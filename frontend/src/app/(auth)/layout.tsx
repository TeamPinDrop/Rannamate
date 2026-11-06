import { AuthShell } from "@/components/auth/AuthShell";

/** Sign In, Sign Up, Forgot & Reset password share one frame, so moving between them never reloads the stage. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <AuthShell>{children}</AuthShell>;
}
