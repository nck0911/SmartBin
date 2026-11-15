# Thông báo đầy và mùi hôi trên điện thoại

## Mục lục

1. [Hai chế độ](#modes)
2. [Thử ngay trong Expo Go](#local)
3. [Chuẩn bị push Android](#android)
4. [Chạy dịch vụ theo dõi](#service)
5. [Bật push trên điện thoại](#enable)
6. [Quy tắc và kiểm chứng](#verify)

<a id="modes"></a>
## 1. Hai chế độ

| Chế độ trong app | Cần gì | Khi nào có thông báo |
| --- | --- | --- |
| Khi đang mở app | Expo Go hoặc bản app riêng, quyền thông báo | Khi app đang nhận MQTT hoặc dữ liệu minh họa |
| Kể cả khi đóng app | Bản app riêng, cấu hình Expo/Firebase, dịch vụ thông báo chạy liên tục | Backend nhận cảnh báo và gửi push đến điện thoại |

Expo Go là ứng dụng để chạy thử source bằng QR. Expo project là định danh dự án; EAS là công cụ build bản cài riêng. Firebase Cloud Messaging (FCM) là dịch vụ Android dùng để chuyển push đến thiết bị. Expo Push Service nối backend với FCM/APNs. Thêm thư viện hoặc quét QR chưa đủ để bật push nền.

Push còn phụ thuộc Internet, quyền thông báo, cấu hình và hệ điều hành. Android bị **Force stop** trong Settings có thể phải mở lại app để nhận tiếp; không hứa nhận khi điện thoại tắt nguồn. Không cần giữ Metro/máy tính phát triển chạy khi dùng APK đã build, nhưng máy chạy backend vẫn phải hoạt động.

<a id="local"></a>
## 2. Thử ngay trong Expo Go

1. Tại `mobile/`, chạy `npm ci` nếu dependencies thay đổi, sau đó `npm start` (hoặc tunnel đang dùng).
2. Trên app mở **Thông báo → Thiết lập thông báo**.
3. Chọn **Bật khi đang mở app** và cho phép thông báo trên điện thoại.
4. Chọn **Gửi thông báo thử**. Đây là thông báo hệ thống do app tạo, không phải bài test đường gửi remote push.
5. Giữ app ở foreground, chạy Wokwi, làm thùng đầy hoặc tăng biến trở mùi vượt ngưỡng. Có thể dùng chế độ minh họa và thêm thùng demo có cảnh báo; thông báo minh họa có tiền tố “Thử”.
6. Bấm vào thông báo để mở chi tiết thùng.

App hiện ngắt MQTT khi xuống nền. Chế độ này không nhận sự kiện mới khi app đã đóng/nằm nền. Bản web không hiển thị thông báo hệ thống, chỉ giữ cảnh báo trên giao diện.

Trong Expo Go, thông báo local dùng kênh mặc định do Expo quản lý (`trigger: null`), không gọi tạo kênh riêng. Bản app riêng tạo kênh `trash-alerts-v2` với cấu hình tối thiểu, dùng âm thanh/rung mặc định của Android. Nếu native API lỗi, ứng dụng giữ thông tin lỗi để chẩn đoán, không tự kết luận Expo Go đã cũ. Thay đổi này chưa xác nhận trên điện thoại cho đến khi chạy thử thực tế.

Nhận diện Expo Go dùng `isRunningInExpoGo()` từ package `expo`, cùng API mà expo-notifications sử dụng; không dựa riêng vào metadata `Constants.executionEnvironment`. Nếu sau cập nhật vẫn thấy log của nhánh tạo kênh riêng, dừng Metro, chạy `npm start -- --clear` rồi đóng/mở lại project bằng QR để loại trừ bundle/callback cũ. Các WARN nói remote push không có trong Expo Go không yêu cầu cấu hình Firebase để thử local notification. Không tắt/ẩn các WARN này để giả vờ native API đã hoạt động.

<a id="android"></a>
## 3. Chuẩn bị push Android

Các bước này cần thực hiện bằng tài khoản của chủ dự án. Không gửi mật khẩu/khóa riêng qua chat và không commit file thông tin xác thực.

### A. Liên kết Expo project

Tại `mobile/`, đăng nhập Expo và liên kết/tạo project:

```powershell
npx eas-cli@latest login
npx eas-cli@latest init
```

Vì dự án dùng `app.config.js`, nếu CLI yêu cầu thêm project ID thủ công, đặt `EAS_PROJECT_ID` trong `mobile/.env.local` và trên Expo Dashboard → Environment variables của môi trường **preview**. Dùng UUID project thật, không dùng giá trị minh họa. Project ID không phải mật khẩu.

### B. Thiết lập Firebase cho Android

1. Mở [Firebase Console](https://console.firebase.google.com/), tạo hoặc chọn project.
2. Thêm ứng dụng Android có application ID **com.smarttrashcan.mobile** (khớp app.config.js; nếu đổi ID thì sửa cả hai nơi).
3. Tải `google-services.json`. Để tại `mobile/google-services.json` khi build trên máy; file đã được Git bỏ qua.
4. Khi cloud build, cấu hình biến môi trường kiểu **file** tên `GOOGLE_SERVICES_JSON` trong môi trường **preview** trên Expo Dashboard. `app.config.js` sẽ đọc đường dẫn file này. Chỉ có file local bị Git bỏ qua thì chưa đủ để cloud build nhận được file.
5. Theo [hướng dẫn Expo FCM V1](https://docs.expo.dev/push-notifications/fcm-credentials/), tạo/chọn Google Service Account phù hợp và upload private key JSON vào Expo Project → Credentials → Android → FCM V1 service account key. Có thể dùng `npx eas-cli@latest credentials` thay dashboard.

`google-services.json` đăng ký app Android với Firebase; private key của service account là file khác, chỉ dùng cấu hình thông tin xác thực trên Expo. Không nhét private key vào bundle mobile. Nếu lưu file khóa trong repo để thao tác, dùng thư mục `.local/` đã được bỏ qua, không đưa vào source public.

### C. Build và cài APK

```powershell
npx eas-cli@latest build --platform android --profile preview
```

Cloud build tải source lên Expo; chọn cấu hình ký app theo CLI. Cài APK từ kết quả build lên điện thoại. Đổi native config/plugin/thông tin Firebase cần build lại APK; cập nhật Metro không bổ sung native module cho bản app đã cài.

`eas.json` có sẵn profile preview tạo APK nội bộ. Đây là đường build đã chuẩn bị, chưa có tài khoản/credential hoặc APK được tạo sẵn trong repository. iOS dùng APNs và cấu hình Apple tương ứng; chưa xác minh luồng iOS trong phiên triển khai này.

<a id="service"></a>
## 4. Chạy dịch vụ theo dõi

Làm theo [notification-service/README.md](../notification-service/README.md). Dịch vụ dùng Node.js + MQTT + SQLite, phải chạy trên một máy có Internet ngay cả khi người dùng đóng app.

```text
ESP32 → MQTT broker → Notification service → Expo Push → FCM/APNs → Điện thoại
```

Điền danh sách ID/topic được phép, broker và mã ghép nối trong file môi trường riêng của dịch vụ. Cung cấp địa chỉ HTTPS đến API để điện thoại truy cập. Không cần thêm Firebase private key vào backend này: Expo giữ credential FCM/APNs. Chỉ cần EXPO_ACCESS_TOKEN phía server nếu chủ dự án bật enhanced push security.

<a id="enable"></a>
## 5. Bật push trên điện thoại

1. Mở APK đã build, kiểm tra danh sách thùng và kết nối MQTT.
2. Vào **Thông báo → Thiết lập thông báo → Kể cả khi đóng app**.
3. Điền địa chỉ HTTPS của dịch vụ và mã kết nối do chủ dịch vụ thiết lập.
4. Cho phép thông báo và chọn **Bật kể cả khi đóng app**.
5. Sau khi API xác nhận đăng ký, điện thoại lưu thông tin truy cập riêng bằng SecureStore. Mã ghép nối nhập trong form được xóa khỏi ô nhập sau thành công.
6. Đưa app xuống nền và tạo một lần chuyển cảnh báo từ tắt sang bật trong Wokwi. Bấm thông báo để mở đúng chi tiết thùng.

App cập nhật đăng ký khi danh sách/broker thay đổi, khi trở lại foreground hoặc native push token thay đổi. Nếu lỗi, có nút **Đồng bộ lại danh sách thùng**; dịch vụ có thể vẫn giữ danh sách cũ cho đến khi đồng bộ thành công. **Tắt thông báo** sẽ xóa đăng ký trên dịch vụ trước khi báo đã tắt; cần mạng để xác nhận.

Trong push mode, app không tạo thêm local notification cho bản tin thật, tránh nhận hai thông báo cùng sự kiện. Demo vẫn có thể tạo thông báo minh họa tại điện thoại; dịch vụ không theo dõi các thùng có ID demo. Khi chọn xem demo, đăng ký push của thùng thật vẫn hoạt động độc lập.

<a id="verify"></a>
## 6. Quy tắc và kiểm chứng

- Full và odor độc lập; chỉ thông báo lúc bật, không lặp mỗi 2 giây. Khi hết cảnh báo rồi bật lại mới phát sinh lần mới.
- Bản tin retained-only, cảm biến invalid và dữ liệu rác stale không tạo cảnh báo đầy mới hoặc xóa cờ để tái thông báo sai.
- Local dedup giữ trong phiên app; mở lại app có thể nhắc một lần về cảnh báo đang bật khi có mẫu mới. Backend giữ dedup qua restart bằng SQLite.
- Cài đặt mới chỉ nhận các sự kiện tiếp theo; không tự gửi lại lịch sử cảnh báo đang bật trước khi đăng ký.
- Hàng đợi bỏ thông báo chưa gửi khi cảnh báo hết, hết hạn và retry có giới hạn. Expo ticket/receipt không bảo đảm điện thoại đã hiển thị.
- Bấm thông báo thùng đã xóa hoặc thuộc broker trước đó không mở nhầm thùng hiện tại.

Kiểm tra tự động:

```powershell
cd mobile
npm run lint
npm run typecheck
npm test
cd ../notification-service
npm test
```

Checklist trên điện thoại: cấp/từ chối quyền, thử foreground, hai cảnh báo cùng lúc, nhận nền/khóa màn hình bằng APK, mở từ trạng thái app đã tắt thông thường, bấm mở đúng thùng, sửa/xóa thùng, mất mạng lúc bật/tắt, restart dịch vụ, thay token và tắt đăng ký. Các test tự động dùng fake Expo sender; không thay thế kiểm chứng push thật bằng tài khoản và thiết bị.

Nguồn: [Expo Notifications SDK](https://docs.expo.dev/versions/v58.0.0/sdk/notifications/), [thiết lập push](https://docs.expo.dev/push-notifications/push-notifications-setup/), [gửi và kiểm tra receipt](https://docs.expo.dev/push-notifications/sending-notifications/).
