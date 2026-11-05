import { loginInputSchema, type AuthUser } from "@fmc/shared";
import { eq } from "drizzle-orm";
import { Router, type Request, type Response } from "express";
import { rateLimit } from "express-rate-limit";
import { hashPassword, verifyPassword } from "../auth/password.js";
import {
    clearSessionCookie,
    createSession,
    destroySession,
    findSessionUser,
    readSessionToken,
    setSessionCookie,
} from "../auth/session.js";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";

const WINDOW_MS = 15 * 60 * 1000;

/**
 * Hash fijo para verificar cuando el email no existe.
 * Así el tiempo de respuesta no delata si hay un usuario.
 * Se calcula al importar el módulo, sin await en el nivel superior.
 */
const dummyPasswordHash = hashPassword("not-a-real-password");

function publicUser(user: { id: number; email: string; role: string }): AuthUser {
    return { id: user.id, email: user.email, role: user.role };
}

function rateLimited(_req: Request, res: Response): void {
    res.status(429).json({ error: "rate_limited" });
}

/** La IP que ve Express puede ser la del contenedor web, así que la clave es el email. */
function loginEmailKey(req: Request): string {
    const email = req.body?.email;
    if (typeof email !== "string") return "invalid";
    return email.trim().toLowerCase() || "invalid";
}

const limitLogin = rateLimit({
    windowMs: WINDOW_MS,
    limit: 30,
    legacyHeaders: false,
    standardHeaders: "draft-8",
    keyGenerator: () => "login",
    handler: rateLimited,
});

const limitLoginEmail = rateLimit({
    windowMs: WINDOW_MS,
    limit: 10,
    legacyHeaders: false,
    standardHeaders: "draft-8",
    keyGenerator: loginEmailKey,
    handler: rateLimited,
});

export const authRouter = Router();

authRouter.post("/login", limitLogin, limitLoginEmail, async (req, res) => {
    const parsed = loginInputSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "invalid_body" });
        return;
    }

    const { email, password } = parsed.data;
    const [user] = await db
        .select({
            id: users.id,
            email: users.email,
            role: users.role,
            passwordHash: users.passwordHash,
        })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

    const passwordOk = await verifyPassword(
        password,
        user?.passwordHash ?? (await dummyPasswordHash),
    );
    if (!user || !passwordOk) {
        res.status(401).json({ error: "invalid_credentials" });
        return;
    }

    const session = await createSession(user.id);
    setSessionCookie(res, session.token, session.expiresAt);
    res.json(publicUser(user));
});

authRouter.post("/logout", async (req, res) => {
    const token = readSessionToken(req);
    if (token) await destroySession(token);
    clearSessionCookie(res);
    res.status(204).end();
});

authRouter.get("/me", async (req, res) => {
    const token = readSessionToken(req);
    const user = token ? await findSessionUser(token) : null;
    if (!user) {
        clearSessionCookie(res);
        res.status(401).json({ error: "unauthenticated" });
        return;
    }
    res.json(publicUser(user));
});
