import * as core from "@actions/core";
import * as github from "@actions/github";
import { Octokit } from "@octokit/rest";
import { parseMarker, type UpstreamCheckMarker } from "../shared/marker.js";
import { createAppOctokit, normalizeApiBaseUrl } from "../shared/octokit.js";
import { buildCheckRunUpdate, isReportState } from "./state.js";

async function run(): Promise<void> {
  const state = core.getInput("state", { required: true });
  if (!isReportState(state)) {
    core.setFailed(
      `invalid state '${state}'. Must be one of: started, in_progress, success, failure, cancelled, skipped.`
    );
    return;
  }

  const progressInput = core.getInput("progress");
  const progress =
    progressInput.length > 0 ? Number.parseInt(progressInput, 10) : undefined;
  if (progress !== undefined && Number.isNaN(progress)) {
    core.setFailed(`invalid progress '${progressInput}': expected an integer.`);
    return;
  }

  const summary = core.getInput("summary") || undefined;
  const detailsUrlInput = core.getInput("details_url") || undefined;
  const appId = core.getInput("app_id", { required: true });
  const privateKey = core.getInput("private_key", { required: true });

  const ctx = github.context;
  const downstreamServer = process.env.GITHUB_SERVER_URL ?? "https://github.com";
  const defaultDetailsUrl = `${downstreamServer}/${ctx.repo.owner}/${ctx.repo.repo}/actions/runs/${ctx.runId}`;
  const detailsUrl = detailsUrlInput ?? defaultDetailsUrl;

  const downstreamToken = process.env.GITHUB_TOKEN ?? "";
  const downstreamOctokit = new Octokit({
    baseUrl: normalizeApiBaseUrl(downstreamServer),
    auth: downstreamToken || undefined,
  });

  const sha = resolveDownstreamSha(ctx);
  if (!sha) {
    core.notice("could not resolve a commit SHA from the workflow context — skipping report.");
    return;
  }

  const commitMessage = await fetchCommitMessage(
    downstreamOctokit,
    ctx.repo.owner,
    ctx.repo.repo,
    sha
  );
  if (commitMessage === null) {
    core.notice(`could not fetch commit ${sha} — skipping report.`);
    return;
  }

  const marker = parseMarker(commitMessage);
  if (!marker) {
    core.notice(
      "no upstream-check marker found on the triggering commit — skipping report (this is expected for native downstream commits)."
    );
    return;
  }

  await updateUpstreamCheck(marker, {
    appId,
    privateKey,
    state,
    progress,
    summary,
    detailsUrl,
  });
}

function resolveDownstreamSha(ctx: typeof github.context): string | undefined {
  const event = ctx.payload as Record<string, unknown> | undefined;
  if (event) {
    const wfRun = event.workflow_run as { head_sha?: string } | undefined;
    if (wfRun?.head_sha) return wfRun.head_sha;
    const pr = event.pull_request as
      | { head?: { sha?: string } }
      | undefined;
    if (pr?.head?.sha) return pr.head.sha;
    const headCommit = event.head_commit as { id?: string } | undefined;
    if (headCommit?.id) return headCommit.id;
  }
  return ctx.sha || process.env.GITHUB_SHA || undefined;
}

async function fetchCommitMessage(
  octokit: Octokit,
  owner: string,
  repo: string,
  sha: string
): Promise<string | null> {
  try {
    const { data } = await octokit.git.getCommit({
      owner,
      repo,
      commit_sha: sha,
    });
    return data.message;
  } catch (err) {
    core.warning(
      `failed to fetch commit ${sha}: ${(err as Error).message}`
    );
    return null;
  }
}

interface UpdateInput {
  appId: string;
  privateKey: string;
  state: Parameters<typeof buildCheckRunUpdate>[0]["state"];
  progress?: number;
  summary?: string;
  detailsUrl: string;
}

async function updateUpstreamCheck(
  marker: UpstreamCheckMarker,
  input: UpdateInput
): Promise<void> {
  let upstream: Octokit;
  try {
    upstream = await createAppOctokit({
      appId: input.appId,
      privateKey: input.privateKey,
      baseUrl: marker.server,
      owner: marker.owner,
      repo: marker.repo,
    });
  } catch (err) {
    core.warning(
      `failed to authenticate to upstream ${marker.server}: ${(err as Error).message}`
    );
    return;
  }

  const update = buildCheckRunUpdate({
    state: input.state,
    progress: input.progress,
    summary: input.summary,
    detailsUrl: input.detailsUrl,
  });

  try {
    await upstream.checks.update({
      owner: marker.owner,
      repo: marker.repo,
      check_run_id: marker.check_run_id,
      ...update,
    });
    core.info(
      `updated upstream check ${marker.check_run_url} → ${input.state}` +
        (input.progress !== undefined ? ` (${input.progress}%)` : "")
    );
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 404) {
      core.warning(
        `upstream check ${marker.check_run_id} not found at ${marker.server}/${marker.owner}/${marker.repo} — skipping.`
      );
      return;
    }
    core.setFailed(
      `failed to update upstream check: ${(err as Error).message}`
    );
  }
}

run().catch((err) => {
  core.setFailed(err instanceof Error ? err.message : String(err));
});
