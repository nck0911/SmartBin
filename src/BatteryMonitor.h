#pragma once
#include "Config.h"

class BatteryMonitor {
 public:
  void update(int value) {
    valid = value >= 0 && value <= 100;
    if (!valid) return; // An invalid reading must not rearm an existing alert.
    percent = value;
    if (percent <= Config::batteryLowOn) low = true;
    else if (percent >= Config::batteryLowOff) low = false;
    if (percent <= Config::batteryCriticalOn) critical = true;
    else if (percent >= Config::batteryCriticalOff) critical = false;
  }
  bool valid = false, low = false, critical = false;
  int percent = 0;
};
