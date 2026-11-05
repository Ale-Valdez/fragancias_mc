"use client";

import type { CatalogBrand, CatalogListQuery } from "@fmc/shared";
import Link from "next/link";
import { useState } from "react";
import { GENDER_LABEL, type Gender } from "@/lib/labels";

const GENDERS: Gender[] = ["femenino", "masculino", "unisex"];

const SORTS: { value: CatalogListQuery["sort"]; label: string }[] = [
  { value: "sort", label: "Recomendados" },
  { value: "name", label: "Nombre" },
  { value: "price", label: "Precio" },
  { value: "newest", label: "Más nuevos" },
];

const fieldClassName =
  "h-11 border border-rule bg-elevated px-3 text-sm tracking-normal text-ink normal-case focus:border-gold focus:outline-none";

export function Filtros({ query, brands }: { query: CatalogListQuery; brands: CatalogBrand[] }) {
  const [open, setOpen] = useState(false);
  const filtered = Boolean(query.q || query.gender || query.brand || query.sort !== "sort");
  const narrowed = Boolean(query.gender || query.brand || query.sort !== "sort");

  return (
    <form action="/catalogo" method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_auto]">
      <label className="flex flex-col gap-1 text-xs tracking-[0.14em] text-muted uppercase">
        Buscar
        <input
          type="search"
          name="q"
          defaultValue={query.q ?? ""}
          placeholder="Nombre o marca"
          enterKeyHint="search"
          className={fieldClassName}
        />
      </label>
      <div className="flex items-center gap-3 sm:hidden">
        <button
          type="button"
          className="inline-flex h-11 flex-1 items-center justify-between border border-rule px-3 text-sm"
          aria-expanded={open}
          aria-controls="catalogo-filtros"
          onClick={() => setOpen((value) => !value)}
        >
          <span>{open ? "Ocultar filtros" : "Filtros"}</span>
          {narrowed ? <span className="text-xs tracking-[0.14em] text-gold uppercase">Activos</span> : null}
        </button>
        {filtered ? (
          <Link href="/catalogo" className="text-sm text-gold-bright underline underline-offset-4">
            Limpiar
          </Link>
        ) : null}
      </div>
      <div id="catalogo-filtros" className={`${open ? "grid" : "hidden"} gap-3 sm:contents`}>
        <label className="flex flex-col gap-1 text-xs tracking-[0.14em] text-muted uppercase">
          Género
          <select name="gender" defaultValue={query.gender ?? ""} className={fieldClassName}>
            <option value="">Todos</option>
            {GENDERS.map((gender) => (
              <option key={gender} value={gender}>
                {GENDER_LABEL[gender]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs tracking-[0.14em] text-muted uppercase">
          Marca
          <select name="brand" defaultValue={query.brand ?? ""} className={fieldClassName}>
            <option value="">Todas</option>
            {brands.map((brand) => (
              <option key={brand.id} value={brand.slug}>
                {brand.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs tracking-[0.14em] text-muted uppercase">
          Orden
          <select name="sort" defaultValue={query.sort} className={fieldClassName}>
            {SORTS.map((sort) => (
              <option key={sort.value} value={sort.value}>
                {sort.label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-3">
          <button type="submit" className="h-11 bg-gold px-5 text-sm font-medium text-page hover:bg-gold-bright">
            Filtrar
          </button>
          {filtered ? (
            <Link href="/catalogo" className="hidden pb-3 text-sm text-gold-bright underline underline-offset-4 sm:inline">
              Limpiar
            </Link>
          ) : null}
        </div>
      </div>
    </form>
  );
}
