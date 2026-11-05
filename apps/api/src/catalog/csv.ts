import { csvProductRowSchema, NOTE_LEVELS, type CsvProductRow } from "@fmc/shared";
import { parse } from "csv-parse/sync";
import { eq } from "drizzle-orm";
import type { RequestHandler } from "express";
import multer from "multer";
import { db } from "../db/client.js";
import { brands, notes, productNotes, products } from "../db/schema.js";
import { slugify } from "./slug.js";

const MAX_BYTES = 2 * 1024 * 1024;

export class CsvImportError extends Error {
    readonly issues: { path: string; message: string }[];

    constructor(issues: { path: string; message: string }[]) {
        super("invalid_csv");
        this.name = "CsvImportError";
        this.issues = issues;
    }
}

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_BYTES, files: 1 },
});

/** Campo multipart `file`. Un CSV de hasta 2 MB. */
export const acceptCatalogCsv: RequestHandler = (req, res, next) => {
    upload.single("file")(req, res, (error: unknown) => {
        if (!error) {
            next();
            return;
        }
        if (error instanceof multer.MulterError) {
            const message = error.code === "LIMIT_FILE_SIZE" ? "file_too_large" : "invalid_file";
            res.status(400).json({ error: "invalid_body", issues: [{ path: "file", message }] });
            return;
        }
        next(error);
    });
};

function isCsvFile(file: { originalname: string; mimetype: string }): boolean {
    const name = file.originalname.toLowerCase();
    return (
        name.endsWith(".csv") ||
        file.mimetype === "text/csv" ||
        file.mimetype === "application/csv" ||
        file.mimetype === "application/vnd.ms-excel"
    );
}

function fitSlug(text: string, max: number): string {
    return slugify(text).slice(0, max).replace(/-$/, "");
}

type DbOps = Pick<typeof db, "delete" | "insert" | "select" | "update">;

async function replaceNotes(tx: DbOps, productId: number, input: CsvProductRow["notes"]): Promise<void> {
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

async function ensureBrand(tx: DbOps, name: string): Promise<{ id: number }> {
    const slug = fitSlug(name, 140);
    const [existing] = await tx.select({ id: brands.id }).from(brands).where(eq(brands.slug, slug)).limit(1);
    if (existing) return existing;
    const [created] = await tx.insert(brands).values({ name, slug }).returning({ id: brands.id });
    if (!created) throw new Error("No se pudo crear la marca");
    return created;
}

function readRows(file: Buffer): CsvProductRow[] {
    let records: unknown;
    try {
        records = parse(file, {
            columns: true,
            bom: true,
            skip_empty_lines: true,
            trim: true,
            relax_column_count: true,
        });
    } catch {
        throw new CsvImportError([{ path: "file", message: "invalid_csv" }]);
    }
    if (!Array.isArray(records)) throw new CsvImportError([{ path: "file", message: "invalid_csv" }]);

    const rows: CsvProductRow[] = [];
    const issues: { path: string; message: string }[] = [];
    records.forEach((record, index) => {
        const row = index + 2;
        const parsed = csvProductRowSchema.safeParse(record);
        if (!parsed.success) {
            for (const issue of parsed.error.issues) {
                const field = issue.path.join(".") || "row";
                issues.push({ path: `${row}.${field}`, message: issue.message });
            }
            return;
        }
        if (!fitSlug(parsed.data.brand, 140)) issues.push({ path: `${row}.brand`, message: "empty_slug" });
        if (!fitSlug(`${parsed.data.brand}-${parsed.data.name}`, 160)) {
            issues.push({ path: `${row}.name`, message: "empty_slug" });
        }
        if (issues.some((issue) => issue.path.startsWith(`${row}.`))) return;
        rows.push(parsed.data);
    });
    if (issues.length > 0) throw new CsvImportError(issues);
    return rows;
}

/**
 * Crea o actualiza por slug de marca + nombre. No duplica.
 * Una fila inválida rechaza el archivo entero, sin escribir nada.
 * Las fotos y el orden no se tocan. Una celda vacía de estado queda en borrador.
 */
export async function importCatalogCsv(file: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
}): Promise<{ created: number; updated: number }> {
    if (!isCsvFile(file)) throw new CsvImportError([{ path: "file", message: "unsupported_type" }]);
    const rows = readRows(file.buffer);

    return db.transaction(async (tx) => {
        let created = 0;
        let updated = 0;
        const now = new Date();

        for (const row of rows) {
            const brand = await ensureBrand(tx, row.brand);
            const slug = fitSlug(`${row.brand}-${row.name}`, 160);
            const [existing] = await tx
                .select({ id: products.id, priceCents: products.priceCents })
                .from(products)
                .where(eq(products.slug, slug))
                .limit(1);

            let productId: number;
            if (!existing) {
                const [inserted] = await tx
                    .insert(products)
                    .values({
                        slug,
                        name: row.name,
                        brandId: brand.id,
                        gender: row.gender,
                        description: row.description,
                        status: row.status,
                        featured: row.featured,
                        priceCents: row.priceCents,
                        priceUpdatedAt: row.priceCents === null ? null : now,
                        updatedAt: now,
                    })
                    .returning({ id: products.id });
                if (!inserted) throw new Error("No se pudo crear el producto");
                productId = inserted.id;
                created += 1;
            } else {
                const priceChanged = existing.priceCents !== row.priceCents;
                await tx
                    .update(products)
                    .set({
                        name: row.name,
                        brandId: brand.id,
                        gender: row.gender,
                        description: row.description,
                        status: row.status,
                        featured: row.featured,
                        updatedAt: now,
                        ...(priceChanged ? { priceCents: row.priceCents, priceUpdatedAt: now } : {}),
                    })
                    .where(eq(products.id, existing.id));
                productId = existing.id;
                updated += 1;
            }
            await replaceNotes(tx, productId, row.notes);
        }

        return { created, updated };
    });
}
