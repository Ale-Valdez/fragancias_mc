import type { CatalogList, CatalogListQuery } from "@fmc/shared";
import Link from "next/link";
import { catalogHref } from "@/lib/catalog-api";
import { formatCount } from "@/lib/labels";
import { VistaCatalogo } from "./vista-catalogo";

export function Grilla({ query, list }: { query: CatalogListQuery; list: CatalogList }) {
  if (list.total === 0) {
    return <p className="text-sm text-muted">Ninguna fragancia coincide con la búsqueda.</p>;
  }

  if (list.items.length === 0) {
    return (
      <p className="text-sm text-muted">
        No hay más fragancias en esta página.{" "}
        <Link href={catalogHref(query, 0)} className="text-gold-bright underline underline-offset-4">
          Volver al inicio
        </Link>
      </p>
    );
  }

  const from = list.offset + 1;
  const to = list.offset + list.items.length;
  const previous = list.offset > 0 ? catalogHref(query, Math.max(0, list.offset - list.limit)) : null;
  const next = list.offset + list.limit < list.total ? catalogHref(query, list.offset + list.limit) : null;

  return (
    <div>
      <VistaCatalogo label={`${from}–${to} de ${formatCount(list.total)}`} items={list.items} />
      {previous || next ? (
        <nav className="mt-10 flex items-center justify-between text-sm" aria-label="Páginas">
          {previous ? (
            <Link href={previous} className="text-gold-bright underline underline-offset-4">
              Anterior
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link href={next} className="text-gold-bright underline underline-offset-4">
              Siguiente
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
