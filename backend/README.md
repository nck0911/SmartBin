# ⚙️ Backend Smart Trash

Backend theo dõi MQTT, lưu trạng thái cảnh báo bằng SQLite và gửi Expo Push để điện thoại nhận nhắc nhở khi app không mở.

Hướng dẫn từ bản clone mới, gồm các bước trên giao diện Expo/Firebase: [Cấu hình toàn bộ dự án](../docs/SETUP.md).

## Mục lục

- [Chạy dịch vụ](#run)
- [Cấu hình](#config)
- [Tổ chức mã nguồn](#structure)
- [Hoạt động](#behavior)
- [Kiểm tra](#checks)

<a id="run"></a>
## Chạy dịch vụ

Cần Node.js 22.13 trở lên. Từ thư mục gốc repo:

```powershell
cd backend
npm ci
Copy-Item .env.example .env
```

Điền cấu hình trong `.env` theo bảng bên dưới. Khi đã có file này, giữ cấu hình hiện tại.

```powershell
npm start
```

`GET /health` trả trạng thái HTTP và kết nối MQTT. Mặc định dịch vụ lắng nghe tại `127.0.0.1:8787`. Để điện thoại kết nối, cung cấp HTTPS qua reverse proxy hoặc tunnel và nhập địa chỉ đó trong phần thiết lập thông báo của app.

<a id="config"></a>
## Cấu hình

| Biến trong `.env` | Giá trị cần điền |
| --- | --- |
| `PAIRING_CODE` | Mã kết nối tự chọn, tối thiểu 16 ký tự; nhập cùng mã trên app |
| `MQTT_URL` | Địa chỉ MQTT của broker thiết bị |
| `APP_BROKER_URL` | Địa chỉ WebSocket dùng trên app, cùng hệ thống với `MQTT_URL` |
| `MQTT_USER`, `MQTT_PASSWORD` | Điền khi broker yêu cầu đăng nhập |
| `DEVICES_JSON` | Danh sách thiết bị, ví dụ `[{"id":"device-a","topic":"demo/device-a"}]` |
| `EXPO_ACCESS_TOKEN` | Tùy chọn theo cấu hình Expo Push của project |
| `HOST`, `PORT` | Địa chỉ và cổng lắng nghe |

Dùng ID và topic khớp firmware. Mỗi ID/topic trong danh sách phải duy nhất; backend chỉ theo dõi các thiết bị đã khai báo. File `.env.example` là mẫu để thiết lập trên máy mới.

<a id="structure"></a>
## Tổ chức mã nguồn

```text
src/
├── server.mjs               # Khởi động HTTP, MQTT và worker
├── http/                    # Nhận và trả yêu cầu HTTP
├── services/
│   ├── notifications/       # Cảnh báo, hàng đợi và gửi thông báo
│   └── registrations/       # Đăng ký, cập nhật và hủy nhận thông báo
├── integrations/            # Kết nối Expo Push
├── storage/                 # Truy cập SQLite
└── security/                # Xác thực yêu cầu
```

Các service là module chức năng chạy chung một tiến trình. Khi thêm chức năng, tạo module tương ứng trong `services/` rồi nối vào HTTP và phần khởi động.

<a id="behavior"></a>
## Hoạt động

- Cảnh báo đầy và mùi độc lập; chỉ gửi khi chuyển sang bật.
- Bỏ qua sự kiện retained và mẫu cảm biến không hợp lệ; cảnh báo đầy cần dữ liệu mới và chiều cao đã thiết lập.
- SQLite giữ trạng thái và hàng đợi qua restart; lỗi gửi tạm thời được thử lại trong thời hạn.
- App đăng ký danh sách thùng và mở đúng thùng khi bấm thông báo. Thùng minh họa không được theo dõi bởi backend.
- Dùng một tiến trình cho mỗi database. Giữ thư mục `data/` khi restart hoặc nâng cấp để tiếp tục trạng thái hiện tại.

Backend cần hoạt động liên tục để phát hiện cảnh báo khi điện thoại không mở app. Xem [thiết lập thông báo](../docs/NOTIFICATIONS.md).

<a id="checks"></a>
## Kiểm tra

```powershell
npm test
```

Test sử dụng SQLite, HTTP trên máy và giả lập Expo Push. Kiểm tra trên điện thoại sau khi cấu hình xong để xác nhận toàn bộ luồng.
