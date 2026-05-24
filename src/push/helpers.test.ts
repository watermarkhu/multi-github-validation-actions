import { describe, expect, it } from "vitest";
import {
  buildBranchName,
  buildCommitUrl,
  buildRemoteUrl,
  isSameTarget,
  parsePrLabels,
  parseRepository,
  trimTrailingSlash,
} from "./helpers.js";

describe("buildRemoteUrl", () => {
  it("constructs an authenticated git URL with x-access-token", () => {
    expect(
      buildRemoteUrl("https://ghes.example", "octo", "repo", "tkn-abc")
    ).toBe("https://x-access-token:tkn-abc@ghes.example/octo/repo.git");
  });

  it("strips path components from server_url", () => {
    expect(
      buildRemoteUrl("https://ghes.example/base/", "octo", "repo", "t")
    ).toBe("https://x-access-token:t@ghes.example/octo/repo.git");
  });
});

describe("buildBranchName", () => {
  it("uses 12-char prefix of sha", () => {
    expect(
      buildBranchName(
        "cross-validation",
        "abcdef0123456789abcdef0123456789abcdef01"
      )
    ).toBe("cross-validation/abcdef012345");
  });

  it("rejects non-hex shas", () => {
    expect(() => buildBranchName("p", "not-a-sha")).toThrow();
  });
});

describe("buildCommitUrl", () => {
  it("renders direct-mode commit URL", () => {
    expect(
      buildCommitUrl("https://ghes.example/", "octo", "repo", "deadbeef")
    ).toBe("https://ghes.example/octo/repo/commit/deadbeef");
  });
});

describe("parsePrLabels", () => {
  it("splits whitespace and filters empties", () => {
    expect(parsePrLabels("foo  bar\nbaz")).toEqual(["foo", "bar", "baz"]);
    expect(parsePrLabels("")).toEqual([]);
    expect(parsePrLabels(undefined)).toEqual([]);
  });
});

describe("trimTrailingSlash", () => {
  it("removes trailing slashes", () => {
    expect(trimTrailingSlash("https://x/")).toBe("https://x");
    expect(trimTrailingSlash("https://x///")).toBe("https://x");
    expect(trimTrailingSlash("https://x")).toBe("https://x");
  });
});

describe("parseRepository", () => {
  it("splits owner/repo", () => {
    expect(parseRepository("octo/repo")).toEqual({ owner: "octo", repo: "repo" });
  });

  it("strips a trailing .git", () => {
    expect(parseRepository("octo/repo.git")).toEqual({ owner: "octo", repo: "repo" });
  });

  it("rejects malformed input", () => {
    expect(() => parseRepository("just-a-name")).toThrow();
    expect(() => parseRepository("a/b/c")).toThrow();
    expect(() => parseRepository("")).toThrow();
  });
});

describe("isSameTarget", () => {
  it("matches identical server + repo regardless of trailing slash and case", () => {
    expect(
      isSameTarget(
        "https://github.com",
        "octo/repo",
        "https://GitHub.com/",
        "Octo/Repo"
      )
    ).toBe(true);
  });

  it("differs when server differs", () => {
    expect(
      isSameTarget(
        "https://github.com",
        "octo/repo",
        "https://ghes.example",
        "octo/repo"
      )
    ).toBe(false);
  });

  it("differs when repo differs", () => {
    expect(
      isSameTarget(
        "https://github.com",
        "octo/repo",
        "https://github.com",
        "octo/other"
      )
    ).toBe(false);
  });
});
