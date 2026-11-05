import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./client.js";
import { logger } from "../logger.js";

await migrate(db, { migrationsFolder: "./drizzle" });
logger.info("Migraciones aplicadas");
await pool.end();