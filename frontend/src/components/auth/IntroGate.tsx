"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { INTRO_DONE_EVENT } from "@/components/Preloader";

/**
 * Opening the site: intro first, then Sign In.
 * Once per browser session, right after the intro finishes (or is skipped), a visitor who opened the
 * home page and isn't signed in is taken to /sign-in. Signed-in users stay where they are, and every
 * public page is still reachable afterwards (the logo/Home link works as usual).
 */
export function IntroGate() {
  const { status } = useAuth();
  const router = useRouter();
  const path = usePathname();
  const [introDone, setIntroDone] = useState(false);
  const [handled, setHandled] = useState(false);

  useEffect(() => {
    const on = () => setIntroDone(true);
    window.addEventListener(INTRO_DONE_EVENT, on);
    return () => window.removeEventListener(INTRO_DONE_EVENT, on);
  }, []);

  useEffect(() => {
    if (!introDone || handled || status === "loading") return; // wait until we know who's here
    setHandled(true);
    if (status !== "signed-in" && status !== "disabled" && path === "/") router.replace("/sign-in");
  }, [introDone, handled, status, path, router]);

  return null;
}
