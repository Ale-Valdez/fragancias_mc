import { randomBytes } from "node:crypto";
import type { CookieOptions, Request, Response } from "express";
import { config } from "../config.js";

export const VISITOR_COOKIE = "fmc_visitor";

const VISITOR_TTL_MS = 365 * 24 * 60 * 60 * 1000;

function cookieOptions(): CookieOptions {
    return {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: config.NODE_ENV === "production",
        maxAge: VISITOR_TTL_MS,
    };
}

/** Id anónimo de 64 hex. No es la sesión del panel. */
export function readVisitorId(req: Request): string | null {
    const value = req.signedCookies?.[VISITOR_COOKIE];
    return typeof value === "string" && /^[0-9a-f]{64}$/.test(value) ? value : null;
}

/** Reutiliza la cookie o crea una. Renueva el vencimiento en cada uso. */
export function ensureVisitorId(req: Request, res: Response): string {
    const id = readVisitorId(req) ?? randomBytes(32).toString("hex");
    res.cookie(VISITOR_COOKIE, id, { ...cookieOptions(), signed: true });
    return id;
}
