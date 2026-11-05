import { catalogListQuerySchema } from "@fmc/shared";
import { Router } from "express";
import { recordCatalogDownload } from "../catalog/events.js";
import { getCurrentCatalog } from "../catalog/publish.js";
import { ensureVisitorId } from "../catalog/visitor.js";
import {
    getPublishedProduct,
    listPublishedBrands,
    listPublishedProducts,
} from "../catalog/queries.js";

export const catalogRouter = Router();

/** PDF vigentes. `current` es el oscuro; `light` es el claro. */
catalogRouter.get("/current", async (_req, res) => {
    const [current, light] = await Promise.all([getCurrentCatalog("dark"), getCurrentCatalog("light")]);
    res.json({ current, light });
});

/** Anota la descarga y redirige al PDF del tema pedido. Sin claro publicado, usa el oscuro. */
catalogRouter.get("/download", async (req, res) => {
    const variant = req.query.theme === "light" ? "light" : "dark";
    const current = (await getCurrentCatalog(variant)) ?? (variant === "light" ? await getCurrentCatalog("dark") : null);
    if (!current) {
        res.status(404).json({ error: "not_found" });
        return;
    }
    const sessionId = ensureVisitorId(req, res);
    await recordCatalogDownload(current.id, sessionId);
    res.setHeader("Cache-Control", "no-store");
    res.redirect(302, current.url);
});

catalogRouter.get("/brands", async (_req, res) => {
    res.json(await listPublishedBrands());
});

catalogRouter.get("/products", async (req, res) => {
    const parsed = catalogListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
        res.status(400).json({ error: "invalid_query" });
        return;
    }
    res.json(await listPublishedProducts(parsed.data));
});

catalogRouter.get("/products/:slug", async (req, res) => {
    const slug = req.params.slug;
    if (typeof slug !== "string" || slug.length === 0 || slug.length > 160) {
        res.status(404).json({ error: "not_found" });
        return;
    }
    const product = await getPublishedProduct(slug);
    if (!product) {
        res.status(404).json({ error: "not_found" });
        return;
    }
    res.json(product);
});
