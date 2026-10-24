import axios from 'axios';
import { api } from '../api/client';

export class WatchProgress {
  private token = '';
  private sequence = 0;
  private stopped = false;
  private timer?: ReturnType<typeof setInterval>;
  private hasStarted = false;

  constructor(private videoId: string, private video: HTMLVideoElement, private onWarning: (message: string) => void) {}

  async open(): Promise<number> {
    const { data } = await api.post<{ write_session: string; position_seconds: number }>(`/api/videos/${this.videoId}/progress/session`);
    this.token = data.write_session;
    return data.position_seconds;
  }

  start() {
    if (this.stopped) return;
    this.timer = setInterval(() => { if (!this.video.paused) void this.save(); }, 5000);
    this.video.addEventListener('playing', this.onPlaying);
    for (const event of ['pause', 'seeked', 'ended']) this.video.addEventListener(event, this.onSave);
    document.addEventListener('visibilitychange', this.onHidden);
  }

  private onPlaying = () => { this.hasStarted = true; };
  private onSave = () => { if (this.hasStarted) void this.save(); };
  private onHidden = () => { if (document.hidden && this.hasStarted) void this.save(); };

  async save(position = this.video.currentTime) {
    if (!this.token || this.stopped || !Number.isFinite(position)) return;
    const sequence = ++this.sequence;
    try {
      await api.put(`/api/videos/${this.videoId}/progress`, { write_session: this.token, sequence, position_seconds: position });
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        if (sequence === this.sequence) { this.stopped = true; this.onWarning('Tiến độ đang được cập nhật ở phiên xem khác.'); }
      } else this.onWarning('Chưa lưu được tiến độ. Sẽ thử ở lần cập nhật tiếp theo.');
    }
  }

  close() {
    if (this.hasStarted) void this.save();
    this.stopped = true;
    clearInterval(this.timer);
    this.video.removeEventListener('playing', this.onPlaying);
    for (const event of ['pause', 'seeked', 'ended']) this.video.removeEventListener(event, this.onSave);
    document.removeEventListener('visibilitychange', this.onHidden);
  }
}
