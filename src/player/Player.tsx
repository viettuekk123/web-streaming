import { useState } from "react";
import { usePlayer } from "./usePlayer";

const statusNames = {
  loading: "Đang tải",
  playing: "Đang phát",
  paused: "Tạm dừng",
  buffering: "Đang đệm",
  ended: "Đã kết thúc",
  error: "Lỗi",
};
export function Player({
  manifestUrl,
  videoId,
  loggedIn,
}: {
  manifestUrl: string;
  videoId: string;
  loggedIn: boolean;
}) {
  const { videoRef, engineRef, stats, manifest, warning, restart } = usePlayer(
    manifestUrl,
    videoId,
    loggedIn,
  );
  const [debug, setDebug] = useState(false);
  const mbps = (value: number) => `${(value / 1_000_000).toFixed(2)} Mbps`;
  return (
    <section className="player">
      <div className="video-frame">
        <video ref={videoRef} controls playsInline preload="none" />
        {stats?.status === "buffering" && (
          <div className="buffering">Đang tải thêm dữ liệu…</div>
        )}
      </div>
      <div className="player-tools">
        <span className="status-dot" />
        <span>
          {stats ? statusNames[stats.status] : "Đang chuẩn bị player"}
        </span>
        <label className="quality-label">
          Chất lượng{" "}
          <select
            value={stats?.mode || "auto"}
            onChange={(e) => engineRef.current?.selectQuality(e.target.value)}
          >
            <option value="auto">
              Auto{stats?.playingQuality ? ` · ${stats.playingQuality}` : ""}
            </option>
            {manifest?.renditions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.id}
              </option>
            ))}
          </select>
        </label>
        <button onClick={restart}>Xem từ đầu</button>
        <button
          className={debug ? "active" : ""}
          onClick={() => setDebug(!debug)}
        >
          ⌘ ABR Debug
        </button>
      </div>
      {stats?.error && (
        <p className="error">
          {stats.error}{" "}
          <button onClick={() => window.location.reload()}>Tải lại</button>
        </p>
      )}
      {warning && <p className="notice">{warning}</p>}
      {debug && stats && (
        <div className="debug-panel">
          <div>
            <small>THROUGHPUT MỚI NHẤT</small>
            <strong>{mbps(stats.throughput)}</strong>
          </div>
          <div>
            <small>BĂNG THÔNG EWMA</small>
            <strong>{mbps(stats.bandwidth)}</strong>
          </div>
          <div>
            <small>BUFFER PHÍA TRƯỚC</small>
            <strong>{stats.buffer.toFixed(1)} / 20 giây</strong>
          </div>
          <div>
            <small>ĐANG PHÁT / ĐANG TẢI</small>
            <strong>
              {stats.playingQuality || "—"} / {stats.loadingQuality || "—"}
            </strong>
          </div>
          <div>
            <small>SEGMENT ĐANG TẢI</small>
            <strong>#{stats.segment + 1}</strong>
          </div>
          <div>
            <small>BUFFERING</small>
            <strong>
              {stats.stalls} lần · {stats.stallSeconds.toFixed(1)} giây
            </strong>
          </div>
          <p className="abr-reason">↳ {stats.reason}</p>
        </div>
      )}
    </section>
  );
}
