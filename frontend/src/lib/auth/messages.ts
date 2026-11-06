import { ApiError } from "@/services/api-client";

/** Human messages for backend error codes. The backend never says whether an email exists on login. */
const MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: "That email and password don't match. Check them and try again.",
  EMAIL_TAKEN: "An account with this email already exists.",
  RATE_LIMITED: "Too many attempts. Please wait a minute and try again.",
  CSRF_FAILED: "Security check failed. Refresh the page and try again.",
  RESET_TOKEN_INVALID: "This reset link has expired or was already used. Request a new one.",
  EMAIL_DELIVERY_FAILED: "We couldn't send the email just now. Please try again in a few minutes.",
  BACKEND_UNREACHABLE: "Can't reach the RANNAMATE server. Make sure the backend is running, then try again.",
  TIMEOUT: "The server took too long to answer. Please try again.",
  // Google redirects back with ?error=
  GOOGLE_CANCELLED: "Google sign-in was cancelled.",
  GOOGLE_EMAIL_EXISTS: "This email already has a RANNAMATE password. Sign in with your password, then connect Google from your profile.",
  GOOGLE_EMAIL_UNVERIFIED: "Your Google email address isn't verified, so it can't be used to sign in.",
  GOOGLE_STATE_INVALID: "Google sign-in timed out or was opened in another tab. Please try again.",
  GOOGLE_NOT_CONFIGURED: "Google sign-in isn't set up on this server.",
  GOOGLE_UNREACHABLE: "Couldn't reach Google. Please try again.",
  GOOGLE_EXCHANGE_FAILED: "Google sign-in could not be completed. Please try again.",
  GOOGLE_INVALID_TOKEN: "Google sign-in could not be verified. Please try again.",
  GOOGLE_FAILED: "Google sign-in could not be completed. Please try again.",
  SESSION_ENDED: "You were signed out. Please sign in again.",
};

export function authMessage(e: unknown): string {
  if (e instanceof ApiError) {
    if (MESSAGES[e.code]) return MESSAGES[e.code];
    if (e.code === "DATABASE_NOT_CONFIGURED" || e.code === "SCHEMA_NOT_VERIFIED") return `Accounts aren't available yet: ${e.message}`;
    return e.message || "Something went wrong. Please try again.";
  }
  return "Something went wrong. Please try again.";
}
export const codeMessage = (code: string | null) => (code ? MESSAGES[code] ?? "Sign-in could not be completed. Please try again." : null);

/** field-level messages from a 400 VALIDATION_FAILED response (the backend sends plain sentences) */
export function fieldErrors(e: unknown): Record<string, string> {
  if (!(e instanceof ApiError) || e.code !== "VALIDATION_FAILED" || !Array.isArray(e.details)) return {};
  const out: Record<string, string> = {};
  for (const m of e.details as string[]) {
    if (typeof m !== "string") continue;
    const k = /email/i.test(m) ? "email" : /password/i.test(m) ? "password" : /name/i.test(m) ? "name" : /terms/i.test(m) ? "terms" : "form";
    out[k] ??= m.charAt(0).toUpperCase() + m.slice(1);
  }
  return out;
}
