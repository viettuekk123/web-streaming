import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, errorMessage } from '../api/client';
import type { VideoInfo } from '../api/videos';
import { useAuth } from '../auth/AuthContext';
import { VideoCard } from '../components/VideoCard';
import { Player } from '../player/Player';
export function WatchPage({ demo = false }: { demo?: boolean }) {
  const { id = 'demo' } = useParams();
  const { user, loading } = useAuth();
  const [video, setVideo] = useState<VideoInfo | null>(null);
  const [others, setOthers] = useState<VideoInfo[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    if (demo) return;
    const controller = new AbortController();
    setVideo(null); setError('');
    api.get(`/api/videos/${id}`, { signal: controller.signal }).then(r => setVideo(r.data)).catch(e => { if (!controller.signal.aborted) setError(errorMessage(e)); });
    api.get('/api/videos', { signal: controller.signal }).then(r => setOthers(r.data.items.filter((v: VideoInfo) => v.id !== id))).catch(() => {});
    return () => controller.abort();
  }, [id, demo]);
  if (error) return <p className="error">{error}</p>;
  if (!demo && !video) return <p>Đang tải video…</p>;
  return <div className="watch-layout"><div>{!loading && <Player key={demo ? 'demo' : id} videoId={demo ? 'demo' : id} loggedIn={!!user} manifestUrl={demo ? '/api/demo/demo/manifest' : `/api/videos/${id}/manifest`} />}
    <h1 className="watch-title">{demo ? 'Phòng thử nghiệm · Adaptive Bitrate Streaming' : video?.title}</h1><div className="uploader"><div className="avatar">{demo ? 'B' : video?.username[0]?.toUpperCase()}</div><div><strong>{demo ? 'BVG Lab' : video?.username}</strong><p className="muted">{demo ? 'Video mẫu được tạo bằng FFmpeg' : video && new Date(video.created_at).toLocaleDateString('vi-VN')}</p></div><span className="tag">VIDEO ON DEMAND</span></div>
    <div className="description">{demo ? 'Bật ABR Debug và dùng network throttling trong DevTools để thử mạng nhanh → chậm → nhanh. Chất lượng mới áp dụng ở segment tiếp theo chưa tải.' : video?.description || 'Video này chưa có mô tả.'}</div>
    </div><aside className="related"><h2>{demo ? 'Cách quan sát' : 'Xem tiếp'}</h2>{demo ? <div className="lab-notes"><p>01 / Bật ABR Debug</p><p>02 / Nhấn Play</p><p>03 / Đổi tốc độ mạng</p><p>04 / Theo dõi EWMA và buffer</p><small>Buffer đã tải có thể giữ chất lượng cũ thêm vài giây.</small></div> : others.map(v => <VideoCard key={v.id} video={v} />)}</aside></div>;
}
