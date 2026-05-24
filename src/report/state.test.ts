import { describe, expect, it } from "vitest";
import { buildCheckRunUpdate, isReportState } from "./state.js";

const fixedNow = () => new Date("2026-05-24T10:00:00Z");

describe("isReportState", () => {
  it("accepts the documented states", () => {
    for (const s of [
      "started",
      "in_progress",
      "success",
      "failure",
      "cancelled",
      "skipped",
    ]) {
      expect(isReportState(s)).toBe(true);
    }
  });

  it("rejects unknown states", () => {
    expect(isReportState("queued")).toBe(false);
    expect(isReportState("")).toBe(false);
  });
});

describe("buildCheckRunUpdate", () => {
  it("started → in_progress with started_at and details_url", () => {
    const u = buildCheckRunUpdate({
      state: "started",
      detailsUrl: "https://example/run/1",
      now: fixedNow,
    });
    expect(u.status).toBe("in_progress");
    expect(u.started_at).toBe("2026-05-24T10:00:00.000Z");
    expect(u.details_url).toBe("https://example/run/1");
    expect(u.completed_at).toBeUndefined();
    expect(u.conclusion).toBeUndefined();
  });

  it("in_progress with progress renders a progress bar in summary", () => {
    const u = buildCheckRunUpdate({
      state: "in_progress",
      progress: 50,
      now: fixedNow,
    });
    expect(u.status).toBe("in_progress");
    expect(u.output?.summary).toContain("50%");
    expect(u.output?.summary).toMatch(/\[#+\.+\]/);
  });

  it("in_progress clamps invalid progress values", () => {
    expect(
      buildCheckRunUpdate({ state: "in_progress", progress: 150 }).output
        ?.summary
    ).toContain("100%");
    expect(
      buildCheckRunUpdate({ state: "in_progress", progress: -5 }).output
        ?.summary
    ).toContain("0%");
  });

  it.each([
    ["success", "success"],
    ["failure", "failure"],
    ["cancelled", "cancelled"],
    ["skipped", "skipped"],
  ] as const)("%s → completed/%s with completed_at", (state, conclusion) => {
    const u = buildCheckRunUpdate({ state, now: fixedNow });
    expect(u.status).toBe("completed");
    expect(u.conclusion).toBe(conclusion);
    expect(u.completed_at).toBe("2026-05-24T10:00:00.000Z");
  });

  it("uses caller-provided summary when supplied", () => {
    const u = buildCheckRunUpdate({
      state: "success",
      summary: "All tests passed",
    });
    expect(u.output?.summary).toBe("All tests passed");
  });
});
