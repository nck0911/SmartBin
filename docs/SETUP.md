# 🛠️ Hướng dẫn cấu hình toàn bộ dự án

Đi từ bản clone mới đến mô phỏng ESP32, app trên điện thoại, APK và thông báo khi đóng app. Các giá trị trong ví dụ là cấu hình demo hoặc chỗ cần thay bằng project của bạn.

Ứng dụng hiện mang tên **SmartBin**, slug `smartbin`, Android/iOS identifier `com.smartbin.mobile`. Khi chuyển từ cấu hình cũ, tạo/liên kết project Expo mới có slug `smartbin`, đăng ký Firebase app cho package mới, tải Firebase JSON mới và cập nhật FCM V1 trên EAS trước khi build. Không sửa package name trực tiếp trong Firebase JSON cũ. Mã QR và ID/topic mô phỏng cũng đã chuyển sang SmartBin.

## Mục lục

1. [Chọn mức chạy và chuẩn bị](#prepare)
2. [Các file cần tạo sau khi clone](#files)
3. [Firmware và Wokwi](#firmware)
4. [Chạy app bằng Expo Go hoặc LDPlayer](#mobile)
5. [Kết nối app với thùng và nhập chiều cao](#bin)
6. [Tạo project Expo](#expo)
7. [Firebase Android](#firebase)
8. [Ký ứng dụng Android](#signing)
9. [Biến môi trường trên Expo Dashboard](#environment)
10. [Thiết lập FCM V1 trên Expo](#fcm)
11. [Build và cài APK](#apk)
12. [Backend và địa chỉ HTTPS](#backend)
13. [Bật thông báo trên app](#notifications)
14. [Sửa code, build lại và đổi máy](#updates)
15. [Xử lý sự cố](#troubleshooting)

<a id="prepare"></a>
## 1. Chọn mức chạy và chuẩn bị

| Mục tiêu | Phần cần làm |
| --- | --- |
| Xem giao diện bằng dữ liệu minh họa | Phần 4 |
| Wokwi gửi dữ liệu đến app | Phần 3–5 |
| APK chạy độc lập | Phần 6, 8, 9, 11; thêm phần 7 và 10 nếu dùng push |
| Nhận thông báo khi đóng app | Toàn bộ luồng APK, Firebase và backend |

Chuẩn bị Node.js **22.13 trở lên** và npm. Với firmware: VS Code, extension **PlatformIO IDE** và **Wokwi Simulator**. Với bản mobile thử nhanh: Expo Go tương thích SDK trong `mobile/package.json`, điện thoại và máy tính cùng Wi-Fi. LDPlayer có thể thay điện thoại khi phát triển.

Các lệnh dưới đây dùng PowerShell. Khi gặp `npm.ps1 cannot be loaded`, dùng `npm.cmd` thay `npm`, `npx.cmd` thay `npx`. Lệnh ghi rõ thư mục chạy; giữ cấu hình hiện tại nếu file đã tồn tại.

<a id="files"></a>
## 2. Các file cần tạo sau khi clone

| Thành phần | File/thông tin riêng | Lấy hoặc tạo từ đâu? | Cần khi nào? |
| --- | --- | --- | --- |
| Firmware | `include/Secrets.h` | Sao chép `include/Secrets.example.h`, điền Wi-Fi/broker của bạn | Khi đổi cấu hình mặc định |
| Mobile | `mobile/.env` | Sao chép `mobile/.env.example` | Cấu hình project Expo để build/push |
| Firebase Android | `mobile/google-services.json` | Firebase → Project settings → Your apps → Android | Push Android |
| Expo cloud build | `EAS_PROJECT_ID`, `GOOGLE_SERVICES_JSON` | Expo → Environment variables → preview | Build theo project/cấu hình của bạn |
| Android signing | Keystore và thông tin ký | EAS tạo hoặc dùng bản ký hiện có | APK và các bản cập nhật |
| FCM V1 | JSON service account | Firebase → Project settings → Service accounts | Upload vào Expo cho push Android |
| Backend | `backend/.env` | Sao chép `backend/.env.example` | Push khi app đóng |
| Dữ liệu backend | `backend/data/` | Tự tạo khi chạy dịch vụ | Giữ trạng thái và đăng ký qua restart |

Các file cấu hình riêng được Git bỏ qua. Lưu file ký và JSON service account trong `.local/credentials/`; chỉ dùng `google-services.json` làm cấu hình Firebase của app. Dependencies (`node_modules/`) và firmware build (`.pio/`) được tạo lại bằng lệnh cài đặt/build.

<a id="firmware"></a>
## 3. Firmware và Wokwi

1. Mở thư mục gốc repo bằng VS Code, cài hai extension đã nêu.
2. Mở PlatformIO terminal. Bản mặc định dùng Wi-Fi `Wokwi-GUEST` và broker demo HiveMQ nên chạy được mà chưa có `Secrets.h`.
3. Nếu cần cấu hình khác, chạy từ gốc repo:

```powershell
Copy-Item include/Secrets.example.h include/Secrets.h
```

4. Sửa file vừa tạo: Wi-Fi, broker, device ID và topic root. Khi chạy nhiều mô phỏng cùng lúc, dùng ID/topic riêng cho từng thiết bị. Ghi lại ID/topic để nhập trên app và backend.
5. Build tại gốc repo:

```powershell
pio run
```

6. Mở Command Palette (`Ctrl+Shift+P`) → **Wokwi: Start Simulator**. Hoàn tất kích hoạt Wokwi nếu extension yêu cầu.
7. Kiểm tra mô phỏng và Serial Monitor. Đưa khoảng cách cảm biến tay xuống ≤20 cm trên 500 ms để mở nắp; rút tay ra khoảng 3 giây để nắp đóng.

Cảm biến còn lại đo khoảng cách đến mặt rác. Biến trở mô phỏng tín hiệu mùi: tăng tín hiệu để bật cảnh báo, giảm để xóa. Phần trăm đầy chỉ có sau khi nhập chiều cao ở phần 5.

<a id="mobile"></a>
## 4. Chạy app bằng Expo Go hoặc LDPlayer

Từ gốc repo:

```powershell
cd mobile
npm ci
Copy-Item .env.example .env
npm start
```

Để trống `EAS_PROJECT_ID` nếu chỉ thử Expo Go. Quét QR bằng Expo Go trên Android hoặc Camera trên iPhone. Cùng mạng Wi-Fi thì dùng lệnh trên, không cần tunnel. Chạy Wokwi để app nhận dữ liệu thùng qua MQTT.

Với LDPlayer:

1. Khởi động máy ảo, bật ADB trong thiết lập của LDPlayer.
2. Dùng địa chỉ/cổng ADB của máy ảo đang chạy:

```powershell
adb connect <dia-chi-ADB-cua-LDPlayer>
adb devices
npm run android
```

Thay phần trong `<...>` bằng địa chỉ thật. Nếu máy ảo đã xuất hiện trong `adb devices`, có thể chạy thẳng `npm run android`. Lệnh này mở app qua Expo Go; chưa tạo APK độc lập.

<a id="bin"></a>
## 5. Kết nối app với thùng và nhập chiều cao

1. Chạy Wokwi để gửi dữ liệu thùng qua MQTT.
2. Bên triển khai đặt `EXPO_PUBLIC_MQTT_URL` trong `mobile/.env`, khớp `APP_BROKER_URL` của backend, rồi khởi động lại Expo. Ví dụ broker mô phỏng: `wss://broker.hivemq.com:8884/mqtt`. Người dùng không cần nhập địa chỉ trong app.
3. Chọn **+ Thêm thùng**. Nhập tên, vị trí, **Mã thiết bị** và **Đường dẫn dữ liệu** đúng với firmware. Với thùng đã thêm, **Sửa thông tin** chỉ cập nhật tên và vị trí.
4. Mở chi tiết thùng và chờ dữ liệu mới. Nếu thiết bị chưa có chiều cao, chọn **Thiết lập**; thùng đã có cấu hình sẽ không hiện phần này.
5. Nhập **Chiều cao bên trong thùng**, đo từ mặt dưới nắp đóng đến đáy. Ví dụ 45 cm; chọn lưu và chờ thiết bị xác nhận.
6. Khi nắp đóng ổn định, thay khoảng cách cảm biến rác để quan sát phần trăm đầy. Với chiều cao 45 cm và cảm biến lắp phẳng: 45/25/13/5 cm tương ứng 0/50/80/100%.

Chiều cao lưu trên ESP32; không sửa code mỗi khi đổi thùng. Chi tiết công thức và giao thức ở [BIN_HEIGHT.md](BIN_HEIGHT.md).

<a id="expo"></a>
## 6. Tạo project Expo

1. Đăng nhập [Expo Dashboard](https://expo.dev/), chọn tài khoản của bạn rồi tạo project mới; nếu đã có project phù hợp thì mở lại project đó.
2. Đặt tên hiển thị tùy chọn; dùng slug `smartbin` để khớp `mobile/app.json`. Nếu chọn slug khác, sửa `expo.slug` trong file này cho khớp.
3. Trong trang project, mở **Project settings → General** và tìm **Project ID** dạng UUID. Dùng ID của Expo, khác với ID dạng tên của Firebase.
4. Điền vào `mobile/.env`:

```dotenv
EAS_PROJECT_ID=<UUID-project-Expo-cua-ban>
EXPO_PUBLIC_MQTT_URL=wss://broker.hivemq.com:8884/mqtt
GOOGLE_SERVICES_JSON=./google-services.json
```

Thay phần `<...>` bằng UUID thật. `app.config.js` đọc biến này để liên kết, không cần đưa ID riêng vào `app.json`. Nếu trang tạo project dẫn sang build, có thể quay về trang project để cấu hình trước.

Tại `mobile/`, xác thực và kiểm tra project:

```powershell
npx eas-cli@latest login
npx eas-cli@latest project:info
```

Nếu đăng nhập bằng Google trên web nhưng CLI yêu cầu mật khẩu bạn chưa đặt, dùng Access Token:

1. Trên Expo, vào [Account settings → Access tokens](https://expo.dev/settings/access-tokens), tạo token có quyền với project của bạn và sao chép trên máy.
2. Trong PowerShell đang mở ở `mobile/`, chạy các lệnh dưới đây rồi dán token vào lời nhắc nhập ẩn:

```powershell
$expoBuildToken = Read-Host 'Expo access token' -AsSecureString
$env:EXPO_TOKEN = [System.Net.NetworkCredential]::new('', $expoBuildToken).Password
npx eas-cli@latest project:info
```

CLI đọc `EXPO_TOKEN` từ tiến trình, không tự lấy biến đăng nhập này từ `.env` mobile. Giữ terminal này để chạy lệnh build; không cần `eas login` khi đã dùng token hợp lệ. Sau khi xong, chạy `Remove-Item Env:EXPO_TOKEN` và đóng terminal. Xem [xác thực bằng access token](https://docs.expo.dev/accounts/programmatic-access/).

<a id="firebase"></a>
## 7. Firebase Android

1. Mở [Firebase Console](https://console.firebase.google.com/), chọn **Create a project** hoặc project đã có.
2. Vào **Project settings → General → Your apps**, thêm ứng dụng **Android**.
3. Điền Android package name: `com.smartbin.mobile`, khớp `mobile/app.config.js`. Nếu đổi package cho ứng dụng riêng, sửa cả hai nơi trước khi build.
4. Đăng ký ứng dụng, tải **google-services.json**, giữ nguyên tên file và đặt tại `mobile/google-services.json`.
5. Với Expo, cấu hình native do plugin và `app.config.js` xử lý; tiếp tục hoàn tất trình hướng dẫn Firebase, không cần chép thủ công đoạn Gradle vào repo.
6. Trong **Project settings → Service accounts**, chọn **Generate new private key → Generate key**, giữ nguyên tên JSON tải về và lưu vào `.local/credentials/`. Tab Node.js ở đây chỉ là ví dụ Admin SDK; app Expo không cần chép đoạn code đó.

Hai JSON có vai trò khác nhau: `google-services.json` dùng cho bản app Android; JSON service account dùng ở bước cấu hình FCM V1 trên Expo. Giữ chúng đúng vị trí theo bảng phần 2.

<a id="signing"></a>
## 8. Ký ứng dụng Android

Cách đơn giản là để EAS tạo keystore khi build lần đầu: chọn tạo mới nếu CLI hỏi và bạn chưa có bản ký cho ứng dụng này. Nếu đã có cấu hình ký, chọn dùng lại.

Nếu thiết lập bằng trang **Expo → Project settings → Credentials → Android → Add application identifier**, nhập `com.smartbin.mobile`. Khi wizard yêu cầu upload keystore, điền các trường sau:

| Trường trên giao diện | Nội dung |
| --- | --- |
| Android keystore file | File `.jks`/`.keystore` của ứng dụng |
| Android keystore password | Mật khẩu kho lưu khóa đã tạo |
| Android key alias | Alias đã dùng khi tạo khóa |
| Android key password | Mật khẩu của khóa tương ứng alias |

Nếu chưa có keystore mà muốn hoàn tất bằng giao diện web, cài JDK có `keytool`, rồi chạy tại gốc repo:

```powershell
New-Item -ItemType Directory -Force .local/credentials
keytool -genkeypair -v -storetype JKS -keystore .local/credentials/android-release.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
```

Trả lời thông tin và đặt mật khẩu theo lời nhắc. Alias trong ví dụ là `upload`; dùng đúng giá trị đó khi upload. Nếu chọn mật khẩu key giống keystore, điền cùng giá trị vào hai trường password.

Trong wizard, bước **Google Service Account Key** có mô tả **Expo Submit upload your app to Google Play** là cấu hình phát hành lên Play. Khi chỉ cần APK, chọn **Skip this step** ở bước đó rồi **Next → Submit**. Phần FCM cho thông báo được thiết lập riêng ở phần 10.

Lưu lại keystore và thông tin ký để dùng cho các bản cập nhật. Tham khảo [cấu hình ký Android](https://docs.expo.dev/app-signing/local-credentials/).

<a id="environment"></a>
## 9. Biến môi trường trên Expo Dashboard

File `.env` trên máy không tự xuất hiện trong cloud build. Trong project Expo, mở **Environment variables → Add variables** và tạo:

| Name | Value | Kiểu/Visibility | Environments |
| --- | --- | --- | --- |
| `EAS_PROJECT_ID` | UUID cùng giá trị trong `mobile/.env` | Text / Plain text | `preview` |
| `GOOGLE_SERVICES_JSON` | Chọn file `mobile/google-services.json` | File / Secret | `preview` |

Với biến kiểu file, dùng nút/biểu tượng upload cạnh ô Value để chọn file; không nhập đường dẫn Windows vào Value. Chọn **preview** bên dưới rồi **Add variables**. Kiểm tra danh sách có đủ hai tên và nhãn môi trường preview.

`mobile/eas.json` đã chọn môi trường `preview` cho profile cùng tên. Khi làm thêm profile/môi trường khác, cấu hình các biến tương ứng ở môi trường đó. Xem [hướng dẫn biến môi trường Expo](https://docs.expo.dev/eas/environment-variables/manage/).

<a id="fcm"></a>
## 10. Thiết lập FCM V1 trên Expo

1. Vào project Expo → **Project settings → Credentials**.
2. Chọn Android application identifier `com.smartbin.mobile` đã tạo ở phần 8.
3. Trong **Service credentials → FCM V1 service account key**, chọn **Add a service account key**.
4. Chọn **Upload new key**, upload JSON service account từ phần 7, rồi **Save**. Nếu đã có bản đúng project, có thể chọn dùng lại.

Kiểm tra FCM V1 đã có thông tin cấu hình. Đây là vị trí dùng JSON service account, khác ô file Firebase trong Environment variables và khác cấu hình Expo Submit cho Google Play. Xem [hướng dẫn FCM V1](https://docs.expo.dev/push-notifications/fcm-credentials/).

<a id="apk"></a>
## 11. Build và cài APK

Tại `mobile/`, sau khi xác thực CLI và hoàn tất các phần trên:

```powershell
npx eas-cli@latest build --platform android --profile preview
```

Kiểm tra CLI nhận đúng project và Android package. Chọn cấu hình ký đã chuẩn bị, chờ build hoàn tất rồi tải APK từ liên kết kết quả.

Mở file APK trên điện thoại, cho phép cài từ nguồn đang dùng nếu Android yêu cầu. Không cần cắm điện thoại khi build, không cần Expo Go hay `npm start` khi chạy APK. Nếu muốn cài qua ADB:

```powershell
adb install -r <duong-dan-file.apk>
```

APK đã chứa code ứng dụng; sửa code rồi build lại để đóng gói bản mới. Tham khảo [build APK bằng EAS](https://docs.expo.dev/build-reference/apk/).

<a id="backend"></a>
## 12. Backend và địa chỉ HTTPS

Từ gốc repo:

```powershell
cd backend
npm ci
Copy-Item .env.example .env
```

Điền `backend/.env`:

| Biến | Cách điền |
| --- | --- |
| `PAIRING_CODE` | Tự đặt mã tối thiểu 16 ký tự; lát nữa nhập cùng mã trên app |
| `MQTT_URL` | Với demo: `mqtt://broker.hivemq.com:1883` |
| `APP_BROKER_URL` | Với demo: `wss://broker.hivemq.com:8884/mqtt`, giống URL lưu trong app |
| `MQTT_USER`, `MQTT_PASSWORD` | Để trống với broker demo không yêu cầu đăng nhập |
| `DEVICES_JSON` | Mảng ID/topic đúng firmware và app |
| `EXPO_ACCESS_TOKEN` | Để trống nếu chưa bật enhanced push security; nếu bật thì điền theo thiết lập Expo Push |
| `HOST`, `PORT` | Giữ `127.0.0.1` và `8787` khi proxy/tunnel chạy cùng máy |

Ví dụ danh sách cho cấu hình mô phỏng mặc định:

```dotenv
DEVICES_JSON=[{"id":"smartbin-7c91a2-01","topic":"smartbin/bins/smartbin-7c91a2-01"}]
```

Chạy và kiểm tra từ terminal trong `backend/`:

```powershell
npm start
```

Mở `http://127.0.0.1:8787/health` trên máy chạy backend; HTTP phải hoạt động và MQTT đã kết nối. Điện thoại cần địa chỉ HTTPS truy cập được, vì app không nhận URL HTTP hay localhost của máy tính.

Để thử nhanh, tải `cloudflared` theo [Cloudflare Downloads](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) và mở terminal khác:

```powershell
cloudflared tunnel --url http://localhost:8787
```

Lấy địa chỉ `https://...trycloudflare.com` từ terminal, mở `/health` trên điện thoại để kiểm tra rồi nhập địa chỉ gốc đó vào app. Giữ cả backend và tunnel chạy. Đây là [Quick Tunnel dùng thử](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/); URL có thể đổi khi khởi động lại. Khi dùng lâu dài, chạy backend trên máy chủ và dùng HTTPS ổn định.

Dịch vụ tự tạo `backend/data/notifications.sqlite`. Giữ thư mục `data/` qua restart/nâng cấp để tiếp tục đăng ký và trạng thái cảnh báo. Xem thêm [backend/README.md](../backend/README.md).

<a id="notifications"></a>
## 13. Bật thông báo trên app

### Thử khi đang mở app

1. Trong Expo Go hoặc APK, mở **Thông báo → Thiết lập thông báo**.
2. Chọn **Bật khi đang mở app**, cho phép thông báo.
3. Chọn **Gửi thông báo thử**, kiểm tra thông báo hệ thống.
4. Giữ app đang nhận dữ liệu, tạo cảnh báo từ Wokwi để kiểm tra luồng thực tế.

### Nhận khi đóng app

1. Dùng APK đã cấu hình FCM, chạy backend và Wokwi.
2. Mở **Thông báo → Thiết lập thông báo → Kể cả khi đóng app**.
3. **Địa chỉ dịch vụ thông báo:** URL HTTPS ở phần 12.
4. **Mã kết nối:** giá trị `PAIRING_CODE` của backend.
5. Chọn **Bật kể cả khi đóng app**, cấp quyền và chờ đăng ký thành công.
6. Đưa app xuống nền, tạo một lần chuyển từ bình thường sang đầy hoặc có mùi, kiểm tra thông báo và bấm mở đúng thùng.

Nút gửi thông báo thử chỉ kiểm tra thông báo trên thiết bị. Kiểm tra push bằng một cảnh báo mới sau khi đăng ký; cảnh báo đang bật từ trước không tự phát lại cho đăng ký mới. Xem [kịch bản thông báo](NOTIFICATIONS.md#verify).

<a id="updates"></a>
## 14. Sửa code, build lại và đổi máy

- Cùng ứng dụng: sửa code, chạy kiểm tra rồi build lại bằng profile preview; giữ project Expo, package Firebase và cấu hình ký hiện có.
- Thay cấu hình Firebase/native: build và cài APK mới.
- Thêm thiết bị mới: dùng đúng thông tin kết nối của thiết bị và thiết lập chiều cao một lần nếu chưa có. Thiết bị đã cấu hình không cho sửa chiều cao trong app.
- Clone sang máy mới: cài dependencies, tự tạo lại `.env` từ mẫu và lấy các file riêng của project từ nơi bạn lưu. EAS vẫn dùng cấu hình ký và FCM đã lưu trên tài khoản Expo.
- Người khác dùng Firebase/Expo riêng: làm lại phần tạo project và các biến môi trường cho project của họ, không dùng ID của người phát triển repo.

<a id="troubleshooting"></a>
## 15. Xử lý sự cố

| Hiện tượng | Kiểm tra |
| --- | --- |
| Expo Go không mở được app | SDK tương thích, cùng Wi-Fi; chạy `npm start -- --clear` nếu bundle cũ |
| LDPlayer không được tìm thấy | Bật ADB, đúng cổng, `adb devices` có thiết bị |
| App không nhận dữ liệu Wokwi | Tắt minh họa; broker, device ID và topic trùng firmware; simulator đang chạy |
| Mức đầy chưa có số | Thiết lập chiều cao, chờ ACK và lượt đo mới khi nắp đóng |
| CLI hỏi đăng nhập dù web đã đăng nhập | Web và CLI là hai phiên riêng; dùng login hoặc token ở phần 6 |
| EAS không nhận project | `EAS_PROJECT_ID` trong `.env` đúng; tài khoản CLI có quyền; biến preview cùng ID |
| Cloud build thiếu Firebase | Biến `GOOGLE_SERVICES_JSON` là file và đã chọn preview; không chỉ có file trên máy |
| Không tạo được bản cập nhật APK | Kiểm tra cùng application ID và cấu hình ký như bản đã cài |
| Backend dừng ngay lúc chạy | Điền mã kết nối ≥16 ký tự, danh sách thiết bị không rỗng và hai URL broker |
| App không đăng ký dịch vụ | URL HTTPS truy cập được từ điện thoại, mã kết nối đúng, ID/topic trong danh sách backend |
| Local có thông báo nhưng push chưa có | APK, FCM V1 đúng Firebase, backend có MQTT, đăng ký thành công, tạo cảnh báo mới |
| Đóng terminal thì không nhận push | Backend/tunnel đã dừng; cần giữ chạy hoặc triển khai trên máy chủ |

Android **Buộc dừng** có thể chặn nhận push cho đến khi mở lại app. Điện thoại tắt nguồn không hiển thị thông báo ngay. Sau thiết lập, kiểm tra đầy đủ theo [TEST_CASES.md](TEST_CASES.md).
