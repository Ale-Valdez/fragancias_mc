import type { PriceAdjust } from "@fmc/shared";
import { and, eq, inArray, isNotNull, sql, type SQL } from "drizzle-orm";
import { db } from "../db/client.js";
import { products } from "../db/schema.js";

/** Nuevo precio en centavos. Porcentaje redondeado, y delta o porcentaje nunca dejan un valor negativo. */
function nextPrice(input: PriceAdjust): SQL<number> {
    if (input.mode === "set") return sql`${input.value}`;
    if (input.mode === "delta") return sql`greatest(0, ${products.priceCents} + ${input.value})`;
    return sql`greatest(0, round(${products.priceCents} * (1 + ${input.value}::numeric / 100))::int)`;
}

/**
 * Solo productos que ya tienen precio. Los filtros presentes se combinan.
 * Sin filtros, alcanza a todo el catálogo con precio.
 */
export async function adjustPrices(input: PriceAdjust): Promise<{ updated: number }> {
    const next = nextPrice(input);
    const filters: SQL[] = [isNotNull(products.priceCents), sql`${products.priceCents} is distinct from ${next}`];
    if (input.productIds) filters.push(inArray(products.id, input.productIds));
    if (input.brandId) filters.push(eq(products.brandId, input.brandId));
    if (input.gender) filters.push(eq(products.gender, input.gender));
    const where = and(...filters);
    if (!where) throw new Error("Se esperaba al menos un filtro");

    const now = new Date();
    return db.transaction(async (tx) => {
        const rows = await tx
            .update(products)
            .set({ priceCents: next, priceUpdatedAt: now, updatedAt: now })
            .where(where)
            .returning({ id: products.id });
        return { updated: rows.length };
    });
}
