// Balayage de prises de vue simulées pour mesurer l'erreur du calcul géométrique (aucune photo).
// Utilisé par `npm run geometry:report` et par les tests.

import { CAMERA, MARGIN } from "@/config/site";
import { estimateMeasures, marginPct } from "../measure";
import { estimateMeasuresPose } from "../pose";
import { DEFAULT_SHOT, simulateShot, type Shot } from "./camera-sim";

export type Row = { shot: Shot; legacy: { len: number; girth: number }; pose: { len: number; girth: number; tilt: number; margin: number } | null };

export const LONG_SIDE = Math.max(DEFAULT_SHOT.width, DEFAULT_SHOT.height);

export function runSweep(opts: { noisePx?: number; tilts?: number[]; cardWidths?: number[]; focalRatios?: number[] } = {}): Row[] {
  const tilts = opts.tilts ?? [0, 15, 30, 45];
  const cardWidths = opts.cardWidths ?? [150, 250, 400, 600];
  // Focale réelle : 80 %, 100 % et 120 % de la focale supposée (CAMERA.focalFactor × grand côté).
  const focalRatios = opts.focalRatios ?? [0.8, 1.0, 1.2];
  const rows: Row[] = [];
  let seed = 100;
  for (const tiltDeg of tilts)
    for (const cardWidthPx of cardWidths)
      for (const ratio of focalRatios)
        for (const cardRotationDeg of [0, 35, 110, 200])
          for (const cylinderDirectionDeg of [0, 50, 100, 160])
            for (const [lengthMm, diameterMm] of [
              [100, 30],
              [130, 38],
              [160, 45],
            ])
              for (const rollDeg of [0, 20]) {
                const sim = simulateShot({
                  ...DEFAULT_SHOT,
                  tiltDeg,
                  cardWidthPx,
                  focalPx: CAMERA.focalFactor * LONG_SIDE * ratio,
                  cardRotationDeg,
                  cylinderDirectionDeg,
                  lengthMm,
                  diameterMm,
                  rollDeg,
                  azimuthDeg: cylinderDirectionDeg + 70,
                  noisePx: opts.noisePx ?? 0,
                  seed: seed++,
                });
                if (!sim.cardInImage) continue;
                const legacy = estimateMeasures(sim.reperage, sim.shot.width, sim.shot.height);
                let pose: Row["pose"] = null;
                try {
                  const p = estimateMeasuresPose(sim.reperage, sim.shot.width, sim.shot.height);
                  pose = {
                    len: ((p.lengthCm - sim.trueLengthCm) / sim.trueLengthCm) * 100,
                    girth: ((p.girthFromMaxCm - sim.trueGirthCm) / sim.trueGirthCm) * 100,
                    tilt: p.tiltDeg,
                    margin: marginPct(90, { cardLongEdgePx: p.cardLongEdgePx, tiltDeg: p.tiltDeg }, MARGIN),
                  };
                } catch {
                  pose = null;
                }
                rows.push({
                  shot: sim.shot,
                  legacy: {
                    len: ((legacy.lengthCm - sim.trueLengthCm) / sim.trueLengthCm) * 100,
                    girth: ((legacy.girthFromMaxCm - sim.trueGirthCm) / sim.trueGirthCm) * 100,
                  },
                  pose,
                });
              }
  return rows;
}

