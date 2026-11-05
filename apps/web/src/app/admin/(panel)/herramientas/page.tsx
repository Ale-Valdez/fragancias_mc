import { adminProductListSchema, catalogBrandListSchema } from "@fmc/shared";
import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminApiError, adminJson } from "@/lib/admin-api";
import { requireUser } from "@/lib/auth";
import { CatalogTools } from "../catalog-tools";
import type { ProductList } from "../product-labels";

export const instant = false;

export const metadata: Metadata = {
  title: "Herramientas · Fragancias MC",
  robots: { index: false, follow: false },
};

type BrandRow = {
  id: number;
  name: string;
};

export default function ToolsPage() {
  return (
    <main className="flex flex-1 flex-col">
      <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}>
        <Tools />
      </Suspense>
    </main>
  );
}

async function Tools() {
  await requireUser();

  let brands: unknown;
  let products: unknown;
  try {
    [brands, products] = await Promise.all([
      adminJson("/brands", catalogBrandListSchema),
      adminJson("/products?limit=100&sort=name", adminProductListSchema),
    ]);
  } catch (error) {
    if (error instanceof AdminApiError) {
      return <p className="text-sm text-danger">No se pudieron cargar las herramientas.</p>;
    }
    throw error;
  }

  return (
    <div className="w-full max-w-5xl">
      <h1 className="text-2xl font-semibold">Herramientas</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Ajuste masivo de precios e importación CSV. El listado para el día a día está en Productos.
      </p>
      <div className="mt-8">
        <CatalogTools brands={brands as BrandRow[]} products={products as ProductList} />
      </div>
    </div>
  );
}
