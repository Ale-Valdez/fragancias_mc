/**
 * Crea el admin o, si el email ya existe, le cambia la contraseña y cierra sus sesiones.
 * Uso: ADMIN_EMAIL=... ADMIN_PASSWORD=... pnpm --filter @fmc/api admin:create
 */
import { loginInputSchema } from "@fmc/shared";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { hashPassword } from "../auth/password.js";
import { db, pool } from "../db/client.js";
import { sessions, users } from "../db/schema.js";
import { logger } from "../logger.js";

const passwordSchema = z.string().min(12).max(200);

try {
    const emailResult = loginInputSchema.shape.email.safeParse(process.env.ADMIN_EMAIL ?? "");
    const passwordResult = passwordSchema.safeParse(process.env.ADMIN_PASSWORD ?? "");
    if (!emailResult.success || !passwordResult.success) {
        logger.error(
            "ADMIN_EMAIL debe ser un email y ADMIN_PASSWORD debe tener entre 12 y 200 caracteres",
        );
        process.exitCode = 1;
    } else {
        const email = emailResult.data;
        const passwordHash = await hashPassword(passwordResult.data);
        const [existing] = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.email, email))
            .limit(1);

        if (existing) {
            await db.transaction(async (tx) => {
                await tx
                    .update(users)
                    .set({ passwordHash, role: "admin", updatedAt: new Date() })
                    .where(eq(users.id, existing.id));
                await tx.delete(sessions).where(eq(sessions.userId, existing.id));
            });
            logger.info({ email }, "Contraseña del admin actualizada");
        } else {
            await db.insert(users).values({ email, passwordHash, role: "admin" });
            logger.info({ email }, "Admin creado");
        }
    }
} finally {
    await pool.end();
}
