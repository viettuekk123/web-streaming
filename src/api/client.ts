import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  withCredentials: true,
  timeout: 30_000,
});

export function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    return typeof detail === 'string' ? detail : 'Không thể thực hiện yêu cầu. Vui lòng thử lại.';
  }
  return error instanceof Error ? error.message : 'Đã có lỗi xảy ra.';
}
