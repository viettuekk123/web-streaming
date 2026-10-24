import axios from "axios";
import { api } from "../api/client";

export class WatchProgress {
  private token = "";
  private sequence = 0;
  private stopped = false;
  private timer?: ReturnType<typeof setInterval>;
  private hasStarted = false;
  private saveQueue: Promise<void> = Promise.resolve();
  private openController = new AbortController();

  constructor(
    private videoId: string,
    private video: HTMLVideoElement,
    private onWarning: (message: string) => void,
  ) {}

  async open(): Promise<number> {
    const { data } = await api.post<{
      write_session: string;
      position_seconds: number;
    }>(`/api/videos/${this.videoId}/progress/session`, undefined, {
      signal: this.openController.signal,
    });
    this.token = data.write_session;
    return data.position_seconds;
  }

  start() {
    if (this.stopped) return;
    this.timer = setInterval(() => {
      if (!this.video.paused) void this.save();
    }, 5000);
    this.video.addEventListener("playing", this.onPlaying);
    for (const event of ["pause", "ended"])
      this.video.addEventListener(event, this.onSave);
    this.video.addEventListener("seeked", this.onSeeked);
    document.addEventListener("visibilitychange", this.onHidden);
  }

  private onPlaying = () => {
    this.hasStarted = true;
  };
  private onSave = () => {
    if (this.hasStarted) void this.save();
  };
  private onSeeked = () => {
    // Người xem có thể chủ động tua khi vẫn pause, chưa nhấn Play lần nào.
    this.hasStarted = true;
    void this.save();
  };
  private onHidden = () => {
    if (document.hidden && this.hasStarted) void this.save();
  };

  async save(position = this.video.currentTime) {
    if (!this.token || this.stopped || !Number.isFinite(position)) return;
    const sequence = ++this.sequence;
    // Các event pause/seeked/interval có thể xảy ra cùng lúc. Gửi tuần tự để
    // request sequence nhỏ hơn luôn được xử lý trước request mới hơn.
    this.saveQueue = this.saveQueue.then(async () => {
      try {
        await api.put(`/api/videos/${this.videoId}/progress`, {
          write_session: this.token,
          sequence,
          position_seconds: position,
        });
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 409) {
          // Nếu đã có sequence mới hơn thì đây chỉ là request cũ đến trễ.
          if (sequence === this.sequence) {
            this.stopped = true;
            this.onWarning("Tiến độ đang được cập nhật ở phiên xem khác.");
          }
        } else {
          this.onWarning(
            "Chưa lưu được tiến độ. Sẽ thử ở lần cập nhật tiếp theo.",
          );
        }
      }
    });
    await this.saveQueue;
  }

  close() {
    this.openController.abort();
    if (this.hasStarted) void this.save();
    this.stopped = true;
    clearInterval(this.timer);
    this.video.removeEventListener("playing", this.onPlaying);
    for (const event of ["pause", "ended"])
      this.video.removeEventListener(event, this.onSave);
    this.video.removeEventListener("seeked", this.onSeeked);
    document.removeEventListener("visibilitychange", this.onHidden);
  }
}
