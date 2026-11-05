import { catalogBrandListSchema } from "@fmc/shared";
import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminApiError, adminJson } from "@/lib/admin-api";
import { requireUser } from "@/lib/auth";
import { BrandManager } from "../brand-manager";

export const instant = false;

export const metadata: Metadata = {
  title: "Marcas · Fragancias MC",
  robots: { index: false, follow: false },
};

type BrandRow = {
  id: number;
  name: string;
};

export default function BrandsPage() {
  return (
    <main className="flex flex-1 flex-col">
      <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}>
        <Brands />
      </Suspense>
    </main>
  );
}

async function Brands() {
  await requireUser();

  let brands: unknown;
  try {
    brands = await adminJson("/brands", catalogBrandListSchema);
  } catch (error) {
    if (error instanceof AdminApiError) {
      return <p className="text-sm text-danger">No se pudieron cargar las marcas.</p>;
    }
    throw error;
  }

  return (
    <div className="w-full max-w-xl">
      <BrandManager brands={brands as BrandRow[]} />
    </div>
  );
}
