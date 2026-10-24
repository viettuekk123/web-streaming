import { playerConfig as config } from "./config";
import type { Track } from "./types";

export class BandwidthEstimator {
  value = 0;
  last = 0;

  sample(bytes: number, seconds: number) {
    this.last = (bytes * 8) / seconds;
    // EWMA theo thời gian tải, half-life 3 giây. Mẫu dài có trọng số lớn hơn.
    // alpha = 1 - 2^(-seconds/3); estimate = alpha*sample + (1-alpha)*old.
    const alpha = 1 - 2 ** (-seconds / 3);
    this.value = this.value
      ? alpha * this.last + (1 - alpha) * this.value
      : this.last;
  }
}

export interface AbrInput {
  tracks: Track[];
  current: number;
  bandwidth: number;
  buffer: number;
  now: number;
}

export interface AbrStrategy {
  choose(input: AbrInput): { index: number; reason: string };
  reset(): void;
}

export class BufferBandwidthStrategy implements AbrStrategy {
  private lastSwitch = -Infinity;
  private goodSamples = 0;
  reset() {
    this.lastSwitch = -Infinity;
    this.goodSamples = 0;
  }

  choose({ tracks, current, bandwidth, buffer, now }: AbrInput) {
    if (!bandwidth)
      return { index: 0, reason: "Khởi đầu mức thấp nhất để đo mạng" };
    const budget = bandwidth * config.safetyFactor;
    let affordable = 0;
    tracks.forEach((track, i) => {
      if (track.bitrate <= budget) affordable = i;
    });
    let next = current;
    let reason = "Giữ mức: mạng và buffer phù hợp";
    const emergency = buffer < config.lowBuffer;
    if (current > 0 && (emergency || affordable < current)) {
      next = emergency ? Math.min(current - 1, affordable) : affordable;
      reason = emergency
        ? "Giảm khẩn cấp: buffer dưới 4 giây"
        : "Giảm: băng thông an toàn không đủ";
      this.goodSamples = 0;
    } else if (
      affordable > current &&
      buffer > config.highBuffer &&
      budget >= tracks[current + 1].bitrate * config.upgradeMargin
    ) {
      this.goodSamples++;
      reason = `Chờ tăng: ${this.goodSamples}/${config.upgradeSamples} mẫu tốt`;
      if (
        this.goodSamples >= config.upgradeSamples &&
        now - this.lastSwitch >= config.cooldownMs
      ) {
        next = current + 1;
        reason = "Tăng một mức: mạng ổn định, buffer trên 15 giây";
        this.goodSamples = 0;
      }
    } else {
      this.goodSamples = 0;
    }
    if (next !== current) this.lastSwitch = now;
    return { index: next, reason };
  }
}
