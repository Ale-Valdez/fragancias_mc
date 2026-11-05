import { catalogBrandListSchema } from "@fmc/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminApiError, adminJson } from "@/lib/admin-api";
import { requireUser } from "@/lib/auth";
import { ProductForm } from "../product-form";
import type { BrandOption } from "../product-values";

export const instant = false;

export const metadata: Metadata = {
  title: "Nuevo producto · Fragancias MC",
  robots: { index: false, follow: false },
};

export default function NewProductPage() {
  return (
    <main className="flex flex-1 flex-col">
      <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}>
        <NewProduct />
      </Suspense>
    </main>
  );
}

async function NewProduct() {
  await requireUser();

  let brands: BrandOption[];
  try {
    brands = (await adminJson("/brands", catalogBrandListSchema)) as BrandOption[];
  } catch (error) {
    if (error instanceof AdminApiError) {
      return <p className="text-sm text-danger">No se pudieron cargar las marcas.</p>;
    }
    throw error;
  }

  return (
    <div className="w-full max-w-xl">
      <Link href="/admin" className="text-sm text-muted underline underline-offset-2">
        Volver al catálogo
      </Link>
      <h1 className="mt-4 text-2xl font-semibold">Nuevo producto</h1>
      <p className="mt-2 text-sm text-muted">Las fotos se cargan después de crearlo.</p>
      {brands.length === 0 ? (
        <p className="mt-4 text-sm text-muted">
          Primero creá una marca en{" "}
          <Link href="/admin/marcas" className="underline underline-offset-2">
            Marcas
          </Link>
          .
        </p>
      ) : (
        <ProductForm brands={brands} />
      )}
    </div>
  );
}
