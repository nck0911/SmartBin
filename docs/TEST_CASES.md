# 🧪 Kịch bản kiểm thử

## Mục lục

- [Kiểm tra tự động](#automated)
- [Tương tác Wokwi](#wokwi)
- [Thông báo mobile](#notifications)

<a id="automated"></a>
## Kiểm tra tự động

Chạy từ gốc repository với `g++` trong PATH:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test.ps1
cd mobile
npm run lint
npm run typecheck
npm test
cd ../backend
npm test
```

Các nhóm kiểm thử gồm điều khiển nắp, lỗi cảm biến, tràn thời gian, mức đầy, cảnh báo mùi, giải mã MQTT, thiết lập chiều cao và luồng thông báo.

<a id="wokwi"></a>
## Tương tác Wokwi

Build bằng `pio run` rồi chạy **Wokwi: Start Simulator**. Với các ca đo mức đầy, thiết lập chiều cao **45 cm** trong app và chờ xác nhận. Cảm biến lắp phẳng, mốc đầy 5 cm; xem [thiết lập chiều cao](BIN_HEIGHT.md).

| Ca | Thao tác theo README | Cần quan sát/lưu bằng chứng |
| --- | --- | --- |
| W01 | Start Simulator, thiết lập chiều cao 45 cm, tay 50 cm, rác 35 cm, khí thấp | Không reset; lệnh nắp đóng; sau đo có mức rác khoảng 25% |
| W02 | Tay 10 cm trong 300 ms rồi rút | Servo không mở |
| W03 | Tay 10 cm trên 500 ms, giữ >3 giây | Servo tới góc mở, giữ nguyên; timestamp Serial |
| W04 | Rút tay, đưa lại trước 3 giây, rút lần nữa | Hủy đóng lần đầu, đóng sau lần rút cuối |
| W05 | Nắp đóng; chiều cao 45 cm; rác lần lượt 45/25/12/15 cm | Mức rác khoảng 0/50/82,5/75%; đầy bật ở 12 cm và xóa ở 15 cm |
| W06 | Khí cao khi rác thấp, sau đó vừa đầy vừa khí cao | Serial và MQTT có cờ độc lập/cả hai cờ |
| W07 | Connect trang HiveMQ, subscribe topic nhóm | Nhận JSON state/events và availability thật từ ESP32 mô phỏng |
| W08 | Mở nắp lúc đang báo đầy rồi đóng | `trash_stale=true` đến phép đo mới sau đóng ổn định; không kết luận rỗng khi nắp mở |
| W09 | Ngắt dây echo tay/rác, sau đó nối lại | Tay lỗi giữ mở nếu đang mở; rác lỗi là null/invalid; phục hồi trạng thái |
| W10 | Chạy bản cấu hình broker không truy cập được | Tay vẫn điều khiển nắp đúng thời gian; log retry không làm treo |
| W11 | Mất Wi-Fi/đường mạng rồi khôi phục | Tự nối lại; nhận snapshot hiện tại, không giả định khôi phục toàn bộ lịch sử |
| W12 | Đóng simulator đột ngột khi đang online | Broker gửi `offline` theo Last Will sau khoảng phát hiện mất kết nối |


Ghi lại kết quả thực tế, ảnh hoặc log cho từng lần chạy. Kiểm tra mô phỏng và phần cứng riêng để đánh giá hoạt động của cảm biến và mạng.

<a id="notifications"></a>
## Thông báo mobile

Theo [hướng dẫn thông báo](NOTIFICATIONS.md#verify), thử cả khi app mở và khi dùng APK ở nền. Kiểm thử tự động giả lập nhà cung cấp push; cần điện thoại để kiểm tra thông báo thực tế.
