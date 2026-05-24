import { describe, expect, it } from "vitest";
import {
  appendMarker,
  formatMarker,
  parseMarker,
  type UpstreamCheckMarker,
} from "./marker.js";

const sample: UpstreamCheckMarker = {
  server: "https://github.example",
  owner: "octo",
  repo: "repo",
  check_run_id: 12345,
  check_run_url: "https://github.example/octo/repo/runs/12345",
};

describe("marker", () => {
  it("round-trips through format/parse", () => {
    const formatted = formatMarker(sample);
    const parsed = parseMarker(`subject\n\nbody\n\n${formatted}\n`);
    expect(parsed).toEqual(sample);
  });

  it("returns null when no marker present", () => {
    expect(parseMarker("plain commit message")).toBeNull();
  });

  it("returns null when JSON is malformed", () => {
    expect(parseMarker("<!-- upstream-check {bad json} -->")).toBeNull();
  });

  it("returns null when required fields are missing", () => {
    const bad = '<!-- upstream-check {"server":"x"} -->';
    expect(parseMarker(bad)).toBeNull();
  });

  it("ignores non-marker HTML comments", () => {
    expect(parseMarker("<!-- something else -->")).toBeNull();
  });

  it("appendMarker preserves the original message and replaces existing markers", () => {
    const original = "fix: thing\n\nlong body";
    const once = appendMarker(original, sample);
    expect(once).toContain("fix: thing");
    expect(once).toContain("long body");
    expect(parseMarker(once)).toEqual(sample);

    const replaced = appendMarker(once, { ...sample, check_run_id: 999 });
    const occurrences = replaced.match(/upstream-check/g) ?? [];
    expect(occurrences.length).toBe(1);
    expect(parseMarker(replaced)?.check_run_id).toBe(999);
  });

  it("parses markers across multi-line bodies", () => {
    const msg =
      "title\n\nfirst paragraph\n\nsecond paragraph\n\n" + formatMarker(sample);
    expect(parseMarker(msg)).toEqual(sample);
  });
});
