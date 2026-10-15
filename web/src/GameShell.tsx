import { useEffect, useRef, useState } from "react";
import { GameAuth, GameButton, GameShell as PlatformShell, GameThemeToggle, GameTopbar } from "@freegamestore/games";
import { generateImage } from "./art/generator";
import { dailyPicture, PACK_NAMES, PICTURE_COUNT, PICTURES, utcDateKey, type Picture } from "./art/pictures";

/** The side of the picture, in pixels. CSS scales the canvas to fit the screen. */
const SIZE = 512;

/**
 * The game's frame: the platform shell, the topbar, and the picture on show. The page opens on
 * the picture for today, and "Next picture" moves through the catalogue in order.
 */
export default function GameShell() {
  // The daily picture is fixed for the UTC day the page was opened on.
  const [today] = useState(() => utcDateKey(new Date()));
  const [picture, setPicture] = useState<Picture>(() => dailyPicture(today));
  const frame = useRef<HTMLDivElement>(null);

  useEffect(() => {
    frame.current?.replaceChildren(generateImage(picture.seed, SIZE, SIZE));
  }, [picture]);

  const topbar = (
    <GameTopbar
      title="Puzzlepix"
      actions={<GameThemeToggle />}
      stats={[
        { label: "Pack", value: PACK_NAMES[picture.pack] },
        { label: "Picture", value: `${picture.id + 1}/${PICTURE_COUNT}`, accent: true },
      ]}
    />
  );

  return (
    <PlatformShell topbar={topbar}>
      <GameAuth />
      <div className="play-area">
        <div
          ref={frame}
          className="art-frame"
          role="img"
          aria-label={`${PACK_NAMES[picture.pack]} picture ${picture.id + 1}`}
        />
        <GameButton variant="primary" onClick={() => setPicture(PICTURES[(picture.id + 1) % PICTURE_COUNT]!)}>
          Next picture
        </GameButton>
      </div>
    </PlatformShell>
  );
}
