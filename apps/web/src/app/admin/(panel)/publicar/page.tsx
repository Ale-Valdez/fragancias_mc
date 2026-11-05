import { currentCatalogSchema } from "@fmc/shared";
import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminApiError, adminJson } from "@/lib/admin-api";
import { requireUser } from "@/lib/auth";
import { PublishCatalog } from "../publish-catalog";

export const instant = false;

export const metadata: Metadata = {
  title: "Publicar catálogo · Fragancias MC",
  robots: { index: false, follow: false },
};

type Publication = {
  id: number;
  productCount: number;
  sizeBytes: number;
  createdAt: string;
  url: string;
};

export default function PublishPage() {
  return (
    <main className="flex flex-1 flex-col">
      <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}>
        <Publish />
      </Suspense>
    </main>
  );
}

async function Publish() {
  await requireUser();

  let currentBody: unknown;
  try {
    currentBody = await adminJson("/catalog/current", currentCatalogSchema);
  } catch (error) {
    if (error instanceof AdminApiError) {
      return <p className="text-sm text-danger">No se pudo cargar el catálogo publicado.</p>;
    }
    throw error;
  }

  const published = currentBody as { current: Publication | null; light: Publication | null };
  return (
    <div className="w-full max-w-xl">
      <PublishCatalog dark={published.current} light={published.light ?? null} />
    </div>
  );
}
