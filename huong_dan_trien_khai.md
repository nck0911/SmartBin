# DỰ ÁN: THÙNG RÁC THÔNG MINH TÍCH HỢP IOT (ESP32 + WOKWI + PLATFORMIO)
*Dựa trên Đề tài 5 & Báo cáo Nhóm 10 - Tự động mở nắp, đo mức rác và cảnh báo khí hôi.*

Tài liệu này cung cấp hướng dẫn từng bước (Step-by-Step) để Agent hoặc Lập trình viên thiết lập môi trường, cấu hình file và chạy mô phỏng dự án hoàn chỉnh trên Visual Studio Code.

---

## PHẦN 1: CHUẨN BỊ MÔI TRƯỜNG LÀM VIỆC (VS CODE)
Để chạy được mô phỏng này, yêu cầu bắt buộc phải cài đặt 2 Extensions sau trong Visual Studio Code:
1. **PlatformIO IDE** (ID: `platformio.platformio-ide`): Dùng để quản lý framework Arduino, biên dịch code C++ cho ESP32.
2. **Wokwi Simulator** (ID: `Wokwi.wokwi-vscode`): Dùng để chạy mô phỏng mạch điện tử trực tiếp trong VS Code. (Yêu cầu phải lấy License Key miễn phí từ wokwi.com nếu được hỏi).

---

## PHẦN 2: KHỞI TẠO DỰ ÁN VÀ CẤU HÌNH PLATFORMIO

### Bước 1: Khởi tạo Project
1. Mở PlatformIO (Biểu tượng con kiến ở thanh sidebar VS Code).
2. Chọn **PIO Home** -> **Open**.
3. Chọn **New Project**:
   - **Name:** `Smart_Trash_Can_ESP32`
   - **Board:** `Espressif ESP32 Dev Module`
   - **Framework:** `Arduino`
   - **Location:** Chọn thư mục lưu trữ tùy ý.
4. Bấm **Finish** và đợi PIO tải các core cần thiết.

### Bước 2: Cấu hình `platformio.ini`
Mở file `platformio.ini` ở thư mục gốc của dự án và dán đè toàn bộ nội dung sau vào. Việc này giúp khai báo tốc độ Serial và tải thư viện Servo chuyên dụng cho ESP32.

```ini
[env:esp32dev]
platform = espressif32
board = esp32dev
framework = arduino
monitor_speed = 115200
lib_deps = 
	madhephaestus/ESP32Servo @ ^3.0.5
```

---

## PHẦN 3: LẬP TRÌNH MÃ NGUỒN C++ (TẦNG EDGE/XỬ LÝ)

Mở file `src/main.cpp`. Xóa nội dung cũ và dán toàn bộ mã nguồn sau vào. 
*Đặc tính mã nguồn: Hoàn toàn sử dụng `millis()` (non-blocking), tích hợp lọc nhiễu 0.5s khi mở nắp, tự đóng sau 3s và đọc ADC 12-bit cảnh báo mùi hôi.*

```cpp
#include <Arduino.h>
#include <ESP32Servo.h>

// ================= CẤU HÌNH CHÂN (PINOUT) =================
// 1. Cảm biến nhận diện tay (Bên ngoài)
#define TRIG_HAND 5
#define ECHO_HAND 18

// 2. Cảm biến đo mức rác (Bên trong)
#define TRIG_TRASH 12
#define ECHO_TRASH 14

// 3. Động cơ & Khí hôi
#define SERVO_PIN 13
#define MQ135_PIN 34 // Dùng biến trở giả lập trên Wokwi

// ================= THÔNG SỐ CÀI ĐẶT =================
#define DISTANCE_TO_OPEN 20.0     // Cự ly quơ tay mở nắp (cm)
#define TIME_TO_FILTER_OPEN 500   // Lọc nhiễu: Phải giữ tay 0.5s
#define TIME_TO_AUTO_CLOSE 3000   // Tự động đóng sau 3s khi rời tay

#define TRASH_BIN_HEIGHT 40.0     // Chiều cao thùng rác (cm)
#define TRASH_FULL_THRESHOLD 80.0 // Mức % rác báo đầy
#define GAS_DANGER_THRESHOLD 2000 // Ngưỡng báo khí hôi (ADC 12-bit: 0-4095)

// ================= BIẾN TOÀN CỤC =================
Servo trashServo;
bool isLidOpen = false;
uint32_t detectStartTime = 0;
uint32_t lastDetectTime = 0;
uint32_t lastEnvCheckTime = 0;

// ================= HÀM ĐO KHOẢNG CÁCH =================
float readUltrasonic(int trigPin, int echoPin) {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);
  long duration = pulseIn(echoPin, HIGH, 30000);
  if (duration == 0) return 400.0;
  return (duration * 0.0343) / 2.0;
}

void setup() {
  Serial.begin(115200);
  analogReadResolution(12); // ESP32 ADC 12-bit
  
  pinMode(TRIG_HAND, OUTPUT); pinMode(ECHO_HAND, INPUT);
  pinMode(TRIG_TRASH, OUTPUT); pinMode(ECHO_TRASH, INPUT);
  
  ESP32PWM::allocateTimer(0);
  trashServo.setPeriodHertz(50);
  trashServo.attach(SERVO_PIN, 500, 2400);
  trashServo.write(0); // Mặc định đóng
  Serial.println("Hệ thống Thùng Rác ESP32 đã khởi động!");
}

void loop() {
  uint32_t currentMillis = millis();

  // 1. TÁC VỤ: NHẬN DIỆN MỞ NẮP (Chạy liên tục)
  float handDist = readUltrasonic(TRIG_HAND, ECHO_HAND);
  
  if (handDist <= DISTANCE_TO_OPEN) {
    if (detectStartTime == 0) detectStartTime = currentMillis; // Bắt đầu phát hiện
    lastDetectTime = currentMillis; // Cập nhật thời điểm cuối thấy tay
    
    // Lọc nhiễu: Đứng đủ lâu mới mở
    if (!isLidOpen && (currentMillis - detectStartTime >= TIME_TO_FILTER_OPEN)) {
      trashServo.write(90); // Mở nắp 90 độ
      isLidOpen = true;
      Serial.println("=> MỞ NẮP");
    }
  } else {
    detectStartTime = 0; // Hủy lọc nhiễu nếu rút tay nhanh
  }

  // 2. TÁC VỤ: TỰ ĐỘNG ĐÓNG NẮP
  if (isLidOpen && (currentMillis - lastDetectTime >= TIME_TO_AUTO_CLOSE)) {
    trashServo.write(0); // Đóng nắp
    isLidOpen = false;
    Serial.println("=> ĐÓNG NẮP");
  }

  // 3. TÁC VỤ: KIỂM TRA MÔI TRƯỜNG (Chu kỳ 2 giây/lần)
  if (currentMillis - lastEnvCheckTime >= 2000) {
    lastEnvCheckTime = currentMillis;
    
    // Kiểm tra mức rác
    float trashDist = readUltrasonic(TRIG_TRASH, ECHO_TRASH);
    float fillPercent = 100.0 - ((trashDist / TRASH_BIN_HEIGHT) * 100.0);
    if (fillPercent > 100.0) fillPercent = 100.0;
    if (fillPercent < 0.0) fillPercent = 0.0;
    
    if (fillPercent >= TRASH_FULL_THRESHOLD) {
      Serial.printf("[CẢNH BÁO] Thùng rác ĐÃ ĐẦY! Mức hiện tại: %.1f%%\n", fillPercent);
    }

    // Kiểm tra khí hôi
    int gasLevel = analogRead(MQ135_PIN);
    if (gasLevel > GAS_DANGER_THRESHOLD) {
      Serial.printf("[CẢNH BÁO] KHÍ HÔI ĐỘC HẠI! (Mức: %d/4095)\n", gasLevel);
    }
  }
}
```

---

## PHẦN 4: THIẾT LẬP MẠCH MÔ PHỎNG WOKWI

Bạn cần tạo 2 file mới tại thư mục gốc của dự án (ngang hàng với `platformio.ini`).

### 1. Tạo file `wokwi.toml`
File này giúp Wokwi biết đường dẫn đến file thực thi (firmware) vừa được PlatformIO biên dịch.
```toml
[wokwi]
version = 1
firmware = ".pio/build/esp32dev/firmware.elf"
elf = ".pio/build/esp32dev/firmware.elf"
```

### 2. Tạo file `diagram.json`
Đây là sơ đồ đấu nối toàn bộ phần cứng. Agent chỉ cần tạo file `diagram.json` và chèn nội dung sau:
```json
{
  "version": 1,
  "author": "IoT System Engineer",
  "editor": "wokwi",
  "parts": [
    { "type": "board-esp32-devkit-v1", "id": "esp", "top": 0, "left": 0, "attrs": {} },
    { "type": "wokwi-hc-sr04", "id": "ultrasonic_hand", "top": -120, "left": -200, "attrs": { "distance": "50" } },
    { "type": "wokwi-hc-sr04", "id": "ultrasonic_trash", "top": 120, "left": -200, "attrs": { "distance": "35" } },
    { "type": "wokwi-servo", "id": "servo", "top": -100, "left": 150, "attrs": {} },
    { "type": "wokwi-potentiometer", "id": "pot_gas", "top": 150, "left": 150, "attrs": {} }
  ],
  "connections": [
    [ "esp:TX0", "$serialMonitor:RX", "", [] ],
    [ "esp:RX0", "$serialMonitor:TX", "", [] ],
    
    [ "esp:5V", "ultrasonic_hand:VCC", "red", [ "v0" ] ],
    [ "esp:GND", "ultrasonic_hand:GND", "black", [ "v0" ] ],
    [ "esp:D5", "ultrasonic_hand:TRIG", "green", [ "v0" ] ],
    [ "esp:D18", "ultrasonic_hand:ECHO", "blue", [ "v0" ] ],

    [ "esp:5V", "ultrasonic_trash:VCC", "red", [ "v0" ] ],
    [ "esp:GND", "ultrasonic_trash:GND", "black", [ "v0" ] ],
    [ "esp:D12", "ultrasonic_trash:TRIG", "green", [ "v0" ] ],
    [ "esp:D14", "ultrasonic_trash:ECHO", "blue", [ "v0" ] ],

    [ "esp:5V", "servo:V+", "red", [ "v0" ] ],
    [ "esp:GND", "servo:GND", "black", [ "v0" ] ],
    [ "esp:D13", "servo:PWM", "yellow", [ "v0" ] ],

    [ "esp:3V3", "pot_gas:VCC", "red", [ "v0" ] ],
    [ "esp:GND", "pot_gas:GND", "black", [ "v0" ] ],
    [ "esp:D34", "pot_gas:SIG", "purple", [ "v0" ] ]
  ]
}
```

---

## PHẦN 5: BIÊN DỊCH VÀ CHẠY MÔ PHỎNG

**BƯỚC QUAN TRỌNG DÀNH CHO AGENT:**
1. Mở Terminal trong VS Code, chạy lệnh `pio run` (hoặc bấm dấu Check `✓` ở thanh công cụ dưới cùng) để tiến hành Build source code.
2. Đảm bảo xuất hiện thông báo **SUCCESS** màu xanh lá. (File `firmware.elf` sẽ được tạo ra tại thư mục `.pio/build/esp32dev/`).
3. Nhấn phím `F1` (hoặc `Ctrl+Shift+P`), gõ và chọn lệnh: **`Wokwi: Start Simulator`**.
4. Wokwi sẽ mở một tab mới hiển thị Board ESP32 cùng các linh kiện.
5. **Cách kiểm thử (Testing):**
   - Click vào cảm biến HC-SR04 phía trên (`ultrasonic_hand`) và kéo thanh trượt xuống dưới 20cm. Chờ 0.5s, xem cánh Servo quay 90 độ. Kéo thanh trượt ra xa, đếm 3 giây cánh Servo sẽ quay về 0 độ.
   - Click vào cảm biến HC-SR04 phía dưới (`ultrasonic_trash`), kéo cự ly xuống thấp (< 8cm, tương đương đầy > 80%). Nhìn vào màn hình Serial Monitor để thấy cảnh báo "ĐÃ ĐẦY!".
   - Xoay núm vặn của Biến trở màu xám (`pot_gas`) lên quá mức giữa để giả lập nồng độ khí hôi. Xem Serial Monitor báo "KHÍ HÔI ĐỘC HẠI!".

*Chúc Agent thiết lập thành công!*