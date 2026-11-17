# Thêm thùng bằng mã QR

Mở app → **Quét QR** → cho phép camera → quét mã → kiểm tra tên, vị trí → **Lưu thay đổi**.
Quét thùng đã có sẽ mở chi tiết, không thêm trùng. Có thể chọn **Nhập thông tin thủ công** khi không dùng camera.

Mã cho mạch hiện tại (thùng 1, cao 45 cm): [mở mã QR để in](qr/nhom10-trash-7c91a2.svg).
Hai thùng bổ sung cao 60 và 80 cm: [trang QR của cả 3 thùng](qr/index.html), [hướng dẫn mô phỏng](SIMULATIONS.md).
In nền trắng, giữ nguyên viền trắng quanh mã, kích thước khoảng 5–7 cm và dán lên thân thùng.
Mã khớp `DEVICE_ID` và `MQTT_TOPIC_ROOT` trong `include/Secrets.example.h`, cấu hình firmware đang dùng khi chưa có `Secrets.h`.

QR chứa JSON theo [mẫu](qr/nhom10-trash-7c91a2.json): `type: smart-trash-bin`, `version: 1`, `id`, `topic`, `name`, `location`, `heightCm`.
Chiều cao được điền sẵn trong bước Thiết lập sau khi thêm thùng. Kiểm tra rồi xác nhận một lần để mạch lưu; QR không ghi đè chiều cao thiết bị đã lưu. QR cũ không có `heightCm` vẫn dùng được.
Mỗi mạch mới cần `id` và `topic` riêng, khớp firmware. QR không chứa mật khẩu và không thay địa chỉ broker của app.
App vẫn cần kết nối đến cùng broker với thiết bị để nhận dữ liệu; quét QR chỉ thêm thông tin theo dõi.

Lần cài mới không có thùng sẵn. Khi nâng cấp, app loại bỏ mục mặc định cũ nếu tên, vị trí và topic vẫn nguyên mẫu; các mục đã sửa được giữ lại. Thùng thêm bằng QR được lưu qua các lần mở app.

Đã thêm `expo-camera`; bản app cài đặt cần được build lại để có module và quyền camera. Camera cần được kiểm tra trên điện thoại thật, bao gồm từ chối quyền, quét sai mã và quét lại thùng đã có.
