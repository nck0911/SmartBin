# Chạy đồng thời 3 thùng rác

Ba thùng dùng chung code cảm biến và MQTT; mỗi firmware có mã thiết bị và topic riêng.
Các mã thiết bị và topic dùng tiền tố SmartBin; build lại firmware và dùng bộ QR SmartBin mới khi chuyển từ hệ thống tên cũ.

| Thùng | Mã thiết bị | Chiều cao trong QR | Khoảng cách mặt rác ban đầu | Biến trở mùi |
|---|---|---|---|---|
| 1 | `smartbin-7c91a2-01` | 45 cm | 35 cm, khoảng 25% đầy | 0, thấp |
| 2 | `smartbin-7c91a2-02` | 60 cm | 10 cm, khoảng 91% đầy | 0, thấp |
| 3 | `smartbin-7c91a2-03` | 80 cm | 40 cm, khoảng 53% đầy | 800/1023, cao |

Mức đầy chỉ xuất hiện sau khi xác nhận chiều cao trên mạch và cảm biến cập nhật khi nắp đóng.
Các giá trị ban đầu phục vụ minh họa; có thể chỉnh cảm biến riêng trong từng cửa sổ.

## Build một lần

Tại thư mục gốc dự án, chạy trong PlatformIO terminal:

```powershell
pio run -e bin-1 -e bin-2 -e bin-3
```

Firmware nằm trong `.pio/build/bin-1`, `bin-2`, `bin-3`. Lệnh `pio run` thông thường vẫn build `esp32dev` như trước.
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
2. Trong app, tắt **Chế độ minh họa**, chọn **Quét QR**, kiểm tra thông tin rồi **Lưu thay đổi**.
3. Mở chi tiết thùng → **Thiết lập**. Chiều cao từ QR đã được điền sẵn; kiểm tra rồi xác nhận lưu.
4. Chờ mạch xác nhận và gửi số liệu mới. Chiều cao lưu trên mạch mới là giá trị dùng để tính phần trăm đầy.

QR chứa `heightCm` (cm, từ 10 đến 400, tối đa một chữ số thập phân). Không tự gửi thiết lập khi quét.
Nếu thùng đã có chiều cao, QR không ghi đè cấu hình đó. Quét lại QR của thùng đã lưu sẽ cập nhật thông tin chiều cao gợi ý và mở chi tiết, không tạo bản sao.
QR SmartBin không có chiều cao vẫn được nhận và có thể nhập số đo thủ công. QR của hệ thống trước khi đổi tên cần thay bằng bộ mã mới.
Tắt/mở mô phỏng vẫn dùng cùng QR; nếu trạng thái lưu trữ của mô phỏng được đặt lại thì xác nhận lại thiết lập bằng số đo sẵn trong QR.

App cài đặt cần build lại vì chức năng quét sử dụng `expo-camera`. Kiểm tra camera và luồng MQTT trên điện thoại thật sau khi build.
