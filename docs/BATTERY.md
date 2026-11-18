# Pin mô phỏng và cảnh báo dashboard

Mức pin hiển thị trên card thùng ở dashboard, không thêm phần pin vào trang chi tiết. Quét QR chỉ cung cấp định danh thùng. Sau khi thêm, app tự nhận mức pin, cảm biến và trạng thái qua MQTT khi firmware tương ứng đang chạy. QR không cung cấp hoặc quyết định phần trăm pin.

## Thử trên Wokwi

Sơ đồ gốc và `simulations/bin-1`, `bin-2`, `bin-3` đều có biến trở `battery` riêng nằm dưới biến trở mùi. SIG nối GPIO35, VCC nối 3V3 và GND nối GND. Giá trị khởi tạo 1023 tương ứng pin mô phỏng 100%.

1. Build firmware mới tại thư mục gốc:

   ```powershell
   pio run -e esp32dev -e bin-1 -e bin-2 -e bin-3
   ```

2. Dừng rồi chạy lại Wokwi để nạp firmware và sơ đồ mới. Không chạy hai mô phỏng cùng ID thùng 1.
3. Reload app. Quét QR để thêm thùng nếu chưa có; thùng đã lưu sẽ nhận dữ liệu pin mới mà không cần thêm lại.
4. Xoay biến trở `battery`: giá trị từ 0 đến 1023 được quy đổi thành 0–100%. Firmware đọc pin mỗi 5 giây, sau đó gửi cùng telemetry. Cảnh báo đổi trạng thái được gửi theo luồng sự kiện.

| Mức | Dashboard |
| --- | --- |
| Pin >20% | Icon xanh và phần trăm |
| Pin 10–20% | Icon vàng và phần trăm |
| Pin 1–9% | Icon đỏ và phần trăm |
| Pin 0% | Icon đỏ và 0% |

Màu dashboard theo phần trăm mới nhất. Cảnh báo gửi từ firmware/backend vẫn giữ ngưỡng hồi phục 25%/15% để không gửi lặp quanh ranh giới. Ví dụ vị trí biến trở khoảng 0.18 tương ứng 18%, 0.08 tương ứng 8%. Pin 0% vẫn là mẫu hợp lệ. Trong mô phỏng, vặn về 0% không tự cắt nguồn ESP32.

Chưa có bản tin mới, firmware cũ không hỗ trợ pin, thiết bị offline hoặc dữ liệu quá hạn: hiển thị `—`. Không tự giả định đầy pin và không suy ra hết pin từ mất Wi-Fi. Pin yếu được tính vào số thùng có cảnh báo và bộ lọc cảnh báo trên dashboard.

## Dữ liệu và thông báo

Firmware giữ schema telemetry 1, bổ sung `battery_percent`, `battery_valid`, `battery_low`, `battery_critical`. Firmware cũ không có các trường này vẫn đọc được. Khi mẫu không hợp lệ, phần trăm là null và backend không dùng nó để xóa/rearm cảnh báo.

Backend tạo cảnh báo `battery_low` và `battery_critical` khi chuyển trạng thái, không lặp lại mỗi bản tin MQTT. Nếu bản tin đầu tiên đã ở mức khẩn cấp thì chỉ gửi thông báo khẩn cấp. Tính năng này dùng cùng đăng ký push hiện tại; Expo Go không kiểm thử được remote push Android. Cảnh báo trực tiếp trên card dashboard vẫn hoạt động qua MQTT.

## Khi chuyển sang pin thật

`src/BatteryInput.h` là bộ đọc riêng cho biến trở mô phỏng, không đo điện áp pin thật. Thay bộ đọc này bằng mạch đo/module phù hợp với loại pin và hiệu chuẩn phép quy đổi. `BatteryMonitor`, telemetry, app và backend có thể giữ cùng giao diện phần trăm và trạng thái. Không dùng phép nội suy tuyến tính biến trở làm công thức dung lượng pin thật.

Tài liệu: [Wokwi potentiometer](https://docs.wokwi.com/parts/wokwi-potentiometer), [Arduino ESP32 ADC](https://docs.espressif.com/projects/arduino-esp32/en/latest/api/adc.html).
