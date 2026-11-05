import type { PublicEvent } from "@fmc/shared";
import { and, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { events, products } from "../db/schema.js";

const CATALOG_DOWNLOAD = "catalog_download";

/** Anota una descarga del PDF vigente. */
export async function recordCatalogDownload(catalogVersionId: number, sessionId: string): Promise<void> {
    await db.insert(events).values({
        type: CATALOG_DOWNLOAD,
        sessionId,
        meta: { catalogVersionId },
    });
}

/**
 * Anota una vista o un clic de WhatsApp.
 * Devuelve false si el producto no existe o no está publicado.
 */
export async function recordPublicEvent(event: PublicEvent, sessionId: string): Promise<boolean> {
    const [product] = await db
        .select({ id: products.id })
        .from(products)
        .where(and(eq(products.id, event.productId), eq(products.status, "published")))
        .limit(1);
    if (!product) return false;

    await db.insert(events).values({
        type: event.type,
        productId: event.productId,
        sessionId,
    });
    return true;
}
