import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { adminCatalogRouter } from "./routes/admin-catalog.js";
import { authRouter } from "./routes/auth.js";
import { catalogRouter } from "./routes/catalog.js";
import { eventsRouter } from "./routes/events.js";
import { healthRouter } from "./routes/health.js";
import { mediaRouter } from "./routes/media.js";

export function createApp() {
    const app = express();
    app.disable("x-powered-by");
    app.set("trust proxy", 1); // detrás de Cloudflare / contenedor web

    app.use(helmet({ crossOriginResourcePolicy: { policy: "same-site" } }));
    app.use(cookieParser(config.SESSION_SECRET));
    app.use(express.json({ limit: "1mb" }));

    // Los entornos de prueba no deben indexarse
    if (!config.ALLOW_INDEXING) {
        app.use((_req, res, next) => {
            res.header("X-Robots-Tag", "noindex, nofollow");
            next();
        });
    }

    app.use("/media", mediaRouter);
    app.use("/api/health", healthRouter);
    app.use("/api/auth", authRouter);
    app.use("/api/catalog", catalogRouter);
    app.use("/api/events", eventsRouter);
    app.use("/api/admin", adminCatalogRouter);

    app.use(
        (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
            logger.error({ err }, "Error no controlado");
            res.status(500).json({ error: "internal_error" });
        },
    );

    return app;
}