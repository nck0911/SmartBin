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
2. Quét QR bằng Expo Go, mở **Thông báo → Thiết lập thông báo**.
3. Chọn **Bật khi đang mở app**, cho phép thông báo và chọn **Gửi thông báo thử**.
4. Giữ app ở foreground, chạy Wokwi rồi tạo cảnh báo đầy hoặc mùi.

Chế độ này tạo thông báo hệ thống khi app đang nhận dữ liệu. Bản web chỉ hiển thị cảnh báo trong giao diện.

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
2. Vào **Thông báo → Thiết lập thông báo → Kể cả khi đóng app**.
3. Điền địa chỉ HTTPS và mã kết nối đã thiết lập trên backend.
4. Cho phép thông báo rồi chọn **Bật kể cả khi đóng app**.
5. Đưa app xuống nền, tạo một cảnh báo mới trong Wokwi và kiểm tra thông báo.

Khi sửa danh sách thùng, app đồng bộ đăng ký với backend; có thể chọn **Đồng bộ lại danh sách thùng** nếu cần. Tắt thông báo cần mạng để xác nhận hủy đăng ký.

<a id="verify"></a>
## Kiểm tra hoạt động

- Thử riêng cảnh báo đầy, cảnh báo mùi và cả hai cùng lúc.
- Giữ cảnh báo bật qua nhiều bản tin: chỉ nhận một lần cho mỗi loại.
- Hạ dưới ngưỡng rồi tạo lại cảnh báo: nhận lần mới.
- Bấm thông báo: mở chi tiết đúng thùng.
- Với APK, thử khi app ở nền và khi đóng bình thường.

Android có thể chặn nhận push sau khi **Buộc dừng** app; cần mở lại app. Điện thoại tắt nguồn không hiển thị thông báo ngay. Kiểm tra trên thiết bị sau khi hoàn tất cấu hình để xác nhận toàn bộ luồng.
