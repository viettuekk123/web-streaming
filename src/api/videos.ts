export interface VideoInfo {
  id: string;
  title: string;
  description: string;
  username: string;
  duration: number;
  thumbnail_url: string | null;
  created_at: string;
  status: string;
  error: string | null;
}
export function mediaUrl(path: string) {
  return `${import.meta.env.VITE_API_URL || "http://localhost:8000"}${path}`;
}
export function formatTime(seconds: number) {
  const whole = Math.floor(seconds || 0);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}
