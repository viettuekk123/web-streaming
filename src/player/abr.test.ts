import { describe, expect, it } from "vitest";
import { BandwidthEstimator, BufferBandwidthStrategy } from "./abr";
import type { Track } from "./types";

const tracks = [1_000_000, 2_000_000, 4_000_000].map(
  (bitrate, i) => ({ id: String(i), bitrate }) as Track,
);

describe("ABR", () => {
  it("EWMA có half-life 3 giây", () => {
    const estimator = new BandwidthEstimator();
    estimator.sample(375_000, 3); // 1 Mbps
    estimator.sample(1_125_000, 3); // 3 Mbps
    expect(estimator.value).toBeCloseTo(2_000_000);
  });

  it("khởi đầu thấp và chỉ tăng sau nhiều mẫu tốt", () => {
    const strategy = new BufferBandwidthStrategy();
    expect(
      strategy.choose({ tracks, current: 0, bandwidth: 0, buffer: 0, now: 0 })
        .index,
    ).toBe(0);
    const input = {
      tracks,
      current: 0,
      bandwidth: 10_000_000,
      buffer: 18,
      now: 10_000,
    };
    expect(strategy.choose(input).index).toBe(0);
    expect(strategy.choose(input).index).toBe(0);
    expect(strategy.choose(input).index).toBe(1);
  });

  it("cooldown chặn tăng liên tục nhưng giảm khẩn cấp vẫn hoạt động", () => {
    const strategy = new BufferBandwidthStrategy();
    const input = {
      tracks,
      current: 0,
      bandwidth: 10_000_000,
      buffer: 18,
      now: 10_000,
    };
    strategy.choose(input);
    strategy.choose(input);
    strategy.choose(input);
    for (let i = 0; i < 4; i++)
      expect(strategy.choose({ ...input, current: 1, now: 11_000 }).index).toBe(
        1,
      );
    expect(
      strategy.choose({ ...input, current: 1, buffer: 2, now: 11_001 }).index,
    ).toBe(0);
  });

  it("hysteresis tránh tăng sát ngưỡng và giảm nhiều mức khi mạng suy yếu", () => {
    const strategy = new BufferBandwidthStrategy();
    for (let i = 0; i < 8; i++)
      expect(
        strategy.choose({
          tracks,
          current: 0,
          bandwidth: 2_700_000,
          buffer: 20,
          now: 10_000 + i * 4000,
        }).index,
      ).toBe(0);
    expect(
      strategy.choose({
        tracks,
        current: 2,
        bandwidth: 800_000,
        buffer: 8,
        now: 50_000,
      }).index,
    ).toBe(0);
  });
});
