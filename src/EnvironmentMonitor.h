#pragma once
#include <math.h>
#include "Config.h"
class EnvironmentMonitor {
 public:
  static float fillFromDistance(float cm) {
    const float percent = 100.0f * (1.0f - cm / Config::binHeightCm);
    return percent < 0 ? 0 : (percent > 100 ? 100 : percent);
  }
  void updateTrash(bool valid, float cm, uint32_t now) {
    trashHasSample = true;
    trashAt = now;
    trashValid = valid && isfinite(cm) && cm >= 2.0f && cm <= 400.0f;
    if (!trashValid) return; // Preserve alarm on sensor failure.
    fill = fillFromDistance(cm);
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
};
