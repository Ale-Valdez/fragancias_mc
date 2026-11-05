import { catalogListQuerySchema } from "@fmc/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CatalogApiError, listProducts } from "@/lib/catalog-api";
import { PdfHero } from "./pdf-button";
import { ProductCard } from "./product-card";

export const metadata: Metadata = {
  title: { absolute: "Fragancias MC" },
  description: "Extractos de perfume de 60 ml, inspirados en fragancias reconocidas.",
};

export default function HomePage() {
  return (
    <>
      <Suspense fallback={<p className="py-24 text-center text-sm text-muted">Cargando…</p>}>
        <PdfHero />
      </Suspense>
      {/* <Suspense fallback={<p className="py-10 text-sm text-muted">Cargando fragancias…</p>}>
        <HomeSelection />
      </Suspense> */}
    </>
  );
}

async function HomeSelection() {
  try {
    const featured = await listProducts(catalogListQuerySchema.parse({ featured: "true", limit: 8, sort: "sort" }));
    const list =
      featured.total > 0
        ? featured
        : await listProducts(catalogListQuerySchema.parse({ limit: 8, sort: "sort" }));
    if (list.items.length === 0) {
      return <p className="text-sm text-muted">Todavía no hay fragancias publicadas.</p>;
    }

    return (
      <section className="pb-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <h2 className="text-2xl font-light">{featured.total > 0 ? "Destacados" : "En el catálogo"}</h2>
          <Link href="/catalogo" className="text-sm text-gold-bright underline underline-offset-4">
            Ver el catálogo
          </Link>
        </div>
        <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
          {list.items.map((product) => (
            <li key={product.id}>
              <ProductCard product={product} />
            </li>
          ))}
        </ul>
      </section>
    );
  } catch (error) {
    if (error instanceof CatalogApiError) {
      return <p className="text-sm text-gold-bright">No se pudo cargar el catálogo.</p>;
    }
    throw error;
  }
}
