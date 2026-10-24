import { expect, it } from "vitest";
import { bufferAhead, segmentAt } from "./timeline";
import type { Segment } from "./types";

it("seek theo timeline thực, gồm segment cuối ngắn", () => {
  const segments = [
    { start: 0, duration: 4.1 },
    { start: 4.1, duration: 3.9 },
    { start: 8, duration: 0.7 },
  ] as Segment[];
  expect(segmentAt(segments, 4.05)).toBe(0);
  expect(segmentAt(segments, 4.1)).toBe(1);
  expect(segmentAt(segments, 8.65)).toBe(2);
});

it("không tính buffer qua khoảng trống", () => {
  const ranges = {
    length: 2,
    start: (i: number) => [0, 20][i],
    end: (i: number) => [8, 30][i],
  };
  expect(bufferAhead(ranges, 5)).toBe(3);
  expect(bufferAhead(ranges, 12)).toBe(0);
  expect(bufferAhead(ranges, 24)).toBe(6);
});
