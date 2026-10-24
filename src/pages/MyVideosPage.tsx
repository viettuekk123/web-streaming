import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, errorMessage } from "../api/client";
import type { VideoInfo } from "../api/videos";
import { useAuth } from "../auth/AuthContext";
const labels: Record<string, string> = {
  uploaded: "Chờ xử lý",
  processing: "Đang xử lý",
  ready: "Sẵn sàng",
  failed: "Thất bại",
};
export function MyVideosPage() {
  const { user, loading } = useAuth();
  const [videos, setVideos] = useState<VideoInfo[]>([]);
  const [error, setError] = useState("");
  const [fetching, setFetching] = useState(true);
  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    const refresh = () =>
      api
        .get("/api/videos/mine", { signal: controller.signal })
        .then((r) => {
          setVideos(r.data);
          setError("");
        })
        .catch((e) => {
          if (!controller.signal.aborted) setError(errorMessage(e));
        })
        .finally(() => {
          if (!controller.signal.aborted) setFetching(false);
        });
    void refresh();
    const timer = setInterval(refresh, 5000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [user]);
  if (loading) return <p>Đang tải…</p>;
  if (!user)
    return (
      <div className="empty">
        <h1>Video của tôi</h1>
        <Link to="/login">Đăng nhập để xem video của bạn</Link>
      </div>
    );
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">GÓC SÁNG TẠO</p>
          <h1>Video của tôi</h1>
        </div>
        <Link className="primary button" to="/upload">
          ＋ Upload video
        </Link>
      </div>
      {error && <p className="error">{error}</p>}
      {fetching ? (
        <p>Đang tải…</p>
      ) : !videos.length ? (
        <div className="empty">Bạn chưa upload video nào.</div>
      ) : (
        <div className="my-list">
          {videos.map((v) => (
            <article key={v.id}>
              <div>
                <h3>
                  {v.status === "ready" ? (
                    <Link to={`/watch/${v.id}`}>{v.title}</Link>
                  ) : (
                    v.title
                  )}
                </h3>
                <small>{new Date(v.created_at).toLocaleString("vi-VN")}</small>
                {v.error && <p className="notice">{v.error}</p>}
              </div>
              <span className={`badge ${v.status}`}>
                {labels[v.status] || v.status}
              </span>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
