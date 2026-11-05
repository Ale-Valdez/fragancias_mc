import {
  catalogBrandListSchema,
  catalogListQuerySchema,
  catalogListSchema,
  catalogProductSchema,
  currentCatalogSchema,
  type CatalogBrand,
  type CatalogList,
  type CatalogListQuery,
  type CatalogProduct,
  type CatalogPublication,
} from "@fmc/shared";
import { cacheLife } from "next/cache";

const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? "http://localhost:4000";
const PAGE_SIZE = 24;

export class CatalogApiError extends Error {
  constructor(readonly status: number) {
    super("catalog_api");
    this.name = "CatalogApiError";
  }
}

type SearchParams = Record<string, string | string[] | undefined>;

function textOf(value: string | string[] | undefined): string | undefined {
  const picked = Array.isArray(value) ? value[0] : value;
  const trimmed = picked?.trim();
  return trimmed ? trimmed : undefined;
}

/** Filtros de `/catalogo`. Ignora `limit` de la URL y usa páginas de 24. */
export function parseCatalogSearch(raw: SearchParams): CatalogListQuery {
  const parsed = catalogListQuerySchema.safeParse({
    q: textOf(raw.q),
    gender: textOf(raw.gender),
    brand: textOf(raw.brand),
    sort: textOf(raw.sort),
    limit: PAGE_SIZE,
    offset: textOf(raw.offset),
  });
  if (!parsed.success) return catalogListQuerySchema.parse({ limit: PAGE_SIZE });
  return { ...parsed.data, limit: PAGE_SIZE };
}

export function catalogHref(query: CatalogListQuery, offset = query.offset): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.gender) params.set("gender", query.gender);
  if (query.brand) params.set("brand", query.brand);
  if (query.sort !== "sort") params.set("sort", query.sort);
  if (offset > 0) params.set("offset", String(offset));
  const qs = params.toString();
  return qs ? `/catalogo?${qs}` : "/catalogo";
}

async function readJson(path: string): Promise<{ status: number; body: unknown }> {
  let response: Response;
  try {
    response = await fetch(`${API_INTERNAL_URL}${path}`);
  } catch {
    throw new CatalogApiError(0);
  }
  const body: unknown = await response.json().catch(() => null);
  return { status: response.status, body };
}

function productQuery(query: CatalogListQuery): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.gender) params.set("gender", query.gender);
  if (query.brand) params.set("brand", query.brand);
  if (query.featured !== undefined) params.set("featured", query.featured ? "true" : "false");
  params.set("sort", query.sort);
  params.set("limit", String(query.limit));
  params.set("offset", String(query.offset));
  return params.toString();
}

export async function getCurrentPublication(): Promise<CatalogPublication | null> {
  "use cache";
  cacheLife("minutes");
  const { status, body } = await readJson("/api/catalog/current");
  if (status !== 200) throw new CatalogApiError(status);
  const parsed = currentCatalogSchema.safeParse(body);
  if (!parsed.success) throw new CatalogApiError(500);
  return parsed.data.current ?? parsed.data.light;
}

export async function listBrands(): Promise<CatalogBrand[]> {
  "use cache";
  cacheLife("minutes");
  const { status, body } = await readJson("/api/catalog/brands");
  if (status !== 200) throw new CatalogApiError(status);
  const parsed = catalogBrandListSchema.safeParse(body);
  if (!parsed.success) throw new CatalogApiError(500);
  return parsed.data;
}

export async function listProducts(query: CatalogListQuery): Promise<CatalogList> {
  "use cache";
  cacheLife("minutes");
  const { status, body } = await readJson(`/api/catalog/products?${productQuery(query)}`);
  if (status !== 200) throw new CatalogApiError(status);
  const parsed = catalogListSchema.safeParse(body);
  if (!parsed.success) throw new CatalogApiError(500);
  return parsed.data;
}

export async function getProduct(slug: string): Promise<CatalogProduct | null> {
  "use cache";
  cacheLife("minutes");
  const { status, body } = await readJson(`/api/catalog/products/${encodeURIComponent(slug)}`);
  if (status === 404) return null;
  if (status !== 200) throw new CatalogApiError(status);
  const parsed = catalogProductSchema.safeParse(body);
  if (!parsed.success) throw new CatalogApiError(500);
  return parsed.data;
}

/** Slugs publicados, para el sitemap. */
export async function listProductSlugs(): Promise<string[]> {
  "use cache";
  cacheLife("minutes");
  const slugs: string[] = [];
  let offset = 0;
  for (;;) {
    const { status, body } = await readJson(
      `/api/catalog/products?${productQuery(catalogListQuerySchema.parse({ sort: "name", limit: 100, offset }))}`,
    );
    if (status !== 200) throw new CatalogApiError(status);
    const parsed = catalogListSchema.safeParse(body);
    if (!parsed.success) throw new CatalogApiError(500);
    slugs.push(...parsed.data.items.map((item) => item.slug));
    if (slugs.length >= parsed.data.total || parsed.data.items.length === 0) return slugs;
    offset += parsed.data.items.length;
  }
}
