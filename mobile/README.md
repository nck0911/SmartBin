# 📱 Smart Trash Mobile

Ứng dụng React Native + Expo + TypeScript để theo dõi mức đầy, tình trạng mùi và quản lý danh sách thùng rác.

Hướng dẫn từ bản clone mới, gồm các bước trên giao diện Expo/Firebase: [Cấu hình toàn bộ dự án](../docs/SETUP.md).

## Mục lục

- [Cài đặt](#install)
- [Chạy ứng dụng](#run)
- [Kết nối thùng rác](#connect)
- [Build APK](#apk)
- [Thông báo](#notifications)
- [Điều hướng và nút Back](#navigation)
- [Kiểm tra](#checks)

<a id="install"></a>
## Cài đặt

Cần Node.js 22.13 trở lên. Từ thư mục gốc repo:

```powershell
cd mobile
npm ci
Copy-Item .env.example .env
```

Chạy `npm ci` lần đầu hoặc sau khi dependencies thay đổi. Khi đã có `.env`, giữ cấu hình hiện tại. Expo Go và chế độ minh họa chạy được khi để trống `EAS_PROJECT_ID`.

<a id="run"></a>
## Chạy ứng dụng

```powershell
npm start
```

Cài Expo Go tương thích SDK trong `package.json`, cho điện thoại và máy tính dùng cùng Wi-Fi rồi quét QR. Trên Android dùng Expo Go; trên iOS dùng Camera.

| Môi trường | Lệnh trong `mobile/` |
| --- | --- |
| Android emulator đã khởi động | `npm run android` |
| iOS simulator trên macOS có Xcode | `npm run ios` |
| Trình duyệt | `npm run web` |

Với LDPlayer, dùng `adb connect` đến địa chỉ ADB của máy ảo, kiểm tra bằng `adb devices`, sau đó chạy `npm run android`.

Bật **Chế độ minh họa** để trải nghiệm mà không cần ESP32. Nhấn `Ctrl+C` để dừng; dùng `npm start -- --clear` khi cần xóa cache Metro. Nếu PowerShell chặn `npm.ps1`, dùng `npm.cmd`.

<a id="connect"></a>
## Kết nối thùng rác

1. Build firmware và chạy Wokwi theo [README chính](../README.md#getting-started).
2. Tắt chế độ minh họa trong app.
3. Chọn broker WebSocket tương ứng; mặc định là `wss://broker.hivemq.com:8884/mqtt`.
4. Thêm thùng với device ID và topic root khớp cấu hình firmware.
5. Mở chi tiết → **Thiết lập**, nhập chiều cao bên trong thùng và chờ thiết bị xác nhận.

App nhận trạng thái để theo dõi; firmware tự điều khiển nắp. Xem [cách tính mức đầy](../docs/BIN_HEIGHT.md).

<a id="apk"></a>
## Build APK

Profile `preview` trong `eas.json` đã tạo APK cài độc lập. Thiết lập một lần cho project của bạn:

1. Sao chép `.env.example` thành `.env` nếu chưa có, điền `EAS_PROJECT_ID` của project Expo.
2. Đặt `google-services.json` tại `mobile/` khi dùng Firebase Android. Application ID đăng ký trên Firebase phải khớp `com.smarttrashcan.mobile` trong `app.config.js`.
3. Trên Expo Dashboard → **Environment variables**, thêm `EAS_PROJECT_ID` kiểu text (Plain text) và `GOOGLE_SERVICES_JSON` kiểu file vào môi trường **preview**. Chọn file cấu hình Android ở bước trên cho biến kiểu file.
4. Hoàn tất cấu hình ký Android theo hướng dẫn của EAS. Nếu cần push, làm thêm [thiết lập thông báo](../docs/NOTIFICATIONS.md).

Tại `mobile/`:

```powershell
npx eas-cli@latest login
npx eas-cli@latest build --platform android --profile preview
```

Build chạy trên Expo, cần Internet và không cần kết nối điện thoại. Khi thành công, tải APK từ liên kết CLI trả về rồi mở trên điện thoại để cài. APK chạy độc lập với Expo Go và Metro. Sửa code rồi chạy lại lệnh build để tạo bản mới, dùng tiếp cùng project và cấu hình ký.

Tham khảo [Expo APK builds](https://docs.expo.dev/build-reference/apk/) và [cấu hình môi trường EAS](https://docs.expo.dev/eas/environment-variables/).

<a id="notifications"></a>
## Thông báo

Trong app, mở **Thông báo → Thiết lập thông báo**:

- **Bật khi đang mở app:** nhận thông báo hệ thống khi app đang theo dõi dữ liệu; có nút gửi thông báo thử.
- **Kể cả khi đóng app:** dùng APK và [backend](../backend/README.md) đang hoạt động. Nhập địa chỉ HTTPS của dịch vụ và mã kết nối được thiết lập trên backend.

<a id="navigation"></a>
## Điều hướng và nút Back

Danh sách và chi tiết dùng lịch sử màn hình của Expo Router. Mũi tên trên thanh tiêu đề và nút Back của Android quay lại màn hình trước đó. Khi biểu mẫu hoặc thiết lập đang mở, Back đóng phần đó trước; trong lúc chờ lưu, thao tác đóng có thể tạm khóa để đợi kết quả.

Sau khi cập nhật các thư viện điều hướng, dừng Metro và chạy `npm start -- --clear`. APK đã cài cần build lại để có thay đổi native.

<a id="checks"></a>
## Kiểm tra

```powershell
npm run lint
npm run typecheck
npm test
```
