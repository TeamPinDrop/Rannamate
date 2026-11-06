/** Pages of the sign-in experience (shown without the site navbar/footer). */
export const AUTH_ROUTES = ["/sign-in", "/sign-up", "/forgot-password", "/reset-password", "/auth/callback"];
export const isAuthRoute = (path: string | null | undefined) => !!path && AUTH_ROUTES.some((r) => path === r || path.startsWith(`${r}/`));

/** Only same-site paths survive ("/profile" yes; "//evil.com", "https://…", auth pages themselves → fallback). */
export function safeReturnTo(v: string | null | undefined, fallback = "/"): string {
  if (!v || !v.startsWith("/") || v.startsWith("//") || v.startsWith("/\\") || v.length > 300 || /[\r\n]/.test(v)) return fallback;
  if (isAuthRoute(v.split("?")[0])) return fallback;
  return v;
}

/** "/sign-in?returnTo=…" — used by protected pages */
export const signInHref = (returnTo?: string | null) => {
  const r = safeReturnTo(returnTo, "");
  return r && r !== "/" ? `/sign-in?returnTo=${encodeURIComponent(r)}` : "/sign-in";
};
/** carry returnTo between Sign In ↔ Sign Up ↔ Forgot password */
export const withReturnTo = (path: string, returnTo: string | null) => {
  const r = safeReturnTo(returnTo, "");
  return r && r !== "/" ? `${path}?returnTo=${encodeURIComponent(r)}` : path;
};
