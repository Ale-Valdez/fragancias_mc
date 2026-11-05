import {
    CreateBucketCommand,
    DeleteObjectCommand,
    GetObjectCommand,
    HeadBucketCommand,
    HeadObjectCommand,
    ListObjectsV2Command,
    PutObjectCommand,
    S3Client,
    S3ServiceException,
} from "@aws-sdk/client-s3";
import { Readable } from "node:stream";
import type { Config } from "../config.js";
import type { PutOptions, StorageAdapter, StoredObject, StoredObjectInfo } from "./types.js";

function isNotFound(err: unknown): boolean {
    return (
        err instanceof S3ServiceException &&
        (err.name === "NoSuchKey" || err.name === "NotFound" || err.$metadata.httpStatusCode === 404)
    );
}

export class S3StorageAdapter implements StorageAdapter {
    private readonly client: S3Client;

    constructor(
        cfg: Pick<
            Config,
            "S3_ENDPOINT" | "S3_REGION" | "S3_ACCESS_KEY" | "S3_SECRET_KEY" | "S3_FORCE_PATH_STYLE"
        >,
    ) {
        this.client = new S3Client({
            region: cfg.S3_REGION,
            endpoint: cfg.S3_ENDPOINT || undefined,
            forcePathStyle: cfg.S3_FORCE_PATH_STYLE,
            credentials: { accessKeyId: cfg.S3_ACCESS_KEY, secretAccessKey: cfg.S3_SECRET_KEY },
        });
    }

    async ensureBucket(bucket: string): Promise<void> {
        try {
            await this.client.send(new HeadBucketCommand({ Bucket: bucket }));
        } catch {
            await this.client.send(new CreateBucketCommand({ Bucket: bucket }));
        }
    }

    async put(bucket: string, key: string, body: Buffer | Readable, opts: PutOptions): Promise<void> {
        await this.client.send(
            new PutObjectCommand({
                Bucket: bucket,
                Key: key,
                Body: body,
                ContentType: opts.contentType,
                CacheControl: opts.cacheControl,
            }),
        );
    }

    async get(bucket: string, key: string): Promise<StoredObject | null> {
        try {
            const res = await this.client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
            return {
                body: res.Body as Readable,
                size: res.ContentLength ?? 0,
                contentType: res.ContentType,
                etag: res.ETag,
                cacheControl: res.CacheControl,
                lastModified: res.LastModified,
            };
        } catch (err) {
            if (isNotFound(err)) return null;
            throw err;
        }
    }

    async head(bucket: string, key: string): Promise<StoredObjectInfo | null> {
        try {
            const res = await this.client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
            return {
                size: res.ContentLength ?? 0,
                contentType: res.ContentType,
                etag: res.ETag,
                cacheControl: res.CacheControl,
                lastModified: res.LastModified,
            };
        } catch (err) {
            if (isNotFound(err)) return null;
            throw err;
        }
    }

    async delete(bucket: string, key: string): Promise<void> {
        await this.client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    }

    async list(bucket: string, prefix: string): Promise<string[]> {
        const keys: string[] = [];
        let token: string | undefined;
        do {
            const res = await this.client.send(
                new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }),
            );
            for (const o of res.Contents ?? []) if (o.Key) keys.push(o.Key);
            token = res.IsTruncated ? res.NextContinuationToken : undefined;
        } while (token);
        return keys;
    }
}