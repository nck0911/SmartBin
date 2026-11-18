# Thiết lập chiều cao thùng

## Mục lục

- [Quy ước lắp đặt và tính mức đầy](#calculation)
- [Luồng MQTT](#mqtt)
- [Kiểm tra thủ công](#checks)

<a id="calculation"></a>
## Quy ước lắp đặt và tính mức đầy

Chiều cao là thông tin do bên triển khai đo và khai báo trong `DEVICES_JSON` của backend. Khi thêm thùng bằng tay hoặc QR, app lấy chiều cao từ API xác minh, hiển thị trong chi tiết và không yêu cầu người dùng nhập lại.

Chiều cao chỉ được ghi **một lần cho mỗi thiết bị**. App tự gửi chiều cao đã được backend xác minh khi nhận telemetry mới có `configured=false`, session hợp lệ và thiết bị online. Mỗi session thử tối đa ba lần, cách nhau ít nhất 15 giây. Chỉ thiết bị xác nhận mới hoàn tất lưu; không ghi đè thiết bị có `configured=true`. Luồng nhập/xác nhận cũ chỉ còn dành cho bản ghi cũ chưa có chiều cao từ hệ thống.

Cảm biến đặt ở mặt dưới nắp, hướng xuống đáy. Người dùng nhập chiều cao bên trong, đo từ mặt dưới nắp đóng đến đáy. Phần firmware có `sensorOffsetCm` để bù độ nhô của mặt cảm biến so với mặt dưới nắp; mặc định 0 giả định lắp phẳng. Khi làm giá đỡ thật, đo độ nhô và đặt giá trị cố định cho mẫu giá đỡ, không bắt người dùng tự nhập độ lệch này.

```text
empty_distance = height_cm - sensorOffsetCm
fill_percent = clamp(100 × (empty_distance - measured_distance) / (empty_distance - 5), 0, 100)
```

Chiều cao nhập 10–400 cm, độ phân giải 0,1 cm. Mốc đầy 5 cm; cảnh báo đầy bật ≥80%, tắt ≤75%. Thiết bị chưa cấu hình gửi phần trăm null và full=false, nhưng vẫn điều khiển nắp và đo khí. Sau lần thiết lập đầu, chờ nắp đóng ổn định và lượt đo mới để tính phần trăm. Firmware từ chối các lần thiết lập tiếp theo bằng `already_configured`, kể cả sau khởi động lại.

<a id="mqtt"></a>
## Luồng MQTT

1. App chờ bản tin mới từ thiết bị, không dùng retained-only hoặc dữ liệu quá 15 giây để gửi thiết lập.
2. App publish QoS 0, **không retained**, tới `<root>/config/set`.
3. Firmware kiểm tra phiên khởi động, hạn dùng và miền giá trị; lưu `height-mm` dạng uint16 trong namespace NVS `smartbin-bin` bằng Preferences trên task mạng.
4. Queue chuyển thiết lập sang vòng điều khiển. Sau khi áp dụng, firmware trả kết quả **không retained** tại `<root>/config/result`.
5. App chỉ báo thành công với phản hồi đúng device ID, request ID và chiều cao; broker publish callback không phải xác nhận của thiết bị. Timeout 12 giây hoặc đổi kết nối sẽ kết thúc chờ bằng thông báo chưa xác nhận. Nếu mất ACK, kiểm tra state mới để biết giá trị thực tế.

Payload lệnh có dạng ASCII giới hạn độ dài, đơn vị chiều cao là mm:

```text
request_id:settings_session:deadline_uptime_ms:height_mm
```

`request_id` gồm 1–48 ký tự chữ/số/`_`/`-`. `settings_session` là số uint32 khác 0 được firmware tạo mỗi lần khởi động. Deadline là uptime của thiết bị được app ước tính từ bản tin mới cộng 15 giây, theo modulo uint32. Firmware chỉ nhận yêu cầu còn hạn tối đa 20 giây và đúng phiên; mẫu phiên cũ hoặc yêu cầu hết hạn không được áp dụng.

Kết quả:

```json
{"device_id":"device-a","request_id":"app_request","ok":true,"height_mm":450,"error":""}
```

Các mã lỗi: `expired`, `invalid_height`, `busy`, `storage`, `already_configured`. Payload không phân tích được bị bỏ qua. Cùng một request ID gần nhất không được thực thi lại. Chỉ xử lý một yêu cầu đang chờ vòng điều khiển áp dụng.

State/events vẫn dùng schema 1, bổ sung `configured`, `bin_height_cm` (null nếu chưa thiết lập), `settings_session`. Giá trị height được phát từ snapshot đã áp dụng; không phát mẫu có chiều cao khác cấu hình đã lưu. App cũ không thể gửi thiết lập; app mới vẫn decode schema cũ nhưng ẩn phần trăm dựa trên chiều cao cố định trước đây.

<a id="checks"></a>
## Kiểm tra thủ công

| Ca | Thao tác | Kết quả mong đợi |
| --- | --- | --- |
| H01 | Khởi động thiết bị chưa có chiều cao | Mức đầy là null, app mời thiết lập; nắp/khí vẫn hoạt động |
| H02 | Nhập 45 cm, lưu khi thiết bị online | Pending → ACK → thành công, state có chiều cao 45 |
| H03 | Nắp đóng, đo 45/25/13/5 cm | Khoảng 0/50/80/100%, báo đầy từ 80% |
| H04 | Đang báo đầy, tăng khoảng cách tới 15 cm với chiều cao 45 cm | Cảnh báo đầy được xóa ở 75% |
| H05 | Thùng đã có 45 cm; mở lại app hoặc gửi yêu cầu 100 cm | Không hiện nhập chiều cao; thiết bị từ chối yêu cầu mới, vẫn giữ 45 cm |
| H06 | Khởi động lại ESP32 thật | Chiều cao vẫn được đọc từ NVS |
| H07 | Nhập rỗng, chữ, 5, 400.1 hoặc nhiều hơn 1 chữ số thập phân | Lỗi ngay cạnh biểu mẫu, không gửi lệnh |
| H08 | Ngắt kết nối hoặc chặn result khi đang lưu | Không báo thành công giả; mở lại/chờ state để kiểm tra |
| H09 | Gửi lệnh sai phiên, hết hạn, hoặc chiều cao ngoài miền | Không đổi chiều cao hiện hành |
| H10 | Xem thùng minh họa đã có chiều cao | Không hiện phần thiết lập, không gửi lệnh tới thiết bị thật |
| H11 | Firmware cũ hoặc chỉ có state retained | Không cho lưu dựa trên dữ liệu không hỗ trợ/cũ |
| H12 | Chuyển app xuống nền trong lúc chờ | Kết thúc chờ, quay lại phải chờ dữ liệu mới và kiểm tra chiều cao |
| H13 | Nhập 45 cm rồi chọn Lưu thiết lập | Dialog nêu rõ 45 cm và chỉ thiết lập một lần; chưa gửi lệnh trước khi xác nhận |
| H14 | Chọn Kiểm tra lại trong dialog | Trở về biểu mẫu, thiết bị chưa thay đổi |
| H15 | Hai điện thoại cùng thiết lập một thùng chưa cấu hình | Chỉ yêu cầu đầu lưu thành công; yêu cầu sau bị từ chối |

Ghi nhận kết quả khi chạy từng ca trên mô phỏng hoặc thiết bị.
