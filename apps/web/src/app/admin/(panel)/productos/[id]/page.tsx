import { adminProductSchema, catalogBrandListSchema } from "@fmc/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminApiError, adminJson } from "@/lib/admin-api";
import { requireUser } from "@/lib/auth";
import { ImageManager, type ProductImage } from "../image-manager";
import { ProductForm } from "../product-form";
import { toFormValues, type BrandOption, type ProductSource } from "../product-values";

export const instant = false;

export const metadata: Metadata = {
  title: "Editar producto · Fragancias MC",
  robots: { index: false, follow: false },
};

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <main className="flex flex-1 flex-col">
      <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}>
        <EditProduct params={params} />
      </Suspense>
    </main>
  );
}

async function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  if (!/^\d+$/.test(id)) return <Missing />;

  let productBody: unknown;
  let brandBody: unknown;
  try {
    [productBody, brandBody] = await Promise.all([
      adminJson(`/products/${id}`, adminProductSchema),
      adminJson("/brands", catalogBrandListSchema),
    ]);
  } catch (error) {
    if (error instanceof AdminApiError && error.status === 404) return <Missing />;
    if (error instanceof AdminApiError) {
      return <p className="text-sm text-danger">No se pudo cargar el producto.</p>;
    }
    throw error;
  }

  const loaded = productBody as ProductSource & { images: ProductImage[] };
  const product = toFormValues(loaded);
  const brands = brandBody as BrandOption[];
  const brandKnown = brands.some((brand) => brand.id === product.brandId);
  const options = brandKnown ? brands : [{ id: product.brandId, name: "Marca eliminada" }, ...brands];

  return (
    <div className="w-full max-w-xl">
      <Link href="/admin" className="text-sm text-muted underline underline-offset-2">
        Volver al catálogo
      </Link>
      <h1 className="mt-4 text-2xl font-semibold">{product.name}</h1>
      <ImageManager productId={product.id} images={loaded.images} />
      <ProductForm brands={options} product={product} />
    </div>
  );
}

function Missing() {
  return (
    <div>
      <p className="text-sm text-muted">Ese producto no existe.</p>
      <Link href="/admin" className="mt-4 inline-block text-sm underline underline-offset-2">
        Volver al catálogo
      </Link>
    </div>
  );
}
