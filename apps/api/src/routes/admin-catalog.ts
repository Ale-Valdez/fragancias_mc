import {
    adminProductListQuerySchema,
    brandInputSchema,
    metricsQuerySchema,
    productInputSchema,
    productUpdateSchema,
    priceAdjustSchema,
} from "@fmc/shared";
import { Router, type Response } from "express";
import { requireAdmin } from "../auth/middleware.js";
import {
    createBrand,
    deleteBrand,
    EmptyBrandSlugError,
    listBrands,
    updateBrand,
} from "../catalog/brands.js";
import { getAdminProduct, listAdminProducts } from "../catalog/queries.js";
import {
    acceptProductImages,
    addProductImages,
    deleteProductImage,
    InvalidImageError,
    productImageUpdateSchema,
    updateProductImage,
} from "../catalog/images.js";
import {
    createProduct,
    deleteProduct,
    EmptyProductSlugError,
    MissingBrandError,
    updateProduct,
} from "../catalog/products.js";
import { adjustPrices } from "../catalog/prices.js";
import { acceptCatalogCsv, CsvImportError, importCatalogCsv } from "../catalog/csv.js";
import { getMetrics } from "../catalog/metrics.js";
import { getCurrentCatalog, PublishError, publishCatalog } from "../catalog/publish.js";

export const adminCatalogRouter = Router();

adminCatalogRouter.use(requireAdmin);

function invalidBody(res: Response, issues: { path: string; message: string }[]): void {
    res.status(400).json({ error: "invalid_body", issues });
}

function zodIssues(error: { issues: { path: PropertyKey[]; message: string }[] }): { path: string; message: string }[] {
    return error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
    }));
}

function readId(value: string | string[] | undefined): number | null {
    const raw = Array.isArray(value) ? value[0] : value;
    if (!raw || !/^\d+$/.test(raw)) return null;
    const id = Number(raw);
    if (!Number.isSafeInteger(id) || id < 1) return null;
    return id;
}

adminCatalogRouter.get("/brands", async (_req, res) => {
    res.json(await listBrands());
});

adminCatalogRouter.post("/brands", async (req, res) => {
    const parsed = brandInputSchema.safeParse(req.body);
    if (!parsed.success) {
        invalidBody(
            res,
            parsed.error.issues.map((issue) => ({
                path: issue.path.join("."),
                message: issue.message,
            })),
        );
        return;
    }
    try {
        const brand = await createBrand(parsed.data.name);
        res.status(201).json(brand);
    } catch (error) {
        if (error instanceof EmptyBrandSlugError) {
            invalidBody(res, [{ path: "name", message: "empty_slug" }]);
            return;
        }
        throw error;
    }
});

adminCatalogRouter.patch("/brands/:id", async (req, res) => {
    const id = readId(req.params.id);
    if (id === null) {
        res.status(404).json({ error: "not_found" });
        return;
    }
    const parsed = brandInputSchema.safeParse(req.body);
    if (!parsed.success) {
        invalidBody(
            res,
            parsed.error.issues.map((issue) => ({
                path: issue.path.join("."),
                message: issue.message,
            })),
        );
        return;
    }
    const brand = await updateBrand(id, parsed.data.name);
    if (!brand) {
        res.status(404).json({ error: "not_found" });
        return;
    }
    res.json(brand);
});

adminCatalogRouter.delete("/brands/:id", async (req, res) => {
    const id = readId(req.params.id);
    if (id === null) {
        res.status(404).json({ error: "not_found" });
        return;
    }
    const result = await deleteBrand(id);
    if (result === "missing") {
        res.status(404).json({ error: "not_found" });
        return;
    }
    if (result === "in_use") {
        res.status(409).json({ error: "conflict" });
        return;
    }
    res.status(204).end();
});

adminCatalogRouter.get("/products", async (req, res) => {
    const parsed = adminProductListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
        res.status(400).json({ error: "invalid_query" });
        return;
    }
    res.json(await listAdminProducts(parsed.data));
});

adminCatalogRouter.post("/products", async (req, res) => {
    const parsed = productInputSchema.safeParse(req.body);
    if (!parsed.success) {
        invalidBody(res, zodIssues(parsed.error));
        return;
    }
    try {
        const product = await createProduct(parsed.data);
        res.status(201).json(product);
    } catch (error) {
        if (error instanceof MissingBrandError) {
            invalidBody(res, [{ path: "brandId", message: "not_found" }]);
            return;
        }
        if (error instanceof EmptyProductSlugError) {
            invalidBody(res, [{ path: "name", message: "empty_slug" }]);
            return;
        }
        throw error;
    }
});

adminCatalogRouter.post("/products/prices", async (req, res) => {
    const parsed = priceAdjustSchema.safeParse(req.body);
    if (!parsed.success) {
        invalidBody(res, zodIssues(parsed.error));
        return;
    }
    res.json(await adjustPrices(parsed.data));
});

adminCatalogRouter.get("/products/:id", async (req, res) => {
    const id = readId(req.params.id);
    if (id === null) {
        res.status(404).json({ error: "not_found" });
        return;
    }
    const product = await getAdminProduct(id);
    if (!product) {
        res.status(404).json({ error: "not_found" });
        return;
    }
    res.json(product);
});

adminCatalogRouter.patch("/products/:id", async (req, res) => {
    const id = readId(req.params.id);
    if (id === null) {
        res.status(404).json({ error: "not_found" });
        return;
    }
    const parsed = productUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
        invalidBody(res, zodIssues(parsed.error));
        return;
    }
    try {
        const product = await updateProduct(id, parsed.data);
        if (!product) {
            res.status(404).json({ error: "not_found" });
            return;
        }
        res.json(product);
    } catch (error) {
        if (error instanceof MissingBrandError) {
            invalidBody(res, [{ path: "brandId", message: "not_found" }]);
            return;
        }
        throw error;
    }
});

adminCatalogRouter.delete("/products/:id", async (req, res) => {
    const id = readId(req.params.id);
    if (id === null) {
        res.status(404).json({ error: "not_found" });
        return;
    }
    const removed = await deleteProduct(id);
    if (!removed) {
        res.status(404).json({ error: "not_found" });
        return;
    }
    res.status(204).end();
});

adminCatalogRouter.post("/products/:id/images", acceptProductImages, async (req, res) => {
    const id = readId(req.params.id);
    if (id === null) {
        res.status(404).json({ error: "not_found" });
        return;
    }
    const files = req.files;
    if (!Array.isArray(files) || files.length === 0) {
        invalidBody(res, [{ path: "images", message: "required" }]);
        return;
    }
    try {
        const images = await addProductImages(
            id,
            files.map((file) => file.buffer),
        );
        if (!images) {
            res.status(404).json({ error: "not_found" });
            return;
        }
        res.status(201).json(images);
    } catch (error) {
        if (error instanceof InvalidImageError) {
            invalidBody(res, [{ path: "images", message: "invalid_image" }]);
            return;
        }
        throw error;
    }
});

adminCatalogRouter.patch("/products/:id/images/:imageId", async (req, res) => {
    const productId = readId(req.params.id);
    const imageId = readId(req.params.imageId);
    if (productId === null || imageId === null) {
        res.status(404).json({ error: "not_found" });
        return;
    }
    const parsed = productImageUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
        invalidBody(res, zodIssues(parsed.error));
        return;
    }
    const image = await updateProductImage(productId, imageId, parsed.data);
    if (image === "missing") {
        res.status(404).json({ error: "not_found" });
        return;
    }
    if (image === "conflict") {
        res.status(409).json({ error: "conflict" });
        return;
    }
    res.json(image);
});

adminCatalogRouter.delete("/products/:id/images/:imageId", async (req, res) => {
    const productId = readId(req.params.id);
    const imageId = readId(req.params.imageId);
    if (productId === null || imageId === null) {
        res.status(404).json({ error: "not_found" });
        return;
    }
    const result = await deleteProductImage(productId, imageId);
    if (result === "missing") {
        res.status(404).json({ error: "not_found" });
        return;
    }
    res.status(204).end();
});

adminCatalogRouter.get("/metrics", async (req, res) => {
    const parsed = metricsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
        res.status(400).json({ error: "invalid_query" });
        return;
    }
    res.setHeader("Cache-Control", "no-store");
    res.json(await getMetrics(parsed.data.range));
});

adminCatalogRouter.get("/catalog/current", async (_req, res) => {
    const [current, light] = await Promise.all([getCurrentCatalog("dark"), getCurrentCatalog("light")]);
    res.json({ current, light });
});

adminCatalogRouter.post("/catalog/publish", async (_req, res) => {
    try {
        res.status(201).json(await publishCatalog());
    } catch (error) {
        if (error instanceof PublishError) {
            res.status(error.code === "print_failed" ? 502 : 409).json({ error: error.code });
            return;
        }
        throw error;
    }
});

adminCatalogRouter.post("/catalog/import", acceptCatalogCsv, async (req, res) => {
    const file = req.file;
    if (!file) {
        invalidBody(res, [{ path: "file", message: "required" }]);
        return;
    }
    try {
        res.json(await importCatalogCsv(file));
    } catch (error) {
        if (error instanceof CsvImportError) {
            invalidBody(res, error.issues);
            return;
        }
        throw error;
    }
});
