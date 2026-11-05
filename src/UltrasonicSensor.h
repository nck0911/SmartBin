#pragma once
#include <Arduino.h>
#include "Config.h"
class UltrasonicSensor {
 public:
  UltrasonicSensor(uint8_t trig, uint8_t echo) : trig_(trig), echo_(echo) {}
  void begin();
  void start();
  bool poll(uint32_t now);
  bool busy() const { return busy_; }
  bool valid = false, hasSample = false;
  float cm = 0;
  uint32_t sampledAt = 0;
 private:
  static void IRAM_ATTR onEdge(void* arg);
  uint8_t trig_, echo_;
  bool busy_ = false;
  uint32_t startedUs_ = 0;
  portMUX_TYPE mux_ = portMUX_INITIALIZER_UNLOCKED;
  volatile bool armed_ = false, rose_ = false, done_ = false;
  volatile uint32_t riseUs_ = 0, widthUs_ = 0;
};
