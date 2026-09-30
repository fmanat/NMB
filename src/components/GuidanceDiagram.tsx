// Schéma neutre des consignes photo : une carte à côté d'un objet cylindrique abstrait. Aucune photo réelle.
export function GuidanceDiagram() {
  return (
    <svg viewBox="0 0 360 170" className="w-full max-w-md mx-auto" role="img" aria-label="Schéma : carte au format bancaire posée à côté du sujet, dans le même plan, bien éclairée">
      <rect x="1" y="1" width="358" height="168" rx="10" fill="none" stroke="var(--border)" />
      <g stroke="var(--border)" strokeWidth="0.5">
        {Array.from({ length: 8 }, (_, i) => (
          <line key={"v" + i} x1={45 * (i + 1)} x2={45 * (i + 1)} y1="1" y2="169" />
        ))}
        {Array.from({ length: 3 }, (_, i) => (
          <line key={"h" + i} x1="1" x2="359" y1={42 * (i + 1)} y2={42 * (i + 1)} />
        ))}
      </g>
      {/* carte de référence */}
      <rect x="30" y="80" width="110" height="70" rx="6" fill="var(--surface-2)" stroke="var(--accent)" strokeWidth="2" />
      <rect x="30" y="98" width="110" height="14" fill="var(--accent)" opacity="0.35" />
      <text x="85" y="138" textAnchor="middle" fontSize="10" fill="var(--foreground)">CARTE · VERSO</text>
      {[[30, 80], [140, 80], [140, 150], [30, 150]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="4" fill="var(--accent-2)" />
      ))}
      {/* objet abstrait : cylindre couché */}
      <rect x="190" y="70" width="140" height="44" rx="22" fill="none" stroke="var(--foreground)" strokeWidth="2" />
      <line x1="190" x2="330" y1="92" y2="92" stroke="var(--accent-2)" strokeDasharray="4 4" />
      <text x="260" y="140" textAnchor="middle" fontSize="10" fill="var(--muted)">même plan que la carte</text>
      <text x="180" y="22" textAnchor="middle" fontSize="11" fill="var(--muted)">vue de profil ou de dessus · bonne lumière · 4 coins de la carte visibles</text>
    </svg>
  );
}
