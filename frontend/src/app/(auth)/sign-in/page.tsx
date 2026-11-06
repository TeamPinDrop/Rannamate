import type { Metadata } from "next";
import { Suspense } from "react";
import { SignInForm } from "@/components/auth/SignInForm";

export const metadata: Metadata = { title: "Sign In — RANNAMATE", description: "Sign in to RANNAMATE and continue your culinary journey." };

export default function SignInPage() {
  return <Suspense><SignInForm /></Suspense>;
}
