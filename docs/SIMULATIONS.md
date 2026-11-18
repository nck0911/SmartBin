# Chạy đồng thời 3 thùng rác

Ba thùng dùng chung code cảm biến và MQTT; mỗi firmware có mã thiết bị và topic riêng.
Các mã thiết bị và topic dùng tiền tố SmartBin; build lại firmware và dùng bộ QR SmartBin mới khi chuyển từ hệ thống tên cũ.

| Thùng | Mã thiết bị | Chiều cao trong QR | Khoảng cách mặt rác ban đầu | Biến trở mùi |
|---|---|---|---|---|
| 1 | `smartbin-7c91a2-01` | 45 cm | 35 cm, khoảng 25% đầy | 0, thấp |
| 2 | `smartbin-7c91a2-02` | 60 cm | 10 cm, khoảng 91% đầy | 0, thấp |
| 3 | `smartbin-7c91a2-03` | 80 cm | 40 cm, khoảng 53% đầy | 800/1023, cao |

Mức đầy xuất hiện sau khi app tự đồng bộ chiều cao hệ thống xuống mạch chưa thiết lập và cảm biến cập nhật khi nắp đóng.
Các giá trị ban đầu phục vụ minh họa; có thể chỉnh cảm biến riêng trong từng cửa sổ.

## Build một lần

Tại thư mục gốc dự án, chạy trong PlatformIO terminal:

```powershell
pio run -e bin-1 -e bin-2 -e bin-3
```

Firmware nằm trong `.pio/build/bin-1`, `bin-2`, `bin-3`. Lệnh `pio run` thông thường vẫn build `esp32dev` như trước.
Nếu Wokwi báo `firmware binary ../../.pio/build/bin-1/firmware.bin not found in workspace`, kiểm tra build đã thành công. Wokwi không tự biên dịch firmware. Chạy lệnh build trên tại thư mục gốc, không chạy trong `simulations/bin-*`, rồi mở lại simulator.
`include/SimulationConfig.h` chỉ đổi ID/topic khi chọn một trong ba cấu hình trên; Wi-Fi và broker vẫn lấy từ `Secrets.h` hoặc `Secrets.example.h`.

## Mở ba phiên mô phỏng

Mở từng thư mục dưới đây trong **một cửa sổ VS Code riêng** bằng File → New Window → Open Folder:

- `simulations/bin-1`
- `simulations/bin-2`
- `simulations/bin-3`

Trong từng cửa sổ, chạy **Wokwi: Start Simulator**. Mỗi thư mục có `diagram.json` và `wokwi.toml` trỏ về firmware riêng đã build ở thư mục gốc.
Không cần sao chép source hoặc build trong các thư mục mô phỏng. Cách đặt đường dẫn firmware tương đối tuân theo [cấu hình Wokwi](https://docs.wokwi.com/vscode/project-config).
Nếu dùng Wokwi trên trình duyệt, mỗi project/tab cần nạp đúng firmware tương ứng; mở ba bản của firmware thùng 1 sẽ gây trùng thiết bị.
Khi thùng 1 chạy ở thư mục con, dừng phiên chạy ở thư mục gốc nếu đang dùng cùng ID.

## Quét QR và chiều cao

1. Mở [trang QR của cả ba thùng](qr/index.html) trên máy tính; mã SVG có thể in và dùng lại.
2. Giữ backend chạy, chọn **+ Thêm thùng rác → Quét QR**, sửa tên/vị trí rồi **Lưu thông tin**.
3. Backend trả chiều cao chuẩn 45/60/80 cm từ `DEVICES_JSON`; app hiển thị trong chi tiết và tự đồng bộ khi mạch online, có dữ liệu mới và chưa thiết lập.
4. Chờ mạch xác nhận và gửi số liệu mới để xem phần trăm đầy. Không cần nhập lại chiều cao.

QR có thể chứa `heightCm`, nhưng chiều cao chính thức luôn lấy từ backend. Thiết bị đã có chiều cao không bị ghi đè. Quét lại thùng đã lưu sẽ lấy lại chiều cao hệ thống và mở chi tiết, không tạo bản sao.
QR của hệ thống trước khi đổi tên cần thay bằng bộ mã mới. Nếu trạng thái lưu trữ mô phỏng bị đặt lại, app tự đồng bộ lại chiều cao khi nhận được dữ liệu mới.

App cài đặt cần build lại vì chức năng quét sử dụng `expo-camera`. Kiểm tra camera và luồng MQTT trên điện thoại thật sau khi build.
