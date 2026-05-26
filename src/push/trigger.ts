import type * as github from "@actions/github";

export interface TriggerInfo {
  sha: string;
  prNumber?: number;
  action?: string;
}

export function resolveTrigger(ctx: typeof github.context): TriggerInfo {
  const payload = ctx.payload as {
    action?: string;
    pull_request?: { head?: { sha?: string }; number?: number };
    workflow_run?: { head_sha?: string };
  };

  const sha =
    payload.pull_request?.head?.sha ??
    payload.workflow_run?.head_sha ??
    ctx.sha;

  return {
    sha,
    prNumber: payload.pull_request?.number,
    action: payload.action,
  };
}
