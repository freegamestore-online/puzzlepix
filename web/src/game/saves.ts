import type { Placement } from "../puzzle/board";

/** One puzzle in progress: where every piece was when the player last left it. */
export interface SavedPuzzle {
  placements: Placement[];
}

/** A daily puzzle: when the first attempt started and, once solved, how long it took. */
export interface DailyRecord {
  startedAt: number;
  solvedMs?: number;
  /** A hint was used, so the time does not count for the leaderboard. */
  hinted?: boolean;
  submitted?: boolean;
}

/** Everything the player keeps between visits. */
export interface SavedState {
  /** Keyed by `puzzleKey` for practice puzzles and `dailyKey` for daily ones. */
  puzzles: Record<string, SavedPuzzle>;
  /** Keyed by UTC date. */
  daily: Record<string, DailyRecord>;
}

export const SAVES_KEY = "puzzlepix:saves";

const EMPTY: SavedState = { puzzles: {}, daily: {} };

/** The key of a practice puzzle: its picture and its piece count. */
export function puzzleKey(pictureId: number, count: number): string {
  return `${pictureId}:${count}`;
}

/** The key of the daily puzzle for a UTC date. */
export function dailyKey(dateKey: string): string {
  return `daily:${dateKey}`;
}

function isPlacement(value: unknown): value is Placement {
  if (typeof value !== "object" || value === null) return false;
  const p = value as Placement;
  return Number.isFinite(p.x) && Number.isFinite(p.y) && [0, 1, 2, 3].includes(p.rotation);
}

/** Saved state, or an empty record when there is none or it is unreadable. Bad entries are dropped. */
export function loadSaves(storage: Pick<Storage, "getItem"> = localStorage): SavedState {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(SAVES_KEY) ?? "null");
    if (typeof parsed !== "object" || parsed === null) return EMPTY;
    const { puzzles = {}, daily = {} } = parsed as Partial<SavedState>;
    const cleanPuzzles: SavedState["puzzles"] = {};
    for (const [key, value] of Object.entries(puzzles)) {
      if (Array.isArray(value?.placements) && value.placements.every(isPlacement)) cleanPuzzles[key] = value;
    }
    const cleanDaily: SavedState["daily"] = {};
    for (const [key, value] of Object.entries(daily)) {
      if (Number.isFinite(value?.startedAt)) cleanDaily[key] = value;
    }
    return { puzzles: cleanPuzzles, daily: cleanDaily };
  } catch {
    return EMPTY;
  }
}

export function saveSaves(saves: SavedState, storage: Pick<Storage, "setItem"> = localStorage): void {
  try {
    storage.setItem(SAVES_KEY, JSON.stringify(saves));
  } catch {
    // Storage full or blocked: play on, and lose only this save.
  }
}

/**
 * The placements to resume a saved puzzle with, or null when there is nothing to resume or the
 * saved piece count does not match the puzzle.
 */
export function restorePlacements(saved: SavedPuzzle | undefined, count: number): Placement[] | null {
  if (!saved || saved.placements.length !== count) return null;
  return saved.placements.map((p) => ({ ...p }));
}

/**
 * A daily time is submitted only for a clean solve: solved, no hint, and not sent before.
 * Anything else is not a valid completion, so nothing is written to the leaderboard.
 */
export function shouldSubmitDaily(record: DailyRecord | undefined): boolean {
  return record?.solvedMs !== undefined && !record.hinted && !record.submitted;
}

/** Above this many milliseconds a daily time scores zero. */
const DAILY_SCORE_CEILING_MS = 10_000_000;

/**
 * The leaderboard ranks higher scores better, and a daily time is better when it is lower.
 * So a time is turned into a score that falls as the time grows, and never goes below zero.
 */
export function dailyScore(ms: number): number {
  return Math.max(0, Math.round(DAILY_SCORE_CEILING_MS - ms));
}
