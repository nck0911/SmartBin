# Thêm thùng bằng mã QR

Mở app → **+ Thêm thùng rác** → nhập tay hoặc chọn **Quét QR** → sửa tên, vị trí → **Lưu thông tin**. Backend xác minh mã/topic và trả chiều cao chuẩn trước khi app lưu.
Quét thùng đã có sẽ mở chi tiết, không thêm trùng, đồng thời lấy lại chiều cao từ backend.

Mã cho mạch hiện tại (thùng 1, cao 45 cm): [mở mã QR để in](qr/bin-1.svg).
Hai thùng bổ sung cao 60 và 80 cm: [trang QR của cả 3 thùng](qr/index.html), [hướng dẫn mô phỏng](SIMULATIONS.md).
In nền trắng, giữ nguyên viền trắng quanh mã, kích thước khoảng 5–7 cm và dán lên thân thùng.
Mã khớp `DEVICE_ID` và `MQTT_TOPIC_ROOT` trong `include/Secrets.example.h`, cấu hình firmware đang dùng khi chưa có `Secrets.h`.

QR chứa JSON theo [mẫu](qr/bin-1.json): `type: smartbin-bin`, `version: 1`, `id`, `topic`, `name`, `location`, `heightCm`.
Chiều cao chính thức lấy từ `heightCm` trong danh sách `DEVICES_JSON` của backend, không phụ thuộc có quét QR hay không. App hiển thị ngay sau khi xác minh/lưu và tự đồng bộ khi ESP32 online, có dữ liệu mới và chưa thiết lập. Thiết bị đã có chiều cao không bị ghi đè. QR SmartBin không có `heightCm` vẫn dùng được; giá trị trong QR không được dùng thay chiều cao hệ thống. Khi chuyển từ tên cũ, dùng bộ QR SmartBin mới để khớp ID/topic firmware.
Mỗi mạch mới cần `id` và `topic` riêng, khớp firmware. QR không chứa mật khẩu và không thay địa chỉ broker của app.
App vẫn cần kết nối đến cùng broker với thiết bị để nhận dữ liệu; quét QR chỉ thêm thông tin theo dõi.

Lần cài mới không có thùng sẵn. Khi nâng cấp, app loại bỏ mục mặc định cũ nếu tên, vị trí và topic vẫn nguyên mẫu; các mục đã sửa được giữ lại. Thùng thêm bằng QR được lưu qua các lần mở app.

Đã thêm `expo-camera`; bản app cài đặt cần được build lại để có module và quyền camera. Camera cần được kiểm tra trên điện thoại thật, bao gồm từ chối quyền, quét sai mã và quét lại thùng đã có.
