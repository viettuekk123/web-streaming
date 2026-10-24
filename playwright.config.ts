import { defineConfig } from "@playwright/test";

// Chạy backend + frontend và tạo demo trước. Dùng Chrome đã cài trên Windows.
export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  timeout: 30_000,
  use: { baseURL: "http://localhost:5173", channel: "chrome", headless: true },
});
