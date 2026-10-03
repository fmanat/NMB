import { PRESS_CHARTS, pressChart, type PressChartName } from "@/lib/pressCharts";

// Graphiques de la page presse (PNG 1600 × 900), générés à la construction du site.
export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(PRESS_CHARTS).map((nom) => ({ nom }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ nom: string }> }) {
  const { nom } = await params;
  if (!(nom in PRESS_CHARTS)) return new Response("Introuvable", { status: 404 });
  return pressChart(nom as PressChartName);
}
