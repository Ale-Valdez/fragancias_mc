import { createHash, randomBytes } from "node:crypto";
import { and, eq, lt } from "drizzle-orm";
import type { CookieOptions, Request, Response } from "express";
import { config } from "../config.js";
import { db } from "../db/client.js";
import { sessions, users } from "../db/schema.js";

export const SESSION_COOKIE = "fmc_session";

const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export type SessionUser = {
    id: number;
    email: string;
    role: string;
};

function tokenHash(token: string): string {
    return createHash("sha256").update(token).digest("hex");
}

function baseCookieOptions(): CookieOptions {
    return {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: config.NODE_ENV === "production",
    };
}

export function setSessionCookie(res: Response, token: string, expiresAt: Date): void {
    res.cookie(SESSION_COOKIE, token, {
        ...baseCookieOptions(),
        signed: true,
        expires: expiresAt,
    });
}

export function clearSessionCookie(res: Response): void {
    res.clearCookie(SESSION_COOKIE, baseCookieOptions());
}

/** Token firmado de 32 bytes en hex. Una cookie ausente o con firma inválida da null. */
export function readSessionToken(req: Request): string | null {
    const value = req.signedCookies?.[SESSION_COOKIE];
    return typeof value === "string" && /^[0-9a-f]{64}$/.test(value) ? value : null;
}

/** Crea la sesión y borra las vencidas de ese usuario. El token en claro solo vuelve al caller. */
export async function createSession(userId: number): Promise<{ token: string; expiresAt: Date }> {
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    const now = new Date();

    await db
        .delete(sessions)
        .where(and(eq(sessions.userId, userId), lt(sessions.expiresAt, now)));
    await db.insert(sessions).values({
        id: tokenHash(token),
        userId,
        expiresAt,
    });

    return { token, expiresAt };
}

export async function findSessionUser(token: string): Promise<SessionUser | null> {
    const [row] = await db
        .select({
            id: users.id,
            email: users.email,
            role: users.role,
            expiresAt: sessions.expiresAt,
        })
        .from(sessions)
        .innerJoin(users, eq(users.id, sessions.userId))
        .where(eq(sessions.id, tokenHash(token)))
        .limit(1);

    if (!row) return null;
    if (row.expiresAt.getTime() <= Date.now()) {
        await destroySession(token);
        return null;
    }

    return { id: row.id, email: row.email, role: row.role };
}

export async function destroySession(token: string): Promise<void> {
    await db.delete(sessions).where(eq(sessions.id, tokenHash(token)));
}
