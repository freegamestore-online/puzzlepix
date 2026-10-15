import { describe, expect, it } from "vitest";
import { PACKS } from "./generator";
import { dailyPicture, PICTURE_COUNT, PICTURES, picturesInPack, utcDateKey } from "./pictures";

describe("picture catalogue", () => {
  it("holds 60 pictures, numbered from 0, each seeded by its id", () => {
    expect(PICTURES).toHaveLength(PICTURE_COUNT);
    PICTURES.forEach((picture, i) => {
      expect(picture.id).toBe(i);
      expect(picture.seed).toBe(i);
    });
  });

  it("splits the catalogue evenly across the packs", () => {
    for (const pack of PACKS) {
      expect(picturesInPack(pack)).toHaveLength(PICTURE_COUNT / PACKS.length);
    }
  });
});

describe("dailyPicture", () => {
  it("gives the same picture for the same day", () => {
    expect(dailyPicture("2026-10-16")).toEqual(dailyPicture("2026-10-16"));
  });

  it("always returns a picture from the catalogue", () => {
    for (let day = 1; day <= 31; day++) {
      const key = `2026-10-${String(day).padStart(2, "0")}`;
      expect(PICTURES).toContain(dailyPicture(key));
    }
  });

  it("changes picture from one day to the next most of the time", () => {
    const keys = Array.from({ length: 30 }, (_, i) => `2026-09-${String(i + 1).padStart(2, "0")}`);
    const distinct = new Set(keys.map((key) => dailyPicture(key).id));
    expect(distinct.size).toBeGreaterThan(10);
  });
});

describe("utcDateKey", () => {
  it("uses the UTC calendar day, not the local one", () => {
    expect(utcDateKey(new Date("2026-10-16T23:30:00Z"))).toBe("2026-10-16");
    expect(utcDateKey(new Date("2026-10-17T00:30:00Z"))).toBe("2026-10-17");
  });
});
