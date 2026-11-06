import type { Metadata } from "next";
import { Suspense } from "react";
import { GoogleCallback } from "@/components/auth/GoogleCallback";

export const metadata: Metadata = { title: "Signing in — RANNAMATE", robots: { index: false } };

export default function AuthCallbackPage() {
  return <Suspense><GoogleCallback /></Suspense>;
}
