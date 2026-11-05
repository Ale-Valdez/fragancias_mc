/**
 * Importa el catálogo viejo (catalog_data.json + fotos) a la base y al storage.
 * Uso:  LEGACY_PATH=/ruta/al/proyecto/Mauro pnpm --filter @fmc/api import:legacy
 * Es idempotente: se puede correr varias veces (usa el slug como clave).
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import type { Gender } from "@fmc/shared";
import { slugify } from "../catalog/slug.js";
import { db, pool } from "../db/client.js";
import { brands, productImages, products } from "../db/schema.js";
import { processAndStoreImage } from "../images/process.js";
import { ensureBuckets } from "../storage/index.js";
import { logger } from "../logger.js";

type LegacyItem = {
    name: string;
    brand: string;
    desc?: string;
    notes?: string[];
    photo?: string;
    category?: string[];
};

const legacyPath = process.env.LEGACY_PATH;
if (!legacyPath) throw new Error("Definí LEGACY_PATH con la ruta del proyecto viejo");

/** El catálogo viejo no distingue masculino de unisex: se importa como masculino y se corrige en el panel. */
function toGender(categories: string[] = []): Gender {
    if (categories.includes("femenino")) return "femenino";
    return "masculino";
}

await ensureBuckets();

const items: LegacyItem[] = JSON.parse(
    await readFile(path.join(legacyPath, "assets", "catalog_data.json"), "utf8"),
);

let created = 0;
let skipped = 0;

for (const [index, item] of items.entries()) {
    const slug = slugify(`${item.brand}-${item.name}`);

    const existing = await db
        .select({ id: products.id })
        .from(products)
        .where(eq(products.slug, slug));
    if (existing.length > 0) {
        skipped++;
        continue;
    }

    const brandSlug = slugify(item.brand);
    await db.insert(brands).values({ name: item.brand, slug: brandSlug }).onConflictDoNothing();
    const [brand] = await db.select().from(brands).where(eq(brands.slug, brandSlug));

    const [product] = await db
        .insert(products)
        .values({
            slug,
            name: item.name,
            brandId: brand!.id,
            gender: toGender(item.category),
            description: item.desc || null,
            status: "published",
            sortOrder: index,
        })
        .returning({ id: products.id });

    if (item.photo) {
        try {
            const file = await readFile(path.join(legacyPath, "assets", "photos", item.photo));
            const img = await processAndStoreImage(file, slug);
            await db.insert(productImages).values({ productId: product!.id, ...img, isPrimary: true });
        } catch (err) {
            logger.warn({ slug, photo: item.photo, err }, "No se pudo importar la foto");
        }
    }
    created++;
}

logger.info({ total: items.length, created, skipped }, "Importación terminada");
await pool.end();