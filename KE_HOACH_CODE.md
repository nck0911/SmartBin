# Kế hoạch code — Thùng rác thông minh Nhóm 10

Ngày lập: 05/11/2026. Cập nhật: đã triển khai bản firmware đầu; xem `docs/TEST_CASES.md` để phân biệt phần đã kiểm chứng và phần chờ chạy Wokwi.

## Cập nhật theo note của nhóm

- Chốt luồng demo: **ESP32 trong Wokwi → Wokwi Public Gateway → HiveMQ MQTT Broker → trang MQTT WebSocket Client**. Vào thẳng https://www.hivemq.com/demos/websocket-client/ để nhận dữ liệu, không cần tạo tài khoản broker cho bản demo công cộng.
- Gateway là đường mạng ra ngoài của mô phỏng; broker phân phối bản tin; trang WebSocket là bên nhận trên trình duyệt. Không bổ sung một board gateway vật lý.
- ESP32 tách luồng điều khiển và luồng dữ liệu bằng tác vụ FreeRTOS: điều khiển ở vòng lặp/core 1, MQTT ở core 0; trao đổi snapshot/sự kiện bằng queue có giới hạn. Thao tác kết nối mạng có thể chờ trong tác vụ mạng, không đặt trong vòng điều khiển.
- AI được dùng để hỗ trợ phát triển và rà soát thuật toán. Chưa đưa mô hình AI vào ESP32; độ ổn định dựa trên máy trạng thái, ngắt echo, lịch đo và hysteresis.
- Bản đầu dùng PWM LEDC có sẵn trong Arduino-ESP32 2.0.17 thay ESP32Servo. Cố định PlatformIO Espressif32 7.0.1 và PubSubClient 2.8.
- Hướng dẫn thực thi mới ở `README.md` thay cho thao tác dán code Gemini. Giữ nguyên tài liệu gốc để tham khảo.

## 1. Căn cứ và hiện trạng trước triển khai

- `Bao_cao_De_Tai_IoT_ThungRacThongMinh_Nhom_10.docx`: căn cứ về mục tiêu và chức năng. Đây là bản nháp; các đoạn tuyên bố đã hoàn thành chưa được xem là bằng chứng kiểm thử.
- `huong_dan_trien_khai.md`: phương án tham khảo do Gemini tạo, cần sửa các điểm thiếu trước khi triển khai.
- Dự án hiện có PlatformIO với `esp32dev` / Arduino; `src/main.cpp` còn là code mẫu cộng hai số. Chưa có sơ đồ Wokwi, firmware nghiệp vụ hoặc kết nối IoT.
- Có lệnh `pio` trên máy. Chưa xác minh build, extension Wokwi, license và khả năng kết nối mạng của mô phỏng.

## 2. Phạm vi cần hoàn thành

| Chức năng | Hành vi dự kiến | Tiêu chí chính |
| --- | --- | --- |
| Mở nắp | Tay trong vùng nhận diện liên tục 500 ms; servo từ 0° sang 90° | Quơ tay dưới 500 ms không mở |
| Giữ nắp | Còn tay thì giữ mở | Không đóng theo bộ đếm cố định kể từ lúc mở |
| Đóng nắp | Sau 3.000 ms kể từ mẫu hợp lệ cuối còn tay | Tay quay lại thì hủy đếm đóng |
| Mức rác | Đo mỗi 2.000 ms; quy đổi khoảng cách thành mức đầy 0–100% | Cảnh báo đầy độc lập với khí |
| Khí giả lập | Đọc ADC GPIO34 bằng biến trở | Cảnh báo ngay cả khi rác còn ít |
| IoT | ESP32 gửi trạng thái và cảnh báo qua Wi-Fi tới bên nhận | Có bằng chứng nhận ngoài Serial |
| Mất mạng | Điều khiển cục bộ tiếp tục, mạng tự thử kết nối lại | Không treo chờ Wi-Fi/broker |

Ưu tiên mô phỏng PlatformIO + Wokwi. Chưa đưa load cell, Fuzzy Logic, pin mặt trời, deep sleep, Firebase, OTA hoặc quản lý nhiều thùng vào bản đầu.

## 3. Điểm cần thống nhất khi code

1. **Thiếu phần IoT:** code Gemini chưa có Wi-Fi, broker hay ứng dụng nhận cảnh báo. Chỉ Serial chưa đáp ứng mục tiêu trong báo cáo.
2. **Ngưỡng chưa thống nhất:** báo cáo viết `<20 cm`, `>80%`, còn code mẫu dùng `<=20 cm`, `>=80%`. Đề xuất dùng `<=20 cm` và `>=80%`, ghi rõ các ca đúng ngưỡng; đây là lựa chọn triển khai, cần đồng bộ lại báo cáo.
3. **Thời gian phản hồi:** 500 ms là thời gian xác nhận tay, chưa tính chu kỳ lấy mẫu và thời gian servo chuyển động. Không thể cam kết mọi chức năng đều dưới 500 ms khi mức rác được đo mỗi 2 giây. Tách chỉ tiêu: mở sau xác nhận 500 ms, mức rác phát hiện trong một chu kỳ đo, cảnh báo mạng đo riêng và phụ thuộc kết nối.
4. **Không nghẽn:** `pulseIn(..., 30000)` trong mẫu có thể chờ đến 30 ms mỗi lần; dùng `millis()` ở vòng ngoài chưa làm toàn bộ chương trình không nghẽn. Đề xuất đo echo bằng ngắt cạnh và timestamp `micros()`, có timeout; xử lý và log ở vòng lặp, không xử lý mạng trong ISR.
5. **Không có echo:** không đổi timeout thành 400 cm rồi suy ra thùng rỗng. Mỗi mẫu có cờ hợp lệ và tuổi dữ liệu; lỗi cảm biến phải hiển thị riêng.
6. **Nắp đang mở:** cảm biến gắn trên nắp có thể đổi hướng. Khi nắp mở hoặc vừa đóng, tạm ngừng cập nhật mức rác; hiển thị giá trị cuối kèm trạng thái cũ/chờ ổn định. Đề xuất chờ 500 ms sau lệnh đóng trước khi đo lại; không khẳng định biết vị trí nắp thực nếu chỉ có servo.
7. **Khí giả lập:** ADC 2.000/4.095 là ngưỡng minh họa, không phải ppm hay chứng nhận khí độc. Giao diện/log dùng “chỉ số khí giả lập cao”.
8. **Mô phỏng và phần cứng thật:** sơ đồ mô phỏng không chứng minh đấu dây thực an toàn; phần chuyển sang thiết bị thật cần rà soát mức điện áp, nguồn servo và hiệu chuẩn riêng.

## 4. Thông số mặc định đề xuất

| Nhóm | Thông số |
| --- | --- |
| HC-SR04 nhận tay | TRIG GPIO5, ECHO GPIO18 |
| HC-SR04 mức rác | TRIG GPIO12, ECHO GPIO14 |
| Servo | GPIO13, đóng 0°, mở 90° |
| Biến trở khí | SIG GPIO34, cấp 3,3 V trong mô phỏng |
| Nhận tay | Khoảng cách hợp lệ <=20 cm, liên tục >=500 ms |
| Tự đóng | 3.000 ms sau lần thấy tay cuối, với mẫu xác nhận vùng tay đã trống |
| Mức rác | Chiều cao minh họa 40 cm; đo mỗi 2.000 ms khi nắp đóng ổn định |
| Ngưỡng đầy | Bật >=80%; đề xuất tắt <=75% để tránh bật/tắt liên tục |
| Khí | Đọc mỗi 100 ms; bật >2.000, đề xuất tắt <=1.800 |
| Gửi trạng thái | Mỗi 2.000 ms; gửi sự kiện khi trạng thái thay đổi |

Toàn bộ nằm trong `Config.h`. Ngưỡng tắt, chu kỳ khí và thời gian ổn định là đề xuất bổ sung, chưa có trong báo cáo. Mức đầy được ước tính theo chiều cao, không phải đo chính xác thể tích rác bất quy tắc.

## 5. Kiến trúc firmware

Giữ một vòng lặp điều phối ngắn cho cảm biến và servo. Theo note bổ sung, tách tác vụ mạng sang core 0 ngay trong bản đầu vì PubSubClient có thao tác kết nối chờ.

```text
include/Config.h                  Chân, ngưỡng, chu kỳ
include/Secrets.example.h         Mẫu cấu hình Wi-Fi/broker
src/main.cpp                     Khởi tạo và điều phối
src/UltrasonicSensor.h/.cpp       Trigger, bắt echo, timeout, mẫu hợp lệ
src/LidController.h/.cpp          Máy trạng thái nắp
src/EnvironmentMonitor.h/.cpp     Mức đầy, khí, hysteresis, tuổi dữ liệu
src/Telemetry.h/.cpp              Wi-Fi, MQTT, JSON, reconnect
diagram.json                     Sơ đồ mô phỏng
wokwi.toml                       Đường dẫn firmware
test/                            Kiểm thử logic độc lập phần cứng
README.md                        Cách build, mô phỏng và nhận MQTT
docs/TEST_CASES.md                Kịch bản, kết quả, bằng chứng
```

- Máy trạng thái nắp: `CLOSED → CONFIRMING → OPEN → WAITING_TO_CLOSE → CLOSED`. Mất tay khi xác nhận thì về `CLOSED`; tay quay lại khi đếm đóng thì về `OPEN` ngay.
- Dùng phép trừ thời gian unsigned để chịu được bộ đếm tràn; không dùng timestamp bằng 0 làm dấu hiệu duy nhất của trạng thái.
- Hai cảm biến siêu âm đo luân phiên, không phát trigger đồng thời; dành khoảng nghỉ giữa các lượt đo. Ưu tiên lịch nhận tay, xen phép đo rác mỗi 2 giây.
- Timeout tay hủy xác nhận mở. Nếu đang mở mà trạng thái tay không xác định, giữ mở và báo lỗi; chỉ đóng khi đã xác nhận vùng tay trống đủ 3 giây. Đây là hành vi lỗi đề xuất cần kiểm thử.
- Cảnh báo đầy và khí là hai cờ độc lập, có hysteresis. Serial ghi các lần chuyển trạng thái và bản tin định kỳ để tránh spam.

## 6. Phương án IoT đề xuất

Chọn **Wi-Fi + MQTT** cho bản đầu, phù hợp lựa chọn MQTT Broker trong báo cáo. Dùng trang MQTT WebSocket Client có sẵn trên trình duyệt để nhận và hiển thị; chưa phát sinh một dự án web riêng. Nhận bản tin trong trang đang mở chưa đồng nghĩa có push notification khi đóng trang; nếu cần loại thông báo đó thì bổ sung Blynk hoặc dịch vụ thông báo ở giai đoạn sau.

- Chọn HiveMQ public broker `broker.hivemq.com`: ESP32 dùng TCP 1883, trình duyệt dùng WebSocket bảo mật 8884 với SSL. ID/topic riêng nằm trong `Secrets.example.h`, có thể ghi đè bằng `Secrets.h`.
- Topic dự kiến: `nhom10/trash/<device_id>/state`, `/events`, `/availability`.
- State JSON gồm phiên bản schema, device ID, uptime, trạng thái lệnh servo, khoảng cách tay, mức đầy, ADC khí, hai cờ cảnh báo và tính hợp lệ/tuổi mẫu. Giá trị chưa biết dùng `null`, không mặc định là 0.
- Giữ state mới nhất và availability; dùng Last Will để bên nhận biết mất kết nối. Sự kiện cảnh báo gửi khi đổi trạng thái, không lặp mỗi vòng lặp.
- Reconnect theo lịch/backoff, không `while` chờ kết nối. Sau khi nối lại gửi snapshot hiện tại; bản đầu không cam kết lưu lại toàn bộ sự kiện trong lúc offline.
- Cấu hình kết nối tách khỏi logic và không đưa thông tin đăng nhập thật vào mã chia sẻ.
- Wokwi Public Gateway truy cập Internet nhưng không truy cập LAN. Nếu yêu cầu bắt buộc broker nội bộ thì phải cấu hình gateway phù hợp và kiểm chứng đường mạng; không coi broker Internet là đáp ứng hoàn toàn yêu cầu “nội bộ”.

## 7. Thứ tự triển khai và đầu ra

### Bước 1 — Môi trường và mạch mô phỏng

- Kiểm tra ESP32 Arduino core đi cùng PlatformIO; sử dụng PWM LEDC tích hợp để điều khiển servo, không cần ESP32Servo.
- Bổ sung Serial 115200, dependency; tạo `diagram.json` và `wokwi.toml`.
- Theo tài liệu Wokwi cho PlatformIO: `firmware` trỏ `.pio/build/esp32dev/firmware.bin`, `elf` trỏ `.pio/build/esp32dev/firmware.elf`.
- Đầu ra: build thành công, Wokwi khởi động, đọc riêng từng đầu vào và điều khiển được servo. Chưa coi việc build thành công là mô phỏng thành công.

### Bước 2 — Điều khiển nắp

- Viết bộ đo siêu âm và máy trạng thái nắp; timestamp cho mỗi chuyển trạng thái.
- Kiểm thử quơ tay nhanh, giữ tay, rút tay, tay quay lại, không có echo và tràn bộ đếm.
- Đầu ra: nắp hoạt động độc lập mạng đúng các mốc thời gian, sai số đo thực tế được ghi nhận.

### Bước 3 — Mức rác và khí

- Thêm lịch đo, kiểm tra dữ liệu hợp lệ, tạm dừng mức rác khi nắp mở, hai cảnh báo và hysteresis.
- Đầu ra: log trạng thái đầy đủ; hai cảnh báo chạy riêng và đồng thời.

### Bước 4 — Kết nối IoT

- Thêm Wi-Fi, MQTT, payload và ứng dụng nhận; cấu hình thử lại kết nối và Last Will.
- Thử broker không phản hồi trong khi đưa tay vào để phát hiện thao tác mạng gây chặn; điều chỉnh thư viện hoặc tách tác vụ nếu cần.
- Đầu ra: có bản tin thật ở bên nhận; mất mạng không làm dừng điều khiển nắp.

### Bước 5 — Kiểm chứng và bàn giao

- Chạy lại toàn bộ ca bên dưới, lưu log/ảnh và thông số build. Chỉ đánh dấu pass với ca đã thực sự chạy.
- Hoàn thiện README và bảng kết quả để nhóm cập nhật báo cáo: kiến trúc thực tế, ngưỡng thực tế, độ trễ đo được, hạn chế.
- Chưa sửa bản DOCX gốc trong giai đoạn lập kế hoạch.

## 8. Ma trận kiểm thử tối thiểu

| Ca | Thao tác | Kết quả mong đợi |
| --- | --- | --- |
| T01 | Khởi động | Lệnh servo đóng, dữ liệu chưa đo được đánh dấu chưa biết |
| T02 | Tay trong ngưỡng 300 ms rồi rút | Không mở |
| T03 | Tay trong ngưỡng liên tục 500 ms trở lên | Mở sau xác nhận, ghi độ trễ theo chu kỳ mẫu |
| T04 | Giữ tay lâu hơn 3 giây | Giữ mở |
| T05 | Rút tay, rồi đưa lại trước 3 giây | Hủy đóng; lần rút tiếp bắt đầu đếm lại |
| T06 | Rút tay liên tục đủ 3 giây | Đóng; ghi thời điểm lệnh servo |
| T07 | Khoảng cách rác 40 / 20 / 8 / 4 cm | Lần lượt 0 / 50 / 80 / 90%; đúng quy ước ngưỡng |
| T08 | Mức rác dao động quanh 80% | Không lặp sự kiện liên tục; hạ <=75% mới xóa |
| T09 | ADC 1.999 / 2.000 / 2.001 | Chỉ giá trị >2.000 bật cảnh báo từ trạng thái bình thường |
| T10 | Khí cao khi mức rác 10–20% | Cảnh báo khí vẫn bật |
| T11 | Rác đầy và khí cao | Hai cờ cùng bật; bên nhận thể hiện cả hai |
| T12 | Timeout echo từng cảm biến | Báo mẫu lỗi, không suy ra thùng rỗng; nắp theo hành vi lỗi đã chọn |
| T13 | Mở nắp khi đang báo đầy | Mẫu mức rác cũ được đánh dấu; đo lại sau đóng ổn định |
| T14 | Ngắt/kết nối lại Wi-Fi hoặc broker | Nắp tiếp tục chạy; bên nhận nhận snapshot khi kết nối lại |
| T15 | Broker không phản hồi, tay vào/ra | Đo độ trễ để chứng minh mạng không làm treo điều khiển |
| T16 | Thời gian giả lập gần tràn `uint32_t` | Các bộ đếm xác nhận, tự đóng và chu kỳ vẫn đúng |

Unit test tập trung máy trạng thái, công thức mức rác, hysteresis, dữ liệu lỗi và tràn thời gian. Tương tác GPIO, servo và đường mạng cần kiểm chứng trên Wokwi. Chưa đặt chỉ tiêu thời gian mạng tuyệt đối trước khi đo thực tế.

## 9. Tài liệu kỹ thuật đã đối chiếu

- [Wokwi — Simulating PlatformIO Projects](https://docs.wokwi.com/vscode/platformio): build trước khi mô phỏng, đường dẫn BIN/ELF.
- [Wokwi — ESP32 WiFi Networking](https://docs.wokwi.com/guides/esp32-wifi): Wi-Fi giả lập, MQTT và giới hạn Public/Private Gateway.

Các lựa chọn mặc định ở trên giúp bắt đầu triển khai mà không phải chờ hoàn thiện bản báo cáo. Nếu nhóm chọn Blynk hoặc bắt buộc mạng nội bộ, thay phần kết nối và ca kiểm thử tương ứng; giữ nguyên logic điều khiển cục bộ.
