"use client";

import { adminProductSchema, productInputSchema } from "@fmc/shared";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { adminMutate } from "@/lib/admin-mutate";
import { errorClassName, inputClassName, primaryButtonClassName, quietButtonClassName } from "../form-styles";
import {
  toFormValues,
  type BrandOption,
  type Gender,
  type ProductFormValues,
  type ProductSource,
  type Status,
} from "./product-values";

type FieldErrors = Partial<
  Record<
    | "name"
    | "brandId"
    | "gender"
    | "description"
    | "price"
    | "status"
    | "sortOrder"
    | "notesTop"
    | "notesHeart"
    | "notesBase",
    string
  >
>;

const GENDER_LABEL: Record<Gender, string> = {
  femenino: "Femenino",
  masculino: "Masculino",
  unisex: "Unisex",
};

const STATUS_LABEL: Record<Status, string> = {
  draft: "Borrador",
  published: "Publicado",
  archived: "Archivado",
};

function pesosToCents(text: string): number | null | undefined {
  const value = text.trim();
  if (value === "") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return undefined;
  const [whole, frac = ""] = value.split(".");
  if (whole === undefined) return undefined;
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents)) return undefined;
  return cents;
}

function noteNames(text: string): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const part of text.split(",")) {
    const name = part.trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }
  return names;
}

function readSort(text: string): number | undefined {
  const value = text.trim();
  if (!/^\d+$/.test(value)) return undefined;
  const order = Number(value);
  return Number.isSafeInteger(order) ? order : undefined;
}

function issueText(path: string, message: string): string {
  if (path === "name" && message === "empty_slug") return "Ese nombre no se puede usar.";
  if (path === "name") return "El nombre es obligatorio y puede tener hasta 160 caracteres.";
  if (path === "brandId" && message === "not_found") return "Esa marca ya no existe.";
  if (path === "brandId") return "Elegí una marca.";
  if (path === "gender") return "Elegí un género.";
  if (path === "description") return "La descripción puede tener hasta 2000 caracteres.";
  if (path === "priceCents") return "El precio no es válido.";
  if (path === "status") return "Elegí un estado.";
  if (path === "sortOrder") return "El orden tiene que ser un entero de 0 en adelante.";
  if (path.startsWith("notes.")) return "Cada nota puede tener hasta 80 caracteres.";
  return "Revisá este campo.";
}

function assignIssue(errors: FieldErrors, path: string, message: string) {
  const text = issueText(path, message);
  if (path === "name") errors.name = text;
  else if (path === "brandId") errors.brandId = text;
  else if (path === "gender") errors.gender = text;
  else if (path === "description") errors.description = text;
  else if (path === "priceCents") errors.price = text;
  else if (path === "status") errors.status = text;
  else if (path === "sortOrder") errors.sortOrder = text;
  else if (path.startsWith("notes.top")) errors.notesTop = text;
  else if (path.startsWith("notes.heart")) errors.notesHeart = text;
  else if (path.startsWith("notes.base")) errors.notesBase = text;
}

export function ProductForm({
  brands,
  product,
}: {
  brands: BrandOption[];
  product?: ProductFormValues;
}) {
  const router = useRouter();
  const [name, setName] = useState(product?.name ?? "");
  const [brandId, setBrandId] = useState(product ? String(product.brandId) : "");
  const [gender, setGender] = useState<Gender | "">(product?.gender ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [price, setPrice] = useState(product?.price ?? "");
  const [status, setStatus] = useState<Status>(product?.status ?? "draft");
  const [featured, setFeatured] = useState(product?.featured ?? false);
  const [sortOrder, setSortOrder] = useState(product?.sortOrder ?? "0");
  const [notesTop, setNotesTop] = useState(product?.notesTop ?? "");
  const [notesHeart, setNotesHeart] = useState(product?.notesHeart ?? "");
  const [notesBase, setNotesBase] = useState(product?.notesBase ?? "");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [pending, setPending] = useState(false);

  function applySaved(body: unknown): boolean {
    const parsed = adminProductSchema.safeParse(body);
    if (!parsed.success) return false;
    const savedProduct = toFormValues(parsed.data as ProductSource);
    setName(savedProduct.name);
    setBrandId(String(savedProduct.brandId));
    setGender(savedProduct.gender);
    setDescription(savedProduct.description);
    setPrice(savedProduct.price);
    setStatus(savedProduct.status);
    setFeatured(savedProduct.featured);
    setSortOrder(savedProduct.sortOrder);
    setNotesTop(savedProduct.notesTop);
    setNotesHeart(savedProduct.notesHeart);
    setNotesBase(savedProduct.notesBase);
    return true;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setFormError(null);
    setSaved(false);
    setConfirmArchive(false);

    const errors: FieldErrors = {};
    const priceCents = pesosToCents(price);
    if (priceCents === undefined) errors.price = "Usá pesos enteros o con hasta 2 decimales.";
    const order = readSort(sortOrder);
    if (order === undefined) errors.sortOrder = "El orden tiene que ser un entero de 0 en adelante.";
    const selectedBrand = Number(brandId);
    if (!Number.isInteger(selectedBrand) || selectedBrand < 1) errors.brandId = "Elegí una marca.";
    if (gender === "") errors.gender = "Elegí un género.";
    if (
      priceCents === undefined ||
      order === undefined ||
      gender === "" ||
      !Number.isInteger(selectedBrand) ||
      selectedBrand < 1
    ) {
      setFieldErrors(errors);
      return;
    }

    const parsed = productInputSchema.safeParse({
      name,
      brandId: selectedBrand,
      gender,
      description,
      priceCents,
      status,
      featured,
      sortOrder: order,
      notes: {
        top: noteNames(notesTop),
        heart: noteNames(notesHeart),
        base: noteNames(notesBase),
      },
    });
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        assignIssue(next, issue.path.join("."), issue.message);
      }
      setFieldErrors(next);
      return;
    }

    setFieldErrors({});
    setPending(true);
    const result = product
      ? await adminMutate(`/products/${product.id}`, "PATCH", parsed.data)
      : await adminMutate("/products", "POST", parsed.data);
    if (!result.ok) {
      if (result.status === 401) {
        router.push("/admin/login");
        return;
      }
      const next: FieldErrors = {};
      for (const issue of result.issues) assignIssue(next, issue.path, issue.message);
      setFieldErrors(next);
      setFormError(
        result.error === "network"
          ? "No se pudo conectar con el servidor."
          : result.status === 404
            ? "Este producto ya no existe."
            : Object.keys(next).length > 0
              ? null
              : "No se pudo guardar el producto.",
      );
      setPending(false);
      return;
    }

    if (!product) {
      const created = adminProductSchema.safeParse(result.body);
      const id = created.success ? (created.data as { id: number }).id : null;
      if (!id) {
        setFormError("El producto se creó, pero no se pudo abrir. Volvé al catálogo.");
        setPending(false);
        return;
      }
      router.push(`/admin/productos/${id}`);
      router.refresh();
      return;
    }

    if (!applySaved(result.body)) {
      setFormError("Se guardó, pero no se pudo mostrar el resultado. Recargá la página.");
    } else {
      setSaved(true);
    }
    setPending(false);
    router.refresh();
  }

  async function onArchive() {
    if (!product || pending) return;
    if (!confirmArchive) {
      setConfirmArchive(true);
      setFormError(null);
      setSaved(false);
      return;
    }
    setPending(true);
    const result = await adminMutate(`/products/${product.id}`, "PATCH", { status: "archived" });
    if (!result.ok) {
      if (result.status === 401) {
        router.push("/admin/login");
        return;
      }
      setFormError(
        result.status === 404
          ? "Este producto ya no existe."
          : result.error === "network"
            ? "No se pudo conectar con el servidor."
            : "No se pudo archivar el producto.",
      );
      setConfirmArchive(false);
      setPending(false);
      return;
    }
    if (!applySaved(result.body)) {
      setFormError("Se archivó, pero no se pudo mostrar el resultado. Recargá la página.");
      setPending(false);
      router.refresh();
      return;
    }
    setSaved(true);
    setFormError(null);
    setConfirmArchive(false);
    setPending(false);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-8 flex flex-col gap-4">
      <Field label="Nombre" error={fieldErrors.name}>
        <input
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={pending}
          autoComplete="off"
          aria-invalid={fieldErrors.name ? true : undefined}
          className={inputClassName}
        />
      </Field>
      <Field label="Marca" error={fieldErrors.brandId}>
        <select
          name="brandId"
          value={brandId}
          onChange={(event) => setBrandId(event.target.value)}
          disabled={pending}
          aria-invalid={fieldErrors.brandId ? true : undefined}
          className={inputClassName}
        >
          <option value="">Elegí…</option>
          {brands.map((brand) => (
            <option key={brand.id} value={brand.id}>
              {brand.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Género" error={fieldErrors.gender}>
        <select
          name="gender"
          value={gender}
          onChange={(event) => setGender(event.target.value as Gender | "")}
          disabled={pending}
          aria-invalid={fieldErrors.gender ? true : undefined}
          className={inputClassName}
        >
          <option value="">Elegí…</option>
          {(Object.keys(GENDER_LABEL) as Gender[]).map((value) => (
            <option key={value} value={value}>
              {GENDER_LABEL[value]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Descripción" error={fieldErrors.description}>
        <textarea
          name="description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          disabled={pending}
          rows={4}
          aria-invalid={fieldErrors.description ? true : undefined}
          className={inputClassName}
        />
      </Field>
      <Field
        label="Precio (ARS)"
        hint="Vacío si todavía no tiene precio. Punto para los centavos."
        error={fieldErrors.price}
      >
        <input
          name="price"
          inputMode="decimal"
          value={price}
          onChange={(event) => setPrice(event.target.value)}
          disabled={pending}
          autoComplete="off"
          aria-invalid={fieldErrors.price ? true : undefined}
          className={inputClassName}
        />
      </Field>
      <Field label="Estado" hint="Solo los publicados aparecen en el catálogo." error={fieldErrors.status}>
        <select
          name="status"
          value={status}
          onChange={(event) => setStatus(event.target.value as Status)}
          disabled={pending}
          aria-invalid={fieldErrors.status ? true : undefined}
          className={inputClassName}
        >
          {(Object.keys(STATUS_LABEL) as Status[]).map((value) => (
            <option key={value} value={value}>
              {STATUS_LABEL[value]}
            </option>
          ))}
        </select>
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="featured"
          checked={featured}
          onChange={(event) => setFeatured(event.target.checked)}
          disabled={pending}
        />
        Destacado
      </label>
      <Field label="Orden" hint="Más chico, más arriba en el listado por orden." error={fieldErrors.sortOrder}>
        <input
          name="sortOrder"
          inputMode="numeric"
          value={sortOrder}
          onChange={(event) => setSortOrder(event.target.value)}
          disabled={pending}
          aria-invalid={fieldErrors.sortOrder ? true : undefined}
          className={inputClassName}
        />
      </Field>
      <Field label="Notas de salida" hint="Separadas por coma." error={fieldErrors.notesTop}>
        <input
          name="notesTop"
          value={notesTop}
          onChange={(event) => setNotesTop(event.target.value)}
          disabled={pending}
          autoComplete="off"
          aria-invalid={fieldErrors.notesTop ? true : undefined}
          className={inputClassName}
        />
      </Field>
      <Field label="Notas de corazón" hint="Separadas por coma." error={fieldErrors.notesHeart}>
        <input
          name="notesHeart"
          value={notesHeart}
          onChange={(event) => setNotesHeart(event.target.value)}
          disabled={pending}
          autoComplete="off"
          aria-invalid={fieldErrors.notesHeart ? true : undefined}
          className={inputClassName}
        />
      </Field>
      <Field label="Notas de fondo" hint="Separadas por coma." error={fieldErrors.notesBase}>
        <input
          name="notesBase"
          value={notesBase}
          onChange={(event) => setNotesBase(event.target.value)}
          disabled={pending}
          autoComplete="off"
          aria-invalid={fieldErrors.notesBase ? true : undefined}
          className={inputClassName}
        />
      </Field>
      {formError ? (
        <p role="alert" className={errorClassName}>
          {formError}
        </p>
      ) : null}
      {saved ? <p className="text-sm text-muted">Cambios guardados.</p> : null}
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className={primaryButtonClassName}>
          {pending ? "Guardando…" : product ? "Guardar cambios" : "Crear producto"}
        </button>
        {product && status !== "archived" ? (
          <button type="button" disabled={pending} onClick={onArchive} className={quietButtonClassName}>
            {confirmArchive ? "Confirmar archivado" : "Archivar"}
          </button>
        ) : null}
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      {label}
      {children}
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
      {error ? <span className={errorClassName}>{error}</span> : null}
    </label>
  );
}
