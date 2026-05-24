export const REPORT_STATES = [
  "started",
  "in_progress",
  "success",
  "failure",
  "cancelled",
  "skipped",
] as const;

export type ReportState = (typeof REPORT_STATES)[number];

export function isReportState(value: string): value is ReportState {
  return (REPORT_STATES as readonly string[]).includes(value);
}

export interface CheckRunUpdate {
  status: "queued" | "in_progress" | "completed";
  conclusion?:
    | "success"
    | "failure"
    | "cancelled"
    | "skipped"
    | "neutral"
    | "timed_out"
    | "action_required"
    | "stale";
  started_at?: string;
  completed_at?: string;
  details_url?: string;
  output?: {
    title: string;
    summary: string;
  };
}

export interface BuildUpdateInput {
  state: ReportState;
  progress?: number;
  summary?: string;
  detailsUrl?: string;
  now?: () => Date;
}

const TERMINAL: Record<string, CheckRunUpdate["conclusion"]> = {
  success: "success",
  failure: "failure",
  cancelled: "cancelled",
  skipped: "skipped",
};

function clampProgress(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function progressBar(percent: number): string {
  const filled = Math.round((percent / 100) * 20);
  return `\`[${"#".repeat(filled)}${".".repeat(20 - filled)}] ${percent}%\``;
}

export function buildCheckRunUpdate(input: BuildUpdateInput): CheckRunUpdate {
  const now = (input.now ?? (() => new Date()))().toISOString();

  if (input.state === "started") {
    return {
      status: "in_progress",
      started_at: now,
      details_url: input.detailsUrl,
      output: {
        title: "Started",
        summary: input.summary ?? "Downstream validation started.",
      },
    };
  }

  if (input.state === "in_progress") {
    const lines: string[] = [];
    if (input.progress !== undefined) {
      const pct = clampProgress(input.progress);
      lines.push(progressBar(pct));
    }
    if (input.summary) lines.push(input.summary);
    return {
      status: "in_progress",
      details_url: input.detailsUrl,
      output: {
        title: "In progress",
        summary: lines.length > 0 ? lines.join("\n\n") : "Running.",
      },
    };
  }

  const conclusion = TERMINAL[input.state];
  if (!conclusion) {
    throw new Error(`unhandled report state: ${input.state}`);
  }

  return {
    status: "completed",
    conclusion,
    completed_at: now,
    details_url: input.detailsUrl,
    output: {
      title: input.state[0]!.toUpperCase() + input.state.slice(1),
      summary: input.summary ?? `Downstream validation ${input.state}.`,
    },
  };
}
