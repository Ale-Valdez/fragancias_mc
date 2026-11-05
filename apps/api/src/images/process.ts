import { createHash } from "node:crypto";
import sharp from "sharp";
import { PREFIXES } from "@fmc/shared";
import { config } from "../config.js";
import { storage } from "../storage/index.js";

const IMMUTABLE = "public, max-age=31536000, immutable";

const VARIANTS = [
    { name: "thumb", width: 320 },
    { name: "medium", width: 800 },
    { name: "large", width: 1600 },
] as const;

export type ProcessedImage = {
    keyThumb: string;
    keyMedium: string;
    keyLarge: string;
    keyOriginal: string;
};

/**
 * Recibe el archivo subido, guarda el original en el bucket privado y
 * genera 3 variantes WebP en el bucket público-por-API ("media").
 * El nombre incluye el hash del contenido: si la foto cambia, cambia la URL
 * y se puede cachear "para siempre".
 */
export async function processAndStoreImage(
    input: Buffer,
    productSlug: string,
): Promise<ProcessedImage> {
    const hash = createHash("sha256").update(input).digest("hex").slice(0, 16);
    const base = `${PREFIXES.productImages}/${productSlug}/${hash}`;

    const keyOriginal = `${PREFIXES.originals}/${productSlug}/${hash}`;
    await storage.put(config.S3_BUCKET_PRIVATE, keyOriginal, input, {
        contentType: "application/octet-stream",
    });

    const keys: Record<string, string> = {};
    for (const v of VARIANTS) {
        const out = await sharp(input)
            .rotate() // respeta la orientación EXIF
            .resize({ width: v.width, withoutEnlargement: true })
            .webp({ quality: 80 })
            .toBuffer();
        const key = `${base}-${v.name}.webp`;
        await storage.put(config.S3_BUCKET_MEDIA, key, out, {
            contentType: "image/webp",
            cacheControl: IMMUTABLE,
        });
        keys[v.name] = key;
    }

    return {
        keyThumb: keys.thumb!,
        keyMedium: keys.medium!,
        keyLarge: keys.large!,
        keyOriginal,
    };
}