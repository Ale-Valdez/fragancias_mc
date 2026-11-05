import { Suspense, type ReactNode } from "react";
import { requireUser } from "@/lib/auth";
import { PanelShell } from "./panel-shell";

export const instant = false;

async function PanelFrame({ children }: { children: ReactNode }) {
  const user = await requireUser();
  return <PanelShell email={user.email}>{children}</PanelShell>;
}

export default function PanelLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center px-6 text-sm text-muted">
          Cargando…
        </main>
      }
    >
      <PanelFrame>{children}</PanelFrame>
    </Suspense>
  );
}
