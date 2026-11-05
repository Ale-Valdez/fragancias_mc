import { createHash } from "node:crypto";
import { catalogListQuerySchema, PREFIXES } from "@fmc/shared";
import { and, desc, eq } from "drizzle-orm";
import puppeteer from "puppeteer-core";
import { config } from "../config.js";
import { db } from "../db/client.js";
import { catalogVersions } from "../db/schema.js";
import { logger } from "../logger.js";
import { storage } from "../storage/index.js";
import { listPublishedProducts } from "./queries.js";

const VARIANTS = ["dark", "light"] as const;
type CatalogVariant = (typeof VARIANTS)[number];

export class PublishError extends Error {
    constructor(readonly code: "empty" | "busy" | "print_failed") {
        super(code);
        this.name = "PublishError";
    }
}

export type CatalogPublication = {
    id: number;
    variant: string;
    productCount: number;
    sizeBytes: number;
    createdAt: string;
    url: string;
};

let publishing = false;

function iso(value: Date | string): string {
    return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toPublication(row: {
    id: number;
    variant: string;
    objectKey: string;
    productCount: number;
    sizeBytes: number;
    createdAt: Date | string;
}): CatalogPublication {
    return {
        id: row.id,
        variant: row.variant,
        productCount: row.productCount,
        sizeBytes: row.sizeBytes,
        createdAt: iso(row.createdAt),
        url: `/media/${row.objectKey}`,
    };
}

export async function getCurrentCatalog(variant: CatalogVariant = "dark"): Promise<CatalogPublication | null> {
    const [row] = await db
        .select({
            id: catalogVersions.id,
            variant: catalogVersions.variant,
            objectKey: catalogVersions.objectKey,
            productCount: catalogVersions.productCount,
            sizeBytes: catalogVersions.sizeBytes,
            createdAt: catalogVersions.createdAt,
        })
        .from(catalogVersions)
        .where(and(eq(catalogVersions.isCurrent, true), eq(catalogVersions.variant, variant)))
        .orderBy(desc(catalogVersions.createdAt), desc(catalogVersions.id))
        .limit(1);
    return row ? toPublication(row) : null;
}

async function renderPdf(
    browser: Awaited<ReturnType<typeof puppeteer.launch>>,
    variant: CatalogVariant,
): Promise<Buffer> {
    const page = await browser.newPage();
    try {
        await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1 });
        await page.goto(`${config.PRINT_BASE_URL}/print/catalog?theme=${variant}`, {
            waitUntil: "networkidle0",
            timeout: 60_000,
        });
        await page.waitForSelector("[data-catalog-ready]", { timeout: 15_000 });
        const pdf = await page.pdf({
            format: "A4",
            printBackground: true,
            margin: { top: 0, right: 0, bottom: 0, left: 0 },
            preferCSSPageSize: false,
        });
        return Buffer.from(pdf);
    } finally {
        await page.close();
    }
}

async function renderBoth(): Promise<Record<CatalogVariant, Buffer>> {
    const executablePath = config.CHROMIUM_PATH || "/usr/bin/chromium";
    const browser = await puppeteer.launch({
        executablePath,
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    });
    try {
        return {
            dark: await renderPdf(browser, "dark"),
            light: await renderPdf(browser, "light"),
        };
    } finally {
        await browser.close();
    }
}

/** Genera el PDF oscuro y el claro, los guarda y los marca como vigentes. */
export async function publishCatalog(): Promise<Record<CatalogVariant, CatalogPublication>> {
    if (publishing) throw new PublishError("busy");
    publishing = true;
    try {
        const preview = await listPublishedProducts(catalogListQuerySchema.parse({ limit: 1, offset: 0, sort: "sort" }));
        if (preview.total === 0) throw new PublishError("empty");

        let pdfs: Record<CatalogVariant, Buffer>;
        try {
            pdfs = await renderBoth();
        } catch (error) {
            logger.error({ err: error }, "No se pudo imprimir el catálogo");
            throw new PublishError("print_failed");
        }

        const stored = VARIANTS.map((variant) => {
            const pdf = pdfs[variant];
            const contentHash = createHash("sha256").update(pdf).digest("hex");
            return {
                variant,
                pdf,
                contentHash,
                objectKey: `${PREFIXES.catalogs}/${contentHash}.pdf`,
            };
        });

        for (const item of stored) {
            await storage.put(config.S3_BUCKET_MEDIA, item.objectKey, item.pdf, {
                contentType: "application/pdf",
                cacheControl: "public, max-age=31536000, immutable",
            });
        }

        const rows = await db.transaction(async (tx) => {
            const created = [];
            for (const item of stored) {
                await tx.update(catalogVersions).set({ isCurrent: false }).where(eq(catalogVersions.variant, item.variant));
                const [row] = await tx
                    .insert(catalogVersions)
                    .values({
                        variant: item.variant,
                        objectKey: item.objectKey,
                        productCount: preview.total,
                        sizeBytes: item.pdf.length,
                        contentHash: item.contentHash,
                        isCurrent: true,
                    })
                    .returning({
                        id: catalogVersions.id,
                        variant: catalogVersions.variant,
                        objectKey: catalogVersions.objectKey,
                        productCount: catalogVersions.productCount,
                        sizeBytes: catalogVersions.sizeBytes,
                        createdAt: catalogVersions.createdAt,
                    });
                if (!row) throw new Error("No se pudo registrar el catálogo");
                created.push(row);
            }
            return created;
        });

        const [dark, light] = rows;
        if (!dark || !light) throw new Error("No se pudo registrar el catálogo");
        logger.info(
            { productCount: preview.total, darkBytes: dark.sizeBytes, lightBytes: light.sizeBytes },
            "Catálogo publicado",
        );
        return { dark: toPublication(dark), light: toPublication(light) };
    } finally {
        publishing = false;
    }
}
