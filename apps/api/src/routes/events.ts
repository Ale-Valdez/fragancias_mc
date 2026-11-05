import { publicEventSchema } from "@fmc/shared";
import { Router, type Request, type Response } from "express";
import { rateLimit } from "express-rate-limit";
import { recordPublicEvent } from "../catalog/events.js";
import { ensureVisitorId, readVisitorId } from "../catalog/visitor.js";

const WINDOW_MS = 15 * 60 * 1000;

function rateLimited(_req: Request, res: Response): void {
    res.status(429).json({ error: "rate_limited" });
}

/**
 * El rewrite de Next hace que la IP sea la del contenedor web.
 * El tope útil es por cookie. Este tope global frena a quien la descarta.
 */
const limitEventsGlobal = rateLimit({
    windowMs: WINDOW_MS,
    limit: 2000,
    legacyHeaders: false,
    standardHeaders: "draft-8",
    keyGenerator: () => "events",
    handler: rateLimited,
});

const limitEventsVisitor = rateLimit({
    windowMs: WINDOW_MS,
    limit: 180,
    legacyHeaders: false,
    standardHeaders: "draft-8",
    skip: (req) => readVisitorId(req) === null,
    keyGenerator: (req) => readVisitorId(req) ?? "none",
    handler: rateLimited,
});

export const eventsRouter = Router();

eventsRouter.post("/", limitEventsGlobal, limitEventsVisitor, async (req, res) => {
    const parsed = publicEventSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "invalid_body" });
        return;
    }

    const sessionId = ensureVisitorId(req, res);
    const saved = await recordPublicEvent(parsed.data, sessionId);
    res.setHeader("Cache-Control", "no-store");
    if (!saved) {
        res.status(404).json({ error: "not_found" });
        return;
    }
    res.status(204).end();
});
