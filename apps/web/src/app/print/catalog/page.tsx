import { catalogListSchema } from "@fmc/shared";
import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";

export const instant = false;

export const metadata: Metadata = {
  title: "Catálogo · Fragancias MC",
  robots: { index: false, follow: false },
};

const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? "http://localhost:4000";
const PER_PAGE = 20;

type Gender = "femenino" | "masculino" | "unisex";

type PrintProduct = {
  name: string;
  gender: Gender;
  description: string | null;
  brand: { name: string };
  images: { urlMedium: string; isPrimary: boolean }[];
  notes: { top: string[]; heart: string[]; base: string[] };
};

type Card = {
  name: string;
  brand: string;
  description: string;
  notes: string;
  image: string | null;
};

type Sheet = {
  number: string;
  title: string;
  continued: boolean;
  cards: Card[];
};

const FOOTER_BRAND = "Extractos de 60 ml · inspirados en la fragancia de cada imagen";
const SECTION_META = "60 ml · Extracto de perfume";

const PRINT_CSS = `
  *, *::before, *::after { box-sizing: border-box; }
  html, body {
    margin: 0;
    background: #e6e6e6;
    color: #ffffff;
    font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: auto;
    -moz-osx-font-smoothing: auto;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  nextjs-portal, [data-next-badge-root] { display: none !important; }
  .catalog[data-theme="dark"] {
    --page: #0A192F;
    --ink: #ffffff;
    --gold: #D3AE37;
    --gold-bright: #E4C56A;
    --muted: #9AA6B8;
    --reason: #C5CEDA;
    --footer: #7E8BA0;
    --rule: #243656;
    --frame: #D3AE37;
    --card: #ffffff;
    --card-edge: transparent;
  }
  .catalog[data-theme="light"] {
    --page: #F6F3EC;
    --ink: #0A192F;
    --gold: #8A6918;
    --gold-bright: #6F5410;
    --muted: #5C6774;
    --reason: #243044;
    --footer: #5E6874;
    --rule: #E4D9C6;
    --frame: #8A6918;
    --card: #ffffff;
    --card-edge: #E3D9C8;
  }
  .sheet {
    width: 210mm;
    height: 297mm;
    background: var(--page);
    color: var(--ink);
    position: relative;
    overflow: hidden;
    page-break-after: always;
    font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  }
  .sheet:last-child { page-break-after: auto; }
  .frame {
    position: absolute;
    top: 7mm; left: 7mm; right: 7mm; bottom: 7mm;
    border: 0.6pt solid var(--frame);
    pointer-events: none;
  }
  .cover {
    min-height: 297mm;
    padding: 16mm 16mm 28mm;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
  }
  .kicker {
    letter-spacing: 0.35em;
    font-size: 11px;
    color: var(--gold);
    text-transform: uppercase;
    margin-bottom: 7mm;
  }
  .logo {
    width: 46mm;
    height: 46mm;
    margin-bottom: 2mm;
    display: block;
  }
  .rule { width: 32mm; height: 0.5pt; background: var(--gold); margin: 5mm auto 7mm; }
  .lead {
    font-size: 15px;
    font-weight: 200;
    line-height: 1.35;
    max-width: 150mm;
    margin-bottom: 4mm;
  }
  .note {
    font-size: 12px;
    color: var(--muted);
    line-height: 1.55;
    max-width: 152mm;
    margin-bottom: 7mm;
  }
  .note strong { color: var(--gold-bright); font-weight: 500; }
  .stats {
    display: flex;
    align-items: center;
    gap: 10mm;
    margin: 0 0 8mm;
  }
  .stat { text-align: center; }
  .stat-value {
    font-size: 22px;
    font-weight: 200;
    letter-spacing: 0.04em;
    display: block;
  }
  .stat-label {
    font-size: 6px;
    letter-spacing: 0.22em;
    color: var(--gold);
    text-transform: uppercase;
    margin-top: 1mm;
    display: block;
  }
  .stat-label.wide {
    letter-spacing: 0.08em;
    max-width: 42mm;
    line-height: 1.35;
  }
  .stat-sep {
    width: 0.5pt;
    height: 9mm;
    background: var(--gold);
    opacity: 0.5;
  }
  .reasons { display: flex; flex-direction: column; gap: 2.2mm; margin-bottom: 9mm; align-items: flex-start; }
  .reasons-title {
    align-self: center;
    font-size: 10px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--gold);
    margin-bottom: 1mm;
  }
  .reason { font-size: 12px; color: var(--reason); padding-left: 4mm; position: relative; }
  .reason::before {
    content: "";
    position: absolute;
    left: 0; top: 0.62em;
    width: 2mm; height: 0.5pt;
    background: var(--gold);
  }
  .close { font-size: 15px; font-style: italic; color: var(--gold-bright); margin-bottom: 2.5mm; }
  .invite {
    font-size: 8px;
    color: var(--muted);
    letter-spacing: 0.03em;
    line-height: 1.45;
    max-width: 130mm;
    margin-bottom: 7mm;
  }
  .slogan {
    font-size: 10px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--gold);
    border-top: 0.5pt solid var(--gold);
    border-bottom: 0.5pt solid var(--gold);
    padding: 2.2mm 5mm;
  }
  .section {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    padding: 11mm 14mm 0;
  }
  .section-number { font-size: 11px; color: var(--gold); letter-spacing: 0.3em; }
  .section-title { font-size: 32px; font-weight: 200; letter-spacing: 0.06em; line-height: 1; margin-top: 1mm; }
  .section-meta { font-size: 10px; color: var(--muted); letter-spacing: 0.18em; text-transform: uppercase; }
  .grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    align-content: start;
    column-gap: 3mm;
    row-gap: 8mm;
    padding: 6mm 12mm 24mm;
  }
  .card { display: flex; flex-direction: column; align-items: center; text-align: center; }
  .photo {
    position: relative;
    width: 29mm; height: 29mm;
    background: var(--card);
    border: 0.4pt solid var(--card-edge);
    margin-bottom: 2mm;
  }
  .name {
    font-size: 9px; font-weight: 600; letter-spacing: 0.06em;
    text-transform: uppercase; line-height: 1.25; min-height: 2.4em;
  }
  .brand { font-size: 8px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--gold); margin: 0.6mm 0; }
  .desc, .notes {
    font-size: 8px; color: var(--muted); line-height: 1.35;
    max-height: 2.7em; overflow: hidden;
  }
  .desc { font-style: italic; }
  .notes { color: var(--gold); margin-top: 0.8mm; }
  .footer {
    position: absolute; bottom: 10mm; left: 14mm; right: 14mm;
    display: flex; justify-content: space-between;
    border-top: 0.5pt solid var(--rule); padding-top: 2mm;
    font-size: 8px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--footer);
  }
  @page { size: A4 portrait; margin: 0; }
  @media print { .sheet { page-break-after: always; } }
`;

function shortText(value: string | null): string {
  if (!value) return "";
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= 90) return text;
  return `${text.slice(0, 87).trimEnd()}…`;
}

function toCard(product: PrintProduct): Card {
  const image = product.images.find((item) => item.isPrimary) ?? product.images[0];
  const notes = [...product.notes.top, ...product.notes.heart, ...product.notes.base];
  return {
    name: product.name,
    brand: product.brand.name,
    description: shortText(product.description),
    notes: notes.join(" · "),
    image: image?.urlMedium ?? null,
  };
}

function sheetsFor(number: string, title: string, products: PrintProduct[]): Sheet[] {
  const cards = products.map(toCard);
  const sheets: Sheet[] = [];
  for (let offset = 0; offset < cards.length; offset += PER_PAGE) {
    sheets.push({
      number,
      title,
      continued: offset > 0,
      cards: cards.slice(offset, offset + PER_PAGE),
    });
  }
  return sheets;
}

async function loadPublished(): Promise<PrintProduct[]> {
  const items: PrintProduct[] = [];
  let offset = 0;
  for (;;) {
    const response = await fetch(
      `${API_INTERNAL_URL}/api/catalog/products?limit=100&offset=${offset}&sort=sort`,
      { cache: "no-store" },
    );
    if (!response.ok) throw new Error("No se pudo leer el catálogo publicado");
    const parsed = catalogListSchema.safeParse(await response.json());
    if (!parsed.success) throw new Error("El catálogo publicado no tiene el formato esperado");
    const page = parsed.data as { items: PrintProduct[]; total: number };
    items.push(...page.items);
    if (items.length >= page.total || page.items.length === 0) return items;
    offset += page.items.length;
  }
}

function pageLabel(page: number, total: number): string {
  return `${String(page).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
}

type PrintPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function printTheme(value: string | string[] | undefined): "dark" | "light" {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "light" ? "light" : "dark";
}

export default function PrintCatalogPage({ searchParams }: PrintPageProps) {
  return (
    <Suspense fallback={<p className="px-6 py-10 text-sm">Cargando…</p>}>
      <PrintedCatalog searchParams={searchParams} />
    </Suspense>
  );
}

async function PrintedCatalog({ searchParams }: PrintPageProps) {
  const theme = printTheme((await searchParams).theme);
  const products = await loadPublished();
  const sheets = [
    ...sheetsFor(
      "01",
      "Masculino y Unisex",
      products.filter((product) => product.gender === "masculino" || product.gender === "unisex"),
    ),
    ...sheetsFor(
      "02",
      "Femeninos",
      products.filter((product) => product.gender === "femenino"),
    ),
  ];
  const total = 1 + sheets.length;

  return (
    <div className="catalog" data-theme={theme} data-catalog-ready="true">
      <style>{PRINT_CSS}</style>
      <article className="sheet">
        <div className="frame" />
        <div className="cover">
          <p className="kicker">Catálogo de perfumes</p>
          <img
            className="logo"
            src="/logo-fragancias-mc.png"
            alt="Fragancias MC · Rojas - Junín - Pergamino"
          />
          <div className="rule" />
          <p className="lead">Extractos de perfume de 60 ml, inspirados en tus fragancias favoritas.</p>
          <p className="note">
            Cada extracto está elaborado para ofrecer una experiencia olfativa muy similar a la del perfume de
            referencia, con una similitud aromática estimada del <strong>90% al 95%</strong>. Las imágenes de este
            catálogo muestran esas fragancias originales: el producto es el extracto.
          </p>
          <div className="stats">
            <div className="stat">
              <span className="stat-value">60 ml</span>
              <span className="stat-label">Extracto</span>
            </div>
            <div className="stat-sep" />
            <div className="stat">
              <span className="stat-value">90–95%</span>
              <span className="stat-label wide">Similitud aromática estimada</span>
            </div>
          </div>
          <div className="reasons">
            <p className="reasons-title">Por qué elegirlos</p>
            <p className="reason">Presentación de 60 ml</p>
            <p className="reason">Inspirados en perfumes reconocidos</p>
            <p className="reason">Aromas de excelente duración</p>
            <p className="reason">Femeninas, masculinas y unisex</p>
            <p className="reason">Tu fragancia favorita, a un precio accesible</p>
          </div>
          <p className="close">Tu esencia, tu estilo, tu personalidad.</p>
          <p className="invite">Elegí tu favorito y encontrá el aroma que te representa.</p>
          <p className="slogan">Olores que enamoran, aromas que dejan huella.</p>
        </div>
        <footer className="footer">
          <span>{FOOTER_BRAND}</span>
          <span>{pageLabel(1, total)}</span>
        </footer>
      </article>
      {sheets.map((sheet, index) => (
        <article className="sheet" key={`${sheet.number}-${index}`}>
          <div className="frame" />
          <header className="section">
            <div>
              <p className="section-number">{sheet.number}</p>
              <h1 className="section-title">{sheet.title}</h1>
            </div>
            <p className="section-meta">{SECTION_META}</p>
          </header>
          <div className="grid">
            {sheet.cards.map((card, cardIndex) => (
              <div className="card" key={`${card.brand}-${card.name}-${cardIndex}`}>
                <div className="photo">
                  {card.image ? (
                    <Image src={card.image} alt="" fill unoptimized className="object-contain p-[2.5mm]" sizes="120px" />
                  ) : null}
                </div>
                <p className="name">{card.name}</p>
                <p className="brand">{card.brand}</p>
                {card.description ? <p className="desc">{card.description}</p> : null}
                {card.notes ? <p className="notes">{card.notes}</p> : null}
              </div>
            ))}
          </div>
          <footer className="footer">
            <span>{FOOTER_BRAND}</span>
            <span>{pageLabel(index + 2, total)}</span>
          </footer>
        </article>
      ))}
    </div>
  );
}
