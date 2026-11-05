/**
 * Slug de marcas y productos.
 * Es la misma regla que la importación legacy: si cambia, los slugs ya guardados dejan de coincidir.
 */
export function slugify(text: string): string {
    return text
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
}
