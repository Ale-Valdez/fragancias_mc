import { adminProductListSchema } from "@fmc/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminApiError, adminJson } from "@/lib/admin-api";
import { requireUser } from "@/lib/auth";
import { primaryButtonClassName } from "./form-styles";
import { ProductList } from "./product-list";
import type { ProductList as ProductListData } from "./product-labels";

export const instant = false;

export const metadata: Metadata = {
  title: "Productos · Fragancias MC",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return (
    <main className="flex flex-1 flex-col">
      <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}>
        <ProductHome />
      </Suspense>
    </main>
  );
}

async function ProductHome() {
  await requireUser();

  let products: unknown;
  try {
    products = await adminJson("/products?limit=100&sort=name", adminProductListSchema);
  } catch (error) {
    if (error instanceof AdminApiError) {
      return <p className="text-sm text-danger">No se pudo cargar el catálogo.</p>;
    }
    throw error;
  }

  const list = products as ProductListData;
  return (
    <div className="w-full max-w-5xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">Productos</h1>
        <Link href="/admin/productos/nuevo" className={`${primaryButtonClassName} text-center`}>
          Nuevo producto
        </Link>
      </div>
      <ProductList products={list} />
    </div>
  );
}
