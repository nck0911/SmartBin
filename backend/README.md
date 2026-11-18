# ⚙️ Backend SmartBin

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

`GET /health` trả trạng thái HTTP và kết nối MQTT. Mặc định dịch vụ lắng nghe tại `127.0.0.1:8787`. Để điện thoại kết nối, cung cấp HTTPS qua reverse proxy hoặc tunnel, đặt URL vào `EXPO_PUBLIC_BACKEND_URL` trong `mobile/.env`, rồi khởi động lại Expo. Địa chỉ do bên triển khai cấu hình, không yêu cầu người dùng nhập trên app.

## Xác minh thùng trước khi thêm

Khi phát triển bằng Expo Go trong cùng Wi-Fi, có thể không dùng tunnel: đặt `HOST=0.0.0.0` trong `backend/.env` và `EXPO_PUBLIC_BACKEND_URL=http://<IP-noi-bo-may-tinh>:8787` trong `mobile/.env`, khởi động lại hai dịch vụ. Kiểm tra `/health` bằng trình duyệt điện thoại. Nếu Windows hỏi quyền mạng cho Node.js, chỉ cấp quyền phù hợp với mạng đang dùng; không cần tắt firewall. IP máy thay đổi thì cập nhật URL. HTTP mạng nội bộ chỉ được app chấp nhận khi `__DEV__` bật; bản phát hành dùng HTTPS.

App gọi `GET /v1/devices/verify?id=...&topic=...&brokerUrl=...` khi lưu thùng mới, cho cả nhập tay và quét QR. Backend đối chiếu chính xác ID/topic với `DEVICES_JSON` và broker với `APP_BROKER_URL`. Hợp lệ trả 200 kèm ID/topic; không thuộc danh sách trả 404; khác broker trả 409; thiếu thông tin trả 400. Tên và vị trí do người dùng tự đặt, không gửi để xác minh.

Endpoint chỉ kiểm tra danh sách thiết bị được phép, không chứng minh người dùng sở hữu thùng và không thay thế quyền truy cập MQTT. Không cần đăng ký push để gọi endpoint này. Nếu backend không truy cập được, app giữ form và không thêm thùng mới. Sửa tên/vị trí của thùng đã lưu không cần gọi backend.

<a id="config"></a>
## Cấu hình

| Biến trong `.env` | Giá trị cần điền |
| --- | --- |
| `PAIRING_CODE` | Mã kết nối tự chọn, tối thiểu 16 ký tự; nhập cùng mã trên app |
| `MQTT_URL` | Địa chỉ MQTT của broker thiết bị |
| `APP_BROKER_URL` | Địa chỉ WebSocket dùng trên app, cùng hệ thống với `MQTT_URL` |
| `MQTT_USER`, `MQTT_PASSWORD` | Điền khi broker yêu cầu đăng nhập |
| `DEVICES_JSON` | Danh sách thiết bị và chiều cao bên trong, ví dụ `[{"id":"device-a","topic":"demo/device-a","heightCm":45}]` |
| `EXPO_ACCESS_TOKEN` | Tùy chọn theo cấu hình Expo Push của project |
| `HOST`, `PORT` | Địa chỉ và cổng lắng nghe |

Dùng ID và topic khớp firmware. Mỗi ID/topic trong danh sách phải duy nhất; backend chỉ theo dõi các thiết bị đã khai báo. File `.env.example` là mẫu để thiết lập trên máy mới.

API xác minh trả thêm `heightCm` (10–400 cm, tối đa một chữ số thập phân). Thiếu chiều cao hợp lệ thì trả 503, không dùng giá trị từ QR để thay thế. App lưu chiều cao từ hệ thống, hiển thị trong chi tiết và tự đồng bộ xuống thiết bị khi nhận dữ liệu mới cho biết chưa được thiết lập. Không ghi đè chiều cao đã lưu trên thiết bị.

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
