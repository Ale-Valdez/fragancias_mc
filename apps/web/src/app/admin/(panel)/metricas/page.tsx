import { metricsQuerySchema, metricsSchema, type MetricRange, type Metrics } from "@fmc/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { AdminApiError, adminJson } from "@/lib/admin-api";
import { requireUser } from "@/lib/auth";
import { DayCharts, ProductBars } from "./charts";

export const instant = false;

export const metadata: Metadata = {
  title: "Métricas · Fragancias MC",
  robots: { index: false, follow: false },
};

const RANGES: { id: MetricRange; label: string }[] = [
  { id: "7d", label: "7 días" },
  { id: "30d", label: "30 días" },
  { id: "90d", label: "90 días" },
];

const countFormat = new Intl.NumberFormat("es-AR");
const periodFormat = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "America/Argentina/Buenos_Aires",
});

type MetricsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function pickedRange(value: string | string[] | undefined): MetricRange {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = metricsQuerySchema.safeParse(raw ? { range: raw } : {});
  return parsed.success ? parsed.data.range : "30d";
}

function formatCount(value: number): string {
  return countFormat.format(value);
}

export default function MetricsPage({ searchParams }: MetricsPageProps) {
  return (
    <main className="flex flex-1 flex-col">
      <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}>
        <MetricsHome searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function MetricsHome({ searchParams }: MetricsPageProps) {
  await connection();
  await requireUser();
  const range = pickedRange((await searchParams).range);

  let metrics: Metrics;
  try {
    metrics = (await adminJson(`/metrics?range=${range}`, metricsSchema)) as Metrics;
  } catch (error) {
    if (error instanceof AdminApiError) {
      return <p className="text-sm text-danger">No se pudieron cargar las métricas.</p>;
    }
    throw error;
  }

  const hasActivity =
    metrics.totals.catalogDownloads + metrics.totals.productViews + metrics.totals.whatsappClicks > 0;

  return (
    <div className="w-full max-w-5xl">
      <h1 className="text-2xl font-semibold">Métricas</h1>
      <p className="mt-2 text-sm text-muted">
        Del {periodFormat.format(new Date(metrics.from))} al {periodFormat.format(new Date(metrics.to))}.
      </p>
      <nav aria-label="Período" className="mt-6 flex flex-wrap gap-2">
        {RANGES.map((item) => {
          const current = item.id === metrics.range;
          return (
            <Link
              key={item.id}
              href={`/admin/metricas?range=${item.id}`}
              aria-current={current ? "page" : undefined}
              className={`rounded-md px-3 py-2 text-sm ${
                current
                  ? "bg-gold font-medium text-page"
                  : "border border-rule hover:bg-elevated"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <dl className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Descargas del PDF" value={metrics.totals.catalogDownloads} />
        <Stat label="Vistas de fichas" value={metrics.totals.productViews} />
        <Stat label="Consultas por WhatsApp" value={metrics.totals.whatsappClicks} />
        <Stat label="Visitantes" value={metrics.totals.visitors} />
      </dl>
      <p className="mt-3 text-sm text-muted">
        Un visitante es una cookie distinta. Las descargas anteriores a esta versión no suman visitante.
      </p>

      <h2 className="mt-10 text-lg font-semibold">Por día</h2>
      {hasActivity ? (
        <DayCharts series={metrics.series} />
      ) : (
        <p className="mt-4 text-sm text-muted">No hay eventos en este período.</p>
      )}

      <h2 className="mt-10 text-lg font-semibold">Fragancias</h2>
      {metrics.topProducts.length === 0 ? (
        <p className="mt-4 text-sm text-muted">Todavía no hay vistas ni consultas en este período.</p>
      ) : (
        <ProductBars products={metrics.topProducts} />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-rule bg-elevated px-4 py-3">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold">{formatCount(value)}</dd>
    </div>
  );
}

