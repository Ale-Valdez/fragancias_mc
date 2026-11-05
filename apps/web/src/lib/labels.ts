import type { Gender } from "@fmc/shared";

export type { Gender };

export const GENDER_LABEL: Record<Gender, string> = {
  femenino: "Femenino",
  masculino: "Masculino",
  unisex: "Unisex",
};

export const NOTE_LABEL = {
  top: "Salida",
  heart: "Corazón",
  base: "Fondo",
} as const;

export function formatPrice(cents: number | null): string {
  if (cents === null) return "Sin precio";
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(cents / 100);
}

export function formatCount(count: number): string {
  return count === 1 ? "1 fragancia" : `${count} fragancias`;
}

export function primaryImage<T extends { isPrimary: boolean }>(images: T[]): T | null {
  return images.find((image) => image.isPrimary) ?? images[0] ?? null;
}
