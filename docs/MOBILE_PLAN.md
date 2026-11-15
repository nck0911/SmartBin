# Mobile: theo dõi và quản lý thùng rác

## Phạm vi

React Native + Expo + TypeScript trong `mobile/`. Không gửi lệnh điều khiển nắp; có gửi yêu cầu thiết lập chiều cao thùng và chờ thiết bị xác nhận.

1. Danh sách thùng, tìm kiếm và lọc cảnh báo.
2. Thêm/sửa/xóa tên, vị trí, device ID và MQTT topic root; lưu trên thiết bị.
3. MQTT qua WebSocket bảo mật; nhận state/events/availability theo schema 1.
4. Chi tiết mức đầy, mức mùi Bình thường/Cao, cảnh báo Có mùi hôi, cập nhật cuối và tình trạng cảm biến. Nguồn tín hiệu mùi trong demo là biến trở, giải thích trong README.
5. Dùng cờ full/gas_high của firmware, không tự suy ra ngưỡng cảnh báo.
6. Không xem retained state là dữ liệu sống. Chờ bản tin mới và đánh dấu cũ khi không có cập nhật trong 15 giây.
7. Chế độ demo tách khỏi dữ liệu MQTT, có nhãn rõ ràng.
8. Thiết lập chiều cao bên trong thùng từ chi tiết, có hướng dẫn đo và hình minh họa; ESP32 lưu NVS, tính phần trăm và trả xác nhận. Mốc đầy cố định 5 cm; chưa thiết lập thì không hiển thị phần trăm.
9. Thiết lập thông báo: local khi app nhận dữ liệu và remote push bằng backend theo dõi MQTT. Chống lặp theo chuyển trạng thái, bấm mở thùng, lưu đăng ký và xác nhận bật/tắt. Remote push cần cấu hình riêng trước khi dùng trên thiết bị.

## Giao diện

Nền sáng, xanh lá làm màu chính, chữ tối; thẻ bo góc và thanh mức đầy.
Nút tối thiểu 44px, biểu mẫu có nhãn, cảnh báo có chữ ngoài màu sắc.
Danh sách → chi tiết → sửa; thêm thùng và cấu hình broker bằng biểu mẫu.

## Chưa thuộc bản đầu

Tài khoản người dùng, lịch sử telemetry bền và đo mùi thực tế. Backend thông báo đã có; cấu hình Expo/Firebase/APNs, hosting và kiểm chứng push trên thiết bị vẫn phải hoàn tất. Chi tiết ở [NOTIFICATIONS.md](NOTIFICATIONS.md).

Backend nằm trong `backend/`, có `src/services/notifications` và `src/services/registrations`. Các service là module chức năng chạy chung, còn HTTP, SQLite và adapter Expo được tách riêng; xem [cấu trúc backend](../backend/README.md#tổ-chức-mã-nguồn).
Public broker chỉ dùng demo; không nhập dữ liệu bí mật. Cấu hình lưu trên máy không chứa mật khẩu.

## Kiểm chứng

TypeScript, kiểm thử bộ giải mã và trạng thái dữ liệu, Expo export.
Kiểm chứng Android/iOS và luồng ESP32 → broker → app cần thiết bị/simulator chạy thật.
