import sharp from "sharp";

// Images NEUTRES fabriquées par du code pour les tests (jamais enregistrées dans le dépôt, jamais réalistes) :
// aplats, dégradés, formes géométriques et texte. Aucune personne, aucun corps.

/** Aplat gris uni (JPEG). */
export async function flatImage(width = 1200, height = 800): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: "#8a8a8a" } }).jpeg().toBuffer();
}

/** Dégradé bicolore (JPEG), avec une métadonnée EXIF facultative pour vérifier qu'elle est retirée. */
export async function gradientImage(width = 1200, height = 800, withExif = false): Promise<Buffer> {
  const raw = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      raw[i] = (x * 255) / width;
      raw[i + 1] = (y * 255) / height;
      raw[i + 2] = 160;
    }
  }
  let img = sharp(raw, { raw: { width, height, channels: 3 } });
  if (withExif) img = img.withExif({ IFD0: { Copyright: "METADONNEE-DE-TEST" } });
  return img.jpeg({ quality: 85 }).toBuffer();
}

/**
 * Formes géométriques abstraites : un rectangle aux proportions d'une carte bancaire et un rectangle arrondi, avec un texte.
 * Sert aux appels réels de validation du schéma (scripts/xai-schema-check.mts) : l'image n'est PAS un sujet anatomique,
 * la recevabilité attendue est donc « non recevable ».
 */
export async function shapesImage(width = 1200, height = 800): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 1200 800">
    <defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#e8e4da"/><stop offset="1" stop-color="#c9c2b2"/></linearGradient></defs>
    <rect width="1200" height="800" fill="url(#g)"/>
    <rect x="120" y="460" width="342" height="216" rx="14" fill="#2a4d8f"/>
    <rect x="120" y="510" width="342" height="44" fill="#111"/>
    <rect x="560" y="330" width="420" height="120" rx="60" fill="#8c8c8c"/>
    <text x="600" y="140" font-family="sans-serif" font-size="40" fill="#333">image de test neutre</text>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 88 }).toBuffer();
}
