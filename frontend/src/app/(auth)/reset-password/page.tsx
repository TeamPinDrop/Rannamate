import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/auth/RecoverForms";

// the reset token is in the URL — never leak it to other sites through the Referer header
export const metadata: Metadata = { title: "Reset Password — RANNAMATE", referrer: "no-referrer", robots: { index: false } };

export default function ResetPasswordPage() {
  return <Suspense><ResetPasswordForm /></Suspense>;
}
