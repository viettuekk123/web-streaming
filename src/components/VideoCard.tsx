import { Link } from "react-router-dom";
import { formatTime, mediaUrl, type VideoInfo } from "../api/videos";
export function VideoCard({ video }: { video: VideoInfo }) {
  return (
    <Link className="video-card" to={`/watch/${video.id}`}>
      <div className="thumbnail">
        {video.thumbnail_url && (
          <img src={mediaUrl(video.thumbnail_url)} alt="" loading="lazy" />
        )}
        <span>{formatTime(video.duration)}</span>
      </div>
      <div className="card-info">
        <div className="avatar">{video.username[0]?.toUpperCase()}</div>
        <div>
          <h3>{video.title}</h3>
          <p>{video.username}</p>
          <p>{new Date(video.created_at).toLocaleDateString("vi-VN")}</p>
        </div>
      </div>
    </Link>
  );
}
