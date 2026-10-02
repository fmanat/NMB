import { f1 } from "@/lib/format";

/** Indicateur de courbure : arc gradué de 0° à 30° et position de la valeur (l'appelant affiche la valeur numérique et l'interprétation). */
export function CurvatureIndicator({ angleDeg }: { angleDeg: number }) {
  const max = 30;
  const t = Math.min(1, Math.max(0, angleDeg / max));
  // Demi-cercle de rayon 70 centré en (90, 86) : de 0° (gauche) à 30° (droite).
  const a = Math.PI * (1 - t);
  const px = 90 + 70 * Math.cos(a);
  const py = 86 - 70 * Math.sin(a);
  return (
    <svg data-reveal-on-view viewBox="0 0 180 112" className="w-full max-w-[260px] h-auto" role="img" aria-label={`Courbure : ${f1(angleDeg)} degrés sur une échelle de 0 à ${max} degrés`}>
      <path d="M20,86 A70,70 0 0 1 160,86" fill="none" stroke="var(--bm-gray-200)" strokeWidth="10" strokeLinecap="round" />
      {t > 0 && <path className="anim-line" pathLength="1" d={`M20,86 A70,70 0 0 1 ${px.toFixed(1)},${py.toFixed(1)}`} fill="none" stroke="var(--accent)" strokeWidth="10" strokeLinecap="round" />}
      <circle className="anim-marker" cx={px} cy={py} r="7" fill="#fff" stroke="var(--accent)" strokeWidth="3" />
      <text x="20" y="108" fontSize="12" fill="var(--bm-navy-700)" textAnchor="middle" className="num">0°</text>
      <text x="160" y="108" fontSize="12" fill="var(--bm-navy-700)" textAnchor="middle" className="num">{`${max}°`}</text>
    </svg>
  );
}
