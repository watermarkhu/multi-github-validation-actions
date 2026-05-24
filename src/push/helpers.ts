export function buildRemoteUrl(
  serverUrl: string,
  owner: string,
  repo: string,
  token: string
): string {
  const host = new URL(serverUrl).host;
  return `https://x-access-token:${token}@${host}/${owner}/${repo}.git`;
}

export function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

export function buildBranchName(prefix: string, sha: string): string {
  if (!/^[0-9a-f]{7,}$/i.test(sha)) {
    throw new Error(`expected hex sha, got: ${sha}`);
  }
  return `${prefix}/${sha.slice(0, 12)}`;
}

export function buildCommitUrl(
  serverUrl: string,
  owner: string,
  repo: string,
  sha: string
): string {
  return `${trimTrailingSlash(serverUrl)}/${owner}/${repo}/commit/${sha}`;
}

export function parsePrLabels(input: string | undefined): string[] {
  return (input ?? "").split(/\s+/).filter(Boolean);
}

export function parseRepository(input: string): { owner: string; repo: string } {
  const trimmed = input.trim();
  const match = /^([^\s/]+)\/([^\s/]+?)(?:\.git)?$/.exec(trimmed);
  if (!match) {
    throw new Error(`expected repository in 'owner/repo' form, got: ${input}`);
  }
  return { owner: match[1]!, repo: match[2]! };
}

export function isSameTarget(
  currentServer: string,
  currentRepository: string,
  targetServer: string,
  targetRepository: string
): boolean {
  return (
    trimTrailingSlash(currentServer).toLowerCase() ===
      trimTrailingSlash(targetServer).toLowerCase() &&
    currentRepository.trim().toLowerCase() ===
      targetRepository.trim().toLowerCase()
  );
}
