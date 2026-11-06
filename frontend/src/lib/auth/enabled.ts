import { API_URL } from "@/services/api-client";

/**
 * Is sign-in available on this deployment? (client-side only — call after mount)
 *
 *  - NEXT_PUBLIC_AUTH_ENABLED=true / false  → forced on / off
 *  - otherwise: on when the backend has a real address (NEXT_PUBLIC_API_URL=https://…),
 *    or when the site itself runs on this computer (localhost) next to a local backend.
 *
 * So the live site (e.g. rannamate.vercel.app) keeps sign-in hidden until a backend is hosted and
 * NEXT_PUBLIC_API_URL is set in Vercel — no buttons that can't work. Nothing to change on your laptop.
 */
export function authEnabled(): boolean {
  const flag = process.env.NEXT_PUBLIC_AUTH_ENABLED;
  if (flag === "true") return true;
  if (flag === "false") return false;
  const apiIsLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(API_URL);
  if (!apiIsLocal) return true;
  return typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname);
}
