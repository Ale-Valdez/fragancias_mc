"use client";

import { catalogImageSchema } from "@fmc/shared";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState, type DragEvent } from "react";
import { adminMutate } from "@/lib/admin-mutate";
import { errorClassName, primaryButtonClassName, quietButtonClassName } from "../form-styles";

const MAX_FILES = 8;
const MAX_BYTES = 8 * 1024 * 1024;

export type ProductImage = {
  id: number;
  urlThumb: string;
  urlMedium: string;
  urlLarge: string;
  isPrimary: boolean;
  position: number;
};

function sortImages(images: ProductImage[]): ProductImage[] {
  return [...images].sort((a, b) => a.position - b.position || a.id - b.id);
}

function imageKey(images: ProductImage[]): string {
  return images.map((image) => `${image.id}:${image.position}:${image.isPrimary}`).join("|");
}

function readImageList(body: unknown): ProductImage[] | null {
  if (!Array.isArray(body)) return null;
  const images: ProductImage[] = [];
  for (const item of body) {
    const parsed = catalogImageSchema.safeParse(item);
    if (!parsed.success) return null;
    images.push(parsed.data as ProductImage);
  }
  return sortImages(images);
}

function readImage(body: unknown): ProductImage | null {
  const parsed = catalogImageSchema.safeParse(body);
  if (!parsed.success) return null;
  return parsed.data as ProductImage;
}

function isAllowed(file: File): boolean {
  if (file.type === "image/jpeg" || file.type === "image/png" || file.type === "image/webp") return true;
  return /\.(jpe?g|png|webp)$/i.test(file.name);
}

function validateFiles(files: File[]): string | null {
  if (files.length === 0) return "Elegí al menos una foto.";
  if (files.length > MAX_FILES) return "Podés subir hasta 8 fotos a la vez.";
  for (const file of files) {
    if (!isAllowed(file)) return "Usá JPEG, PNG o WebP.";
    if (file.size > MAX_BYTES) return "Cada foto puede pesar hasta 8 MB.";
  }
  return null;
}

function uploadError(message: string | undefined, status: number, error: string | null): string {
  if (error === "network") return "No se pudo conectar con el servidor.";
  if (status === 404) return "Este producto ya no existe.";
  if (message === "file_too_large") return "Cada foto puede pesar hasta 8 MB.";
  if (message === "too_many_files") return "Podés subir hasta 8 fotos a la vez.";
  if (message === "unsupported_type" || message === "invalid_image") return "Usá JPEG, PNG o WebP.";
  if (message === "required") return "Elegí al menos una foto.";
  return "No se pudieron subir las fotos.";
}

function hasFiles(transfer: DataTransfer): boolean {
  return [...transfer.types].includes("Files");
}

export function ImageManager({ productId, images: initialImages }: { productId: number; images: ProductImage[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const incoming = sortImages(initialImages);
  const incomingKey = imageKey(incoming);
  const [images, setImages] = useState(incoming);
  const [knownKey, setKnownKey] = useState(incomingKey);
  if (incomingKey !== knownKey) {
    setKnownKey(incomingKey);
    setImages(incoming);
  }

  const [fileOver, setFileOver] = useState(false);
  const [dragId, setDragId] = useState<number | null>(null);
  const [overId, setOverId] = useState<number | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function loginIfNeeded(status: number): boolean {
    if (status !== 401) return false;
    router.push("/admin/login");
    return true;
  }

  async function upload(list: FileList | File[]) {
    if (pending) return;
    const files = [...list];
    const invalid = validateFiles(files);
    if (invalid) {
      setError(invalid);
      return;
    }

    const body = new FormData();
    for (const file of files) body.append("images", file);
    setError(null);
    setConfirmId(null);
    setPending(true);
    const result = await adminMutate(`/products/${productId}/images`, "POST", body);
    setPending(false);
    if (inputRef.current) inputRef.current.value = "";
    if (!result.ok) {
      if (loginIfNeeded(result.status)) return;
      const issue = result.issues.find((item) => item.path === "images");
      setError(uploadError(issue?.message, result.status, result.error));
      return;
    }

    const created = readImageList(result.body);
    if (!created) {
      setError("Las fotos se subieron, pero no se pudieron mostrar. Recargá la página.");
      return;
    }
    setImages((current) => sortImages([...current, ...created]));
    router.refresh();
  }

  async function makePrimary(id: number) {
    if (pending) return;
    setError(null);
    setConfirmId(null);
    setPending(true);
    const result = await adminMutate(`/products/${productId}/images/${id}`, "PATCH", { isPrimary: true });
    setPending(false);
    if (!result.ok) {
      if (loginIfNeeded(result.status)) return;
      setError(
        result.status === 404
          ? "Esa foto ya no existe."
          : result.error === "network"
            ? "No se pudo conectar con el servidor."
            : "No se pudo marcar la foto principal.",
      );
      if (result.status === 404) router.refresh();
      return;
    }
    const saved = readImage(result.body);
    if (!saved) {
      router.refresh();
      return;
    }
    setImages((current) =>
      current.map((image) =>
        image.id === saved.id ? saved : { ...image, isPrimary: saved.isPrimary ? false : image.isPrimary },
      ),
    );
  }

  async function remove(id: number) {
    if (pending) return;
    if (confirmId !== id) {
      setConfirmId(id);
      setError(null);
      return;
    }
    setPending(true);
    const result = await adminMutate(`/products/${productId}/images/${id}`, "DELETE");
    setPending(false);
    if (!result.ok) {
      if (loginIfNeeded(result.status)) return;
      setConfirmId(null);
      setError(
        result.status === 404
          ? "Esa foto ya no existe."
          : result.error === "network"
            ? "No se pudo conectar con el servidor."
            : "No se pudo quitar la foto.",
      );
      if (result.status === 404) router.refresh();
      return;
    }
    setConfirmId(null);
    setImages((current) => {
      const removed = current.find((image) => image.id === id);
      const rest = current.filter((image) => image.id !== id);
      const first = rest[0];
      if (!removed?.isPrimary || !first) return rest;
      return [{ ...first, isPrimary: true }, ...rest.slice(1)];
    });
    router.refresh();
  }

  async function reorder(from: number, to: number) {
    if (pending || from === to || from < 0 || to < 0) return;
    const previous = images;
    const moved = previous.slice();
    const [item] = moved.splice(from, 1);
    if (!item) return;
    moved.splice(to, 0, item);
    const next = moved.map((image, index) => ({ ...image, position: index }));
    const updates = next.filter((image) => previous.some((before) => before.id === image.id && before.position !== image.position));
    setImages(next);
    setDragId(null);
    setOverId(null);
    setConfirmId(null);
    if (updates.length === 0) return;

    setPending(true);
    const results = await Promise.all(
      updates.map((image) =>
        adminMutate(`/products/${productId}/images/${image.id}`, "PATCH", { position: image.position }),
      ),
    );
    setPending(false);
    const failed = results.find((result) => !result.ok);
    if (!failed || failed.ok) {
      router.refresh();
      return;
    }
    if (loginIfNeeded(failed.status)) return;
    setImages(previous);
    setError(
      failed.status === 404
        ? "Esa foto ya no existe."
        : failed.error === "network"
          ? "No se pudo conectar con el servidor."
          : "No se pudo cambiar el orden.",
    );
    router.refresh();
  }

  function onZoneDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setFileOver(false);
    if (!hasFiles(event.dataTransfer)) return;
    void upload(event.dataTransfer.files);
  }

  function onCardDrop(targetId: number, event: DragEvent<HTMLLIElement>) {
    event.preventDefault();
    event.stopPropagation();
    setOverId(null);
    if (hasFiles(event.dataTransfer)) {
      setDragId(null);
      void upload(event.dataTransfer.files);
      return;
    }
    const from = images.findIndex((image) => image.id === dragId);
    const to = images.findIndex((image) => image.id === targetId);
    void reorder(from, to);
  }

  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">Fotos</h2>
      <p className="mt-1 text-sm text-muted">
        JPEG, PNG o WebP. Hasta 8 por vez y 8 MB cada una. Arrastrá desde Mover para ordenarlas. La principal es la que se muestra primero.
      </p>
      <div
        onDragEnter={(event) => {
          if (!hasFiles(event.dataTransfer)) return;
          event.preventDefault();
          setFileOver(true);
        }}
        onDragOver={(event) => {
          if (!hasFiles(event.dataTransfer)) return;
          event.preventDefault();
          setFileOver(true);
        }}
        onDragLeave={(event) => {
          const next = event.relatedTarget;
          if (next instanceof Node && event.currentTarget.contains(next)) return;
          setFileOver(false);
        }}
        onDrop={onZoneDrop}
        className={`mt-4 flex flex-col items-start gap-3 rounded-md border border-dashed px-4 py-4 ${
          fileOver ? "border-gold" : "border-rule"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          multiple
          className="sr-only"
          onChange={(event) => {
            if (event.target.files) void upload(event.target.files);
          }}
        />
        <button
          type="button"
          disabled={pending}
          onClick={() => inputRef.current?.click()}
          className={primaryButtonClassName}
        >
          {pending ? "Trabajando…" : "Elegir fotos"}
        </button>
        <p className="text-sm text-muted">o soltalas acá.</p>
      </div>
      {error ? (
        <p role="alert" className={`mt-3 ${errorClassName}`}>
          {error}
        </p>
      ) : null}
      {images.length === 0 ? (
        <p className="mt-4 text-sm text-muted">Todavía no hay fotos.</p>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-3">
          {images.map((image, index) => (
            <li
              key={image.id}
              onDragOver={(event) => {
                event.preventDefault();
                if (!hasFiles(event.dataTransfer)) setOverId(image.id);
              }}
              onDragLeave={() => setOverId((current) => (current === image.id ? null : current))}
              onDrop={(event) => onCardDrop(image.id, event)}
              className={`overflow-hidden rounded-md border ${
                overId === image.id && dragId !== image.id
                  ? "border-gold"
                  : "border-rule"
              } ${dragId === image.id ? "opacity-60" : ""}`}
            >
              <div className="relative aspect-square">
                <Image src={image.urlThumb} alt="" fill unoptimized className="object-cover" sizes="240px" />
              </div>
              <div className="flex flex-col gap-2 p-2">
                {image.isPrimary ? (
                  <span className="text-xs font-medium">Principal</span>
                ) : (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => void makePrimary(image.id)}
                    className={quietButtonClassName}
                  >
                    Hacer principal
                  </button>
                )}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    draggable={!pending}
                    disabled={pending}
                    aria-label="Arrastrar para ordenar"
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", String(image.id));
                      setDragId(image.id);
                    }}
                    onDragEnd={() => {
                      setDragId(null);
                      setOverId(null);
                    }}
                    className={`${quietButtonClassName} cursor-grab`}
                  >
                    Mover
                  </button>
                  <button
                    type="button"
                    disabled={pending || index === 0}
                    onClick={() => void reorder(index, index - 1)}
                    className={quietButtonClassName}
                  >
                    Antes
                  </button>
                  <button
                    type="button"
                    disabled={pending || index === images.length - 1}
                    onClick={() => void reorder(index, index + 1)}
                    className={quietButtonClassName}
                  >
                    Después
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => void remove(image.id)}
                    className={quietButtonClassName}
                  >
                    {confirmId === image.id ? "Confirmar" : "Quitar"}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
