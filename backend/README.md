# Backend Smart Trash

Dịch vụ Node.js theo dõi MQTT độc lập với điện thoại, lưu trạng thái cảnh báo và gửi Expo Push. App có thể không mở; dịch vụ này vẫn phải chạy, có Internet và kết nối đúng broker.

## Tổ chức mã nguồn

```text
backend/
├── src/
│   ├── server.mjs                    # Khởi động HTTP, MQTT và worker
│   ├── http/
│   │   └── handler.mjs               # Route, đọc body, phản hồi HTTP
│   ├── services/
│   │   ├── notifications/
│   │   │   ├── alerts.mjs            # Chuyển trạng thái cảnh báo, tạo nội dung
│   │   │   └── delivery.mjs          # Hàng đợi, retry, xử lý ticket/receipt
│   │   └── registrations/
│   │       └── registrations.mjs     # Quy tắc đăng ký, cập nhật và thu hồi
│   ├── integrations/
│   │   └── expoPush.mjs              # Gọi API nhà cung cấp Expo Push
│   ├── storage/
│   │   └── store.mjs                 # Truy cập SQLite
│   └── security/
│       └── credentials.mjs           # So sánh thông tin xác thực
├── test/                             # Kiểm tra nghiệp vụ và API
├── data/                             # Database riêng, không commit
└── package.json
```

`services/` nhóm mã theo chức năng, không phải các microservice chạy riêng. Backend dùng một tiến trình và một database. HTTP chuyển yêu cầu sang service đăng ký; service không phụ thuộc request/response HTTP. Service thông báo dùng store và đối tượng gửi push; adapter Expo xử lý giao tiếp bên ngoài. `server.mjs` ghép các thành phần và quản lý vòng đời.

Khi có chức năng mới, thêm module như `services/devices/` hoặc `services/history/` khi thực sự cần, rồi nối vào HTTP/khởi động. Không tạo server hay sao chép database riêng chỉ vì thêm một service.

## Chạy

Cần Node.js 22.13 trở lên. Từ gốc repository:

```powershell
cd backend
npm ci
Copy-Item .env.example .env
```

Điền `.env` trên máy:

| Biến | Ý nghĩa |
| --- | --- |
| `PAIRING_CODE` | Mã ghép nối riêng, tối thiểu 16 ký tự; dùng để đăng ký/khôi phục kết nối trên app |
| `MQTT_URL` | Địa chỉ MQTT mà dịch vụ sẽ theo dõi |
| `APP_BROKER_URL` | URL broker trong app; phải cùng hệ thống với MQTT_URL |
| `MQTT_USER`, `MQTT_PASSWORD` | Thông tin broker nếu cần |
| `DEVICES_JSON` | Danh sách cho phép, dạng `[{"id":"device-a","topic":"demo/device-a"}]` |
| `EXPO_ACCESS_TOKEN` | Tùy chọn nếu bật enhanced push security trên Expo |
| `HOST`, `PORT` | Mặc định chỉ nghe 127.0.0.1:8787 |

Dùng đúng ID/topic đang chạy trong firmware. `DEVICES_JSON` không phải wildcard; app không được đăng ký thùng ngoài danh sách này. Mỗi ID/topic phải duy nhất. Không đưa cấu hình riêng vào Git.

```powershell
npm start
```

`GET /health` trả trạng thái HTTP và kết nối MQTT. Khi dùng trên điện thoại, đặt dịch vụ sau HTTPS reverse proxy/tunnel để điện thoại truy cập được; app chỉ chấp nhận HTTPS. Không dùng localhost trên điện thoại để trỏ đến máy tính. Chạy một tiến trình dịch vụ cho mỗi database.

SQLite nằm trong `data/notifications.sqlite`, bao gồm thông tin đăng ký, trạng thái cảnh báo và hàng đợi gửi. Không commit, không công khai file data; giữ thư mục này khi restart/nâng cấp. Đổi broker hoặc bộ thiết bị sang hệ thống khác nên dùng database riêng để không dùng lẫn lịch sử cảnh báo.

## Luồng và giới hạn

- Chỉ xử lý `state` và `events` đúng device ID/topic cho phép. Không xử lý bản tin retained như sự kiện mới.
- Cảnh báo đầy chỉ dùng mẫu có chiều cao đã thiết lập, cảm biến rác hợp lệ và không stale. Cảnh báo mùi dùng gas_valid/gas_high độc lập.
- Mỗi loại cảnh báo chỉ phát khi chuyển sang bật; dữ liệu cập nhật mỗi 2 giây không tạo thêm thông báo. Mẫu lỗi/cũ không được dùng để xóa trạng thái cảnh báo.
- Trạng thái được giữ qua restart. Nếu chưa có lịch sử và mẫu mới đầu tiên đang cảnh báo thì tạo thông báo một lần cho các điện thoại đã đăng ký. Đăng ký mới khi cảnh báo đang bật không tự phát lại cảnh báo cũ; sẽ nhận các lần phát sinh tiếp theo.
- Khi cảnh báo hết, bỏ job chưa gửi; thông báo đã giao cho nhà cung cấp không thể thu hồi. TTL 5 phút, không gửi lại job cảnh báo cũ quá 5 phút.
- Lỗi gửi tạm thời retry có backoff và giới hạn. Kiểm tra push receipt sau 15 phút, bỏ đăng ký token `DeviceNotRegistered`, không xóa nhầm token đã được thay mới. Receipt OK là nhà cung cấp nhận, không chứng minh điện thoại đã hiển thị.
- Lỗi provider được ghi dưới dạng mã ở terminal (`InvalidCredentials`, `MismatchSenderId`, `transport_error`...), không log push token hoặc khóa riêng. Kiểm tra các mã này nếu đã đăng ký thành công mà không nhận được push.
- Payload có binId/topic/broker và event ID để app mở đúng thùng. Demo trên app không được đăng ký lên dịch vụ; thông báo thử được tạo ngay trên điện thoại.
- PUT đăng ký lần đầu/khôi phục dùng mã ghép nối. Sau đó mỗi cài đặt có khóa riêng lưu trong SecureStore; PUT cập nhật token/danh sách và DELETE đều được xác thực. Khi mất mạng, app không báo đã tắt push nếu DELETE chưa được xác nhận.
- Chưa có hệ thống tài khoản/quyền sở hữu thùng. Mã ghép nối cấp quyền đăng ký các thùng được dịch vụ cho phép; chỉ cấp cho người dùng của bản demo. Broker dùng chung không chứng minh nguồn dữ liệu thiết bị, nên không dùng kết quả demo làm xác nhận đo mùi thật.

## Kiểm tra

```powershell
npm test
```

Test dùng SQLite và HTTP trên loopback, giả lập Expo Push; không gửi thông báo thật hoặc kết nối broker bên ngoài. Cấu hình tài khoản và kiểm tra trên điện thoại theo [hướng dẫn push](../docs/NOTIFICATIONS.md).
