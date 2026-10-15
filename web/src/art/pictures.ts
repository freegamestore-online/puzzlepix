import { packFor, type Pack } from "./generator";
import { hashString } from "./rng";

/** How many pictures the catalogue holds. Each pack gets an equal share. */
export const PICTURE_COUNT = 60;

export const PACK_NAMES: Record<Pack, string> = {
  landscapes: "Landscapes",
  gradients: "Gradients",
  geometric: "Geometric",
  mosaic: "Mosaic scenes",
};

export interface Picture {
  /** Position in the catalogue, from 0. */
  id: number;
  /** The generator seed. Equal to the id, so any picture can be regenerated from its id. */
  seed: number;
  pack: Pack;
}

/** The catalogue, in order. Each pack's pictures are every fourth entry. */
export const PICTURES: readonly Picture[] = Array.from({ length: PICTURE_COUNT }, (_, id) => ({
  id,
  seed: id,
  pack: packFor(id),
}));

/** The pictures in one pack, in catalogue order. */
export function picturesInPack(pack: Pack): readonly Picture[] {
  return PICTURES.filter((picture) => picture.pack === pack);
}

/** The UTC calendar day of `date`, as YYYY-MM-DD. */
export function utcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** The picture for the UTC day `dateKey` (YYYY-MM-DD). Every visitor sees the same one that day. */
export function dailyPicture(dateKey: string): Picture {
  return PICTURES[hashString(dateKey) % PICTURE_COUNT]!;
}
