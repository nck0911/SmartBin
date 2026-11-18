#include <assert.h>
#include <math.h>
#include <stdio.h>
#include <initializer_list>
#include "LidController.h"
#include "EnvironmentMonitor.h"
#include "BatteryMonitor.h"

void quickGestureAndBoundary() {
  LidController lid;
  assert(!lid.isOpen());
  lid.update(0, true, 20);
  lid.update(300, true, 50);
  assert(lid.state() == LidState::Closed);
  lid.update(400, true, 20);
  lid.update(899, true, 20);
  assert(!lid.isOpen());
  assert(lid.update(900, true, 20));
  assert(lid.isOpen());
  lid.update(8000, true, 10);
  assert(lid.isOpen()); // Staying present never starts closing.
}
void closeAndReturn() {
  LidController lid;
  lid.update(0, true, 10);
  lid.update(500, true, 10);
  lid.update(3499, true, 50);
  assert(lid.isOpen());
  lid.update(3499, true, 10); // Return just before close deadline.
  lid.update(6498, true, 50);
  assert(lid.isOpen());
  assert(lid.update(6499, true, 50));
  assert(!lid.isOpen());
}
void sensorFailure() {
  LidController lid;
  lid.update(0, true, 10);
  lid.update(499, false, 0); // Break confirmation.
  lid.update(500, true, 10);
  lid.update(999, true, 10);
  assert(!lid.isOpen());
  lid.update(1000, true, 10);
  lid.update(10000, false, 0);
  assert(lid.isOpen()); // A missing echo is not a clear hand region.
  lid.update(12999, true, 50);
  assert(lid.isOpen());
  lid.update(13000, true, 50);
  assert(!lid.isOpen());
}
void rollover() {
  LidController lid;
  const uint32_t base = UINT32_MAX - 250;
  lid.update(base, true, 20);
  lid.update(base + uint32_t(499), true, 20);
  assert(!lid.isOpen());
  lid.update(base + uint32_t(500), true, 20);
  assert(lid.isOpen());
  lid.update(base + uint32_t(3499), true, 50);
  assert(lid.isOpen());
  lid.update(base + uint32_t(3500), true, 50);
  assert(!lid.isOpen());
}
void environmentAlarms() {
  EnvironmentMonitor e;
  assert(!e.trashHasSample && !e.gasHasSample);
  e.updateTrash(true, 5, 0);
  assert(!e.configured() && !e.full);
  assert(e.setHeight(450));
  for (const auto cm : {45.0f, 25.0f, 13.0f, 5.0f}) {
    e.updateTrash(true, cm, 100);
    assert(fabs(e.fill - (112.5f - 2.5f * cm)) < 0.001f);
    assert(e.full == (cm <= 13.0f));
  }
  assert(e.full);
  e.updateTrash(true, 13.4f, 200); // 79% must not clear a full alarm.
  assert(e.full);
  e.updateTrash(false, 400, 300);
  assert(!e.trashValid && e.full); // Failure cannot invent an empty bin.
  e.updateTrash(true, NAN, 400);
  assert(!e.trashValid && e.full);
  e.updateTrash(true, 15, 500);
  assert(!e.full && e.trashValid);
  e.updateGas(2000, 100);
  assert(!e.gasHigh);
  e.updateGas(2001, 200);
  assert(e.gasHigh && !e.full); // Independent alarm with low fill.
  e.updateTrash(true, 4, 600);
  assert(e.gasHigh && e.full);
  e.updateGas(1801, 300);
  assert(e.gasHigh);
  e.updateGas(1800, 400);
  assert(!e.gasHigh && e.full);
  assert(EnvironmentMonitor::fillFromDistance(100, 45) == 0);
  assert(EnvironmentMonitor::fillFromDistance(2, 45) == 100);
  assert(isnan(EnvironmentMonitor::fillFromDistance(10, 5)));
  assert(isnan(EnvironmentMonitor::fillFromDistance(NAN, 45)));
  assert(!e.setHeight(50) && e.heightMm == 450 && e.full);
  assert(!e.setHeight(4001));
  assert(e.setHeight(1000));
  assert(!e.full && !e.trashHasSample && !e.trashValid);
  e.updateTrash(true, 25, 700);
  assert(fabs(e.fill - 100.0f * 75 / 95) < 0.001f);
  assert(e.setHeight(1000) && e.trashValid); // Same height does not invalidate a reading.
}
void settingsProtocol() {
  BinSettings::Request request;
  const char* valid = "app-1_2:123:15000:450";
  assert(BinSettings::parse(reinterpret_cast<const uint8_t*>(valid), strlen(valid), request));
  assert(strcmp(request.id, "app-1_2") == 0 && request.heightMm == 450);
  assert(BinSettings::current(request, 123, 1000));
  assert(!BinSettings::current(request, 124, 1000));
  assert(!BinSettings::current(request, 123, 15000));
  assert(!BinSettings::current(request, 123, 16000));
  request.deadline = 500;
  assert(BinSettings::current(request, 123, UINT32_MAX - 500));
  for (const char* invalid : {"", ":1:2:450", "a:1:2:-450", "a:1:2:450x", "a:1:2:450:1",
      "a:1:2:4294967296", "a:1:2:", "a:1:2:45.0", "a\":1:2:450"}) {
    assert(!BinSettings::parse(reinterpret_cast<const uint8_t*>(invalid), strlen(invalid), request));
  }
  assert(BinSettings::validHeight(100));
  assert(BinSettings::validHeight(4000));
  assert(!BinSettings::validHeight(0));
  assert(!BinSettings::validHeight(99));
}
void batteryAlarms() {
  BatteryMonitor battery;
  assert(!battery.valid && !battery.low && !battery.critical);
  battery.update(100);
  assert(battery.valid && battery.percent == 100 && !battery.low);
  battery.update(20);
  assert(battery.low && !battery.critical);
  battery.update(24);
  assert(battery.low);
  battery.update(25);
  assert(!battery.low);
  battery.update(10);
  assert(battery.low && battery.critical);
  battery.update(14);
  assert(battery.critical);
  battery.update(15);
  assert(battery.low && !battery.critical);
  battery.update(0);
  assert(battery.valid && battery.low && battery.critical);
  battery.update(-1);
  assert(!battery.valid && battery.low && battery.critical);
  battery.update(101);
  assert(!battery.valid);
  battery.update(100);
  assert(battery.valid && !battery.low && !battery.critical);
}
int main() {
  quickGestureAndBoundary();
  closeAndReturn();
  sensorFailure();
  rollover();
  environmentAlarms();
  settingsProtocol();
  batteryAlarms();
  puts("PASS: 7 scenario groups (lid timing, return, failure, rollover, bin height/alarms, settings protocol, battery alarms)");
}
