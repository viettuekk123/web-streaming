import { afterEach, expect, it, vi } from "vitest";
import { api } from "../api/client";
import { WatchProgress } from "./progress";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("lưu seek khi chưa Play và gỡ listener khi đóng", async () => {
  const video = Object.assign(new EventTarget(), {
    currentTime: 0,
    paused: true,
  });
  vi.stubGlobal(
    "document",
    Object.assign(new EventTarget(), { hidden: false }),
  );
  vi.spyOn(api, "post").mockResolvedValue({
    data: { write_session: "test-session", position_seconds: 0 },
  });
  const put = vi.spyOn(api, "put").mockResolvedValue({ data: { ok: true } });
  const progress = new WatchProgress(
    "test-video",
    video as HTMLVideoElement,
    vi.fn(),
  );
  await progress.open();
  progress.start();
  video.currentTime = 5;
  video.dispatchEvent(new Event("seeked"));
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(put).toHaveBeenLastCalledWith("/api/videos/test-video/progress", {
    write_session: "test-session",
    sequence: 1,
    position_seconds: 5,
  });
  progress.close();
  await new Promise((resolve) => setTimeout(resolve, 0));
  const callsAfterClose = put.mock.calls.length;
  video.currentTime = 8;
  video.dispatchEvent(new Event("seeked"));
  expect(put).toHaveBeenCalledTimes(callsAfterClose);
});

it("gửi tuần tự các lần lưu phát sinh cùng lúc", async () => {
  const video = Object.assign(new EventTarget(), {
    currentTime: 0,
    paused: true,
  });
  vi.stubGlobal(
    "document",
    Object.assign(new EventTarget(), { hidden: false }),
  );
  vi.spyOn(api, "post").mockResolvedValue({
    data: { write_session: "test-session", position_seconds: 0 },
  });
  let finishFirst!: () => void;
  const firstRequest = new Promise<void>((resolve) => {
    finishFirst = resolve;
  });
  const put = vi
    .spyOn(api, "put")
    .mockImplementationOnce(async () => {
      await firstRequest;
      return { data: { ok: true } };
    })
    .mockResolvedValue({ data: { ok: true } });
  const progress = new WatchProgress(
    "test-video",
    video as HTMLVideoElement,
    vi.fn(),
  );
  await progress.open();
  const first = progress.save(3);
  const second = progress.save(1);
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(put).toHaveBeenCalledTimes(1);
  finishFirst();
  await Promise.all([first, second]);
  expect(put.mock.calls.map((call) => call[1])).toEqual([
    { write_session: "test-session", sequence: 1, position_seconds: 3 },
    { write_session: "test-session", sequence: 2, position_seconds: 1 },
  ]);
  progress.close();
});
