import { dailyPicture, type Picture } from "../art/pictures";
import { hashString } from "../art/rng";
import { cutPuzzle, type Puzzle } from "./cut";

/** The side of the picture and the table, in pixels. */
export const BOARD_SIZE = 512;

/** The daily puzzle always has this many pieces. */
export const DAILY_COUNT = 24;

export interface DailyPuzzle {
  picture: Picture;
  seed: number;
  puzzle: Puzzle;
}

/**
 * The daily puzzle for a UTC day (YYYY-MM-DD): the picture, the cut and the tray layout all come
 * from the date, so every visitor gets the same puzzle that day.
 */
export function dailyPuzzle(dateKey: string): DailyPuzzle {
  const seed = hashString(`daily:${dateKey}`);
  return {
    picture: dailyPicture(dateKey),
    seed,
    puzzle: cutPuzzle(seed, DAILY_COUNT, BOARD_SIZE, BOARD_SIZE),
  };
}
