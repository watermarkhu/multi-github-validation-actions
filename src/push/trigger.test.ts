import { describe, expect, it } from "vitest";
import { resolveTrigger } from "./trigger.js";

type Ctx = Parameters<typeof resolveTrigger>[0];

function makeCtx(payload: Record<string, unknown>, sha = "ctxsha"): Ctx {
  return { payload, sha } as unknown as Ctx;
}

describe("resolveTrigger", () => {
  it("extracts sha, prNumber, and action from a pull_request payload", () => {
    const ctx = makeCtx({
      action: "synchronize",
      pull_request: { head: { sha: "headsha" }, number: 42 },
    });
    expect(resolveTrigger(ctx)).toEqual({
      sha: "headsha",
      prNumber: 42,
      action: "synchronize",
    });
  });

  it("returns action: 'closed' for a pull_request closed event", () => {
    const ctx = makeCtx({
      action: "closed",
      pull_request: { head: { sha: "headsha" }, number: 7 },
    });
    expect(resolveTrigger(ctx)).toEqual({
      sha: "headsha",
      prNumber: 7,
      action: "closed",
    });
  });

  it("uses workflow_run.head_sha and omits prNumber for workflow_run events", () => {
    const ctx = makeCtx({
      workflow_run: { head_sha: "wfsha" },
    });
    expect(resolveTrigger(ctx)).toEqual({
      sha: "wfsha",
      prNumber: undefined,
      action: undefined,
    });
  });

  it("falls back to ctx.sha for plain push payloads", () => {
    const ctx = makeCtx({}, "pushsha");
    expect(resolveTrigger(ctx)).toEqual({
      sha: "pushsha",
      prNumber: undefined,
      action: undefined,
    });
  });
});
