# Kiểm chứng bản đầu — 05/11/2026

## Đã thực hiện

- Build PlatformIO Espressif32 7.0.1, Arduino-ESP32 2.0.17, PubSubClient 2.8: **SUCCESS**. Sử dụng bản sao công cụ trong `.pio/core` vì phiên agent không ghi được thư mục PlatformIO toàn cục.
- RAM tĩnh: 45.704 / 327.680 byte (13,9%); flash ứng dụng: 764.625 / 1.310.720 byte (58,3%). RAM này chưa bao gồm tất cả heap/stack cấp phát lúc chạy.
- Có `.pio/build/esp32dev/firmware.bin` và `firmware.elf`, đúng đường dẫn `wokwi.toml`.
- Host test bằng MinGW g++, C++11, `-Wall -Wextra -Werror`: **PASS**, 5 nhóm kịch bản dưới đây. Chạy lại bằng `scripts/test.ps1`.
- Đã đọc lại cấu hình mạch và ánh xạ chân theo board DevKit V1; kiểm tra cấu trúc JSON/TOML và tham chiếu linh kiện. Đây là kiểm tra cấu hình, chưa phải chạy mô phỏng.

| Nhóm host test | Các tình huống được xác minh |
| --- | --- |
| Thời gian xác nhận | Quơ 300 ms không mở; đúng 20 cm; 499 ms chưa mở, 500 ms mở; giữ tay lâu vẫn mở |
| Đóng và tay quay lại | Chưa đủ 3 giây không đóng; tay quay lại hủy đếm; đủ thời gian sau đó mới đóng |
| Lỗi cảm biến | Lỗi ngắt xác nhận mở; đang mở mà echo lỗi thì giữ mở; phục hồi đo xa mới đóng theo thời gian |
| Tràn thời gian | Xác nhận 500 ms và đóng 3 giây qua mốc `uint32_t` tràn vẫn đúng |
| Hai cảnh báo | Quy đổi 40/20/8/4 cm; bật/tắt đầy và khí có hysteresis; timeout/NaN không xóa báo đầy; khí và đầy hoạt động độc lập/cùng lúc |

## Chưa chạy tương tác Wokwi

Với firmware hỗ trợ chiều cao động, trước các ca đo mức đầy, dùng app thiết lập chiều cao **45 cm** và chờ ACK. Bảng runtime dưới đây dùng chiều cao đó, mốc đầy 5 cm và sensorOffsetCm=0. Kiểm tra riêng trạng thái chưa thiết lập và lưu NVS theo [BIN_HEIGHT.md](BIN_HEIGHT.md). Kết quả build/host test trong phần đầu là báo cáo lịch sử trước refactor.

Máy đã có extension Wokwi nhưng phiên agent không có công cụ điều khiển giao diện VS Code hoặc Wokwi CLI trên PATH. Chưa xác minh license hay khởi chạy được simulator từ phiên này. Không đánh dấu pass cho các ca runtime sau chỉ dựa vào build/host test.

| Ca | Thao tác theo README | Cần quan sát/lưu bằng chứng | Trạng thái |
| --- | --- | --- | --- |
| W01 | Start Simulator, thiết lập chiều cao 45 cm, tay 50 cm, rác 35 cm, khí thấp | Không reset; lệnh nắp đóng; sau đo có mức rác khoảng 25% | Chờ chạy |
| W02 | Tay 10 cm trong 300 ms rồi rút | Servo không mở | Chờ chạy |
| W03 | Tay 10 cm trên 500 ms, giữ >3 giây | Servo tới góc mở, giữ nguyên; timestamp Serial | Chờ chạy |
| W04 | Rút tay, đưa lại trước 3 giây, rút lần nữa | Hủy đóng lần đầu, đóng sau lần rút cuối | Chờ chạy |
| W05 | Nắp đóng; chiều cao 45 cm; rác lần lượt 45/25/12/15 cm | Mức rác khoảng 0/50/82,5/75%; đầy bật ở 12 cm và xóa ở 15 cm | Chờ chạy |
| W06 | Khí cao khi rác thấp, sau đó vừa đầy vừa khí cao | Serial và MQTT có cờ độc lập/cả hai cờ | Chờ chạy |
| W07 | Connect trang HiveMQ, subscribe topic nhóm | Nhận JSON state/events và availability thật từ ESP32 mô phỏng | Chờ chạy |
| W08 | Mở nắp lúc đang báo đầy rồi đóng | `trash_stale=true` đến phép đo mới sau đóng ổn định; không kết luận rỗng khi nắp mở | Chờ chạy |
| W09 | Ngắt dây echo tay/rác, sau đó nối lại | Tay lỗi giữ mở nếu đang mở; rác lỗi là null/invalid; phục hồi trạng thái | Chờ chạy |
| W10 | Chạy bản cấu hình broker không truy cập được | Tay vẫn điều khiển nắp đúng thời gian; log retry không làm treo | Chờ chạy |
| W11 | Mất Wi-Fi/đường mạng rồi khôi phục | Tự nối lại; nhận snapshot hiện tại, không giả định khôi phục toàn bộ lịch sử | Chờ chạy |
| W12 | Đóng simulator đột ngột khi đang online | Broker gửi `offline` theo Last Will sau khoảng phát hiện mất kết nối | Chờ chạy |

Với mỗi ca, ghi thời gian, cấu hình, kết quả thực tế và ảnh/log. Đo độ trễ lệnh servo và độ trễ mạng riêng; chu kỳ tay khoảng 60 ms, có thể 120 ms khi xen phép đo rác. Không dùng thời gian host test để kết luận độ trễ phần cứng.

## Giới hạn đã biết

- Chưa có kiểm chứng runtime cho ISR, PWM, hai core hay đường truyền qua Wokwi Gateway; cần các ca W01–W12.
- Public broker là hạ tầng demo dùng chung; topic không phải quyền truy cập riêng. State/events dùng QoS 0, không có xác nhận giao hàng từng sự kiện.
- Retained state có thể cũ, phải xem availability và uptime. Availability có độ trễ phát hiện offline.
- Có queue 12 sự kiện trong RAM; mất mạng lâu có thể bỏ sự kiện, không có lưu trữ bền. Sau reconnect ưu tiên trạng thái hiện tại.
- `lid_command` biểu diễn lệnh gửi đến servo, không chứng minh vị trí cơ khí. Chưa có cảm biến chống kẹt.
- ADC khí là biến trở giả lập; mức rác ước tính theo chiều cao. Không suy diễn độ chính xác hay độ an toàn của thiết bị thật từ mô phỏng.
