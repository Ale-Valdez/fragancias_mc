import { Router } from "express";
import { config } from "../config.js";
import { storage } from "../storage/index.js";

export const mediaRouter = Router();

/**
 * GET /media/<clave del objeto>
 * Sirve los archivos del bucket "media" a través de la API. Así el bucket
 * puede permanecer privado y funciona igual con cualquier servidor S3.
 * Cloudflare cachea la respuesta en el borde (Cache-Control inmutable).
 */
mediaRouter.get(/^\/(.+)$/, async (req, res, next) => {
    try {
        const key = decodeURIComponent((req.params as Record<string, string>)[0] ?? "");
        if (!key || key.includes("..")) return res.status(400).end();

        const obj = await storage.get(config.S3_BUCKET_MEDIA, key);
        if (!obj) return res.status(404).end();

        if (req.headers["if-none-match"] && req.headers["if-none-match"] === obj.etag) {
            obj.body.destroy();
            return res.status(304).end();
        }

        // El PDF y la web (otro origen interno) necesitan poder embeber estas imágenes
        res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
        res.setHeader("Content-Type", obj.contentType ?? "application/octet-stream");
        res.setHeader("Content-Length", String(obj.size));
        res.setHeader("Cache-Control", obj.cacheControl ?? "public, max-age=3600");
        if (obj.etag) res.setHeader("ETag", obj.etag);
        obj.body.on("error", next);
        obj.body.pipe(res);
    } catch (err) {
        next(err);
    }
});