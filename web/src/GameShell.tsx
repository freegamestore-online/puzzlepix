import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  GameAuth,
  GameButton,
  GameShell as PlatformShell,
  GameThemeToggle,
  GameTopbar,
  Leaderboard,
  useLeaderboard,
} from "@freegamestore/games";
import { generateImage } from "./art/generator";
import { hashInts } from "./art/rng";
import { dailyPicture, PACK_NAMES, PICTURE_COUNT, PICTURES, utcDateKey, type Picture } from "./art/pictures";
import { dailyKey, dailyScore, loadSaves, puzzleKey, restorePlacements, saveSaves, shouldSubmitDaily, type SavedState } from "./game/saves";
import { BOARD_SIZE, DAILY_COUNT, dailyPuzzle } from "./puzzle/daily";
import { isSolved, stageSize, type Placement, type TrayMode } from "./puzzle/board";
import { cutPuzzle, PIECE_COUNTS, type PieceCount, type Puzzle } from "./puzzle/cut";
import { PuzzleBoard } from "./puzzle/PuzzleBoard";

/** The game's id on the leaderboard service. */
const LEADERBOARD_GAME = "puzzlepix";

function formatTime(ms: number): string {
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * The game's frame: the platform shell, the topbar, the options, and the puzzle. The page opens on
 * today's daily puzzle. Practice puzzles can be any picture in any piece count. Every puzzle keeps
 * its pieces between visits.
 */
export default function GameShell() {
  // The daily puzzle is fixed for the UTC day the page was opened on.
  const [today] = useState(() => utcDateKey(new Date()));
  const [mode, setMode] = useState<"daily" | "practice">("daily");
  // Opening today's puzzle starts its clock, unless the day already has one.
  const [saves, setSaves] = useState<SavedState>(() => {
    const loaded = loadSaves();
    return loaded.daily[today] ? loaded : { ...loaded, daily: { ...loaded.daily, [today]: { startedAt: Date.now() } } };
  });
  const [picture, setPicture] = useState<Picture>(() => dailyPicture(today));
  const [count, setCount] = useState<PieceCount>(24);
  const [trayMode, setTrayMode] = useState<TrayMode>("scatter");
  const [rotations, setRotations] = useState(false);
  const [round, setRound] = useState(0);
  const [ghost, setGhost] = useState(false);
  const [edgesOnly, setEdgesOnly] = useState(false);
  const [hintRequest, setHintRequest] = useState(0);
  const { topScores, recentScores, loading, submitScore } = useLeaderboard(LEADERBOARD_GAME);
  const submitting = useRef(false);
  const wrap = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(1);

  useEffect(() => saveSaves(saves), [saves]);

  // A daily time is submitted once, and only for a clean solve. A rejected submission stays quiet
  // and is tried again on a later visit.
  useEffect(() => {
    const record = saves.daily[today];
    if (!shouldSubmitDaily(record) || submitting.current) return;
    submitting.current = true;
    void submitScore(dailyScore(record!.solvedMs!))
      .then((result) => {
        if (result.ok) {
          setSaves((s) => ({ ...s, daily: { ...s.daily, [today]: { ...s.daily[today]!, submitted: true } } }));
        }
      })
      .finally(() => {
        submitting.current = false;
      });
    // The callback is stable, so only the saves and the day matter here.
  }, [saves, today, submitScore]);

  const practice = useMemo(() => {
    const source = generateImage(picture.seed, BOARD_SIZE, BOARD_SIZE);
    const puzzle = cutPuzzle(hashInts(picture.seed, count), count, BOARD_SIZE, BOARD_SIZE);
    return { source, puzzle, seed: hashInts(picture.seed, count, round), key: puzzleKey(picture.id, count) };
  }, [picture, count, round]);

  const daily = useMemo(() => {
    const { picture: dailyPic, seed, puzzle } = dailyPuzzle(today);
    return { source: generateImage(dailyPic.seed, BOARD_SIZE, BOARD_SIZE), puzzle, seed };
  }, [today]);

  const active = mode === "daily"
    ? { source: daily.source, puzzle: daily.puzzle, seed: daily.seed, key: dailyKey(today), tray: "scatter" as TrayMode, turn: false }
    : { source: practice.source, puzzle: practice.puzzle, seed: practice.seed, key: practice.key, tray: trayMode, turn: rotations };
  const storeKey = active.key;
  const puzzle: Puzzle = active.puzzle;
  const { width, height } = stageSize(puzzle);

  const ghostUrl = useMemo(() => (ghost ? active.source.toDataURL("image/png") : null), [ghost, active.source]);

  // Scale the table to the space under the controls, and again whenever the window changes.
  useEffect(() => {
    const measure = () => {
      const el = wrap.current;
      if (el) setFit(Math.max(0.05, Math.min(el.clientWidth / width, el.clientHeight / height)));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [width, height]);

  // Every change to the pieces is saved, and a solved daily puzzle records its time.
  const onChange = useCallback(
    (placements: readonly Placement[]) => {
      const solved = isSolved(puzzle, placements);
      setSaves((s) => {
        const next: SavedState = {
          ...s,
          puzzles: { ...s.puzzles, [storeKey]: { placements: placements.map((p) => ({ ...p })) } },
        };
        const record = s.daily[today];
        if (mode === "daily" && solved && record && record.solvedMs === undefined) {
          next.daily = { ...s.daily, [today]: { ...record, solvedMs: Date.now() - record.startedAt } };
        }
        return next;
      });
    },
    [puzzle, storeKey, mode, today],
  );

  // A hint before the solve makes the daily time ineligible. A hint after it changes nothing.
  const useHint = () => {
    setHintRequest((n) => n + 1);
    setSaves((s) => {
      const record = s.daily[today];
      if (mode !== "daily" || !record || record.hinted || record.solvedMs !== undefined) return s;
      return { ...s, daily: { ...s.daily, [today]: { ...record, hinted: true } } };
    });
  };

  const reshuffle = () => {
    setSaves((s) => {
      const puzzles = { ...s.puzzles };
      delete puzzles[storeKey];
      return { ...s, puzzles };
    });
    setRound((n) => n + 1);
  };

  const record = saves.daily[today];
  const dailyDone = mode === "daily" && record?.solvedMs !== undefined;

  const topbar = (
    <GameTopbar
      title="Puzzlepix"
      actions={<GameThemeToggle />}
      stats={
        mode === "daily"
          ? [
              { label: "Daily", value: today },
              { label: "Pieces", value: DAILY_COUNT, accent: true },
            ]
          : [
              { label: "Pack", value: PACK_NAMES[picture.pack] },
              { label: "Pieces", value: count, accent: true },
            ]
      }
    />
  );

  return (
    <PlatformShell topbar={topbar}>
      <GameAuth />
      <div className="play-area">
        <div className="puzzle-controls" role="group" aria-label="Puzzle options">
          <GameButton size="sm" variant={mode === "daily" ? "primary" : "ghost"} onClick={() => setMode("daily")}>
            Daily
          </GameButton>
          <GameButton size="sm" variant={mode === "practice" ? "primary" : "ghost"} onClick={() => setMode("practice")}>
            Practice
          </GameButton>
          {mode === "practice" &&
            PIECE_COUNTS.map((n) => (
              <GameButton key={n} size="sm" variant={n === count ? "primary" : "ghost"} onClick={() => setCount(n)}>
                {n}
              </GameButton>
            ))}
          {mode === "practice" && (
            <>
              <GameButton size="sm" variant={rotations ? "primary" : "ghost"} onClick={() => setRotations((on) => !on)}>
                Turn
              </GameButton>
              <GameButton
                size="sm"
                variant="ghost"
                onClick={() => setTrayMode((m) => (m === "scatter" ? "edges" : "scatter"))}
              >
                {trayMode === "scatter" ? "Scatter" : "Edges first"}
              </GameButton>
              <GameButton size="sm" variant="ghost" onClick={reshuffle}>
                Reshuffle
              </GameButton>
              <GameButton
                size="sm"
                variant="ghost"
                onClick={() => setPicture(PICTURES[(picture.id + 1) % PICTURE_COUNT]!)}
              >
                Next picture
              </GameButton>
            </>
          )}
          <GameButton size="sm" variant={ghost ? "primary" : "ghost"} onClick={() => setGhost((on) => !on)}>
            Ghost
          </GameButton>
          <GameButton size="sm" variant={edgesOnly ? "primary" : "ghost"} onClick={() => setEdgesOnly((on) => !on)}>
            Edges only
          </GameButton>
          <GameButton size="sm" variant="ghost" onClick={useHint}>
            Hint
          </GameButton>
        </div>
        <div ref={wrap} className="puzzle-wrap">
          <PuzzleBoard
            key={`${storeKey}:${round}:${active.tray}:${active.turn}:${mode}`}
            source={active.source}
            puzzle={puzzle}
            seed={active.seed}
            trayMode={active.tray}
            rotations={active.turn}
            initial={restorePlacements(saves.puzzles[storeKey], puzzle.pieces.length)}
            onChange={onChange}
            hintRequest={hintRequest}
            edgesOnly={edgesOnly}
            ghostUrl={ghostUrl}
            fit={fit}
          />
        </div>
        {dailyDone && record?.solvedMs !== undefined && (
          <div className="daily-result">
            <p>Daily time {formatTime(record.solvedMs)}</p>
            <Leaderboard topScores={topScores.slice(0, 5)} recentScores={recentScores} loading={loading} />
          </div>
        )}
      </div>
    </PlatformShell>
  );
}
