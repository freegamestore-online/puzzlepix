import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { outline, type Puzzle, type Step } from "./cut";
import { drop, groupOf, isSolved, layoutTray, rotatePiece, snapThreshold, stageSize, type Placement, type TrayMode } from "./board";
import { edgeIds, hintPlacements } from "./helpers";

/** Picture kept around each piece, so the tabs are not clipped. */
function padding(puzzle: Puzzle): number {
  return 0.3 * Math.min(puzzle.cellW, puzzle.cellH);
}

function toPath(steps: readonly Step[]): Path2D {
  const path = new Path2D();
  for (const { op, pts } of steps) {
    if (op === "M") path.moveTo(pts[0]!, pts[1]!);
    else if (op === "L") path.lineTo(pts[0]!, pts[1]!);
    else path.bezierCurveTo(pts[0]!, pts[1]!, pts[2]!, pts[3]!, pts[4]!, pts[5]!);
  }
  path.closePath();
  return path;
}

/** One piece cut out of the picture, with its tabs, drawn to its own canvas. */
function drawPiece(source: HTMLCanvasElement, puzzle: Puzzle, id: number): HTMLCanvasElement {
  const piece = puzzle.pieces[id]!;
  const pad = padding(puzzle);
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(puzzle.cellW + 2 * pad);
  canvas.height = Math.ceil(puzzle.cellH + 2 * pad);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas is not available");
  const path = toPath(outline(puzzle, piece));
  ctx.translate(pad, pad);
  ctx.save();
  ctx.clip(path);
  ctx.drawImage(source, -piece.x, -piece.y, puzzle.width, puzzle.height);
  ctx.restore();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
  ctx.stroke(path);
  return canvas;
}

/** The on-screen transform of a piece: its top-left, then its turn about its centre. */
function transformOf(p: Placement, pad: number): string {
  return `translate(${p.x - pad}px, ${p.y - pad}px) rotate(${p.rotation * 90}deg)`;
}

/** Pointer movement shorter than this, in screen pixels, is a tap, not a drag. */
const TAP_SLOP = 4;

interface Drag {
  id: number;
  ids: number[];
  base: readonly Placement[];
  startX: number;
  startY: number;
  dx: number;
  dy: number;
  moved: boolean;
}

interface PuzzleBoardProps {
  source: HTMLCanvasElement;
  puzzle: Puzzle;
  /** Seeds the scatter or edge layout of the tray, when there is no saved placement. */
  seed: number;
  trayMode: TrayMode;
  rotations: boolean;
  /** Where the pieces were when the puzzle was last left. Resumes it exactly when given. */
  initial?: readonly Placement[] | null;
  /** Called with the placements after every change, including the first layout. */
  onChange?: (placements: readonly Placement[]) => void;
  /** Bump this to apply one hint. Each new value is applied once. */
  hintRequest: number;
  /** Hide every piece that is not on the edge of the picture. */
  edgesOnly: boolean;
  /** A faint copy of the whole picture under the board, or null for none. */
  ghostUrl: string | null;
  /** Screen pixels per table pixel, so the whole table fits its container. */
  fit: number;
}

/**
 * The table: the board outline, and the pieces in the tray below it. Drags move the piece's
 * group on screen, and the rules in board.ts decide where it lands on release. A tap turns a
 * lone piece when turning is on.
 */
export function PuzzleBoard({
  source,
  puzzle,
  seed,
  trayMode,
  rotations,
  initial,
  onChange,
  hintRequest,
  edgesOnly,
  ghostUrl,
  fit,
}: PuzzleBoardProps) {
  const [placements, setPlacements] = useState<readonly Placement[]>(
    () => initial ?? layoutTray(puzzle, trayMode, seed, rotations),
  );
  const images = useMemo(() => puzzle.pieces.map((p) => drawPiece(source, puzzle, p.id)), [source, puzzle]);
  const edges = useMemo(() => new Set(edgeIds(puzzle)), [puzzle]);
  const elements = useRef(new Map<number, HTMLDivElement>());
  const drag = useRef<Drag | null>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });
  const pad = padding(puzzle);
  const threshold = snapThreshold(puzzle);
  const size = stageSize(puzzle);
  const solved = isSolved(puzzle, placements);

  // Every piece's on-screen place follows the placements. A drag moves pieces directly, and the
  // next commit puts them back where the placements say.
  useLayoutEffect(() => {
    for (const piece of puzzle.pieces) {
      const el = elements.current.get(piece.id);
      if (!el) continue;
      el.style.transform = transformOf(placements[piece.id]!, pad);
      el.style.zIndex = "";
    }
    onChangeRef.current?.(placements);
  }, [placements, puzzle, pad]);

  // A hint is applied once per request, while rendering, so no extra pass is needed.
  const [seenHint, setSeenHint] = useState(hintRequest);
  if (hintRequest !== seenHint) {
    setSeenHint(hintRequest);
    const next = hintPlacements(puzzle, placements);
    if (next) setPlacements(next);
  }

  const pieceAt = (target: EventTarget): number | null => {
    const el = (target as HTMLElement).closest<HTMLElement>("[data-piece]");
    return el ? Number(el.dataset.piece) : null;
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const id = pieceAt(e.target);
    if (id === null || drag.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const ids = groupOf(puzzle, placements, id);
    for (const member of ids) {
      const el = elements.current.get(member);
      if (el) el.style.zIndex = "2";
    }
    drag.current = { id, ids, base: placements, startX: e.clientX, startY: e.clientY, dx: 0, dy: 0, moved: false };
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const screenX = e.clientX - d.startX;
    const screenY = e.clientY - d.startY;
    if (!d.moved && Math.hypot(screenX, screenY) < TAP_SLOP) return;
    d.moved = true;
    d.dx = screenX / fit;
    d.dy = screenY / fit;
    for (const member of d.ids) {
      const el = elements.current.get(member);
      if (!el) continue;
      const base = d.base[member]!;
      el.style.transform = transformOf({ ...base, x: base.x + d.dx, y: base.y + d.dy }, pad);
    }
  };

  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (!d.moved) {
      if (rotations && d.ids.length === 1) setPlacements(rotatePiece(puzzle, placements, d.id));
      else setPlacements((p) => p.slice());
      return;
    }
    setPlacements(drop(puzzle, d.base, d.id, d.dx, d.dy, threshold).placements);
  };

  const onPointerCancel = () => {
    drag.current = null;
    setPlacements((p) => p.slice());
  };

  return (
    <div className="puzzle" style={{ width: size.width * fit, height: size.height * fit }}>
      <div
        className="puzzle-stage"
        style={{ width: size.width, height: size.height, transform: `scale(${fit})` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        <div className="puzzle-board" style={{ width: puzzle.width, height: puzzle.height }} />
        {ghostUrl && (
          <img
            className="puzzle-ghost"
            src={ghostUrl}
            alt=""
            style={{ width: puzzle.width, height: puzzle.height }}
          />
        )}
        {puzzle.pieces.map((piece) => {
          const canvas = images[piece.id]!;
          const hidden = edgesOnly && !edges.has(piece.id);
          return (
            <div
              key={piece.id}
              data-piece={piece.id}
              className={hidden ? "piece piece-hidden" : "piece"}
              style={{ width: canvas.width, height: canvas.height }}
              ref={(el) => {
                if (!el) {
                  elements.current.delete(piece.id);
                  return;
                }
                elements.current.set(piece.id, el);
                if (!el.firstChild) el.append(canvas);
              }}
            />
          );
        })}
      </div>
      {solved && (
        <p className="solved-note" role="status">
          Solved!
        </p>
      )}
    </div>
  );
}
