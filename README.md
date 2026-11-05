# Thùng rác thông minh — Nhóm 10

Firmware ESP32 mô phỏng bằng PlatformIO + Wokwi: tự mở/đóng nắp, đo mức rác, cảnh báo khí giả lập và gửi MQTT để xem trực tiếp trên trình duyệt.

## Luồng hoạt động

```text
HC-SR04 tay/rác + biến trở → ESP32 → servo + Serial
                              ↓ queue snapshot/sự kiện
                         Tác vụ Wi-Fi/MQTT
                              ↓ Wokwi Public Gateway
                         HiveMQ public broker
                              ↓ MQTT qua WebSocket
                     Trang HiveMQ trên trình duyệt
```

Vòng điều khiển chạy trên core 1; MQTT chạy tác vụ riêng trên core 0. Không chờ Wi-Fi hoặc echo bằng `pulseIn()` trong vòng điều khiển. Echo dùng ngắt; chỉ xung trigger cố định chờ 12 µs và vòng lặp nhường CPU 1 tick. Không cần board gateway riêng hoặc tài khoản HiveMQ cho luồng demo này.

## Chạy mô phỏng

1. Mở thư mục này trong VS Code với PlatformIO IDE và Wokwi Simulator. Wokwi có thể yêu cầu kích hoạt license theo hướng dẫn extension.
2. Chạy `pio run` trong PlatformIO terminal. Nếu `pio` chưa có trên PATH, dùng nút Build của PlatformIO.
3. Đợi `SUCCESS`, rồi `F1` → **Wokwi: Start Simulator**.
4. Theo dõi Serial: `[BOOT]`, `[STATE ...]`, `[NET] MQTT connected ...`.
5. Cảm biến `hand`: chỉnh từ 50 xuống 10 cm, giữ đủ 500 ms để mở. Đưa ra xa, khoảng 3 giây sau nắp đóng. Còn tay thì giữ mở.
6. Cảm biến `trash`: khi nắp đóng, chỉnh khoảng cách xuống 7 cm để thử báo đầy. 40 cm = 0%, 20 cm = 50%, 8 cm xấp xỉ 80%. Dùng 7 cm khi demo để tránh sai số lượng tử ngay ngưỡng.
7. Biến trở `gas`: tăng cho đến khi Serial có `gas > 2000` và `gas_high=1`; giảm về <=1800 để xóa cảnh báo.

Các chân và ngưỡng nằm trong `include/Config.h`. Servo dùng PWM LEDC tích hợp; project cố định Arduino core 2.x thông qua Espressif32 7.0.1. Không tự nâng core lên 3.x mà chưa sửa API LEDC.

## Xem từ xa, không đăng ký tài khoản

Mở trực tiếp [HiveMQ MQTT WebSocket Client](https://www.hivemq.com/demos/websocket-client/), rồi cấu hình:

| Trường | Giá trị |
| --- | --- |
| Host | `broker.hivemq.com` |
| Port | `8884` |
| SSL | Bật |
| ClientID | ID riêng, ví dụ `nhom10-viewer-abc123`; khác ID ESP32 |
| Username / Password | Để trống |
| Clean Session | Bật |

Bấm **Connect** → **Add New Topic Subscription** → nhập `nhom10/trash/nhom10-trash-7c91a2/#` → **Subscribe**. Nếu dùng client khác yêu cầu URL đầy đủ, nhập `wss://broker.hivemq.com:8884/mqtt`. ESP32 vẫn dùng MQTT TCP 1883; không thay port firmware thành port WebSocket.

| Topic | Nội dung |
| --- | --- |
| `…/state` | JSON trạng thái mới nhất, mỗi 2 giây và khi đổi trạng thái |
| `…/events` | Snapshot khi nắp, cảnh báo hoặc tính hợp lệ cảm biến thay đổi |
| `…/availability` | `online` hoặc `offline` qua Last Will |

Các trường cần xem: `lid_command` (lệnh servo), `fill_percent`, `gas_adc`, `full`, `gas_high`, `hand_valid`, `trash_valid`, `trash_stale`. `null` là chưa biết/lỗi, không phải 0. Cảnh báo khí là chỉ số ADC giả lập, không phải ppm hay phép đo khí độc thực.

Trang này hiển thị bản tin nhận được; chưa có dashboard biểu đồ và chưa có thông báo đẩy khi đóng trang. Trạng thái retained có thể còn từ lần chạy trước: kiểm tra availability và sự thay đổi `uptime_ms` để biết thiết bị đang hoạt động. Last Will cần một khoảng thời gian để broker phát hiện ngắt kết nối.

## Quy tắc điều khiển và lỗi

- Tay <=20 cm liên tục 500 ms mới mở; ra ngoài vùng nhận diện liên tục khoảng 3 giây mới đóng. Sai số thời điểm do chu kỳ lấy mẫu; không cam kết thời gian chuyển động cơ khí của servo.
- Tay không có echo: hủy xác nhận mở; nếu nắp đã mở thì giữ mở và chờ dữ liệu hợp lệ. Đây là chế độ lỗi, không thay thế cảm biến chống kẹt trên thiết bị thật.
- Đo rác mỗi 2 giây khi nắp đóng và ổn định ít nhất 500 ms. Khi mở nắp, dữ liệu cuối giữ lại nhưng `trash_stale=true` cho đến phép đo mới sau đóng.
- Bật đầy >=80%, tắt <=75%. Bật khí >2000, tắt <=1800. Hai cảnh báo độc lập; giá trị giữa ngưỡng bật/tắt giữ trạng thái trước để chống dao động.
- Timeout rác: `trash_valid=false`, mức rác JSON là `null`; giữ cờ cảnh báo trước đó thay vì suy ra rỗng.
- Mất mạng: tiếp tục điều khiển, thử Wi-Fi mỗi 10 giây và MQTT với backoff đến 30 giây. Nối lại gửi snapshot hiện tại. Không lưu bền lịch sử offline; queue sự kiện giới hạn 12, có thể bỏ sự kiện cũ. Publish state/events dùng QoS 0, không bảo đảm giao hàng từng sự kiện.

## Đổi cấu hình

Sao chép `include/Secrets.example.h` thành `include/Secrets.h`, sửa SSID/broker, `DEVICE_ID` và `MQTT_TOPIC_ROOT`, rồi build lại. File riêng đã được gitignore. Dùng topic/ID riêng khi chạy nhiều ESP32 để tránh đá kết nối nhau. Bên nhận phải đổi subscription tương ứng.

Broker mặc định công cộng dùng dữ liệu demo. Luồng này đi qua Internet; chưa phải broker nội bộ. [Wokwi Public Gateway](https://docs.wokwi.com/guides/esp32-wifi) không truy cập LAN; nếu chuyển sang broker LAN phải cấu hình đường mạng/gateway phù hợp.

## Kiểm thử

Host test với MinGW `g++` trên PATH:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test.ps1
```

Build firmware:

```powershell
pio run
```

Kết quả và các ca cần chạy tương tác nằm trong [docs/TEST_CASES.md](docs/TEST_CASES.md). Build và test logic không chứng minh servo, ISR hoặc MQTT đã chạy thành công trong Wokwi.

Trong phiên phát triển bị giới hạn quyền ghi thư mục công cụ toàn cục, đã dùng bản sao PlatformIO ở `.pio/core` để build. Khi cần dùng lại bản sao hiện có trong workspace này:

```powershell
$env:PLATFORMIO_CORE_DIR = Join-Path (Get-Location) '.pio/core'
$env:PYTHONIOENCODING = 'utf-8'
pio run
```

Đây là bản sao cục bộ, không cần đưa vào mã chia sẻ; máy khác cài PlatformIO bình thường rồi `pio run`.

## Phạm vi

Mô phỏng phục vụ đồ án; chưa có mô hình AI chạy trên ESP32. AI hỗ trợ phát triển code, còn thuật toán thực thi dùng máy trạng thái, lịch đo và hysteresis. Chuyển sang phần cứng thật cần kiểm tra nguồn servo riêng, mức điện áp echo/ADC, chân boot và hiệu chuẩn; không dùng sơ đồ ảo làm hướng dẫn đấu dây thực.

Nguồn: [Wokwi PlatformIO](https://docs.wokwi.com/vscode/platformio), [HiveMQ public broker](https://www.hivemq.com/mqtt/public-mqtt-broker/), [cổng broker/WebSocket](https://broker.hivemq.com/).
