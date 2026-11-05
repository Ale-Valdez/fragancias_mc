import { argon2id, hash, verify, type HashOptions } from "argon2";

/** OWASP: argon2id, 19 MiB, 2 iteraciones, paralelismo 1. */
const options: HashOptions = {
    type: argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
};

export function hashPassword(password: string): Promise<string> {
    return hash(password, options);
}

/** Contraseña incorrecta o hash ilegible: false. No distingue los dos casos. */
export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
    try {
        return await verify(passwordHash, password);
    } catch {
        return false;
    }
}
