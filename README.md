# BVG Streaming — web

React + TypeScript strict + Vite + Axios. Player tự tải segment và phát bằng Media Source Extensions. Thuật toán ABR được viết trong repo, không dùng thư viện streaming/player.

Repo backend: [server-streaming](https://github.com/viettuekk123/server-streaming). Cài backend theo README của repo đó trước khi chạy web.

## Chức năng

- Tìm kiếm, xem video; đăng ký/đăng nhập để upload và lưu tiến độ.
- Player tải segment bằng Axios, buffer mục tiêu 20 giây, hỗ trợ tua và đổi chất lượng.
- Auto dùng EWMA, safety margin, hysteresis, giảm nhanh và tăng chậm; có bảng debug giải thích quyết định.
- Giao diện sáng với nền trắng/xám nhạt và điểm nhấn xanh. Chữ nội dung dùng độ đậm 500; menu, nút, nhãn và tiêu đề video dùng 600. Màu và kiểu chữ nằm trong `src/style.css`.

## Chạy trên Windows

Node.js 20.20.2 trở lên (hoặc Node 22 LTS). Backend chạy tại http://localhost:8000.

Mở PowerShell tại thư mục `web-streaming`. Cần giữ API, worker và SQL Server chạy theo hướng dẫn backend.

```powershell
npm ci
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npm run dev
```

Mở http://localhost:5173. Nếu API ở địa chỉ khác, sửa VITE_API_URL và APP_ORIGIN ở backend tương ứng. Dùng localhost nhất quán để cookie session hoạt động.

Mặc định `.env` chứa `VITE_API_URL=http://localhost:8000`. Sau khi sửa biến môi trường, dừng rồi chạy lại `npm run dev`. Những lần khởi động sau chỉ cần chạy `npm run dev`, không cần tạo lại `.env`.

- `/`: trang chủ/tìm kiếm và phân trang.
- `/demo`: video mẫu và phòng quan sát ABR; cần chạy scripts.prepare_demo ở backend trước.
- `/watch/{id}`: xem video đã xử lý.
- `/register`, `/login`: tài khoản đơn giản.
- `/upload`, `/mine`: upload và theo dõi trạng thái xử lý.

## Sử dụng ứng dụng

1. Mở trang chủ để tìm video hoặc vào `/demo` để thử player bằng video mẫu.
2. Vào `/register` tạo tài khoản, sau đó đăng nhập nếu chưa có phiên đăng nhập.
3. Vào **Upload video**, chọn file, nhập tiêu đề/mô tả rồi upload. Theo dõi tại **Video của tôi**: `uploaded` → `processing` → `ready`; mở video khi đã sẵn sàng. Nếu `failed`, xem lỗi hiển thị và log worker.
4. Khi xem, dùng thanh điều khiển video để phát/dừng, tua, chỉnh âm lượng hoặc toàn màn hình. Chọn **Auto** hoặc chất lượng cố định ở thanh dưới.
5. Với video trong thư viện, đăng nhập để lưu tiến độ vào SQL Server. Hệ thống lưu khoảng mỗi 5 giây khi phát, thêm lúc pause, tua xong và trang bị ẩn; mở lại sẽ khôi phục vị trí. Từ 95% thời lượng được coi là đã xem và lần mở sau bắt đầu từ đầu. **Xem từ đầu** đưa về giây 0.

Khách và trang `/demo` không lưu tiến độ tài khoản. Nếu mở cùng video ở nhiều tab, phiên xem mở gần nhất có quyền ghi; tab cũ có thể hiện thông báo phiên đã được thay thế.

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

E2E cần backend/frontend đang chạy và hai bộ demo `demo` (65 giây, 1080p, audio) cùng `short` (2,3 giây, 640x360, không audio) đã tạo. Xem lệnh tạo mẫu trong README backend. Dùng Google Chrome cài trên Windows qua `playwright.config.ts`; cấu hình hiện tại không tự khởi động các dịch vụ.

- `npm test`: test EWMA, tăng chậm, giảm khẩn cấp, hysteresis, cooldown, timeline và logic tiến độ.
- `npm run test:e2e`: phát/seek/đổi chất lượng, retry segment, video ngắn và hồi quy StrictMode/lưu tua trước lần Play đầu. Test tiến độ này giả lập API; cần kiểm tra SQL thực tế riêng.
- `npm run build`: kiểm tra TypeScript và tạo bản build trong `dist/`. Có thể xem bản build bằng `npm run preview`; nếu dùng cổng mặc định 4173, chỉnh `APP_ORIGIN` ở backend tương ứng rồi khởi động lại API.

Chạy build không thay thế kiểm tra phát video trong trình duyệt thật. Kết quả tích hợp được ghi ở repo server: [docs/VERIFICATION.md](https://github.com/viettuekk123/server-streaming/blob/main/docs/VERIFICATION.md).

## Lỗi thường gặp và dừng ứng dụng

- Không tải được API hoặc báo CORS: kiểm tra backend ở cổng 8000, `VITE_API_URL` và `APP_ORIGIN`. Nếu Vite chuyển sang cổng khác vì 5173 đang bận, giải phóng cổng hoặc cập nhật origin cho khớp.
- `/demo` báo 404: tạo media mẫu phía backend; đăng nhập không tạo sẵn video mẫu.
- Upload đứng ở `uploaded`/`processing`: kiểm tra worker, SQL Server và FFmpeg ở backend.
- Không thấy chất lượng 1080p: hệ thống không upscale nguồn thấp; danh sách chất lượng tùy nguồn.
- Auto chưa đổi hình ảnh ngay: segment đã buffer vẫn giữ chất lượng cũ. Xem hai chỉ số **đang phát / đang tải** trong debug panel.
- Không lưu tiến độ: đăng nhập và dùng `/watch/{id}`; nếu tab khác lấy quyền ghi, mở lại video ở tab muốn tiếp tục xem.

Nhấn `Ctrl+C` tại terminal Vite để dừng web. `.env`, `node_modules/`, `dist/` và kết quả test bị Git ignore; không đưa mật khẩu hoặc khóa bí mật vào biến `VITE_*` vì các biến này được đưa vào mã phía trình duyệt.
