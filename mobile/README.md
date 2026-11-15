# Smart Trash Mobile

Ứng dụng React Native + Expo + TypeScript để theo dõi và quản lý danh sách thùng rác. Không điều khiển nắp.

## Cài đặt dependencies

Cài Node.js tương thích Expo SDK của dự án (Node.js 22.13 trở lên). Mở terminal tại thư mục gốc repository:

```powershell
cd mobile
npm ci
```

Chỉ cần chạy `npm ci` lần đầu hoặc khi dependencies thay đổi. Các lệnh bên dưới chạy trong thư mục `mobile/`.

## Chọn cách chạy

Đây là ứng dụng mobile Android/iOS. Android Studio cung cấp công cụ tạo máy ảo và build Android, không phải nền tảng khác của ứng dụng.

| Bạn có gì? | Cách chạy |
| --- | --- |
| Điện thoại Android/iPhone | Expo Go để thử nhanh nếu tương thích SDK |
| Android Studio, chưa có điện thoại | Tạo Android emulator rồi chạy app |
| Điện thoại Android hoặc emulator, muốn build native trên máy | `npx expo run:android --device` |
| Muốn APK cài độc lập để demo | Build APK bằng EAS với profile preview |
| Chỉ muốn xem nhanh giao diện | Bản web, là lựa chọn phụ |

## Chạy trên điện thoại bằng Expo Go

```powershell
npm start
```

Cài Expo Go tương thích SDK trong `package.json`. Điện thoại và máy tính dùng cùng mạng Wi-Fi, sau đó quét mã QR trong terminal bằng Expo Go trên Android hoặc Camera trên iOS. Nếu Expo Go chưa hỗ trợ SDK của dự án, cần development build tương thích.

Nếu iPhone báo lỗi tài khoản, chạy `npx expo login` trên máy tính và đăng nhập cùng tài khoản trong Expo Go. Không ghi thông tin đăng nhập vào repository.

## Chạy trên Android emulator

1. Cài Android Studio và hoàn tất Setup Wizard để cài Android SDK.
2. Mở **More Actions → Virtual Device Manager** (hoặc **Tools → Device Manager**).
3. Chọn **Create Virtual Device**, chọn thiết bị Pixel, tải system image Android phù hợp rồi Finish.
4. Nhấn nút Play trong Device Manager để khởi động máy ảo, chờ đến màn hình chính.
5. Tại thư mục `mobile/`, chạy:

```powershell
npm run android
```

Hoặc chạy `npm start` rồi nhấn `a` trong terminal. Expo CLI sẽ mở app qua Expo Go trên máy ảo nếu có bản Expo Go tương thích. Không cần mở source React Native như một Android project trong Android Studio.

Nếu không tìm thấy emulator, kiểm tra Android SDK Platform-Tools, Android Emulator và đường dẫn SDK trong Android Studio. Cấu hình `ANDROID_HOME` và thêm thư mục `platform-tools` vào PATH theo vị trí SDK trên máy; không chép đường dẫn cá nhân vào README.

## Build và chạy native Android trên máy

Cách này không phụ thuộc Expo Go. Cần Android Studio, Android SDK và JDK tương thích Expo SDK hiện tại; xem [thiết lập môi trường Android](https://docs.expo.dev/get-started/set-up-your-environment/?device=simulated&platform=android).

Với điện thoại thật: bật Developer options → USB debugging, kết nối USB và chấp nhận yêu cầu cho phép debug. Với máy ảo: khởi động máy ảo trong Device Manager.

```powershell
adb devices
npx expo run:android --device
```

Chọn thiết bị khi CLI hỏi. Lần đầu lệnh sẽ tạo thư mục native `android/`, biên dịch và cài app; cần tải Android SDK/Gradle dependencies. Bản debug vẫn cần Metro khi phát triển. Thư mục native được tạo tự động và hiện được Git bỏ qua.

## Build APK cài độc lập

Đây là cách đóng gói app để cài lên Android thật hoặc emulator mà không cần Expo Go hay Metro. Cần tài khoản Expo và kết nối Internet; EAS cloud build sẽ tải source dự án lên dịch vụ Expo.

Tại `mobile/`, chạy:

```powershell
npx eas-cli@latest login
npx eas-cli@latest build:configure
```

Chọn Android và làm theo CLI để liên kết dự án, đặt Android application ID riêng và cấu hình ký app. Giữ tài khoản, token, mật khẩu và keystore ngoài Git.

Trong `mobile/eas.json` do CLI tạo, thêm hoặc cập nhật profile `preview` (giữ lại các profile khác):

```json
{
  "build": {
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" }
    }
  }
}
```

```powershell
npx eas-cli@latest build --platform android --profile preview
```

Sau khi build xong, tải APK từ liên kết CLI trả về rồi mở trên điện thoại để cài. Hoặc đổi tên file tải về thành `smart-trash.apk` và cài qua USB/emulator:

```powershell
adb install -r smart-trash.apk
```

Có thể cài build lên emulator bằng `npx eas-cli@latest build:run -p android --latest`. APK preview chạy độc lập; cần build lại để đóng gói thay đổi code. Hướng dẫn này chưa tạo hoặc chạy cloud build cho repository.

Nguồn: [Expo APK builds](https://docs.expo.dev/build-reference/apk/), [Android emulator](https://docs.expo.dev/get-started/set-up-your-environment/?device=simulated&platform=android).

## Chạy trên iOS simulator (macOS)

Cài Xcode và mở iOS simulator, sau đó chạy:

```sh
npm run ios
```

Windows không chạy được iOS simulator.

## Xem thử trên trình duyệt (tùy chọn)

```powershell
npm run web
```

Mở địa chỉ local trong terminal. Đây là bản xem trên web, không phải APK. Với mọi cách chạy, có thể bật **Chế độ minh họa** trong app để xem dữ liệu mà không cần ESP32.

## Dừng hoặc khởi động lại

Nhấn `Ctrl+C` trong terminal để dừng. Nếu cần xóa cache Metro:

```powershell
npm start -- --clear
```

Nếu PowerShell chặn script `npm.ps1`, dùng `npm.cmd` thay cho `npm` (ví dụ `npm.cmd run web`).

## Kết nối firmware

- Mặc định: `wss://broker.hivemq.com:8884/mqtt`.
- Thùng mặc định dùng ID/topic trong `include/Secrets.example.h`.
- Nếu firmware dùng `Secrets.h`, sửa ID và topic trong app tương ứng.
- Thêm thùng: tên, vị trí, device ID và topic root (không thêm `/#`).
- App subscribe `state`, `events`, `availability` và kết quả thiết lập chiều cao; chỉ gửi yêu cầu thiết lập, không gửi lệnh đóng/mở nắp.
- Cờ `full` và `gas_high` lấy từ firmware. UI gọi `gas_high` là cảnh báo mùi hôi, hiển thị “Mức mùi: Bình thường / Cao”. Trong demo, nguồn tín hiệu là biến trở; không quy đổi ADC thành ppm hoặc phần trăm mùi. Xem [giải thích mô phỏng và cảm biến thực tế](../README.md#odor-simulation).
- Bản tin retained được đánh dấu dữ liệu cũ cho đến khi có bản tin mới. Không có bản tin mới trong 15 giây cũng được đánh dấu cũ. Khi broker mất kết nối không thể kết luận riêng thiết bị offline.
- Danh sách và URL broker lưu trên máy bằng AsyncStorage; không lưu tài khoản/mật khẩu.
- Có thiết lập thông báo khi app đang nhận dữ liệu và luồng push qua `backend/` khi app không mở. Remote push cần APK/bản native có cấu hình Expo/Firebase/APNs và backend chạy liên tục; Expo Go Android chỉ thử local notification. Chưa có lịch sử telemetry.

## Thông báo đầy và mùi hôi

Mở **Thông báo → Thiết lập thông báo**:

- **Bật khi đang mở app:** xin quyền thông báo, tạo thông báo hệ thống khi nhận cảnh báo mới. Thử bằng Expo Go trên điện thoại; không dùng để nhận sự kiện mới lúc app xuống nền.
- **Gửi thông báo thử:** kiểm tra quyền và hiển thị trên điện thoại. Không chứng minh đã cấu hình push nền thành công.
- **Bật kể cả khi đóng app:** cần bản app riêng. Nhập địa chỉ HTTPS và mã ghép nối của dịch vụ; app đăng ký token và danh sách thùng. Thông tin truy cập riêng lưu bằng SecureStore.
- **Tắt thông báo:** với push, cần dịch vụ xác nhận xóa đăng ký; nếu mất mạng, app sẽ báo chưa tắt được thay vì báo thành công.

Không thông báo lặp mỗi 2 giây. Dữ liệu retained-only/invalid/stale không tạo cảnh báo đầy mới. Bấm thông báo mở chi tiết đúng ID/topic/broker. Demo tạo thông báo có nhãn “Thử”, không gửi dữ liệu giả lên dịch vụ. Push thật vẫn hoạt động độc lập khi app đang xem demo.

Hướng dẫn từ bước tạo Expo project, Firebase, build APK và chạy backend: [docs/NOTIFICATIONS.md](../docs/NOTIFICATIONS.md).

## Demo và kiểm tra thủ công

### Thiết lập chiều cao thùng

Mở chi tiết thùng → **Thiết lập** → nhập **Chiều cao bên trong thùng (cm)**. Đo từ mặt dưới nắp khi đóng đến đáy bên trong thùng; cảm biến gắn dưới nắp và hướng xuống đáy. Cho phép 10–400 cm, tối đa một chữ số thập phân, chấp nhận dấu phẩy hoặc dấu chấm.

Nhấn **Lưu thiết lập**, chờ ESP32 xác nhận rồi chọn **Hoàn tất**. Thiết lập lưu trên ESP32; không cần nạp lại firmware khi chuyển thùng. Trước khi thiết lập, app không hiển thị phần trăm đầy. Sau khi đổi chiều cao, chờ nắp đóng và một lượt đo mới.

Mốc đầy cố định là khoảng cách 5 cm từ mặt cảm biến tới rác; cảnh báo bật ở 80%, xóa ở 75%. Ví dụ chiều cao 45 cm và cảm biến lắp phẳng với mặt dưới nắp: khoảng cách 45 cm → 0%, 25 cm → 50%, 13 cm → 80%, 5 cm → 100%.

Thiết bị cần chạy firmware hỗ trợ thiết lập chiều cao và gửi dữ liệu mới. Firmware cũ vẫn đọc được trạng thái/khí nhưng cần cập nhật để thiết lập và xem phần trăm. Nếu mất kết nối/hết thời gian chờ, ứng dụng không báo thành công; thiết lập có thể đã được lưu trên thiết bị nên kiểm tra dữ liệu mới trước khi thử lại. Chế độ minh họa chỉ đổi chiều cao giả lập, không gửi xuống thiết bị thật.

Trên ESP32 thật, thiết lập lưu trong NVS qua lần khởi động lại. Môi trường mô phỏng có thể tạo lại bộ nhớ flash khi bắt đầu phiên mới; nếu mất thiết lập thì nhập lại.

### Các thao tác cần kiểm tra

Bật **Chế độ minh họa** để xem dữ liệu giả lập. Thêm thùng demo thứ hai để thấy đồng thời cảnh báo đầy và mùi hôi. Tắt demo để quay về MQTT; dữ liệu giả lập được xóa khỏi bộ nhớ đọc. Các thùng demo vẫn trong danh sách, có thể xóa bằng màn hình chi tiết.

1. Thêm/sửa/xóa thùng và mở lại app để kiểm tra lưu trữ.
2. Tìm kiếm tên/vị trí, bật bộ lọc cảnh báo.
3. Chạy ESP32 Wokwi và đối chiếu app với Serial; kiểm tra mức đầy và cả hai cờ cảnh báo.
4. Ngắt ESP32/broker: kiểm tra offline/dữ liệu cũ; nối lại và chờ bản tin mới.
5. Đưa app xuống nền rồi mở lại: phải kết nối lại, không dùng snapshot cũ như dữ liệu sống.
6. Thử ID/topic sai, JSON lỗi, cảm biến invalid và trash_stale.

## Lệnh kiểm tra

```powershell
npx tsc --noEmit
npm run lint
npm test
npx expo export --platform web
```

Tài liệu nền: [Expo](https://docs.expo.dev/get-started/create-a-project/), [MQTT.js](https://github.com/mqttjs/MQTT.js).

## Kết quả kiểm tra — 11/11/2026

- TypeScript: pass.
- 5 nhóm test model: pass.
- Expo dependency compatibility: pass.
- Expo export web, Android và iOS: pass (bundle, chưa phải APK/IPA).
- Chưa chạy giao diện trên điện thoại/emulator và chưa kiểm chứng end-to-end với ESP32 Wokwi.
- `npm audit`: 5 cảnh báo moderate trong chuỗi công cụ Expo (`glob`, `minimatch`, CLI/fingerprint). Chưa ép hạ Expo theo đề xuất audit vì sẽ thay SDK; cần theo dõi bản vá tương thích.
