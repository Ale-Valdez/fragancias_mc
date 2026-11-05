import type { MetricRange, Metrics } from "@fmc/shared";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { brands, events, products } from "../db/schema.js";

/** Argentina no usa horario de verano: la medianoche local es las 03:00 UTC. */
const TIME_ZONE = "America/Argentina/Buenos_Aires";
const RANGE_DAYS: Record<MetricRange, number> = { "7d": 7, "30d": 30, "90d": 90 };
const TOP_LIMIT = 10;

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
});

function asCount(value: unknown): number {
    const count = Number(value ?? 0);
    return Number.isFinite(count) ? count : 0;
}

function formatDay(date: Date): string {
    return dayFormatter.format(date);
}

function startOfRange(range: MetricRange, now: Date): Date {
    const start = new Date(`${formatDay(now)}T03:00:00.000Z`);
    start.setUTCDate(start.getUTCDate() - (RANGE_DAYS[range] - 1));
    return start;
}

function listDays(from: Date, until: Date): string[] {
    const days: string[] = [];
    const cursor = new Date(from);
    const end = formatDay(until);
    while (days.length < 120) {
        const key = formatDay(cursor);
        days.push(key);
        if (key >= end) break;
        cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return days;
}

type Bucket = {
    catalogDownloads: number;
    productViews: number;
    whatsappClicks: number;
};

function emptyBucket(): Bucket {
    return { catalogDownloads: 0, productViews: 0, whatsappClicks: 0 };
}

function addToBucket(bucket: Bucket, type: string, total: number): void {
    if (type === "catalog_download") bucket.catalogDownloads += total;
    else if (type === "product_view") bucket.productViews += total;
    else if (type === "whatsapp_click") bucket.whatsappClicks += total;
}

/** Totales, serie diaria y ranking del período. Los días sin eventos quedan en cero. */
export async function getMetrics(range: MetricRange): Promise<Metrics> {
    const now = new Date();
    const from = startOfRange(range, now);
    const day = sql<string>`to_char(${events.createdAt} at time zone 'America/Argentina/Buenos_Aires', 'YYYY-MM-DD')`;

    const [byType, byDay, visitorsRow, byProduct] = await Promise.all([
        db
            .select({
                type: events.type,
                total: sql<number>`cast(count(*) as int)`,
            })
            .from(events)
            .where(gte(events.createdAt, from))
            .groupBy(events.type),
        db
            .select({
                day,
                type: events.type,
                total: sql<number>`cast(count(*) as int)`,
            })
            .from(events)
            .where(gte(events.createdAt, from))
            .groupBy(day, events.type),
        db
            .select({
                total: sql<number>`cast(count(distinct ${events.sessionId}) as int)`,
            })
            .from(events)
            .where(gte(events.createdAt, from)),
        db
            .select({
                productId: events.productId,
                name: products.name,
                brand: brands.name,
                type: events.type,
                total: sql<number>`cast(count(*) as int)`,
            })
            .from(events)
            .innerJoin(products, eq(products.id, events.productId))
            .innerJoin(brands, eq(brands.id, products.brandId))
            .where(and(gte(events.createdAt, from), inArray(events.type, ["product_view", "whatsapp_click"])))
            .groupBy(events.productId, products.name, brands.name, events.type),
    ]);

    const totals = emptyBucket();
    for (const row of byType) addToBucket(totals, row.type, asCount(row.total));

    const byDate = new Map<string, Bucket>();
    for (const date of listDays(from, now)) byDate.set(date, emptyBucket());
    for (const row of byDay) {
        const bucket = byDate.get(row.day) ?? emptyBucket();
        addToBucket(bucket, row.type, asCount(row.total));
        byDate.set(row.day, bucket);
    }

    const ranking = new Map<number, Metrics["topProducts"][number]>();
    for (const row of byProduct) {
        if (row.productId === null) continue;
        const current = ranking.get(row.productId) ?? {
            productId: row.productId,
            name: row.name,
            brand: row.brand,
            views: 0,
            whatsappClicks: 0,
        };
        const total = asCount(row.total);
        if (row.type === "product_view") current.views += total;
        if (row.type === "whatsapp_click") current.whatsappClicks += total;
        ranking.set(row.productId, current);
    }

    const topProducts = [...ranking.values()]
        .sort(
            (a, b) =>
                b.views + b.whatsappClicks - (a.views + a.whatsappClicks) ||
                b.views - a.views ||
                a.name.localeCompare(b.name, "es"),
        )
        .slice(0, TOP_LIMIT);

    return {
        range,
        from: from.toISOString(),
        to: now.toISOString(),
        totals: {
            ...totals,
            visitors: asCount(visitorsRow[0]?.total),
        },
        series: [...byDate.entries()].map(([date, bucket]) => ({ date, ...bucket })),
        topProducts,
    };
}
