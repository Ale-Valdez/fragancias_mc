import type { Metrics } from "@fmc/shared";
import Link from "next/link";
import type { ReactNode } from "react";

const countFormat = new Intl.NumberFormat("es-AR");
const dayFormat = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "short",
  timeZone: "America/Argentina/Buenos_Aires",
});

const CHART_WIDTH = 800;
const CHART_HEIGHT = 232;
const PAD = { left: 52, right: 12, top: 16, bottom: 32 };

type LineSeries = {
  label: string;
  values: number[];
  className: string;
  fill: boolean;
};

function formatCount(value: number): string {
  return countFormat.format(value);
}

function formatDay(date: string): string {
  return dayFormat.format(new Date(`${date}T12:00:00-03:00`));
}

function seriesDetail(label: string, value: number): string {
  const word =
    label === "vistas"
      ? value === 1
        ? "vista"
        : "vistas"
      : label === "consultas"
        ? value === 1
          ? "consulta"
          : "consultas"
        : value === 1
          ? "descarga"
          : "descargas";
  return `${formatCount(value)} ${word}`;
}

function niceCeiling(value: number): number {
  if (value <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 5, 10].find((n) => n * pow > value) ?? 10;
  return step * pow;
}

function tickValues(max: number): number[] {
  if (max <= 5) return Array.from({ length: max + 1 }, (_, index) => index);
  if (max % 4 === 0) return [0, max / 4, max / 2, (3 * max) / 4, max];
  if (max % 2 === 0) return [0, max / 2, max];
  return [0, max];
}

function axisIndexes(count: number): number[] {
  if (count <= 1) return [0];
  const target = count <= 7 ? count : 6;
  const step = Math.max(1, Math.round((count - 1) / (target - 1)));
  const indexes: number[] = [];
  for (let index = 0; index < count; index += step) indexes.push(index);
  const last = count - 1;
  if (indexes[indexes.length - 1] !== last) {
    if (last - indexes[indexes.length - 1] < step / 2) indexes.pop();
    indexes.push(last);
  }
  return indexes;
}

function plotX(index: number, count: number): number {
  const width = CHART_WIDTH - PAD.left - PAD.right;
  if (count <= 1) return PAD.left + width / 2;
  return PAD.left + (index / (count - 1)) * width;
}

function plotY(value: number, max: number): number {
  const height = CHART_HEIGHT - PAD.top - PAD.bottom;
  return PAD.top + height - (value / max) * height;
}

function linePath(xs: number[], ys: number[]): string {
  return xs
    .map((x, index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${ys[index].toFixed(1)}`)
    .join(" ");
}

function Legend({ items, mark }: { items: { label: string; className: string }[]; mark: "line" | "dot" }) {
  const markClass = mark === "line" ? "h-0.5 w-4 rounded-full" : "size-2 rounded-full";
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-2">
          <span aria-hidden="true" className={`${markClass} ${item.className}`} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

function LineChart({ dates, series }: { dates: string[]; series: LineSeries[] }) {
  if (dates.length === 0) return null;
  const max = niceCeiling(Math.max(...series.flatMap((item) => item.values), 0));
  const ticks = tickValues(max);
  const xs = dates.map((_, index) => plotX(index, dates.length));
  const baseline = plotY(0, max);

  return (
    <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="h-auto w-full">
      {ticks.map((tick) => (
        <g key={tick}>
          <line
            x1={PAD.left}
            x2={CHART_WIDTH - PAD.right}
            y1={plotY(tick, max)}
            y2={plotY(tick, max)}
            stroke="currentColor"
            strokeWidth={1}
            className="text-ink"
            opacity={0.12}
            vectorEffect="non-scaling-stroke"
          />
          <text
            x={PAD.left - 8}
            y={plotY(tick, max)}
            textAnchor="end"
            dominantBaseline="middle"
            fill="currentColor"
            fontSize={12}
            className="text-muted"
          >
            {formatCount(tick)}
          </text>
        </g>
      ))}
      {series.map((item) => {
        const ys = item.values.map((value) => plotY(value, max));
        const path = linePath(xs, ys);
        return (
          <g key={item.label} className={item.className}>
            {item.fill ? (
              <path
                d={`${path} L${xs[xs.length - 1].toFixed(1)} ${baseline.toFixed(1)} L${xs[0].toFixed(1)} ${baseline.toFixed(1)} Z`}
                fill="currentColor"
                opacity={0.16}
              />
            ) : null}
            <path
              d={path}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            {xs.map((x, index) =>
              dates.length <= 7 || item.values[index] > 0 ? (
                <circle key={dates[index]} cx={x} cy={ys[index]} r={3} fill="currentColor" />
              ) : null,
            )}
          </g>
        );
      })}
      {dates.map((date, index) => {
        const previous = index === 0 ? xs[0] : (xs[index - 1] + xs[index]) / 2;
        const next = index === dates.length - 1 ? xs[index] : (xs[index] + xs[index + 1]) / 2;
        const detail = series.map((item) => seriesDetail(item.label, item.values[index] ?? 0)).join(", ");
        return (
          <rect
            key={date}
            x={previous}
            y={PAD.top}
            width={Math.max(next - previous, 1)}
            height={CHART_HEIGHT - PAD.top - PAD.bottom}
            fill="transparent"
          >
            <title>{`${formatDay(date)}: ${detail}`}</title>
          </rect>
        );
      })}
      {axisIndexes(dates.length).map((index) => (
        <text
          key={dates[index]}
          x={xs[index]}
          y={CHART_HEIGHT - 8}
          textAnchor={index === 0 ? "start" : index === dates.length - 1 ? "end" : "middle"}
          fill="currentColor"
          fontSize={12}
          className="text-muted"
        >
          {formatDay(dates[index])}
        </text>
      ))}
    </svg>
  );
}

function ChartPanel({
  title,
  legend,
  children,
}: {
  title: string;
  legend: { label: string; className: string }[];
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-lg border border-rule bg-elevated px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h3 className="text-sm font-medium">{title}</h3>
        <Legend items={legend} mark="line" />
      </div>
      <div className="mt-3 overflow-x-auto">{children}</div>
    </section>
  );
}

function DayTable({ series }: { series: Metrics["series"] }) {
  const days = [...series].reverse();
  return (
    <table className="sr-only">
     {/*  <caption>Detalle por día</caption> */}
      <thead>
        <tr>
          <th scope="col">Día</th>
          <th scope="col">Descargas</th>
          <th scope="col">Vistas</th>
          <th scope="col">WhatsApp</th>
        </tr>
      </thead>
      <tbody>
        {days.map((day) => (
          <tr key={day.date}>
            <td>{formatDay(day.date)}</td>
            <td>{formatCount(day.catalogDownloads)}</td>
            <td>{formatCount(day.productViews)}</td>
            <td>{formatCount(day.whatsappClicks)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function DayCharts({ series }: { series: Metrics["series"] }) {
  const dates = series.map((day) => day.date);
  return (
    <div className="mt-4">
      <DayTable series={series} />
      <div className="grid min-w-0 gap-4" aria-hidden="true">
        <ChartPanel
          title="Vistas y consultas"
          legend={[
            { label: "Vistas", className: "bg-ink" },
            { label: "WhatsApp", className: "bg-[#075e54]" },
          ]}
        >
          <LineChart
            dates={dates}
            series={[
              {
                label: "vistas",
                className: "text-ink",
                values: series.map((day) => day.productViews),
                fill: false,
              },
              {
                label: "consultas",
                className: "text-[#075e54]",
                values: series.map((day) => day.whatsappClicks),
                fill: false,
              },
            ]}
          />
        </ChartPanel>
        <ChartPanel title="Descargas del PDF" legend={[{ label: "Descargas", className: "bg-gold" }]}>
          <LineChart
            dates={dates}
            series={[
              {
                label: "descargas",
                className: "text-gold",
                values: series.map((day) => day.catalogDownloads),
                fill: true,
              },
            ]}
          />
        </ChartPanel>
      </div>
    </div>
  );
}

function barPercent(value: number, max: number): string {
  if (value <= 0 || max <= 0) return "0%";
  return `${Math.min(100, Math.max((value / max) * 100, 1.5))}%`;
}

export function ProductBars({ products }: { products: Metrics["topProducts"] }) {
  const max = Math.max(...products.map((product) => Math.max(product.views, product.whatsappClicks)), 1);

  return (
    <div className="mt-4 rounded-lg border border-rule bg-elevated px-4 py-4">
      <Legend
        mark="dot"
        items={[
          { label: "Vistas", className: "bg-ink" },
          { label: "WhatsApp", className: "bg-muted" },
        ]}
      />
      <ol className="mt-2 divide-y divide-rule">
        {products.map((product) => (
          <li key={product.productId} className="py-3">
            <div className="flex items-baseline justify-between gap-3">
              <Link
                href={`/admin/productos/${product.productId}`}
                className="min-w-0 truncate underline underline-offset-2"
              >
                {product.name}
              </Link>
              <span className="shrink-0 text-xs text-muted">{product.brand}</span>
            </div>
            <div className="mt-2 grid grid-cols-[1fr_2.75rem] items-center gap-x-3 gap-y-1.5">
              <div
                className="h-1.5 overflow-hidden rounded-full bg-rule"
                title={`${product.name}: ${formatCount(product.views)} ${product.views === 1 ? "vista" : "vistas"}`}
              >
                <div className="h-full rounded-full bg-ink" style={{ width: barPercent(product.views, max) }} />
              </div>
              <span className="text-right text-xs tabular-nums">{formatCount(product.views)}</span>
              <div
                className="h-1.5 overflow-hidden rounded-full bg-rule"
                title={`${product.name}: ${formatCount(product.whatsappClicks)} ${product.whatsappClicks === 1 ? "consulta" : "consultas"}`}
              >
                <div
                  className="h-full rounded-full bg-muted"
                  style={{ width: barPercent(product.whatsappClicks, max) }}
                />
              </div>
              <span className="text-right text-xs tabular-nums text-muted">
                {formatCount(product.whatsappClicks)}
              </span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
