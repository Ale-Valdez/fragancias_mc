import { Router } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { config } from "../config.js";
import { storage } from "../storage/index.js";

export const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
    const checks = { db: false, storage: false };
    try {
        await db.execute(sql`select 1`);
        checks.db = true;
    } catch { }
    try {
        await storage.list(config.S3_BUCKET_MEDIA, "health/");
        checks.storage = true;
    } catch { }
    const ok = checks.db && checks.storage;
    res.status(ok ? 200 : 503).json({ ok, ...checks });
});