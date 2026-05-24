export interface UpstreamCheckMarker {
  server: string;
  owner: string;
  repo: string;
  check_run_id: number;
  check_run_url: string;
}

const MARKER_RE = /<!-- upstream-check (\{[^]*?\}) -->/;

export function formatMarker(marker: UpstreamCheckMarker): string {
  return `<!-- upstream-check ${JSON.stringify(marker)} -->`;
}

export function parseMarker(commitMessage: string): UpstreamCheckMarker | null {
  const match = commitMessage.match(MARKER_RE);
  if (!match || !match[1]) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(match[1]);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as Record<string, unknown>;

  if (
    typeof obj.server !== "string" ||
    typeof obj.owner !== "string" ||
    typeof obj.repo !== "string" ||
    typeof obj.check_run_id !== "number" ||
    typeof obj.check_run_url !== "string"
  ) {
    return null;
  }

  return {
    server: obj.server,
    owner: obj.owner,
    repo: obj.repo,
    check_run_id: obj.check_run_id,
    check_run_url: obj.check_run_url,
  };
}

export function appendMarker(
  commitMessage: string,
  marker: UpstreamCheckMarker
): string {
  const stripped = commitMessage.replace(MARKER_RE, "").trimEnd();
  return `${stripped}\n\n${formatMarker(marker)}\n`;
}
