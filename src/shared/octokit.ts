import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/rest";

export interface AppAuthInput {
  appId: string | number;
  privateKey: string;
  baseUrl: string;
  owner: string;
  repo: string;
}

export async function createAppOctokit(input: AppAuthInput): Promise<Octokit> {
  const baseUrl = normalizeApiBaseUrl(input.baseUrl);

  const appOctokit = new Octokit({
    baseUrl,
    authStrategy: createAppAuth,
    auth: {
      appId: input.appId,
      privateKey: input.privateKey,
    },
  });

  const installation = await appOctokit.apps.getRepoInstallation({
    owner: input.owner,
    repo: input.repo,
  });

  return new Octokit({
    baseUrl,
    authStrategy: createAppAuth,
    auth: {
      appId: input.appId,
      privateKey: input.privateKey,
      installationId: installation.data.id,
    },
  });
}

export function normalizeApiBaseUrl(serverUrl: string): string {
  const trimmed = serverUrl.replace(/\/+$/, "");
  if (trimmed === "https://github.com") {
    return "https://api.github.com";
  }
  return `${trimmed}/api/v3`;
}
