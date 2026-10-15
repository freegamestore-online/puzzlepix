import { useEffect, useMemo, useRef, useState } from "react";
import { GameAuth, GameButton, GameShell as PlatformShell, GameThemeToggle, GameTopbar } from "@freegamestore/games";
import { generateImage } from "./art/generator";
import { hashInts } from "./art/rng";
import { dailyPicture, PACK_NAMES, PICTURE_COUNT, PICTURES, utcDateKey, type Picture } from "./art/pictures";
import { stageSize, type TrayMode } from "./puzzle/board";
import { cutPuzzle, PIECE_COUNTS, type PieceCount } from "./puzzle/cut";
import { PuzzleBoard } from "./puzzle/PuzzleBoard";

/** The side of the picture, in pixels. The table is scaled to fit the screen. */
const SIZE = 512;

/**
 * The game's frame: the platform shell, the topbar, the options, and the puzzle. The page opens
 * on today's picture. Each picture is cut into the chosen number of pieces.
 */
export default function GameShell() {
  // The daily picture is fixed for the UTC day the page was opened on.
  const [today] = useState(() => utcDateKey(new Date()));
  const [picture, setPicture] = useState<Picture>(() => dailyPicture(today));
  const [count, setCount] = useState<PieceCount>(24);
  const [trayMode, setTrayMode] = useState<TrayMode>("scatter");
  const [rotations, setRotations] = useState(false);
  // Bumped to deal the pieces again into a new tray layout.
  const [round, setRound] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(1);

  const source = useMemo(() => generateImage(picture.seed, SIZE, SIZE), [picture.seed]);
  const puzzle = useMemo(() => cutPuzzle(hashInts(picture.seed, count), count, SIZE, SIZE), [picture.seed, count]);
  const { width, height } = stageSize(puzzle);

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

  const topbar = (
    <GameTopbar
      title="Puzzlepix"
      actions={<GameThemeToggle />}
      stats={[
        { label: "Pack", value: PACK_NAMES[picture.pack] },
        { label: "Pieces", value: count, accent: true },
      ]}
    />
  );

  return (
    <PlatformShell topbar={topbar}>
      <GameAuth />
      <div className="play-area">
        <div className="puzzle-controls" role="group" aria-label="Puzzle options">
          {PIECE_COUNTS.map((n) => (
            <GameButton key={n} size="sm" variant={n === count ? "primary" : "ghost"} onClick={() => setCount(n)}>
              {n}
            </GameButton>
          ))}
          <GameButton size="sm" variant={rotations ? "primary" : "ghost"} onClick={() => setRotations((on) => !on)}>
            Turn
          </GameButton>
          <GameButton
            size="sm"
            variant="ghost"
            onClick={() => setTrayMode((mode) => (mode === "scatter" ? "edges" : "scatter"))}
          >
            {trayMode === "scatter" ? "Scatter" : "Edges first"}
          </GameButton>
          <GameButton size="sm" variant="ghost" onClick={() => setRound((n) => n + 1)}>
            Reshuffle
          </GameButton>
          <GameButton
            size="sm"
            variant="ghost"
            onClick={() => setPicture(PICTURES[(picture.id + 1) % PICTURE_COUNT]!)}
          >
            Next picture
          </GameButton>
        </div>
        <div ref={wrap} className="puzzle-wrap">
          <PuzzleBoard
            key={`${picture.id}-${count}-${trayMode}-${rotations}-${round}`}
            source={source}
            puzzle={puzzle}
            seed={hashInts(picture.seed, count, round)}
            trayMode={trayMode}
            rotations={rotations}
            fit={fit}
          />
        </div>
      </div>
    </PlatformShell>
  );
}
