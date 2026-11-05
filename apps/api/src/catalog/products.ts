import {
    NOTE_LEVELS,
    type AdminProduct,
    type ProductInput,
    type ProductNotesInput,
    type ProductUpdate,
} from "@fmc/shared";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { brands, notes, productImages, productNotes, products } from "../db/schema.js";
import { deleteStoredImage } from "./images.js";
import { getAdminProduct } from "./queries.js";
import { slugify } from "./slug.js";

const SLUG_ATTEMPTS = 50;
const SLUG_MAX = 160;

export class EmptyProductSlugError extends Error {
    constructor() {
        super("empty_slug");
        this.name = "EmptyProductSlugError";
    }
}

export class MissingBrandError extends Error {
    constructor() {
        super("missing_brand");
        this.name = "MissingBrandError";
    }
}

function withSuffix(base: string, attempt: number): string {
    const suffix = attempt === 1 ? "" : `-${attempt}`;
    return `${base.slice(0, SLUG_MAX - suffix.length)}${suffix}`;
}

function postgresCode(error: unknown): string | undefined {
    let current: unknown = error;
    for (let depth = 0; depth < 4 && current && typeof current === "object"; depth++) {
        if ("code" in current && typeof current.code === "string") return current.code;
        current = "cause" in current ? current.cause : undefined;
    }
    return undefined;
}

async function replaceNotes(
    tx: Pick<typeof db, "delete" | "insert" | "select">,
    productId: number,
    input: ProductNotesInput,
): Promise<void> {
    await tx.delete(productNotes).where(eq(productNotes.productId, productId));
    for (const level of NOTE_LEVELS) {
        for (const name of input[level]) {
            await tx.insert(notes).values({ name }).onConflictDoNothing();
            const [note] = await tx.select({ id: notes.id }).from(notes).where(eq(notes.name, name)).limit(1);
            if (!note) throw new Error("No se pudo guardar la nota");
            await tx.insert(productNotes).values({ productId, noteId: note.id, level });
        }
    }
}

async function readProduct(id: number): Promise<AdminProduct> {
    const product = await getAdminProduct(id);
    if (!product) throw new Error("No se pudo leer el producto");
    return product;
}

/** El slug sale de marca + nombre una sola vez. Un cambio de nombre no lo regenera. */
export async function createProduct(input: ProductInput): Promise<AdminProduct> {
    const [brand] = await db
        .select({ id: brands.id, name: brands.name })
        .from(brands)
        .where(eq(brands.id, input.brandId))
        .limit(1);
    if (!brand) throw new MissingBrandError();

    const base = slugify(`${brand.name}-${input.name}`);
    if (!base) throw new EmptyProductSlugError();

    for (let attempt = 1; attempt <= SLUG_ATTEMPTS; attempt++) {
        try {
            const id = await db.transaction(async (tx) => {
                const now = new Date();
                const [row] = await tx
                    .insert(products)
                    .values({
                        slug: withSuffix(base, attempt),
                        name: input.name,
                        brandId: input.brandId,
                        gender: input.gender,
                        description: input.description,
                        status: input.status,
                        featured: input.featured,
                        sortOrder: input.sortOrder,
                        priceCents: input.priceCents,
                        priceUpdatedAt: input.priceCents === null ? null : now,
                        updatedAt: now,
                    })
                    .returning({ id: products.id });
                if (!row) throw new Error("No se pudo crear el producto");
                await replaceNotes(tx, row.id, input.notes);
                return row.id;
            });
            return await readProduct(id);
        } catch (error) {
            if (error instanceof EmptyProductSlugError || error instanceof MissingBrandError) throw error;
            if (postgresCode(error) === "23505") continue;
            if (postgresCode(error) === "23503") throw new MissingBrandError();
            throw error;
        }
    }
    throw new Error("No quedó un slug libre para el producto");
}

export async function updateProduct(id: number, input: ProductUpdate): Promise<AdminProduct | null> {
    const [current] = await db
        .select({
            id: products.id,
            priceCents: products.priceCents,
        })
        .from(products)
        .where(eq(products.id, id))
        .limit(1);
    if (!current) return null;

    if (input.brandId !== undefined) {
        const [brand] = await db
            .select({ id: brands.id })
            .from(brands)
            .where(eq(brands.id, input.brandId))
            .limit(1);
        if (!brand) throw new MissingBrandError();
    }

    await db.transaction(async (tx) => {
        const now = new Date();
        const patch: {
            name?: string;
            brandId?: number;
            gender?: ProductInput["gender"];
            description?: string | null;
            status?: ProductInput["status"];
            featured?: boolean;
            sortOrder?: number;
            priceCents?: number | null;
            priceUpdatedAt?: Date | null;
            updatedAt: Date;
        } = { updatedAt: now };

        if (input.name !== undefined) patch.name = input.name;
        if (input.brandId !== undefined) patch.brandId = input.brandId;
        if (input.gender !== undefined) patch.gender = input.gender;
        if (input.description !== undefined) patch.description = input.description;
        if (input.status !== undefined) patch.status = input.status;
        if (input.featured !== undefined) patch.featured = input.featured;
        if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder;
        if (input.priceCents !== undefined && input.priceCents !== current.priceCents) {
            patch.priceCents = input.priceCents;
            patch.priceUpdatedAt = now;
        }

        await tx.update(products).set(patch).where(eq(products.id, id));
        if (input.notes) await replaceNotes(tx, id, input.notes);
    });

    return readProduct(id);
}

/** Borra el producto, sus notas y las fotos guardadas. Las métricas conservan el evento sin producto. */
export async function deleteProduct(id: number): Promise<boolean> {
    const images = await db
        .select({
            keyThumb: productImages.keyThumb,
            keyMedium: productImages.keyMedium,
            keyLarge: productImages.keyLarge,
            keyOriginal: productImages.keyOriginal,
        })
        .from(productImages)
        .where(eq(productImages.productId, id));
    const removed = await db.delete(products).where(eq(products.id, id)).returning({ id: products.id });
    if (removed.length === 0) return false;
    await Promise.all(images.map((image) => deleteStoredImage(image)));
    return true;
}

export async function archiveProduct(id: number): Promise<AdminProduct | null> {
    const current = await getAdminProduct(id);
    if (!current) return null;
    if (current.status === "archived") return current;

    await db
        .update(products)
        .set({ status: "archived", updatedAt: new Date() })
        .where(eq(products.id, id));
    return readProduct(id);
}
