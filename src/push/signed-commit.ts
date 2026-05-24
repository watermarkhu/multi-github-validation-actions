import type { Octokit } from "@octokit/rest";

export interface SignedAmendInput {
  octokit: Octokit;
  owner: string;
  repo: string;
  baseSha: string;
  amendedMessage: string;
}

/**
 * Create a signed amended commit on the target repo.
 *
 * Pre-condition: `baseSha` must exist on the target. The caller pushes the
 * unmodified commit to a branch first; this then creates a new commit
 * referencing the same tree + parents but with the amended message. GitHub
 * signs commits created via the Git Data API with the App's GPG identity,
 * which satisfies branch-protection rules that require signed commits.
 *
 * Returns the SHA of the newly-created signed commit.
 */
export async function createSignedAmendedCommit(
  input: SignedAmendInput
): Promise<string> {
  const { octokit, owner, repo, baseSha, amendedMessage } = input;

  const { data: base } = await octokit.git.getCommit({
    owner,
    repo,
    commit_sha: baseSha,
  });

  const { data: created } = await octokit.git.createCommit({
    owner,
    repo,
    message: amendedMessage,
    tree: base.tree.sha,
    parents: base.parents.map((p) => p.sha),
  });

  return created.sha;
}

/**
 * Move a branch ref to a specific commit SHA, creating the ref if it does
 * not already exist. Force-updates when it does (the previous tip belonged
 * to our scratch push).
 */
export async function upsertBranchRef(input: {
  octokit: Octokit;
  owner: string;
  repo: string;
  branch: string;
  sha: string;
}): Promise<void> {
  const { octokit, owner, repo, branch, sha } = input;
  try {
    await octokit.git.updateRef({
      owner,
      repo,
      ref: `heads/${branch}`,
      sha,
      force: true,
    });
  } catch (err) {
    if ((err as { status?: number }).status === 422) {
      await octokit.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${branch}`,
        sha,
      });
      return;
    }
    throw err;
  }
}
