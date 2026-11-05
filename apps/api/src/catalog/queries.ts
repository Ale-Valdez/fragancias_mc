import {
    type AdminProduct,
    type AdminProductList,
    type AdminProductListQuery,
    type CatalogBrand,
    type CatalogImage,
    type CatalogList,
    type CatalogListQuery,
    type CatalogNotes,
    type CatalogProduct,
    type ProductStatus,
} from "@fmc/shared";
import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "../db/client.js";
import { brands, notes, productImages, productNotes, products } from "../db/schema.js";

const productColumns = {
    id: products.id,
    slug: products.slug,
    name: products.name,
    gender: products.gender,
    description: products.description,
    priceCents: products.priceCents,
    featured: products.featured,
    status: products.status,
    sortOrder: products.sortOrder,
    priceUpdatedAt: products.priceUpdatedAt,
    createdAt: products.createdAt,
    updatedAt: products.updatedAt,
    brandId: brands.id,
    brandName: brands.name,
    brandSlug: brands.slug,
};

type ProductRow = {
    id: number;
    slug: string;
    name: string;
    gender: CatalogProduct["gender"];
    description: string | null;
    priceCents: number | null;
    featured: boolean;
    status: ProductStatus;
    sortOrder: number;
    priceUpdatedAt: Date | string | null;
    createdAt: Date | string;
    updatedAt: Date | string;
    brandId: number;
    brandName: string;
    brandSlug: string;
};

function escapeLike(value: string): string {
    return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

function mediaUrl(key: string): string {
    return `/media/${key}`;
}

function emptyNotes(): CatalogNotes {
    return { top: [], heart: [], base: [] };
}

function iso(value: Date | string): string {
    return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function combine(filters: SQL[]): SQL {
    const combined = and(...filters);
    if (combined) return combined;
    const first = filters[0];
    if (first) return first;
    throw new Error("Se esperaba al menos un filtro");
}

function listFilters(query: CatalogListQuery, status: ProductStatus | undefined): SQL {
    const filters: SQL[] = [];
    if (status) filters.push(eq(products.status, status));
    if (query.gender) filters.push(eq(products.gender, query.gender));
    if (query.featured !== undefined) filters.push(eq(products.featured, query.featured));
    if (query.brand) filters.push(eq(brands.slug, query.brand));
    if (query.q) {
        const pattern = `%${escapeLike(query.q)}%`;
        const search = or(
            ilike(products.name, pattern),
            ilike(products.description, pattern),
            ilike(brands.name, pattern),
        );
        if (search) filters.push(search);
    }
    if (filters.length === 0) return sql`true`;
    return combine(filters);
}

function listOrder(sort: CatalogListQuery["sort"]): SQL[] {
    switch (sort) {
        case "name":
            return [asc(products.name), asc(products.id)];
        case "price":
            return [sql`${products.priceCents} asc nulls last`, asc(products.id)];
        case "newest":
            return [desc(products.createdAt), desc(products.id)];
        case "sort":
            return [asc(products.sortOrder), asc(products.name), asc(products.id)];
    }
}

async function loadImages(productIds: number[]): Promise<Map<number, CatalogImage[]>> {
    const grouped = new Map<number, CatalogImage[]>();
    if (productIds.length === 0) return grouped;

    const rows = await db
        .select({
            id: productImages.id,
            productId: productImages.productId,
            keyThumb: productImages.keyThumb,
            keyMedium: productImages.keyMedium,
            keyLarge: productImages.keyLarge,
            isPrimary: productImages.isPrimary,
            position: productImages.position,
        })
        .from(productImages)
        .where(inArray(productImages.productId, productIds))
        .orderBy(asc(productImages.position), asc(productImages.id));

    for (const row of rows) {
        const image: CatalogImage = {
            id: row.id,
            urlThumb: mediaUrl(row.keyThumb),
            urlMedium: mediaUrl(row.keyMedium),
            urlLarge: mediaUrl(row.keyLarge),
            isPrimary: row.isPrimary,
            position: row.position,
        };
        const list = grouped.get(row.productId);
        if (list) list.push(image);
        else grouped.set(row.productId, [image]);
    }
    return grouped;
}

async function loadNotes(productIds: number[]): Promise<Map<number, CatalogNotes>> {
    const grouped = new Map<number, CatalogNotes>();
    if (productIds.length === 0) return grouped;

    const rows = await db
        .select({
            productId: productNotes.productId,
            level: productNotes.level,
            name: notes.name,
        })
        .from(productNotes)
        .innerJoin(notes, eq(productNotes.noteId, notes.id))
        .where(inArray(productNotes.productId, productIds))
        .orderBy(asc(notes.name), asc(notes.id));

    for (const row of rows) {
        const bucket = grouped.get(row.productId) ?? emptyNotes();
        bucket[row.level].push(row.name);
        grouped.set(row.productId, bucket);
    }
    return grouped;
}

function toAdminProduct(
    row: ProductRow,
    images: Map<number, CatalogImage[]>,
    noteMap: Map<number, CatalogNotes>,
): AdminProduct {
    return {
        id: row.id,
        slug: row.slug,
        name: row.name,
        brand: { id: row.brandId, name: row.brandName, slug: row.brandSlug },
        gender: row.gender,
        description: row.description,
        priceCents: row.priceCents,
        featured: row.featured,
        images: images.get(row.id) ?? [],
        notes: noteMap.get(row.id) ?? emptyNotes(),
        status: row.status,
        sortOrder: row.sortOrder,
        priceUpdatedAt: row.priceUpdatedAt ? iso(row.priceUpdatedAt) : null,
        createdAt: iso(row.createdAt),
        updatedAt: iso(row.updatedAt),
    };
}

function toPublicProduct(product: AdminProduct): CatalogProduct {
    return {
        id: product.id,
        slug: product.slug,
        name: product.name,
        brand: product.brand,
        gender: product.gender,
        description: product.description,
        priceCents: product.priceCents,
        featured: product.featured,
        images: product.images,
        notes: product.notes,
    };
}

async function countProducts(where: SQL): Promise<number> {
    const [countRow] = await db
        .select({ total: sql<number>`cast(count(*) as int)` })
        .from(products)
        .innerJoin(brands, eq(products.brandId, brands.id))
        .where(where);
    return Number(countRow?.total ?? 0);
}

async function fetchProducts(
    where: SQL,
    order: SQL[],
    limit: number,
    offset: number,
): Promise<AdminProduct[]> {
    const rows = await db
        .select(productColumns)
        .from(products)
        .innerJoin(brands, eq(products.brandId, brands.id))
        .where(where)
        .orderBy(...order)
        .limit(limit)
        .offset(offset);
    const ids = rows.map((row) => row.id);
    const [images, noteMap] = await Promise.all([loadImages(ids), loadNotes(ids)]);
    return rows.map((row) => toAdminProduct(row, images, noteMap));
}

export async function listPublishedProducts(query: CatalogListQuery): Promise<CatalogList> {
    const where = listFilters(query, "published");
    const items = await fetchProducts(where, listOrder(query.sort), query.limit, query.offset);
    return {
        items: items.map(toPublicProduct),
        total: await countProducts(where),
        limit: query.limit,
        offset: query.offset,
    };
}

export async function listAdminProducts(query: AdminProductListQuery): Promise<AdminProductList> {
    const where = listFilters(query, query.status);
    const items = await fetchProducts(where, listOrder(query.sort), query.limit, query.offset);
    return {
        items,
        total: await countProducts(where),
        limit: query.limit,
        offset: query.offset,
    };
}

export async function getAdminProduct(id: number): Promise<AdminProduct | null> {
    const [product] = await fetchProducts(eq(products.id, id), [asc(products.id)], 1, 0);
    return product ?? null;
}

export async function getPublishedProduct(slug: string): Promise<CatalogProduct | null> {
    const [product] = await fetchProducts(
        combine([eq(products.status, "published"), eq(products.slug, slug)]),
        [asc(products.id)],
        1,
        0,
    );
    return product ? toPublicProduct(product) : null;
}

/** Marcas que tienen al menos un producto publicado. */
export async function listPublishedBrands(): Promise<CatalogBrand[]> {
    return db
        .selectDistinct({
            id: brands.id,
            name: brands.name,
            slug: brands.slug,
        })
        .from(brands)
        .innerJoin(products, eq(products.brandId, brands.id))
        .where(eq(products.status, "published"))
        .orderBy(asc(brands.name), asc(brands.id));
}
