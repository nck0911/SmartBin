# 🔔 Thông báo trên điện thoại

App nhắc thu gom hoặc vệ sinh khi thùng chuyển sang cảnh báo đầy hoặc có mùi hôi. Bấm thông báo để mở chi tiết thùng.

Nếu chưa có cấu hình, bắt đầu từ [hướng dẫn toàn bộ dự án](SETUP.md); tài liệu này tập trung vào cách dùng và kiểm tra thông báo.

## Mục lục

- [Thử trong Expo Go](#local)
- [Thiết lập push Android](#android)
- [Bật nhận khi đóng app](#enable)
- [Kiểm tra hoạt động](#verify)

<a id="local"></a>
## Thử trong Expo Go

1. Tại `mobile/`, chạy `npm ci` lần đầu rồi `npm start`.
2. Quét QR bằng Expo Go, vào **Cài đặt** trên dashboard.
3. Bật công tắc **Bật thông báo**, cho phép thông báo nếu điện thoại yêu cầu. Trạng thái công tắc được lưu qua các lần reload.
4. Giữ app đang mở và nhận dữ liệu, chạy Wokwi rồi tạo cảnh báo đầy, mùi hoặc pin yếu.

Expo Go tự dùng thông báo cục bộ, không cần đăng ký push hay build APK. Mỗi loại cảnh báo chỉ phát khi chuyển sang trạng thái cảnh báo; đưa về bình thường rồi kích hoạt lại để thử lần tiếp theo. Nếu quyền đã được cấp, điện thoại không hỏi lại. Nếu đã chặn quyền, cho phép lại thông báo của Expo Go trong cài đặt điện thoại.

Chế độ này cần app tiếp tục nhận dữ liệu MQTT, không bảo đảm nhận khi đóng Expo Go. Bản web chỉ hiển thị cảnh báo trong giao diện.

<a id="android"></a>
## Thiết lập push Android

1. Chuẩn bị project Expo và Firebase Android theo [hướng dẫn APK](../mobile/README.md#apk).
2. Thiết lập FCM V1 cho project trên Expo theo [hướng dẫn chính thức](https://docs.expo.dev/push-notifications/fcm-credentials/).
3. Build và cài APK bằng profile `preview`.
4. Cấu hình và chạy [backend](../backend/README.md), cung cấp địa chỉ HTTPS để điện thoại truy cập.

Expo Go hỗ trợ thông báo local; nhận push Android khi đóng app cần bản cài riêng. Với iOS, thiết lập APNs theo [hướng dẫn Expo](https://docs.expo.dev/push-notifications/push-notifications-setup/).

Backend phải chạy liên tục và có Internet. APK không cần máy tính phát triển hoặc Metro, nhưng vẫn cần mạng để nhận push.

<a id="enable"></a>
## Bật nhận khi đóng app

1. Mở APK, kiểm tra app đang theo dõi đúng thùng.
2. Bản cài phải có đăng ký dịch vụ thông báo hợp lệ (địa chỉ HTTPS và thông tin xác thực). Nếu chưa có, công tắc báo dịch vụ chưa được thiết lập; giao diện hiện tại không có ô nhập cấu hình này.
3. Trong **Cài đặt** trên dashboard, bật **Bật thông báo** và cho phép quyền trên điện thoại.
4. Đưa app xuống nền, tạo một cảnh báo mới trong Wokwi và kiểm tra thông báo.

Khi sửa danh sách thùng, app tự đồng bộ đăng ký với backend. Tắt thông báo push cần mạng để xác nhận hủy đăng ký. Thay đổi mã nguồn cục bộ không cập nhật APK đã cài.

<a id="verify"></a>
## Kiểm tra hoạt động

- Thử riêng cảnh báo đầy, cảnh báo mùi và cả hai cùng lúc.
- Giữ cảnh báo bật qua nhiều bản tin: chỉ nhận một lần cho mỗi loại.
- Hạ dưới ngưỡng rồi tạo lại cảnh báo: nhận lần mới.
- Bấm thông báo: mở chi tiết đúng thùng.
- Với APK, thử khi app ở nền và khi đóng bình thường.

Android có thể chặn nhận push sau khi **Buộc dừng** app; cần mở lại app. Điện thoại tắt nguồn không hiển thị thông báo ngay. Kiểm tra trên thiết bị sau khi hoàn tất cấu hình để xác nhận toàn bộ luồng.
