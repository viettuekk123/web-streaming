import type { Segment } from "./types";

export function segmentAt(segments: Segment[], time: number): number {
  const index = segments.findIndex((s) => time < s.start + s.duration - 0.001);
  return index < 0 ? segments.length - 1 : index;
}

export function bufferAhead(ranges: TimeRanges, time: number): number {
  for (let i = 0; i < ranges.length; i++) {
    if (ranges.start(i) <= time + 0.05 && ranges.end(i) > time)
      return ranges.end(i) - time;
  }
  return 0;
}

export function contains(ranges: TimeRanges, time: number): boolean {
  for (let i = 0; i < ranges.length; i++) {
    if (ranges.start(i) <= time && ranges.end(i) > time + 0.05) return true;
  }
  return false;
}
