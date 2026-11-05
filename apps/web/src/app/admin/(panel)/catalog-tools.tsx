"use client";

import { priceAdjustSchema } from "@fmc/shared";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { adminMutate, type AdminIssue } from "@/lib/admin-mutate";
import { errorClassName, inputClassName, primaryButtonClassName, quietButtonClassName } from "./form-styles";
import { formatPrice, GENDER_LABEL, STATUS_LABEL, type Gender, type ProductList } from "./product-labels";

type Mode = "percent" | "delta" | "set";

type BrandRow = {
  id: number;
  name: string;
};

const CSV_FIELD: Record<string, string> = {
  name: "nombre",
  brand: "marca",
  gender: "género",
  description: "descripción",
  price: "precio",
  status: "estado",
  featured: "destacado",
  notes_top: "notas de salida",
  notes_heart: "notas de corazón",
  notes_base: "notas de fondo",
};

const CSV_HEADER =
  "name,brand,gender,description,price,status,featured,notes_top,notes_heart,notes_base\n";

function formatSignedPrice(cents: number): string {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(cents / 100);
}

function pesosToCents(text: string, allowNegative: boolean): number | undefined {
  const value = text.trim();
  const pattern = allowNegative ? /^-?\d+(\.\d{1,2})?$/ : /^\d+(\.\d{1,2})?$/;
  if (!pattern.test(value)) return undefined;
  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const [whole, frac = ""] = unsigned.split(".");
  if (whole === undefined) return undefined;
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents)) return undefined;
  return negative ? -cents : cents;
}

function issueText(message: string): string {
  if (message === "invalid_price") return "el precio va en pesos, vacío o con hasta 2 decimales";
  if (message === "invalid_boolean") return "usá si, no, true o false";
  if (message === "note_too_long") return "cada nota puede tener hasta 80 caracteres";
  if (message === "empty_slug") return "ese nombre no se puede usar";
  if (message === "invalid_csv") return "el archivo no es un CSV válido";
  if (message === "unsupported_type") return "elegí un archivo .csv";
  if (message === "file_too_large") return "el archivo puede pesar hasta 2 MB";
  if (message === "required" || message === "invalid_file") return "elegí un archivo .csv";
  return "el valor no es válido";
}

function formatCsvIssue(issue: AdminIssue): string {
  const text = issueText(issue.message);
  const match = /^(\d+)\.(.+)$/.exec(issue.path);
  if (!match) return text.charAt(0).toUpperCase() + text.slice(1) + ".";
  const field = CSV_FIELD[match[2] ?? ""] ?? match[2];
  return `Fila ${match[1]}, ${field}: ${text}.`;
}

function readUpdated(body: unknown): number | null {
  if (!body || typeof body !== "object" || !("updated" in body)) return null;
  const updated = body.updated;
  return typeof updated === "number" && Number.isInteger(updated) && updated >= 0 ? updated : null;
}

function readImport(body: unknown): { created: number; updated: number } | null {
  if (!body || typeof body !== "object" || !("created" in body) || !("updated" in body)) return null;
  const created = body.created;
  const updated = body.updated;
  if (typeof created !== "number" || typeof updated !== "number") return null;
  if (!Number.isInteger(created) || !Number.isInteger(updated) || created < 0 || updated < 0) return null;
  return { created, updated };
}

export function CatalogTools({ brands, products }: { brands: BrandRow[]; products: ProductList }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>("percent");
  const [rawValue, setRawValue] = useState("");
  const [brandId, setBrandId] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [selected, setSelected] = useState<number[]>([]);
  const [confirmPrice, setConfirmPrice] = useState(false);
  const [priceSummary, setPriceSummary] = useState<string | null>(null);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [priceNotice, setPriceNotice] = useState<string | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvIssues, setCsvIssues] = useState<string[]>([]);
  const [csvNotice, setCsvNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<"price" | "csv" | null>(null);

  const visibleIds = products.items.map((product) => product.id);
  const selectedVisible = selected.filter((id) => visibleIds.includes(id));
  const allVisible = visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id));

  function loginIfNeeded(status: number): boolean {
    if (status !== 401) return false;
    router.push("/admin/login");
    return true;
  }

  function touchPrice() {
    setConfirmPrice(false);
    setPriceSummary(null);
    setPriceNotice(null);
  }

  function toggleAll() {
    touchPrice();
    setSelected(allVisible ? [] : visibleIds);
  }

  function toggleOne(id: number) {
    touchPrice();
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function buildAdjustment(): { body: unknown; summary: string } | { error: string } {
    let value: number | undefined;
    if (mode === "percent") {
      if (!/^-?\d+$/.test(rawValue.trim())) return { error: "El porcentaje tiene que ser un entero. 10 suma 10%." };
      value = Number(rawValue.trim());
    } else {
      value = pesosToCents(rawValue, mode === "delta");
      if (value === undefined) {
        return {
          error:
            mode === "set"
              ? "El precio nuevo va en pesos y no puede ser negativo."
              : "El importe va en pesos. Un valor negativo resta.",
        };
      }
    }

    const body: {
      mode: Mode;
      value: number;
      brandId?: number;
      gender?: Gender;
      productIds?: number[];
    } = { mode, value };
    const brand = brands.find((item) => item.id === Number(brandId));
    if (brandId !== "") {
      if (!brand) return { error: "Elegí una marca." };
      body.brandId = brand.id;
    }
    if (gender !== "") body.gender = gender;
    if (selectedVisible.length > 0) body.productIds = selectedVisible;

    const parsed = priceAdjustSchema.safeParse(body);
    if (!parsed.success) return { error: "Revisá el ajuste." };

    const filters = [brand?.name, gender === "" ? "" : GENDER_LABEL[gender].toLowerCase()].filter(
      (item): item is string => Boolean(item),
    );
    const who =
      selectedVisible.length === 0
        ? "todos los productos"
        : selectedVisible.length === 1
          ? "1 producto marcado"
          : `${selectedVisible.length} productos marcados`;
    const scope = `${who}${filters.length > 0 ? ` (${filters.join(", ")})` : ""} que ya tienen precio`;

    const summary =
      mode === "percent"
        ? `Aplicar ${value > 0 ? "+" : ""}${value}% a ${scope}.`
        : mode === "set"
          ? `Fijar ${formatSignedPrice(value)} en ${scope}.`
          : value < 0
            ? `Restar ${formatSignedPrice(Math.abs(value))} a ${scope}.`
            : `Sumar ${formatSignedPrice(value)} a ${scope}.`;

    return { body: parsed.data, summary };
  }

  async function onAdjust(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPriceError(null);
    const built = buildAdjustment();
    if ("error" in built) {
      setConfirmPrice(false);
      setPriceSummary(null);
      setPriceError(built.error);
      return;
    }
    if (!confirmPrice) {
      setPriceSummary(built.summary);
      setConfirmPrice(true);
      return;
    }

    setPending("price");
    const result = await adminMutate("/products/prices", "POST", built.body);
    setPending(null);
    setConfirmPrice(false);
    if (!result.ok) {
      if (loginIfNeeded(result.status)) return;
      setPriceError(
        result.error === "network" ? "No se pudo conectar con el servidor." : "No se pudieron ajustar los precios.",
      );
      return;
    }
    const updated = readUpdated(result.body);
    setPriceNotice(
      updated === null
        ? "El ajuste se aplicó, pero no se pudo leer el resultado."
        : updated === 0
          ? "Ningún precio cambió."
          : updated === 1
            ? "Se actualizó 1 precio."
            : `Se actualizaron ${updated} precios.`,
    );
    router.refresh();
  }

  function downloadTemplate() {
    const blob = new Blob([CSV_HEADER], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "catalogo.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function onImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setCsvError(null);
    setCsvIssues([]);
    setCsvNotice(null);
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setCsvError("Elegí un archivo .csv.");
      return;
    }
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setCsvError("Elegí un archivo .csv.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setCsvError("El archivo puede pesar hasta 2 MB.");
      return;
    }

    const body = new FormData();
    body.append("file", file);
    setPending("csv");
    const result = await adminMutate("/catalog/import", "POST", body);
    setPending(null);
    if (fileRef.current) fileRef.current.value = "";
    if (!result.ok) {
      if (loginIfNeeded(result.status)) return;
      const issues = result.issues.map(formatCsvIssue);
      setCsvIssues(issues.slice(0, 8));
      setCsvError(
        result.error === "network"
          ? "No se pudo conectar con el servidor."
          : issues.length > 8
            ? `Hay ${issues.length} filas o datos para revisar. Se muestran los primeros.`
            : issues.length > 0
              ? "No se importó nada. Corregí el archivo y volvé a subirlo."
              : "No se pudo importar el archivo.",
      );
      return;
    }
    const counts = readImport(result.body);
    setCsvNotice(
      counts
        ? `Se crearon ${counts.created} y se actualizaron ${counts.updated}.`
        : "El archivo se importó, pero no se pudo leer el resultado.",
    );
    router.refresh();
  }

  return (
    <section className="flex flex-col gap-10">
      <div className="grid gap-8 lg:grid-cols-2">
        <form onSubmit={onAdjust} noValidate className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Ajustar precios</h2>
          <p className="text-sm text-muted">
            Solo cambia productos que ya tienen precio, incluidos borradores y archivados. Sin marca, género ni
            marcados, alcanza a todo el catálogo.
          </p>
          <label className="flex flex-col gap-1.5 text-sm">
            Tipo
            <select
              value={mode}
              disabled={pending !== null}
              onChange={(event) => {
                setMode(event.target.value as Mode);
                touchPrice();
              }}
              className={inputClassName}
            >
              <option value="percent">Porcentaje</option>
              <option value="delta">Sumar o restar</option>
              <option value="set">Fijar precio</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            {mode === "percent" ? "Porcentaje" : "Importe (ARS)"}
            <input
              value={rawValue}
              disabled={pending !== null}
              inputMode={mode === "percent" ? "numeric" : "decimal"}
              autoComplete="off"
              onChange={(event) => {
                setRawValue(event.target.value);
                touchPrice();
              }}
              className={inputClassName}
            />
            <span className="text-xs text-muted">
              {mode === "percent"
                ? "Entero. 10 suma 10% y -10 resta 10%."
                : mode === "delta"
                  ? "En pesos. Un valor negativo resta. Punto para los centavos."
                  : "Precio nuevo en pesos. No puede ser negativo."}
            </span>
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            Marca
            <select
              value={brandId}
              disabled={pending !== null}
              onChange={(event) => {
                setBrandId(event.target.value);
                touchPrice();
              }}
              className={inputClassName}
            >
              <option value="">Todas</option>
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            Género
            <select
              value={gender}
              disabled={pending !== null}
              onChange={(event) => {
                setGender(event.target.value as Gender | "");
                touchPrice();
              }}
              className={inputClassName}
            >
              <option value="">Todos</option>
              {(Object.keys(GENDER_LABEL) as Gender[]).map((value) => (
                <option key={value} value={value}>
                  {GENDER_LABEL[value]}
                </option>
              ))}
            </select>
          </label>
          {priceSummary ? <p className="text-sm">{priceSummary}</p> : null}
          {priceError ? (
            <p role="alert" className={errorClassName}>
              {priceError}
            </p>
          ) : null}
          {priceNotice ? <p className="text-sm text-muted">{priceNotice}</p> : null}
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={pending !== null} className={primaryButtonClassName}>
              {pending === "price" ? "Aplicando…" : confirmPrice ? "Confirmar ajuste" : "Aplicar"}
            </button>
            {confirmPrice ? (
              <button
                type="button"
                disabled={pending !== null}
                onClick={() => {
                  setConfirmPrice(false);
                  setPriceSummary(null);
                }}
                className={quietButtonClassName}
              >
                Cancelar
              </button>
            ) : null}
          </div>
        </form>
        <form onSubmit={onImport} noValidate className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Importar CSV</h2>
          <p className="text-sm text-muted">
            Columnas: name, brand, gender, description, price, status, featured, notes_top, notes_heart, notes_base. El
            precio va en pesos. Si una fila está mal, no se escribe nada. Las fotos y el orden no se tocan.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            disabled={pending !== null}
            className="text-sm"
          />
          {csvError ? (
            <p role="alert" className={errorClassName}>
              {csvError}
            </p>
          ) : null}
          {csvIssues.length > 0 ? (
            <ul className={`list-disc pl-5 ${errorClassName}`}>
              {csvIssues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          ) : null}
          {csvNotice ? <p className="text-sm text-muted">{csvNotice}</p> : null}
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={pending !== null} className={primaryButtonClassName}>
              {pending === "csv" ? "Importando…" : "Importar"}
            </button>
            <button type="button" disabled={pending !== null} onClick={downloadTemplate} className={quietButtonClassName}>
              Descargar plantilla
            </button>
          </div>
        </form>
      </div>
      <div>
        <h2 className="text-lg font-semibold">Productos a incluir</h2>
        <p className="mt-2 text-sm text-muted">
          {products.items.length === products.total
            ? `${products.total} en total.`
            : `Se muestran ${products.items.length} de ${products.total}.`}
          {selectedVisible.length > 0
            ? ` ${selectedVisible.length} marcados: el ajuste solo los toca a ellos.`
            : " Sin marcados, el ajuste usa la marca y el género de arriba."}
        </p>
        {products.items.length === 0 ? (
          <p className="mt-4 text-sm text-muted">Todavía no hay productos.</p>
        ) : (
          <>
            <ul className="mt-4 flex flex-col gap-2 md:hidden">
              <li className="flex items-center gap-3 px-1 py-1 text-sm text-muted">
                <input
                  type="checkbox"
                  checked={allVisible}
                  disabled={pending !== null}
                  onChange={toggleAll}
                  aria-label="Marcar los productos visibles"
                  className="h-5 w-5"
                />
                Marcar visibles
              </li>
              {products.items.map((product) => (
                <li key={product.id}>
                  <label className="flex items-start gap-3 rounded-lg border border-rule bg-elevated px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.includes(product.id)}
                      disabled={pending !== null}
                      onChange={() => toggleOne(product.id)}
                      aria-label={`Marcar ${product.name}`}
                      className="mt-0.5 h-5 w-5"
                    />
                    <span className="flex min-w-0 flex-col gap-0.5 text-sm">
                      <span className="font-medium">{product.name}</span>
                      <span className="text-muted">{product.brand.name}</span>
                      <span>
                        {GENDER_LABEL[product.gender]} · {STATUS_LABEL[product.status]} · {formatPrice(product.priceCents)}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="mt-4 hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="text-muted">
                  <tr>
                    <th className="py-2 pr-4 font-medium">
                      <input
                        type="checkbox"
                        checked={allVisible}
                        disabled={pending !== null}
                        onChange={toggleAll}
                        aria-label="Marcar los productos visibles"
                      />
                    </th>
                    <th className="py-2 pr-4 font-medium">Producto</th>
                    <th className="py-2 pr-4 font-medium">Marca</th>
                    <th className="py-2 pr-4 font-medium">Género</th>
                    <th className="py-2 pr-4 font-medium">Estado</th>
                    <th className="py-2 font-medium">Precio</th>
                  </tr>
                </thead>
                <tbody>
                  {products.items.map((product) => (
                    <tr key={product.id} className="border-t border-rule">
                      <td className="py-2 pr-4">
                        <input
                          type="checkbox"
                          checked={selected.includes(product.id)}
                          disabled={pending !== null}
                          onChange={() => toggleOne(product.id)}
                          aria-label={`Marcar ${product.name}`}
                        />
                      </td>
                      <td className="py-2 pr-4">{product.name}</td>
                      <td className="py-2 pr-4">{product.brand.name}</td>
                      <td className="py-2 pr-4">{GENDER_LABEL[product.gender]}</td>
                      <td className="py-2 pr-4">{STATUS_LABEL[product.status]}</td>
                      <td className="py-2">{formatPrice(product.priceCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
