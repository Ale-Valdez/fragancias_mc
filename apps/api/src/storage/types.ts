import type { Readable } from "node:stream";

export type PutOptions = {
    contentType: string;
    /** Ej: "public, max-age=31536000, immutable" */
    cacheControl?: string;
};

export type StoredObjectInfo = {
    size: number;
    contentType?: string;
    etag?: string;
    cacheControl?: string;
    lastModified?: Date;
};

export type StoredObject = StoredObjectInfo & { body: Readable };

/**
 * Puerto de almacenamiento. El resto de la app solo conoce esta interfaz;
 * si mañana usás AWS S3, Cloudflare R2 o cualquier otro servidor S3,
 * no cambia nada fuera de la configuración (variables S3_*).
 */
export interface StorageAdapter {
    ensureBucket(bucket: string): Promise<void>;
    put(bucket: string, key: string, body: Buffer | Readable, opts: PutOptions): Promise<void>;
    get(bucket: string, key: string): Promise<StoredObject | null>;
    head(bucket: string, key: string): Promise<StoredObjectInfo | null>;
    delete(bucket: string, key: string): Promise<void>;
    list(bucket: string, prefix: string): Promise<string[]>;
}