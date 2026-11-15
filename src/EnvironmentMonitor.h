#pragma once
#include <math.h>
#include "Config.h"
#include "BinSettings.h"
class EnvironmentMonitor {
 public:
  static float fillFromDistance(float cm, float heightCm) {
    const float emptyCm = heightCm - Config::sensorOffsetCm;
    if (!isfinite(cm) || !isfinite(heightCm) || emptyCm <= Config::fullDistanceCm) return NAN;
    const float percent = 100.0f * (emptyCm - cm) / (emptyCm - Config::fullDistanceCm);
    return percent < 0 ? 0 : (percent > 100 ? 100 : percent);
  }
  bool setHeight(uint32_t mm) {
    if (!BinSettings::validHeight(mm)) return false;
    if (heightMm == mm) return true;
    heightMm = mm;
    // A sample taken using the previous bin dimensions must not be reused.
    trashHasSample = trashValid = full = false;
    fill = 0;
    return true;
  }
  bool configured() const { return BinSettings::validHeight(heightMm); }
  void updateTrash(bool valid, float cm, uint32_t now) {
    trashHasSample = true;
    trashAt = now;
    trashValid = valid && isfinite(cm) && cm >= 2.0f && cm <= 400.0f;
    if (!trashValid) return; // Preserve alarm on sensor failure.
    if (!configured()) return;
    fill = fillFromDistance(cm, heightMm / 10.0f);
    if (fill >= Config::fullOn) full = true;
    else if (fill <= Config::fullOff) full = false;
  }
  void updateGas(int adc, uint32_t now) {
    gas = adc;
    gasAt = now;
    gasHasSample = true;
    if (adc > Config::gasOn) gasHigh = true;
    else if (adc <= Config::gasOff) gasHigh = false;
  }
  bool full = false, gasHigh = false;
  bool trashValid = false, trashHasSample = false, gasHasSample = false;
  uint32_t trashAt = 0, gasAt = 0;
  float fill = 0;
  int gas = 0;
  uint16_t heightMm = 0;
};
