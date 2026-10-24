import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, errorMessage } from '../api/client';
import type { VideoInfo } from '../api/videos';
import { VideoCard } from '../components/VideoCard';
export function HomePage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [videos, setVideos] = useState<VideoInfo[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    api.get('/api/videos', { params: { q, page }, signal: controller.signal }).then(r => { setVideos(r.data.items); setTotal(r.data.total); }).catch(e => { if (!controller.signal.aborted) setError(errorMessage(e)); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [q, page]);
  return <><div className="page-heading"><div><p className="eyebrow">KHÁM PHÁ · HỌC HỎI · CHIA SẺ</p><h1>{q ? `Kết quả cho “${q}”` : 'Một góc nhìn mới.'}</h1><p className="muted">Những video đáng xem, theo nhịp của bạn.</p></div><Link className="demo-link" to="/demo">Mở phòng thử nghiệm ABR ↗</Link></div><div className="chips"><span className="selected">{q ? 'Kết quả tìm kiếm' : 'Tất cả video'}</span><span>Video theo yêu cầu</span><span>Do cộng đồng chia sẻ</span></div>
    {loading ? <div className="empty">Đang tải video…</div> : error ? <div className="empty error">{error}<p>Kiểm tra backend và SQL Server đã chạy.</p></div> : videos.length ? <div className="video-grid">{videos.map(v => <VideoCard key={v.id} video={v} />)}</div> : <div className="empty"><h2>{q ? 'Chưa có kết quả phù hợp' : 'Bắt đầu bằng video đầu tiên'}</h2><p>Upload video hoặc mở phòng thử nghiệm để khám phá player.</p><Link className="primary button" to="/upload">Upload video</Link></div>}
    {total > 12 && <div className="pagination"><button disabled={page <= 1} onClick={() => setParams({ q, page: String(page - 1) })}>← Trước</button><span>Trang {page} / {Math.ceil(total / 12)}</span><button disabled={page * 12 >= total} onClick={() => setParams({ q, page: String(page + 1) })}>Sau →</button></div>}</>;
}
