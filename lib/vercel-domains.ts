import { normalizeHostname } from "./hostnames";

const VERCEL_API_BASE_URL = "https://api.vercel.com";
const DEFAULT_TIMEOUT_MS = 8000;

type VercelDomainsConfig = {
  enabled: boolean;
  token: string;
  projectId: string;
  teamId?: string;
  baseUrl: string;
  timeoutMs: number;
};

type JsonObject = Record<string, unknown>;

type RequestOptions = {
  method: "GET" | "POST" | "DELETE";
  path: string;
  body?: JsonObject;
};

type DomainConnectionStatus = {
  hostname: string;
  projectDomain: unknown | null;
  domainConfig: unknown | null;
  verified: boolean;
  verification: unknown[];
  recommendedDnsRecords: Array<{
    type: "A" | "CNAME";
    name: string;
    value: string;
  }>;
  projectDomainError?: {
    code: string;
    message: string;
    statusCode: number;
  };
  domainConfigError?: {
    code: string;
    message: string;
    statusCode: number;
  };
};

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value == null) return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function getConfig(): VercelDomainsConfig {
  return {
    enabled: parseBoolean(process.env.VERCEL_DOMAINS_ENABLED, true),
    token: (process.env.VERCEL_TOKEN ?? "").trim(),
    projectId: (process.env.VERCEL_PROJECT_ID ?? "").trim(),
    teamId: (process.env.VERCEL_TEAM_ID ?? "").trim() || undefined,
    baseUrl:
      trimTrailingSlash(process.env.VERCEL_API_BASE_URL ?? "") ||
      VERCEL_API_BASE_URL,
    timeoutMs: parsePositiveInt(process.env.VERCEL_API_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
  };
}

function toObject(value: unknown): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as JsonObject;
}

function getErrorCode(payload: unknown): string | null {
  const obj = toObject(payload);
  const nested = toObject(obj.error);
  const code = nested.code ?? obj.code;
  return typeof code === "string" && code.trim() ? code.trim() : null;
}

function getErrorMessage(payload: unknown): string | null {
  const obj = toObject(payload);
  const nested = toObject(obj.error);
  const message = nested.message ?? obj.message;
  return typeof message === "string" && message.trim() ? message.trim() : null;
}

function addTeamId(url: URL, teamId: string | undefined): void {
  if (!teamId) return;
  url.searchParams.set("teamId", teamId);
}

export class VercelDomainsError extends Error {
  code: string;
  statusCode: number;
  details?: string;

  constructor(
    code: string,
    message: string,
    statusCode: number,
    details?: string,
  ) {
    super(message);
    this.name = "VercelDomainsError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

function assertConfigured(config: VercelDomainsConfig): void {
  if (!config.enabled) {
    throw new VercelDomainsError(
      "VERCEL_DOMAINS_DISABLED",
      "Vercel domains integration is disabled.",
      503,
    );
  }
  if (!config.token) {
    throw new VercelDomainsError(
      "VERCEL_TOKEN_MISSING",
      "Missing VERCEL_TOKEN environment variable.",
      503,
    );
  }
  if (!config.projectId) {
    throw new VercelDomainsError(
      "VERCEL_PROJECT_ID_MISSING",
      "Missing VERCEL_PROJECT_ID environment variable.",
      503,
    );
  }
}

async function requestJson(options: RequestOptions): Promise<unknown> {
  const config = getConfig();
  assertConfigured(config);

  const url = new URL(`${config.baseUrl}${options.path}`);
  addTeamId(url, config.teamId);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(url.toString(), {
      method: options.method,
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: "no-store",
      signal: controller.signal,
    });

    const text = await response.text();
    let payload: unknown = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = text;
      }
    }

    if (!response.ok) {
      const code = getErrorCode(payload) ?? "VERCEL_API_ERROR";
      const message =
        getErrorMessage(payload) ??
        `Vercel API request failed with HTTP ${response.status}.`;
      const details =
        typeof payload === "string" ? payload.slice(0, 500) : JSON.stringify(payload);
      throw new VercelDomainsError(code, message, response.status, details);
    }

    return payload;
  } catch (error) {
    if (error instanceof VercelDomainsError) {
      throw error;
    }
    if (error instanceof Error && error.name === "AbortError") {
      throw new VercelDomainsError(
        "VERCEL_API_TIMEOUT",
        "Vercel API request timed out.",
        504,
      );
    }
    throw new VercelDomainsError(
      "VERCEL_API_REQUEST_FAILED",
      "Unexpected error while calling Vercel API.",
      502,
      error instanceof Error ? error.message : undefined,
    );
  } finally {
    clearTimeout(timeout);
  }
}

function createProjectPath(
  version: "v9" | "v10",
  projectId: string,
  suffix: string,
): string {
  return `/${version}/projects/${encodeURIComponent(projectId)}${suffix}`;
}

function getVerifiedFlag(projectDomain: unknown): boolean {
  const obj = toObject(projectDomain);
  return Boolean(obj.verified);
}

function getVerificationArray(projectDomain: unknown): unknown[] {
  const obj = toObject(projectDomain);
  return Array.isArray(obj.verification) ? obj.verification : [];
}

function collectRecommendedRecords(
  input: unknown,
  type: "A" | "CNAME",
  defaultName: string,
): DomainConnectionStatus["recommendedDnsRecords"] {
  const out: DomainConnectionStatus["recommendedDnsRecords"] = [];
  const seen = new Set<string>();

  const push = (name: string, value: string) => {
    const normalizedName = name.trim();
    const normalizedValue = value.trim();
    if (!normalizedName || !normalizedValue) return;

    const key = `${type}|${normalizedName}|${normalizedValue}`;
    if (seen.has(key)) return;
    seen.add(key);

    out.push({
      type,
      name: normalizedName,
      value: normalizedValue,
    });
  };

  const visit = (value: unknown, nameHint: string) => {
    if (typeof value === "string") {
      push(nameHint, value);
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => visit(item, nameHint));
      return;
    }

    const obj = toObject(value);
    if (Object.keys(obj).length === 0) return;

    const rawName = obj.name;
    const nextName =
      typeof rawName === "string" && rawName.trim()
        ? rawName.trim()
        : nameHint;

    if (Object.prototype.hasOwnProperty.call(obj, "value")) {
      visit(obj.value, nextName);
    }
  };

  visit(input, defaultName);
  return out;
}

function buildRecommendedDnsRecords(
  domainConfig: unknown,
  hostname: string,
): DomainConnectionStatus["recommendedDnsRecords"] {
  const obj = toObject(domainConfig);
  return [
    ...collectRecommendedRecords(obj.recommendedIPv4, "A", hostname),
    ...collectRecommendedRecords(obj.recommendedCNAME, "CNAME", hostname),
  ];
}

export async function addDomainToProject(hostname: string): Promise<unknown> {
  const config = getConfig();
  assertConfigured(config);

  const normalizedHostname = normalizeHostname(hostname);
  if (!normalizedHostname) {
    throw new VercelDomainsError(
      "VERCEL_DOMAIN_INVALID",
      "Invalid domain hostname.",
      400,
    );
  }

  const path = createProjectPath(
    "v10",
    config.projectId,
    "/domains",
  );

  try {
    return await requestJson({
      method: "POST",
      path,
      body: { name: normalizedHostname },
    });
  } catch (error) {
    if (
      error instanceof VercelDomainsError &&
      [400, 409].includes(error.statusCode)
    ) {
      try {
        return await getProjectDomain(normalizedHostname);
      } catch {
        // keep original error below
      }
    }
    throw error;
  }
}

export async function getProjectDomain(hostname: string): Promise<unknown> {
  const config = getConfig();
  assertConfigured(config);
  const normalizedHostname = normalizeHostname(hostname);
  const path = createProjectPath(
    "v9",
    config.projectId,
    `/domains/${encodeURIComponent(normalizedHostname)}`,
  );
  return requestJson({
    method: "GET",
    path,
  });
}

export async function verifyProjectDomain(hostname: string): Promise<unknown> {
  const config = getConfig();
  assertConfigured(config);
  const normalizedHostname = normalizeHostname(hostname);
  const path = createProjectPath(
    "v9",
    config.projectId,
    `/domains/${encodeURIComponent(normalizedHostname)}/verify`,
  );
  return requestJson({
    method: "POST",
    path,
    body: {},
  });
}

export async function removeProjectDomain(hostname: string): Promise<void> {
  const config = getConfig();
  assertConfigured(config);
  const normalizedHostname = normalizeHostname(hostname);
  const path = createProjectPath(
    "v9",
    config.projectId,
    `/domains/${encodeURIComponent(normalizedHostname)}`,
  );

  try {
    await requestJson({
      method: "DELETE",
      path,
    });
  } catch (error) {
    if (error instanceof VercelDomainsError && error.statusCode === 404) {
      return;
    }
    throw error;
  }
}

export async function getDomainConfiguration(hostname: string): Promise<unknown> {
  const normalizedHostname = normalizeHostname(hostname);
  const path = `/v6/domains/${encodeURIComponent(normalizedHostname)}/config`;
  return requestJson({
    method: "GET",
    path,
  });
}

export async function getDomainConnectionStatus(
  hostname: string,
): Promise<DomainConnectionStatus> {
  const normalizedHostname = normalizeHostname(hostname);
  const [projectDomainResult, domainConfigResult] = await Promise.allSettled([
    getProjectDomain(normalizedHostname),
    getDomainConfiguration(normalizedHostname),
  ]);

  const projectDomain =
    projectDomainResult.status === "fulfilled" ? projectDomainResult.value : null;
  const domainConfig =
    domainConfigResult.status === "fulfilled" ? domainConfigResult.value : null;

  const status: DomainConnectionStatus = {
    hostname: normalizedHostname,
    projectDomain,
    domainConfig,
    verified: getVerifiedFlag(projectDomain),
    verification: getVerificationArray(projectDomain),
    recommendedDnsRecords: buildRecommendedDnsRecords(
      domainConfig,
      normalizedHostname,
    ),
  };

  if (
    projectDomainResult.status === "rejected" &&
    projectDomainResult.reason instanceof VercelDomainsError
  ) {
    status.projectDomainError = {
      code: projectDomainResult.reason.code,
      message: projectDomainResult.reason.message,
      statusCode: projectDomainResult.reason.statusCode,
    };
  }

  if (
    domainConfigResult.status === "rejected" &&
    domainConfigResult.reason instanceof VercelDomainsError
  ) {
    status.domainConfigError = {
      code: domainConfigResult.reason.code,
      message: domainConfigResult.reason.message,
      statusCode: domainConfigResult.reason.statusCode,
    };
  }

  return status;
}
