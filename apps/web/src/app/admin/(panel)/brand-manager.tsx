"use client";

import { brandInputSchema, catalogBrandSchema } from "@fmc/shared";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { adminMutate } from "@/lib/admin-mutate";
import { errorClassName, inputClassName, primaryButtonClassName, quietButtonClassName } from "./form-styles";

type BrandRow = {
  id: number;
  name: string;
};

function nameError(message: string | undefined): string | undefined {
  if (!message) return undefined;
  if (message === "empty_slug") return "Ese nombre no se puede usar como marca.";
  return "El nombre es obligatorio y puede tener hasta 120 caracteres.";
}

export function BrandManager({ brands }: { brands: BrandRow[] }) {
  const router = useRouter();
  const [items, setItems] = useState(brands);
  const [knownBrands, setKnownBrands] = useState(brands);
  if (brands !== knownBrands) {
    setKnownBrands(brands);
    setItems(brands);
  }

  const [name, setName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draftName, setDraftName] = useState("");
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [rowError, setRowError] = useState<{ id: number; message: string } | null>(null);
  const [pending, setPending] = useState<"create" | "save" | "delete" | null>(null);

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending !== null) return;
    setCreateError(null);
    setRowError(null);

    const parsed = brandInputSchema.safeParse({ name });
    if (!parsed.success) {
      setCreateError(nameError(parsed.error.issues[0]?.message) ?? "Revisá el nombre.");
      return;
    }

    setPending("create");
    const result = await adminMutate("/brands", "POST", parsed.data);
    setPending(null);
    if (!result.ok) {
      if (result.status === 401) {
        router.push("/admin/login");
        return;
      }
      const issue = result.issues.find((item) => item.path === "name");
      setCreateError(
        result.error === "network"
          ? "No se pudo conectar con el servidor."
          : (nameError(issue?.message) ?? "No se pudo crear la marca."),
      );
      return;
    }

    const created = catalogBrandSchema.safeParse(result.body);
    if (!created.success) {
      setCreateError("La marca se creó, pero no se pudo mostrar. Recargá la página.");
      return;
    }
    setName("");
    setItems((current) =>
      [...current, { id: created.data.id, name: created.data.name }].sort((a, b) =>
        a.name.localeCompare(b.name, "es"),
      ),
    );
    router.refresh();
  }

  function startEdit(brand: BrandRow) {
    setEditingId(brand.id);
    setDraftName(brand.name);
    setConfirmId(null);
    setRowError(null);
  }

  async function onSave(event: FormEvent<HTMLFormElement>, id: number) {
    event.preventDefault();
    if (pending !== null) return;
    setRowError(null);

    const parsed = brandInputSchema.safeParse({ name: draftName });
    if (!parsed.success) {
      setRowError({
        id,
        message: nameError(parsed.error.issues[0]?.message) ?? "Revisá el nombre.",
      });
      return;
    }

    setPending("save");
    const result = await adminMutate(`/brands/${id}`, "PATCH", parsed.data);
    setPending(null);
    if (!result.ok) {
      if (result.status === 401) {
        router.push("/admin/login");
        return;
      }
      const issue = result.issues.find((item) => item.path === "name");
      setRowError({
        id,
        message:
          result.status === 404
            ? "Esa marca ya no existe."
            : result.error === "network"
              ? "No se pudo conectar con el servidor."
              : (nameError(issue?.message) ?? "No se pudo guardar la marca."),
      });
      if (result.status === 404) router.refresh();
      return;
    }

    const updated = catalogBrandSchema.safeParse(result.body);
    if (!updated.success) {
      setRowError({ id, message: "No se pudo leer la marca guardada." });
      return;
    }
    setItems((current) =>
      current
        .map((brand) => (brand.id === id ? { id, name: updated.data.name } : brand))
        .sort((a, b) => a.name.localeCompare(b.name, "es")),
    );
    setEditingId(null);
    router.refresh();
  }

  async function onDelete(id: number) {
    if (pending !== null) return;
    if (confirmId !== id) {
      setConfirmId(id);
      setEditingId(null);
      setRowError(null);
      return;
    }

    setPending("delete");
    const result = await adminMutate(`/brands/${id}`, "DELETE");
    setPending(null);
    if (!result.ok) {
      if (result.status === 401) {
        router.push("/admin/login");
        return;
      }
      setConfirmId(null);
      setRowError({
        id,
        message:
          result.status === 409
            ? "No se puede borrar: hay productos de esta marca."
            : result.status === 404
              ? "Esa marca ya no existe."
              : result.error === "network"
                ? "No se pudo conectar con el servidor."
                : "No se pudo borrar la marca.",
      });
      if (result.status === 404) router.refresh();
      return;
    }

    setItems((current) => current.filter((brand) => brand.id !== id));
    setConfirmId(null);
    router.refresh();
  }

  return (
    <section>
      <h1 className="text-2xl font-semibold">Marcas</h1>
      <p className="mt-2 text-sm text-muted">{items.length} en total.</p>
      <form onSubmit={onCreate} className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-start">
        <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm">
          Nueva marca
          <input
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={pending !== null}
            autoComplete="off"
            aria-invalid={createError ? true : undefined}
            className={inputClassName}
          />
        </label>
        <button type="submit" disabled={pending !== null} className={`${primaryButtonClassName} sm:mt-6`}>
          {pending === "create" ? "Guardando…" : "Agregar"}
        </button>
      </form>
      {createError ? (
        <p role="alert" className={`mt-2 ${errorClassName}`}>
          {createError}
        </p>
      ) : null}
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-muted">Todavía no hay marcas.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {items.map((brand) => {
            const message = rowError?.id === brand.id ? rowError.message : null;
            return (
              <li
                key={brand.id}
                className="rounded-md border border-rule bg-elevated px-3 py-2"
              >
                {editingId === brand.id ? (
                  <form onSubmit={(event) => onSave(event, brand.id)} className="flex flex-col gap-2">
                    <label className="flex flex-col gap-1.5 text-sm">
                      Nombre
                      <input
                        value={draftName}
                        onChange={(event) => setDraftName(event.target.value)}
                        disabled={pending !== null}
                        autoComplete="off"
                        aria-invalid={message ? true : undefined}
                        className={inputClassName}
                      />
                    </label>
                    <div className="flex gap-2">
                      <button type="submit" disabled={pending !== null} className={primaryButtonClassName}>
                        {pending === "save" ? "Guardando…" : "Guardar"}
                      </button>
                      <button
                        type="button"
                        disabled={pending !== null}
                        onClick={() => setEditingId(null)}
                        className={quietButtonClassName}
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm">{brand.name}</span>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        disabled={pending !== null}
                        onClick={() => startEdit(brand)}
                        className={quietButtonClassName}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        disabled={pending !== null}
                        onClick={() => onDelete(brand.id)}
                        className={quietButtonClassName}
                      >
                        {confirmId === brand.id ? "Confirmar" : "Eliminar"}
                      </button>
                    </div>
                  </div>
                )}
                {message ? (
                  <p role="alert" className={`mt-2 ${errorClassName}`}>
                    {message}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
