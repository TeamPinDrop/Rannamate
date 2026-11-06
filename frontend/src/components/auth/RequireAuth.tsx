"use client";
import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { signInHref } from "@/lib/auth/routes";

/**
 * Wrap a page that needs an account. Signed-out visitors go to Sign In and come back here afterwards.
 * (The backend enforces this too — this is just the friendly front door.)
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status, retry, signedOutByUser } = useAuth();
  const router = useRouter();
  const path = usePathname();
  const qs = useSearchParams().toString();
  useEffect(() => {
    if (status === "signed-out") router.replace(signedOutByUser ? "/" : signInHref(`${path}${qs ? `?${qs}` : ""}`));
  }, [status, path, qs, router, signedOutByUser]);

  if (status === "signed-in") return <>{children}</>;
  return (
    <div className="mx-auto flex min-h-[70svh] max-w-md flex-col items-center justify-center px-6 pt-24 text-center" role="status">
      {status === "offline" ? (
        <div className="glass-strong rounded-[2rem] p-8">
          <p className="font-display text-xl font-semibold text-forest">Can&apos;t check your sign-in</p>
          <p className="mt-2 text-sm text-forest/75">The RANNAMATE server isn&apos;t reachable right now. Start the backend, then try again.</p>
          <button onClick={retry} className="btn-primary mt-5"><RefreshCw className="h-4 w-4" /> Try again</button>
        </div>
      ) : (
        <>
          <Loader2 className="h-7 w-7 animate-spin text-burgundy" aria-hidden />
          <p className="mt-3 text-sm font-semibold text-forest/70">{status === "signed-out" ? (signedOutByUser ? "Signed out. See you soon!" : "Taking you to Sign In…") : "Checking your account…"}</p>
        </>
      )}
    </div>
  );
}
