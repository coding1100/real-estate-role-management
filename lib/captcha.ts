import { NextRequest } from "next/server";

const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY;

export async function verifyRecaptchaToken(
  token: string | null,
  options?: { minScore?: number; expectedAction?: string },
) {
  const minScore =
    typeof options?.minScore === "number" && Number.isFinite(options.minScore)
      ? options.minScore
      : 0.5;
  // If no secret configured, skip verification (dev mode)
  if (!RECAPTCHA_SECRET_KEY) {
    return {
      ok: true,
      score: 1,
      skipped: true,
      action: null as string | null,
      reason: "secret_missing" as const,
    };
  }

  if (!token) {
    return {
      ok: false,
      score: 0,
      skipped: false,
      action: null as string | null,
      reason: "missing_token" as const,
    };
  }

  const params = new URLSearchParams();
  params.append("secret", RECAPTCHA_SECRET_KEY);
  params.append("response", token);

  const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const data = (await res.json()) as {
    success: boolean;
    score?: number;
    action?: string;
    "error-codes"?: string[];
  };

  const score = data.score ?? 0;
  const action = typeof data.action === "string" ? data.action : null;
  const actionMatches =
    !options?.expectedAction || !action
      ? true
      : action === options.expectedAction;

  return {
    ok: data.success && score >= minScore && actionMatches,
    score,
    action,
    reason: !data.success
      ? ("google_rejected" as const)
      : !actionMatches
        ? ("action_mismatch" as const)
        : score < minScore
          ? ("low_score" as const)
          : ("ok" as const),
    skipped: false,
    raw: data,
  };
}

export async function extractClientIp(req: NextRequest) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim();
  }
  // NextRequest in the App Router does not expose req.ip typed,
  // so rely only on x-forwarded-for for now.
  return null;
}

