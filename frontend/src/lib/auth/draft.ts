"use client";
import { useCallback, useEffect, useState } from "react";

/**
 * What the visitor typed, kept for this tab only so it survives switching between Sign In,
 * Sign Up and Forgot password (and a refresh). Only the email and name — never passwords.
 */
const KEY = "rannamate:auth-draft";
type Draft = { email?: string; name?: string };
const read = (): Draft => { try { return JSON.parse(sessionStorage.getItem(KEY) ?? "{}"); } catch { return {}; } };

export function useDraftField(field: keyof Draft): [string, (v: string) => void] {
  const [value, setValue] = useState("");
  useEffect(() => { setValue(read()[field] ?? ""); }, [field]);
  const set = useCallback((v: string) => {
    setValue(v);
    try { sessionStorage.setItem(KEY, JSON.stringify({ ...read(), [field]: v })); } catch { /* private mode */ }
  }, [field]);
  return [value, set];
}
export const clearDraft = () => { try { sessionStorage.removeItem(KEY); } catch { /* ignore */ } };
