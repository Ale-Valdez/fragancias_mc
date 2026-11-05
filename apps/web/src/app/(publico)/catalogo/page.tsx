import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { CatalogApiError, listBrands, listProducts, parseCatalogSearch } from "@/lib/catalog-api";
import { Filtros } from "./filtros";
import { Grilla } from "./grilla";

export const metadata: Metadata = {
  title: "Catálogo",
  description: "Catálogo de extractos de perfume de 60 ml.",
};

type CatalogoPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function CatalogoPage({ searchParams }: CatalogoPageProps) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Cargando el catálogo…</p>}>
      <Catalogo searchParams={searchParams} />
    </Suspense>
  );
}

async function Catalogo({ searchParams }: CatalogoPageProps) {
  await connection();
  const query = parseCatalogSearch(await searchParams);

  try {
    const [brands, list] = await Promise.all([listBrands(), listProducts(query)]);
    return (
      <div className="flex flex-col gap-8">
        <h1 className="text-3xl font-light">Catálogo</h1>
        <Filtros query={query} brands={brands} />
        <Grilla query={query} list={list} />
      </div>
    );
  } catch (error) {
    if (error instanceof CatalogApiError) {
      return <p className="text-sm text-gold-bright">No se pudo cargar el catálogo.</p>;
    }
    throw error;
  }
}
