import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const instant = false;

export const metadata: Metadata = {
  title: "Ingresar · Fragancias MC",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}>
        <LoginGate />
      </Suspense>
    </main>
  );
}

async function LoginGate() {
  const user = await getCurrentUser();
  if (user) redirect("/admin");
  return <LoginForm />;
}
