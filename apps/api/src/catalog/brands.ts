import type { CatalogBrand } from "@fmc/shared";
import { asc, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { brands, products } from "../db/schema.js";
import { slugify } from "./slug.js";

const SLUG_ATTEMPTS = 50;

export class EmptyBrandSlugError extends Error {
    constructor() {
        super("empty_slug");
        this.name = "EmptyBrandSlugError";
    }
}

const brandColumns = {
    id: brands.id,
    name: brands.name,
    slug: brands.slug,
};

function withSuffix(base: string, attempt: number): string {
    const suffix = attempt === 1 ? "" : `-${attempt}`;
    return `${base.slice(0, 140 - suffix.length)}${suffix}`;
}

function postgresCode(error: unknown): string | undefined {
    let current: unknown = error;
    for (let depth = 0; depth < 4 && current && typeof current === "object"; depth++) {
        if ("code" in current && typeof current.code === "string") return current.code;
        current = "cause" in current ? current.cause : undefined;
    }
    return undefined;
}

export async function listBrands(): Promise<CatalogBrand[]> {
    return db.select(brandColumns).from(brands).orderBy(asc(brands.name), asc(brands.id));
}

/** El slug sale del nombre y no vuelve a cambiar: el catálogo público filtra por ese slug. */
export async function createBrand(name: string): Promise<CatalogBrand> {
    const base = slugify(name);
    if (!base) throw new EmptyBrandSlugError();

    for (let attempt = 1; attempt <= SLUG_ATTEMPTS; attempt++) {
        try {
            const [row] = await db
                .insert(brands)
                .values({ name, slug: withSuffix(base, attempt) })
                .returning(brandColumns);
            if (!row) throw new Error("No se pudo crear la marca");
            return row;
        } catch (error) {
            if (postgresCode(error) === "23505") continue;
            throw error;
        }
    }
    throw new Error("No quedó un slug libre para la marca");
}

export async function updateBrand(id: number, name: string): Promise<CatalogBrand | null> {
    const [row] = await db.update(brands).set({ name }).where(eq(brands.id, id)).returning(brandColumns);
    return row ?? null;
}

export async function deleteBrand(id: number): Promise<"deleted" | "missing" | "in_use"> {
    const [brand] = await db.select({ id: brands.id }).from(brands).where(eq(brands.id, id)).limit(1);
    if (!brand) return "missing";

    const [used] = await db
        .select({ id: products.id })
        .from(products)
        .where(eq(products.brandId, id))
        .limit(1);
    if (used) return "in_use";

    try {
        const deleted = await db.delete(brands).where(eq(brands.id, id)).returning({ id: brands.id });
        return deleted.length === 0 ? "missing" : "deleted";
    } catch (error) {
        if (postgresCode(error) === "23503") return "in_use";
        throw error;
    }
}
