import type { Metadata } from "next";
import { Suspense } from "react";
import { SignUpForm } from "@/components/auth/SignUpForm";

export const metadata: Metadata = { title: "Sign Up — RANNAMATE", description: "Join RANNAMATE and discover a smarter, more exciting way to cook." };

export default function SignUpPage() {
  return <Suspense><SignUpForm /></Suspense>;
}
