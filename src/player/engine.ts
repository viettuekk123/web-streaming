import { api } from "../api/client";
import {
  BandwidthEstimator,
  BufferBandwidthStrategy,
  type AbrStrategy,
} from "./abr";
import { playerConfig as config } from "./config";
import { loadSegment } from "./segmentLoader";
import { SourceQueue } from "./sourceQueue";
import { bufferAhead, contains, segmentAt } from "./timeline";
import type { Manifest, PlayerStats, Track } from "./types";

export class PlayerEngine {
  manifest: Manifest | null = null;
  stats: PlayerStats = {
    status: "loading",
    error: "",
    buffer: 0,
    throughput: 0,
    bandwidth: 0,
    playingQuality: "",
    loadingQuality: "",
    mode: "auto",
    segment: 0,
    reason: "Chưa có mẫu mạng",
    stalls: 0,
    stallSeconds: 0,
  };
  private media = new MediaSource();
  private objectUrl = "";
  private controller = new AbortController();
  private videoQueue?: SourceQueue;
  private audioQueue?: SourceQueue;
  private disposed = false;
  private busy = false;
  private downloadingVideo = false;
  private downloadStarted = 0;
  private generation = 0;
  private nextVideo = 0;
  private nextAudio = 0;
  private currentQuality = 0;
  private initializedQuality = "";
  private audioInitialized = false;
  private pendingSeek: number | null = null;
  private internalSeekTarget: number | null = null;
  private timer?: ReturnType<typeof setInterval>;
  private estimator = new BandwidthEstimator();
  private stallStart = 0;
  private qualityRanges: { start: number; end: number; quality: string }[] = [];

  constructor(
    private video: HTMLVideoElement,
    private onStats: (stats: PlayerStats) => void,
    private strategy: AbrStrategy = new BufferBandwidthStrategy(),
  ) {}

  async open(manifestUrl: string, resume = 0): Promise<void> {
    try {
      const { data } = await api.get<Manifest>(manifestUrl, {
        signal: this.controller.signal,
      });
      if (this.disposed) return;
      if (
        !data.renditions.length ||
        !Number.isFinite(data.duration) ||
        data.duration <= 0
      )
        throw new Error("Manifest không hợp lệ");
      this.manifest = data;
      data.renditions.sort((a, b) => a.bitrate - b.bitrate);
      for (const track of [
        ...data.renditions,
        ...(data.audio ? [data.audio] : []),
      ]) {
        if (!MediaSource.isTypeSupported(this.mime(track)))
          throw new Error(`Trình duyệt không hỗ trợ ${track.codec}`);
      }
      this.objectUrl = URL.createObjectURL(this.media);
      const opened = new Promise<void>((resolve, reject) => {
        const done = () => {
          cleanup();
          resolve();
        };
        const abort = () => {
          cleanup();
          reject(new DOMException("Đã đóng", "AbortError"));
        };
        const cleanup = () => {
          this.media.removeEventListener("sourceopen", done);
          this.controller.signal.removeEventListener("abort", abort);
        };
        this.media.addEventListener("sourceopen", done, { once: true });
        this.controller.signal.addEventListener("abort", abort, { once: true });
      });
      this.video.src = this.objectUrl;
      await opened;
      if (this.disposed) return;
      this.media.duration = data.duration;
      this.videoQueue = new SourceQueue(
        this.media.addSourceBuffer(this.mime(data.renditions[0])),
      );
      if (data.audio)
        this.audioQueue = new SourceQueue(
          this.media.addSourceBuffer(this.mime(data.audio)),
        );
      for (const event of [
        "seeking",
        "waiting",
        "playing",
        "pause",
        "ended",
        "timeupdate",
        "error",
      ])
        this.video.addEventListener(event, this.onVideoEvent);
      this.pendingSeek = Math.min(
        Math.max(0, resume),
        Math.max(0, data.duration - 0.05),
      );
      this.setIndexes(this.pendingSeek);
      this.timer = setInterval(() => {
        this.checkEmergencyDownload();
        this.publish();
        void this.pump();
      }, 250);
      await this.pump();
    } catch (error) {
      if (!this.disposed && !this.controller.signal.aborted) this.fail(error);
    }
  }

  private mime(track: Track) {
    return `${track.mime}; codecs="${track.codec}"`;
  }

  private checkEmergencyDownload() {
    if (
      !this.manifest ||
      this.stats.mode !== "auto" ||
      !this.downloadingVideo ||
      this.video.paused ||
      this.currentQuality === 0
    )
      return;
    if (
      performance.now() - this.downloadStarted < 1000 ||
      bufferAhead(this.video.buffered, this.video.currentTime) >=
        config.lowBuffer
    )
      return;
    const decision = this.strategy.choose({
      tracks: this.manifest.renditions,
      current: this.currentQuality,
      bandwidth: this.estimator.value,
      buffer: 0,
      now: performance.now(),
    });
    this.currentQuality = decision.index;
    this.stats.reason =
      "Giảm khẩn cấp: hủy segment tải chậm khi buffer dưới 4 giây";
    // Giữ nextVideo: tải lại đúng segment này ở chất lượng thấp, không bỏ qua timeline.
    this.generation++;
    this.controller.abort();
    this.controller = new AbortController();
  }

  private onVideoEvent = (event: Event) => {
    if (event.type === "seeking") {
      if (
        this.internalSeekTarget !== null &&
        Math.abs(this.video.currentTime - this.internalSeekTarget) < 0.1
      )
        this.internalSeekTarget = null;
      else this.seek(this.video.currentTime);
    }
    if (
      event.type === "waiting" &&
      !this.video.paused &&
      !this.video.ended &&
      !this.stallStart
    ) {
      this.stallStart = performance.now();
      this.stats.stalls++;
    }
    if (["playing", "pause", "ended"].includes(event.type)) this.finishStall();
    if (event.type === "error")
      this.fail(
        new Error(this.video.error?.message || "Không giải mã được media"),
      );
    this.publish();
  };

  private finishStall() {
    if (this.stallStart) {
      this.stats.stallSeconds += (performance.now() - this.stallStart) / 1000;
      this.stallStart = 0;
    }
  }

  private setIndexes(time: number) {
    if (!this.manifest) return;
    this.nextVideo = segmentAt(this.manifest.renditions[0].segments, time);
    this.nextAudio = this.manifest.audio
      ? segmentAt(this.manifest.audio.segments, time)
      : 0;
  }

  seek(time: number) {
    if (!this.manifest || this.disposed || this.stats.error) return;
    const target = Math.min(Math.max(0, time), this.manifest.duration - 0.05);
    if (this.pendingSeek === null && contains(this.video.buffered, target)) {
      this.pendingSeek = null;
      return;
    }
    this.generation++;
    this.controller.abort();
    this.controller = new AbortController();
    this.pendingSeek = target;
    this.setIndexes(target);
    // Một request cũ có thể đang append. Pump mới chờ hàng đợi xong rồi dọn buffer.
    void this.pump();
  }

  selectQuality(mode: string) {
    if (
      mode !== "auto" &&
      !this.manifest?.renditions.some((r) => r.id === mode)
    )
      return;
    this.stats.mode = mode;
    this.strategy.reset();
    this.stats.reason =
      mode === "auto" ? "Đã bật Auto" : "Người dùng chọn chất lượng cố định";
    this.publish();
  }

  private async append(
    queue: SourceQueue,
    data: ArrayBuffer,
    generation: number,
  ) {
    if (generation !== this.generation || this.disposed) return;
    try {
      await queue.append(data);
    } catch (error) {
      if (
        !(error instanceof DOMException) ||
        error.name !== "QuotaExceededError"
      )
        throw error;
      const before = Math.max(0, this.video.currentTime - 2);
      if (!before)
        throw new Error(
          "Không đủ bộ nhớ buffer. Thử tải lại hoặc chọn chất lượng thấp hơn.",
        );
      await queue.remove(0, before);
      if (generation === this.generation && !this.disposed)
        await queue.append(data);
    }
  }

  private async fetchTrack(
    track: Track,
    queue: SourceQueue,
    index: number,
    generation: number,
    signal: AbortSignal,
    isVideo: boolean,
  ) {
    const needsInit = isVideo
      ? this.initializedQuality !== track.id
      : !this.audioInitialized;
    if (needsInit) {
      const init = await loadSegment(track.init_url, signal);
      if (generation !== this.generation || this.disposed) return;
      await this.append(queue, init.data, generation);
      if (isVideo) this.initializedQuality = track.id;
      else this.audioInitialized = true;
    }
    const segment = track.segments[index];
    this.downloadingVideo = isVideo;
    this.downloadStarted = performance.now();
    let result: Awaited<ReturnType<typeof loadSegment>>;
    try {
      result = await loadSegment(segment.url, signal);
    } finally {
      this.downloadingVideo = false;
    }
    if (generation !== this.generation || this.disposed) return;
    await this.append(queue, result.data, generation);
    if (generation !== this.generation || this.disposed) return;
    if (isVideo) {
      this.qualityRanges.push({
        start: segment.start,
        end: segment.start + segment.duration,
        quality: track.id,
      });
      this.nextVideo = index + 1;
      this.stats.segment = index;
      if (result.validSample)
        this.estimator.sample(result.data.byteLength, result.seconds);
    } else {
      this.nextAudio = index + 1;
    }
  }

  private async pump() {
    if (
      this.busy ||
      this.disposed ||
      !this.manifest ||
      !this.videoQueue ||
      this.stats.error
    )
      return;
    this.busy = true;
    const generation = this.generation;
    const signal = this.controller.signal;
    try {
      if (this.pendingSeek !== null) {
        const target = this.pendingSeek;
        await this.videoQueue.idle();
        if (this.audioQueue) await this.audioQueue.idle();
        if (generation !== this.generation || this.disposed) return;
        await this.videoQueue.remove(0, this.manifest.duration + 1);
        if (this.audioQueue)
          await this.audioQueue.remove(0, this.manifest.duration + 1);
        if (generation !== this.generation || this.disposed) return;
        this.qualityRanges = [];
        if (Math.abs(this.video.currentTime - target) > 0.02) {
          this.internalSeekTarget = target;
          this.video.currentTime = target;
        }
        this.pendingSeek = null;
      }
      if (
        bufferAhead(this.video.buffered, this.video.currentTime) >=
        config.bufferTarget
      )
        return;
      const tracks = this.manifest.renditions;
      if (
        this.nextVideo >= tracks[0].segments.length &&
        (!this.manifest.audio ||
          this.nextAudio >= this.manifest.audio.segments.length)
      )
        return;
      const decision =
        this.stats.mode === "auto"
          ? this.strategy.choose({
              tracks,
              current: this.currentQuality,
              bandwidth: this.estimator.value,
              buffer: bufferAhead(this.video.buffered, this.video.currentTime),
              now: performance.now(),
            })
          : {
              index: tracks.findIndex((r) => r.id === this.stats.mode),
              reason: "Chất lượng cố định do người dùng chọn",
            };
      this.currentQuality = decision.index;
      const track = tracks[this.currentQuality];
      this.stats.reason = decision.reason;
      this.stats.loadingQuality = track.id;
      const audio = this.manifest.audio;
      // Tải audio đi cùng mốc video; timeline AAC có thể lệch nhẹ so với keyframe video.
      const videoSegment = track.segments[this.nextVideo];
      const until = videoSegment
        ? videoSegment.start + videoSegment.duration
        : this.manifest.duration;
      if (audio && this.audioQueue) {
        while (
          this.nextAudio < audio.segments.length &&
          audio.segments[this.nextAudio].start < until + 0.05
        ) {
          await this.fetchTrack(
            audio,
            this.audioQueue,
            this.nextAudio,
            generation,
            signal,
            false,
          );
          if (generation !== this.generation || this.disposed) return;
        }
      }
      if (videoSegment)
        await this.fetchTrack(
          track,
          this.videoQueue,
          this.nextVideo,
          generation,
          signal,
          true,
        );
      if (generation !== this.generation || this.disposed) return;
      const cutoff = this.video.currentTime - config.keepBehind;
      if (cutoff > 1) {
        await this.videoQueue.remove(0, cutoff);
        if (this.audioQueue) await this.audioQueue.remove(0, cutoff);
        this.qualityRanges = this.qualityRanges.filter((r) => r.end > cutoff);
      }
      if (
        this.nextVideo >= track.segments.length &&
        (!audio || this.nextAudio >= audio.segments.length) &&
        this.media.readyState === "open"
      ) {
        await this.videoQueue.idle();
        if (this.audioQueue) await this.audioQueue.idle();
        this.media.endOfStream();
      }
    } catch (error) {
      if (!this.disposed && generation === this.generation && !signal.aborted)
        this.fail(error);
    } finally {
      this.busy = false;
      if (!this.disposed) this.publish();
    }
  }

  private fail(error: unknown) {
    this.stats.error =
      error instanceof Error ? error.message : "Không thể tải/phát video";
    this.stats.status = "error";
    this.finishStall();
    this.publish();
  }

  private publish() {
    if (this.disposed) return;
    this.stats.buffer = bufferAhead(
      this.video.buffered,
      this.video.currentTime,
    );
    const stalled =
      !this.video.paused &&
      !this.video.ended &&
      this.video.readyState < 3 &&
      this.video.currentTime > 0.1;
    if (stalled && !this.stallStart) {
      this.stallStart = performance.now();
      this.stats.stalls++;
    }
    if (!stalled) this.finishStall();
    this.stats.bandwidth = this.estimator.value;
    this.stats.throughput = this.estimator.last;
    this.stats.playingQuality =
      this.qualityRanges.find(
        (r) =>
          r.start <= this.video.currentTime && r.end > this.video.currentTime,
      )?.quality || "";
    if (!this.stats.error)
      this.stats.status = this.video.ended
        ? "ended"
        : this.video.paused
          ? "paused"
          : this.video.readyState < 3
            ? "buffering"
            : "playing";
    this.onStats({
      ...this.stats,
      stallSeconds:
        this.stats.stallSeconds +
        (this.stallStart ? (performance.now() - this.stallStart) / 1000 : 0),
    });
  }

  destroy() {
    this.disposed = true;
    this.generation++;
    this.controller.abort();
    clearInterval(this.timer);
    for (const event of [
      "seeking",
      "waiting",
      "playing",
      "pause",
      "ended",
      "timeupdate",
      "error",
    ])
      this.video.removeEventListener(event, this.onVideoEvent);
    this.videoQueue?.dispose();
    this.audioQueue?.dispose();
    this.video.pause();
    this.video.removeAttribute("src");
    this.video.load();
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
  }
}
