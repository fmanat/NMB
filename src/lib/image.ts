import sharp from "sharp";
import { UPLOAD } from "@/config/site";

export class ImageError extends Error {}

/**
 * Réencodage côté serveur (défense en profondeur, en plus du réencodage du navigateur) :
 * format vérifié, taille limitée, orientation appliquée, JPEG sans aucune métadonnée (EXIF, GPS).
 * Tout reste en mémoire.
 */
export async function prepareImage(input: Buffer): Promise<{ jpeg: Buffer; width: number; height: number }> {
  if (input.length === 0 || input.length > UPLOAD.maxBytes) throw new ImageError("taille");
  try {
    const meta = await sharp(input, { limitInputPixels: UPLOAD.maxInputPixels, failOn: "error" }).metadata();
    if (meta.format !== "jpeg" && meta.format !== "png") throw new ImageError("format");
    const jpeg = await sharp(input, { limitInputPixels: UPLOAD.maxInputPixels, failOn: "error" })
      .rotate()
      .resize({ width: UPLOAD.maxPx, height: UPLOAD.maxPx, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 88 })
      .toBuffer();
    const out = await sharp(jpeg).metadata();
    return { jpeg, width: out.width ?? 0, height: out.height ?? 0 };
  } catch (e) {
    if (e instanceof ImageError) throw e;
    throw new ImageError("illisible");
  }
}
