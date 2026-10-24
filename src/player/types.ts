export interface Segment {
  index: number;
  start: number;
  duration: number;
  bytes: number;
  url: string;
}

export interface Track {
  id: string;
  width: number;
  height: number;
  mime: string;
  codec: string;
  bitrate: number;
  init_url: string;
  segments: Segment[];
}

export interface Manifest {
  version: number;
  video_id: string;
  duration: number;
  renditions: Track[];
  audio: Track | null;
}

export interface PlayerStats {
  status: "loading" | "playing" | "paused" | "buffering" | "ended" | "error";
  error: string;
  buffer: number;
  throughput: number;
  bandwidth: number;
  playingQuality: string;
  loadingQuality: string;
  mode: string;
  segment: number;
  reason: string;
  stalls: number;
  stallSeconds: number;
}
