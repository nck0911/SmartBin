#pragma once
#include <Arduino.h>
#include "BinSettings.h"
struct Snapshot {
  uint32_t uptime = 0, sequence = 0;
  bool lidOpen = false, full = false, gasHigh = false;
  bool handValid = false, trashValid = false, trashStale = true, gasValid = false;
  bool handHasSample = false, trashHasSample = false;
  float handCm = 0, fill = 0;
  int gas = 0;
  uint32_t handAge = 0, trashAge = 0;
  uint16_t heightMm = 0;
};
namespace Telemetry {
uint16_t loadHeight();
bool begin();
void update(const Snapshot& snapshot, bool event);
bool takeSettings(BinSettings::Request& request);
void settingsApplied(const BinSettings::Request& request);
}
