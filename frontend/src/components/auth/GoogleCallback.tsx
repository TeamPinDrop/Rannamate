"use client";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { safeReturnTo } from "@/lib/auth/routes";
import { AuthCard, Notice } from "./controls";

/** Google sends the browser back here after the backend set the session cookie; we just confirm it. */
export function GoogleCallback() {
  const { status, retry } = useAuth();
  const router = useRouter();
  const returnTo = safeReturnTo(useSearchParams().get("returnTo"));
  useEffect(() => {
    if (status === "signed-in") router.replace(returnTo);
    if (status === "signed-out") router.replace("/sign-in?error=GOOGLE_FAILED");
  }, [status, returnTo, router]);
  return (
    <AuthCard>
      {status === "offline" ? (
        <Notice tone="warn" action={<button onClick={retry} className="font-bold underline underline-offset-4">Try again</button>}>Can&apos;t reach the RANNAMATE server to finish signing in.</Notice>
      ) : (
        <div className="flex flex-col items-center py-10 text-center" role="status">
          <Loader2 className="h-8 w-8 animate-spin text-burgundy" aria-hidden />
          <p className="mt-4 font-display text-xl text-forest">Finishing Google sign-in…</p>
        </div>
      )}
    </AuthCard>
  );
}
