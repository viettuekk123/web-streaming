import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, errorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
export function UploadPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [percent, setPercent] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  if (loading) return <p>Đang tải…</p>;
  if (!user) return <div className="empty"><h1>Chia sẻ video của bạn</h1><p>Đăng nhập để upload.</p><Link className="primary button" to="/login">Đăng nhập</Link></div>;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setPercent(0);
    controller.current = new AbortController();
    try { await api.post('/api/videos', new FormData(event.currentTarget), { signal: controller.current.signal, timeout: 0, onUploadProgress: e => setPercent(e.total ? Math.round(e.loaded * 100 / e.total) : 0) }); navigate('/mine'); }
    catch (e) { if (!controller.current.signal.aborted) setError(errorMessage(e)); } finally { setBusy(false); }
  }
  return <div className="form-card upload-card"><p className="eyebrow">GÓC SÁNG TẠO</p><h1>Đưa video lên BVG</h1><p className="muted">Hệ thống sẽ chuẩn bị các chất lượng phù hợp với nguồn.</p><form onSubmit={submit}><label className="file-drop">↑<strong>Chọn file video</strong><input name="file" type="file" accept="video/*" required disabled={busy} /></label><label>Tiêu đề<input name="title" required maxLength={200} disabled={busy} /></label><label>Mô tả<textarea name="description" rows={4} maxLength={5000} disabled={busy} /></label>{busy && <div><progress max={100} value={percent} /><p>{percent}% · {percent === 100 ? 'Đang kiểm tra video…' : 'Đang upload…'}</p></div>}{error && <p className="error">{error}</p>}<button className="primary" disabled={busy}>{busy ? 'Đang upload…' : 'Upload video'}</button></form></div>;
}
