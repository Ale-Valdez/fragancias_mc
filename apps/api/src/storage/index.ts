import { config } from "../config.js";
import { S3StorageAdapter } from "./s3.js";
import type { StorageAdapter } from "./types.js";

export type { StorageAdapter } from "./types.js";

/** Único lugar donde se elige la implementación concreta. */
export const storage: StorageAdapter = new S3StorageAdapter(config);

export async function ensureBuckets(): Promise<void> {
    await storage.ensureBucket(config.S3_BUCKET_MEDIA);
    await storage.ensureBucket(config.S3_BUCKET_PRIVATE);
}