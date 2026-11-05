import type { RequestHandler } from "express";
import {
    clearSessionCookie,
    findSessionUser,
    readSessionToken,
    type SessionUser,
} from "./session.js";

declare global {
    namespace Express {
        interface Request {
            user?: SessionUser;
        }
    }
}

export const requireAdmin: RequestHandler = async (req, res, next) => {
    const token = readSessionToken(req);
    const user = token ? await findSessionUser(token) : null;
    if (!user) {
        clearSessionCookie(res);
        res.status(401).json({ error: "unauthenticated" });
        return;
    }
    if (user.role !== "admin") {
        res.status(403).json({ error: "forbidden" });
        return;
    }
    req.user = user;
    next();
};
