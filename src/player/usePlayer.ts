import { useEffect, useRef, useState } from "react";
import { PlayerEngine } from "./engine";
import { WatchProgress } from "./progress";
import type { Manifest, PlayerStats } from "./types";

export function usePlayer(
  manifestUrl: string,
  videoId: string,
  loggedIn: boolean,
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const engineRef = useRef<PlayerEngine | null>(null);
  const progressRef = useRef<WatchProgress | null>(null);
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [warning, setWarning] = useState("");

  useEffect(() => {
    const video = videoRef.current!;
    let active = true;
    setStats(null);
    setManifest(null);
    setWarning("");
    const engine = new PlayerEngine(video, (state) => {
      if (active) setStats(state);
    });
    engineRef.current = engine;
    const progress =
      loggedIn && videoId !== "demo"
        ? new WatchProgress(videoId, video, (message) => {
            if (active) setWarning(message);
          })
        : null;
    progressRef.current = progress;
    async function open() {
      // StrictMode setup → cleanup → setup ngay trong cùng lượt render.
      // Chờ một microtask để effect đã bị cleanup không mở phiên ghi thừa.
      await Promise.resolve();
      if (!active) return;
      let resume = 0;
      if (progress) {
        try {
          resume = await progress.open();
        } catch {
          if (active)
            setWarning("Không lấy được tiến độ xem. Video sẽ phát từ đầu.");
        }
      }
      if (!active) return;
      await engine.open(manifestUrl, resume);
      if (active) {
        setManifest(engine.manifest);
        progress?.start();
      }
    }
    void open();
    return () => {
      active = false;
      progress?.close();
      engine.destroy();
      engineRef.current = null;
    };
  }, [manifestUrl, videoId, loggedIn]);

  function restart() {
    const video = videoRef.current;
    if (video) {
      video.currentTime = 0;
      engineRef.current?.seek(0);
      void progressRef.current?.save(0);
    }
  }
  return { videoRef, engineRef, stats, manifest, warning, restart };
}
