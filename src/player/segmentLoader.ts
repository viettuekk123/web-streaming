import axios from "axios";
import { api } from "../api/client";
import { playerConfig as config } from "./config";

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(new DOMException("Đã hủy", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, ms);
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
  });
}

export async function loadSegment(url: string, signal: AbortSignal) {
  for (let attempt = 0; ; attempt++) {
    const started = performance.now();
    // Cache-buster + no-store từ API: mẫu mạng trong demo không lấy từ disk/memory cache.
    const requestUrl = `${url}${url.includes("?") ? "&" : "?"}sample=${crypto.randomUUID()}`;
    try {
      const response = await api.get<ArrayBuffer>(requestUrl, {
        responseType: "arraybuffer",
        signal,
        timeout: config.requestTimeout,
      });
      const seconds = Math.max((performance.now() - started) / 1000, 0.001);
      const cacheControl = String(response.headers["cache-control"] || "");
      const age = Number(response.headers.age || 0);
      return {
        data: response.data,
        seconds,
        validSample:
          cacheControl.includes("no-store") && age === 0 && !signal.aborted,
      };
    } catch (error) {
      if (signal.aborted || axios.isCancel(error)) throw error;
      const status = axios.isAxiosError(error)
        ? error.response?.status
        : undefined;
      if (
        attempt >= config.retryCount ||
        (status !== undefined &&
          status >= 400 &&
          status < 500 &&
          status !== 408 &&
          status !== 429)
      )
        throw error;
      await delay(config.retryDelay * 2 ** attempt, signal);
    }
  }
}
