"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { adminMutate } from "@/lib/admin-mutate";
import { inputClassName } from "./form-styles";
import { formatPrice, GENDER_LABEL, STATUS_LABEL, type ProductList, type ProductRow, type Status } from "./product-labels";

const STATUSES: Status[] = ["draft", "published", "archived"];

const iconButtonClass =
  "inline-flex h-11 w-11 items-center justify-center rounded-md text-reason hover:text-ink disabled:opacity-60 md:h-9 md:w-9";

function listSignature(products: ProductList): string {
  return products.items.map((item) => `${item.id}:${item.status}`).join("|");
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es");
}

function matchesQuery(product: ProductRow, query: string): boolean {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = normalize(`${product.name} ${product.brand.name}`);
  return words.every((word) => haystack.includes(word));
}

function StatusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="5.25" />
      <circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M9.5 3.5 12.5 6.5 5.5 13.5 2.5 13.5 2.5 10.5 9.5 3.5z" />
      <path d="M8.2 4.8 11.2 7.8" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3.5 4.5h9" />
      <path d="M6 4.5V3.2h4V4.5" />
      <path d="M4.5 4.5 5.2 13h5.6l.7-8.5" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4.5 4.5 11.5 11.5M11.5 4.5 4.5 11.5" />
    </svg>
  );
}

function ProductActions({
  product,
  pending,
  menuOpen,
  confirming,
  onToggleMenu,
  onStatus,
  onAskDelete,
  onCancelDelete,
  onDelete,
}: {
  product: ProductRow;
  pending: boolean;
  menuOpen: boolean;
  confirming: boolean;
  onToggleMenu: () => void;
  onStatus: (status: Status) => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onDelete: () => void;
}) {
  const statusButtonRef = useRef<HTMLButtonElement>(null);
  const [menuBox, setMenuBox] = useState<{ top: number; right: number } | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function place() {
      const rect = statusButtonRef.current?.getBoundingClientRect();
      if (!rect) return;
      setMenuBox({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [menuOpen]);

  return (
    <div data-product-actions="" className="inline-flex items-center justify-end gap-1">
      <div>
        <button
          ref={statusButtonRef}
          type="button"
          aria-label={`Cambiar estado de ${product.name}`}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          disabled={pending}
          onClick={onToggleMenu}
          className={iconButtonClass}
        >
          <StatusIcon />
        </button>
        {menuOpen && menuBox ? (
          <div
            role="menu"
            aria-label="Estado"
            style={{ top: menuBox.top, right: menuBox.right }}
            className="fixed z-20 w-36 border border-rule bg-elevated py-1 text-left shadow-lg"
          >
            {STATUSES.map((status) => {
              const current = status === product.status;
              return (
                <button
                  key={status}
                  type="button"
                  role="menuitem"
                  disabled={pending}
                  onClick={() => onStatus(status)}
                  className={`block w-full px-3 py-3 text-left text-sm disabled:opacity-60 md:py-2 ${
                    current ? "text-gold" : "text-ink hover:bg-page"
                  }`}
                >
                  {STATUS_LABEL[status]}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
      <Link href={`/admin/productos/${product.id}`} aria-label={`Editar ${product.name}`} className={iconButtonClass}>
        <PencilIcon />
      </Link>
      {confirming ? (
        <>
          <button
            type="button"
            aria-label={`Confirmar eliminación de ${product.name}`}
            disabled={pending}
            onClick={onDelete}
            className={`${iconButtonClass} text-danger hover:text-danger`}
          >
            <CheckIcon />
          </button>
          <button
            type="button"
            aria-label="Cancelar eliminación"
            disabled={pending}
            onClick={onCancelDelete}
            className={iconButtonClass}
          >
            <CloseIcon />
          </button>
        </>
      ) : (
        <button
          type="button"
          aria-label={`Eliminar ${product.name}`}
          disabled={pending}
          onClick={onAskDelete}
          className={`${iconButtonClass} hover:text-danger`}
        >
          <TrashIcon />
        </button>
      )}
    </div>
  );
}

export function ProductList({ products }: { products: ProductList }) {
  const router = useRouter();
  const signature = listSignature(products);
  const [items, setItems] = useState(products.items);
  const [seen, setSeen] = useState(signature);
  const [menuId, setMenuId] = useState<number | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  if (signature !== seen) {
    setSeen(signature);
    setItems(products.items);
  }

  useEffect(() => {
    if (menuId === null && confirmId === null) return;
    function onPointer(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Element && target.closest("[data-product-actions]")) return;
      setMenuId(null);
      setConfirmId(null);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuId(null);
        setConfirmId(null);
      }
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuId, confirmId]);

  if (items.length === 0) {
    return <p className="mt-6 text-sm text-muted">Todavía no hay productos.</p>;
  }

  const removed = products.items.length - items.length;
  const total = products.total - removed;
  const visible = items.filter((product) => matchesQuery(product, query));
  const searching = query.trim().length > 0;

  async function changeStatus(product: ProductRow, status: Status) {
    setMenuId(null);
    setConfirmId(null);
    if (status === product.status || pendingId !== null) return;
    setPendingId(product.id);
    setError(null);
    const result = await adminMutate(`/products/${product.id}`, "PATCH", { status });
    setPendingId(null);
    if (!result.ok) {
      if (result.status === 401) {
        router.push("/admin/login");
        return;
      }
      setError(
        result.status === 404
          ? `${product.name} ya no existe.`
          : result.error === "network"
            ? "No se pudo conectar con el servidor."
            : `No se pudo cambiar el estado de ${product.name}.`,
      );
      return;
    }
    setItems((current) => current.map((item) => (item.id === product.id ? { ...item, status } : item)));
    router.refresh();
  }

  async function remove(product: ProductRow) {
    if (pendingId !== null) return;
    setPendingId(product.id);
    setError(null);
    const result = await adminMutate(`/products/${product.id}`, "DELETE");
    setPendingId(null);
    setConfirmId(null);
    if (!result.ok) {
      if (result.status === 401) {
        router.push("/admin/login");
        return;
      }
      setError(
        result.status === 404
          ? `${product.name} ya no existe.`
          : result.error === "network"
            ? "No se pudo conectar con el servidor."
            : `No se pudo eliminar ${product.name}.`,
      );
      return;
    }
    setItems((current) => current.filter((item) => item.id !== product.id));
    router.refresh();
  }

  function actions(product: ProductRow) {
    return (
      <ProductActions
        product={product}
        pending={pendingId === product.id}
        menuOpen={menuId === product.id}
        confirming={confirmId === product.id}
        onToggleMenu={() => {
          setConfirmId(null);
          setMenuId((current) => (current === product.id ? null : product.id));
        }}
        onStatus={(status) => void changeStatus(product, status)}
        onAskDelete={() => {
          setMenuId(null);
          setConfirmId(product.id);
        }}
        onCancelDelete={() => setConfirmId(null)}
        onDelete={() => void remove(product)}
      />
    );
  }

  return (
    <>
      <label className="mt-4 block text-sm">
        <span className="sr-only">Buscar por producto o marca</span>
        <input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setMenuId(null);
            setConfirmId(null);
          }}
          placeholder="Buscar producto o marca"
          autoComplete="off"
          className={inputClassName}
        />
      </label>
      <p className="mt-3 text-sm text-muted">
        {searching
          ? visible.length === 1
            ? "1 resultado."
            : `${visible.length} resultados.`
          : items.length === total
            ? `${total} en total.`
            : `Se muestran ${items.length} de ${total}.`}
      </p>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {visible.length === 0 ? <p className="mt-4 text-sm text-muted">Ningún producto coincide con la búsqueda.</p> : null}
      {visible.length > 0 ? (
      <ul className="mt-4 flex flex-col gap-3 md:hidden">
        {visible.map((product) => (
          <li key={product.id} className="rounded-lg border border-rule bg-elevated px-4 py-3">
            <p className="font-medium">{product.name}</p>
            <p className="text-sm text-muted">{product.brand.name}</p>
            <p className="text-sm">
              {GENDER_LABEL[product.gender]} · {STATUS_LABEL[product.status]}
            </p>
            <p className="text-sm">{formatPrice(product.priceCents)}</p>
            <div className="mt-3 flex justify-end">{actions(product)}</div>
          </li>
        ))}
      </ul>
      ) : null}
      {visible.length > 0 ? (
      <div className="mt-4 hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead className="text-muted">
            <tr>
              <th className="py-2 pr-4 font-medium">Producto</th>
              <th className="py-2 pr-4 font-medium">Marca</th>
              <th className="py-2 pr-4 font-medium">Género</th>
              <th className="py-2 pr-4 font-medium">Estado</th>
              <th className="py-2 pr-4 font-medium">Precio</th>
              <th className="py-2 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((product) => (
              <tr key={product.id} className="border-t border-rule">
                <td className="py-2 pr-4 font-medium">{product.name}</td>
                <td className="py-2 pr-4">{product.brand.name}</td>
                <td className="py-2 pr-4">{GENDER_LABEL[product.gender]}</td>
                <td className="py-2 pr-4">{STATUS_LABEL[product.status]}</td>
                <td className="py-2 pr-4">{formatPrice(product.priceCents)}</td>
                <td className="py-2 text-right">{actions(product)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      ) : null}
    </>
  );
}
