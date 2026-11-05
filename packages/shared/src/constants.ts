/** Nombres de buckets y prefijos: un solo lugar para no repetir strings. */
export const BUCKETS = {
    media: "media",
    private: "private",
  } as const;
  
  export const PREFIXES = {
    productImages: "products",
    catalogs: "catalogs",
    originals: "originals",
    backups: "backups",
  } as const;
