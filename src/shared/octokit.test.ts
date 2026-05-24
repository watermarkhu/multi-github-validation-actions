import { describe, expect, it } from "vitest";
import { normalizeApiBaseUrl } from "./octokit.js";

describe("normalizeApiBaseUrl", () => {
  it("maps github.com to api.github.com", () => {
    expect(normalizeApiBaseUrl("https://github.com")).toBe(
      "https://api.github.com"
    );
    expect(normalizeApiBaseUrl("https://github.com/")).toBe(
      "https://api.github.com"
    );
  });

  it("appends /api/v3 to GHES URLs", () => {
    expect(normalizeApiBaseUrl("https://ghes.example")).toBe(
      "https://ghes.example/api/v3"
    );
    expect(normalizeApiBaseUrl("https://ghes.example/")).toBe(
      "https://ghes.example/api/v3"
    );
  });
});
