# BVG Streaming — web

React + TypeScript strict + Vite + Axios. Player tự tải segment và phát bằng Media Source Extensions. Thuật toán ABR được viết trong repo, không dùng thư viện streaming/player.

## Chạy trên Windows

Node.js 20.20.2 trở lên (hoặc Node 22 LTS). Backend chạy tại http://localhost:8000.

```powershell
npm ci
Copy-Item .env.example .env
npm run dev
```

Mở http://localhost:5173. Nếu API ở địa chỉ khác, sửa VITE_API_URL và APP_ORIGIN ở backend tương ứng. Dùng localhost nhất quán để cookie session hoạt động.

- `/`: trang chủ/tìm kiếm và phân trang.
- `/demo`: video mẫu và phòng quan sát ABR; cần chạy scripts.prepare_demo ở backend trước.
- `/watch/{id}`: xem video đã xử lý.
- `/register`, `/login`: tài khoản đơn giản.
- `/upload`, `/mine`: upload và theo dõi trạng thái xử lý.

## Player và thuật toán

- `src/player/engine.ts`: vòng tải, MSE, seek, chuyển rendition và cleanup.
- `sourceQueue.ts`: tuần tự append/remove và chờ updateend.
- `segmentLoader.ts`: Axios ArrayBuffer, abort, retry/backoff và tránh mẫu cache.
- `timeline.ts`: tìm segment và tính buffer liên tục.
- `abr.ts`: EWMA và interface strategy, safety margin, hysteresis, cooldown.
- `config.ts`: ngưỡng buffer, ABR và retry.
- `progress.ts`: lưu tiến độ SQL Server qua API, sequence và phiên ghi.
- `usePlayer.ts`, `Player.tsx`: nối engine với React, điều khiển và debug panel.

HTMLVideoElement controls cung cấp play/pause, seek, thời gian, âm lượng và fullscreen. Thanh dưới cung cấp chất lượng Auto/thủ công, xem từ đầu và debug. Các segment đã buffer giữ chất lượng cũ cho tới khi phát qua ranh giới tương ứng.

## Demo ABR

1. Mở Chrome/Edge DevTools → Network, bật Disable cache.
2. Mở `/demo`, bật ABR Debug rồi nhấn Play.
3. Để No throttling, theo dõi buffer tăng và chất lượng tăng từng mức.
4. Tạo profile mạng khoảng 1200–1800 kbps để quan sát giảm; thử thấp hơn để quan sát buffering.
5. Trở lại No throttling, quan sát EWMA hồi phục rồi chất lượng tăng chậm.
6. Thử chọn chất lượng cố định và trở về Auto; tua vào vùng chưa tải.

Khi buffer dưới 4 giây và request video ở chất lượng cao bị kéo dài, Auto có thể hủy request để tải lại cùng segment ở mức thấp hơn. Debug phân biệt chất lượng đang phát/đang tải. Video mẫu dài 65 giây đủ thấy một số lần chuyển; dùng mẫu dài hơn để demo nhiều chu kỳ mạng.

## Kiểm tra

```powershell
npm test
npm run build
npm run test:e2e
```

E2E cần backend/frontend đang chạy và hai bộ demo `demo` (65 giây, 1080p, audio) cùng `short` (2,3 giây, 640x360, không audio) đã tạo. Dùng Chrome cài trên Windows qua playwright.config.ts. Test EWMA, tăng chậm, giảm khẩn cấp, hysteresis, cooldown và timeline. Chạy build không thay thế kiểm tra phát video trong trình duyệt thật. Kết quả tích hợp được ghi ở repo server: `docs/VERIFICATION.md`.
