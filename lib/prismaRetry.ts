const DEFAULT_RETRY_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 150;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientPrismaError(error: unknown): boolean {
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
      ? (error as { code: string }).code
      : "";
  const name =
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    typeof (error as { name?: unknown }).name === "string"
      ? (error as { name: string }).name
      : "";
  const message =
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
      ? (error as { message: string }).message
      : "";

  if (code === "ETIMEDOUT") return true;
  if (code === "P1001") return true; // can't reach database server
  if (code === "EDBHANDLEREXITED") return true;
  if (/DriverAdapterError/i.test(name)) return true;
  if (
    /ETIMEDOUT|timeout|ECONNRESET|connection reset|socket hang up|DbHandler exited|EDBHANDLEREXITED/i.test(
      message,
    )
  ) {
    return true;
  }
  return false;
}

export async function withPrismaRetry<T>(
  operation: () => Promise<T>,
  options?: { attempts?: number; baseDelayMs?: number },
): Promise<T> {
  const attempts = Math.max(1, options?.attempts ?? DEFAULT_RETRY_ATTEMPTS);
  const baseDelayMs = Math.max(10, options?.baseDelayMs ?? DEFAULT_BASE_DELAY_MS);

  let lastError: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const shouldRetry = isTransientPrismaError(error) && i < attempts - 1;
      if (!shouldRetry) break;
      await sleep(baseDelayMs * (i + 1));
    }
  }
  throw lastError;
}

export async function safePrismaRead<T>(
  operationName: string,
  operation: () => Promise<T>,
  fallback: T,
  options?: { attempts?: number; baseDelayMs?: number },
): Promise<T> {
  try {
    return await withPrismaRetry(operation, options);
  } catch (error) {
    console.error(`[prisma] Read failed (${operationName}). Using fallback.`, error);
    return fallback;
  }
}

