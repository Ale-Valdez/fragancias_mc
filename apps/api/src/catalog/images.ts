import type { CatalogImage } from "@fmc/shared";
import { and, asc, eq, sql } from "drizzle-orm";
import type { RequestHandler } from "express";
import multer from "multer";
import sharp from "sharp";
import { z } from "zod";
import { config } from "../config.js";
import { db } from "../db/client.js";
import { productImages, products } from "../db/schema.js";
import { processAndStoreImage, type ProcessedImage } from "../images/process.js";
import { storage } from "../storage/index.js";

const MAX_FILES = 8;
const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_FORMAT = new Set(["jpeg", "png", "webp"]);

export class InvalidImageError extends Error {
    constructor() {
        super("invalid_image");
        this.name = "InvalidImageError";
    }
}

export const productImageUpdateSchema = z
    .object({
        isPrimary: z.boolean().optional(),
        position: z.number().int().min(0).optional(),
    })
    .refine((body) => body.isPrimary !== undefined || body.position !== undefined, {
        message: "empty",
    });

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_BYTES, files: MAX_FILES },
    fileFilter(_req, file, callback) {
        if (ALLOWED_MIME.has(file.mimetype)) {
            callback(null, true);
            return;
        }
        callback(new InvalidImageError());
    },
});

/** Campo multipart `images`. Hasta 8 archivos, 8 MB cada uno, jpeg, png o webp. */
export const acceptProductImages: RequestHandler = (req, res, next) => {
    upload.array("images", MAX_FILES)(req, res, (error: unknown) => {
        if (!error) {
            next();
            return;
        }
        if (error instanceof multer.MulterError) {
            const message =
                error.code === "LIMIT_FILE_SIZE"
                    ? "file_too_large"
                    : error.code === "LIMIT_FILE_COUNT"
                      ? "too_many_files"
                      : error.code === "LIMIT_UNEXPECTED_FILE"
                        ? "unexpected_field"
                        : "invalid_file";
            res.status(400).json({ error: "invalid_body", issues: [{ path: "images", message }] });
            return;
        }
        if (error instanceof InvalidImageError) {
            res.status(400).json({
                error: "invalid_body",
                issues: [{ path: "images", message: "unsupported_type" }],
            });
            return;
        }
        next(error);
    });
};

function mediaUrl(key: string): string {
    return `/media/${key}`;
}

function toImage(row: {
    id: number;
    keyThumb: string;
    keyMedium: string;
    keyLarge: string;
    isPrimary: boolean;
    position: number;
}): CatalogImage {
    return {
        id: row.id,
        urlThumb: mediaUrl(row.keyThumb),
        urlMedium: mediaUrl(row.keyMedium),
        urlLarge: mediaUrl(row.keyLarge),
        isPrimary: row.isPrimary,
        position: row.position,
    };
}

async function assertImage(input: Buffer): Promise<void> {
    if (input.length === 0) throw new InvalidImageError();
    try {
        const meta = await sharp(input, { failOn: "error" }).metadata();
        if (!meta.format || !ALLOWED_FORMAT.has(meta.format)) throw new InvalidImageError();
    } catch (error) {
        if (error instanceof InvalidImageError) throw error;
        throw new InvalidImageError();
    }
}

export async function deleteStoredImage(image: {
    keyThumb: string;
    keyMedium: string;
    keyLarge: string;
    keyOriginal: string | null;
}): Promise<void> {
    await deleteObjects({
        keyThumb: image.keyThumb,
        keyMedium: image.keyMedium,
        keyLarge: image.keyLarge,
        keyOriginal: image.keyOriginal ?? "",
    });
}

async function deleteObjects(image: ProcessedImage): Promise<void> {
    await storage.delete(config.S3_BUCKET_MEDIA, image.keyThumb);
    await storage.delete(config.S3_BUCKET_MEDIA, image.keyMedium);
    await storage.delete(config.S3_BUCKET_MEDIA, image.keyLarge);
    if (image.keyOriginal) await storage.delete(config.S3_BUCKET_PRIVATE, image.keyOriginal);
}

const imageColumns = {
    id: productImages.id,
    keyThumb: productImages.keyThumb,
    keyMedium: productImages.keyMedium,
    keyLarge: productImages.keyLarge,
    isPrimary: productImages.isPrimary,
    position: productImages.position,
};

export async function addProductImages(productId: number, files: Buffer[]): Promise<CatalogImage[] | null> {
    if (files.length === 0) throw new InvalidImageError();

    const [product] = await db
        .select({ id: products.id, slug: products.slug })
        .from(products)
        .where(eq(products.id, productId))
        .limit(1);
    if (!product) return null;

    const stored: ProcessedImage[] = [];
    try {
        for (const file of files) {
            await assertImage(file);
            stored.push(await processAndStoreImage(file, product.slug));
        }

        return await db.transaction(async (tx) => {
            const [maxRow] = await tx
                .select({ maxPosition: sql<number>`coalesce(max(${productImages.position}), -1)` })
                .from(productImages)
                .where(eq(productImages.productId, productId));
            const [primary] = await tx
                .select({ id: productImages.id })
                .from(productImages)
                .where(and(eq(productImages.productId, productId), eq(productImages.isPrimary, true)))
                .limit(1);

            let position = Number(maxRow?.maxPosition ?? -1) + 1;
            let needsPrimary = !primary;
            const created: CatalogImage[] = [];

            for (const image of stored) {
                const isPrimary = needsPrimary;
                needsPrimary = false;
                const [row] = await tx
                    .insert(productImages)
                    .values({
                        productId,
                        keyThumb: image.keyThumb,
                        keyMedium: image.keyMedium,
                        keyLarge: image.keyLarge,
                        keyOriginal: image.keyOriginal,
                        isPrimary,
                        position,
                    })
                    .returning(imageColumns);
                if (!row) throw new Error("No se pudo guardar la foto");
                created.push(toImage(row));
                position += 1;
            }
            return created;
        });
    } catch (error) {
        await Promise.all(stored.map((image) => deleteObjects(image).catch(() => undefined)));
        throw error;
    }
}

export async function updateProductImage(
    productId: number,
    imageId: number,
    input: { isPrimary?: boolean; position?: number },
): Promise<CatalogImage | "missing" | "conflict"> {
    return db.transaction(async (tx) => {
        const [image] = await tx
            .select({ id: productImages.id })
            .from(productImages)
            .where(and(eq(productImages.id, imageId), eq(productImages.productId, productId)))
            .limit(1);
        if (!image) return "missing";
        if (input.isPrimary === false) return "conflict";

        if (input.isPrimary === true) {
            await tx
                .update(productImages)
                .set({ isPrimary: false })
                .where(eq(productImages.productId, productId));
        }

        const patch: { isPrimary?: boolean; position?: number } = {};
        if (input.isPrimary === true) patch.isPrimary = true;
        if (input.position !== undefined) patch.position = input.position;

        const [row] = await tx
            .update(productImages)
            .set(patch)
            .where(eq(productImages.id, imageId))
            .returning(imageColumns);
        if (!row) return "missing";
        return toImage(row);
    });
}

export async function deleteProductImage(productId: number, imageId: number): Promise<"deleted" | "missing"> {
    const removed = await db.transaction(async (tx) => {
        const [image] = await tx
            .select({
                keyThumb: productImages.keyThumb,
                keyMedium: productImages.keyMedium,
                keyLarge: productImages.keyLarge,
                keyOriginal: productImages.keyOriginal,
                isPrimary: productImages.isPrimary,
            })
            .from(productImages)
            .where(and(eq(productImages.id, imageId), eq(productImages.productId, productId)))
            .limit(1);
        if (!image) return null;

        await tx.delete(productImages).where(eq(productImages.id, imageId));
        if (image.isPrimary) {
            const [next] = await tx
                .select({ id: productImages.id })
                .from(productImages)
                .where(eq(productImages.productId, productId))
                .orderBy(asc(productImages.position), asc(productImages.id))
                .limit(1);
            if (next) {
                await tx.update(productImages).set({ isPrimary: true }).where(eq(productImages.id, next.id));
            }
        }
        return image;
    });
    if (!removed) return "missing";

    const [stillUsed] = await db
        .select({ id: productImages.id })
        .from(productImages)
        .where(eq(productImages.keyThumb, removed.keyThumb))
        .limit(1);
    if (!stillUsed) await deleteStoredImage(removed);
    return "deleted";
}
