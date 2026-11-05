#include "UltrasonicSensor.h"
#include <driver/gpio.h>
void UltrasonicSensor::begin() {
  pinMode(trig_, OUTPUT);
  digitalWrite(trig_, LOW);
  pinMode(echo_, INPUT);
  attachInterruptArg(echo_, onEdge, this, CHANGE);
}
void IRAM_ATTR UltrasonicSensor::onEdge(void* arg) {
  auto* sensor = static_cast<UltrasonicSensor*>(arg);
  const uint32_t now = micros();
  const bool high = gpio_get_level(static_cast<gpio_num_t>(sensor->echo_));
  portENTER_CRITICAL_ISR(&sensor->mux_);
  if (sensor->armed_) {
    if (high && !sensor->rose_) {
      sensor->riseUs_ = now;
      sensor->rose_ = true;
    } else if (!high && sensor->rose_) {
      sensor->widthUs_ = now - sensor->riseUs_;
      sensor->done_ = true;
      sensor->armed_ = false;
    }
  }
  portEXIT_CRITICAL_ISR(&sensor->mux_);
}
void UltrasonicSensor::start() {
  if (busy_) return;
  portENTER_CRITICAL(&mux_);
  rose_ = done_ = false;
  armed_ = true;
  portEXIT_CRITICAL(&mux_);
  startedUs_ = micros();
  busy_ = true;
  // Only the fixed 12-us trigger pulse waits; echo capture is asynchronous.
  digitalWrite(trig_, LOW);
  delayMicroseconds(2);
  digitalWrite(trig_, HIGH);
  delayMicroseconds(10);
  digitalWrite(trig_, LOW);
}
bool UltrasonicSensor::poll(uint32_t now) {
  if (!busy_) return false;
  portENTER_CRITICAL(&mux_);
  const bool done = done_;
  const uint32_t width = widthUs_;
  const bool timeout = uint32_t(micros() - startedUs_) >= Config::echoTimeoutUs;
  if (done || timeout) armed_ = false;
  portEXIT_CRITICAL(&mux_);
  if (!done && !timeout) return false;
  busy_ = false;
  hasSample = true;
  sampledAt = now;
  cm = done ? width * 0.0343f / 2.0f : 0;
  valid = done && cm >= 2.0f && cm <= 400.0f;
  return true;
}
