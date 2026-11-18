#pragma once
#include <Arduino.h>
#include "Config.h"

// Wokwi input only: the potentiometer represents 0..100%, not battery voltage.
// Replace this adapter with a calibrated voltage/fuel-gauge reader for real cells.
namespace BatteryInput {
inline void begin() { pinMode(Config::batteryPin, INPUT); }
inline int readPercent() {
  const int raw = analogRead(Config::batteryPin);
  return raw >= 0 && raw <= 4095 ? (raw * 100 + 2047) / 4095 : -1;
}
}
