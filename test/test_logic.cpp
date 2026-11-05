#include <assert.h>
#include <math.h>
#include <stdio.h>
#include <initializer_list>
#include "LidController.h"
#include "EnvironmentMonitor.h"

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
  for (const auto cm : {40.0f, 20.0f, 8.0f, 4.0f}) {
    e.updateTrash(true, cm, 100);
    assert(fabs(e.fill - (100 - 2.5f * cm)) < 0.001f);
    assert(e.full == (cm <= 8.0f));
  }
  assert(e.full);
  e.updateTrash(true, 8.4f, 200); // 79% must not clear a full alarm.
  assert(e.full);
  e.updateTrash(false, 400, 300);
  assert(!e.trashValid && e.full); // Failure cannot invent an empty bin.
  e.updateTrash(true, NAN, 400);
  assert(!e.trashValid && e.full);
  e.updateTrash(true, 10, 500);
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
  assert(EnvironmentMonitor::fillFromDistance(100) == 0);
  assert(EnvironmentMonitor::fillFromDistance(-1) == 100);
}
int main() {
  quickGestureAndBoundary();
  closeAndReturn();
  sensorFailure();
  rollover();
  environmentAlarms();
  puts("PASS: 5 scenario groups (lid timing, return, failure, rollover, independent alarms)");
}
