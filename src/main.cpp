#include <Arduino.h>
#include "Config.h"
#include "LidController.h"
#include "EnvironmentMonitor.h"
#include "UltrasonicSensor.h"
#include "Telemetry.h"
#include "BatteryInput.h"
#include "BatteryMonitor.h"
namespace {
UltrasonicSensor hand(Config::handTrig, Config::handEcho);
UltrasonicSensor trash(Config::trashTrig, Config::trashEcho);
LidController lid;
EnvironmentMonitor environment;
BatteryMonitor battery;
uint32_t lastBattery = 0;
bool batterySampled = false;
constexpr uint8_t servoChannel = 0;
uint32_t lastTrigger = 0, lastTrash = 0, lastGas = 0, closedAt = 0;
uint32_t lastLog = 0, sequence = 0;
bool firstTrigger = true, telemetryReady = false, trashRefreshNeeded = true;
void commandServo(bool open) {
  // Built-in Arduino-ESP32 2.x LEDC: 50 Hz, 16-bit PWM.
  const uint32_t pulseUs = open ? Config::servoOpenUs : Config::servoClosedUs;
  ledcWrite(servoChannel, pulseUs * 65535UL / 20000UL);
}
}
void setup() {
  Serial.begin(115200);
  analogReadResolution(12);
  pinMode(Config::gasPin, INPUT);
  BatteryInput::begin();
  ledcSetup(servoChannel, 50, 16);
  ledcAttachPin(Config::servoPin, servoChannel);
  commandServo(false);
  hand.begin();
  trash.begin();
  environment.setHeight(Telemetry::loadHeight());
  closedAt = millis();
  telemetryReady = Telemetry::begin();
  Serial.println("[BOOT] SmartBin Nhom 10: local control + independent MQTT task");
  if (!telemetryReady) Serial.println("[FAULT] Network task unavailable; local control active");
}
void loop() {
  const uint32_t now = millis();
  BinSettings::Request settings;
  const bool settingsChanged = telemetryReady && Telemetry::takeSettings(settings);
  if (settingsChanged) {
    environment.setHeight(settings.heightMm);
    trashRefreshNeeded = true;
    closedAt = now;
    Telemetry::settingsApplied(settings);
  }
  hand.poll(now);
  const bool trashDone = trash.poll(now);
  const bool fullBefore = environment.full, gasBefore = environment.gasHigh;
  const bool batteryLowBefore = battery.low, batteryCriticalBefore = battery.critical;
  const bool batteryValidBefore = battery.valid;
  if (!batterySampled || uint32_t(now - lastBattery) >= Config::batteryMs) {
    batterySampled = true;
    lastBattery = now;
    battery.update(BatteryInput::readPercent());
  }
  const bool handValid = hand.hasSample && hand.valid &&
                         uint32_t(now - hand.sampledAt) <= Config::handFreshMs;
  const bool lidChanged = lid.update(now, handValid, hand.cm);
  if (lidChanged) {
    trashRefreshNeeded = true;
    commandServo(lid.isOpen());
    if (!lid.isOpen()) closedAt = now;
    Serial.printf("[LID %lu] %s\n", (unsigned long)now, lid.isOpen() ? "OPEN" : "CLOSED");
  }
  const bool settled = !lid.isOpen() && uint32_t(now - closedAt) >= Config::settleMs;
  if (trashDone && settled) {
    environment.updateTrash(trash.valid, trash.cm, now);
    trashRefreshNeeded = false;
  }
  if (uint32_t(now - lastGas) >= Config::gasMs) {
    lastGas = now;
    environment.updateGas(analogRead(Config::gasPin), now);
  }
  // One trigger at a time with >=60 ms acoustic gap, including on timeout.
  if (!hand.busy() && !trash.busy() &&
      (firstTrigger || uint32_t(now - lastTrigger) >= Config::sensorGapMs)) {
    firstTrigger = false;
    lastTrigger = now;
    if (settled && uint32_t(now - lastTrash) >= Config::environmentMs) {
      lastTrash = now;
      trash.start();
    } else hand.start();
  }
  const bool alarmChanged = fullBefore != environment.full || gasBefore != environment.gasHigh;
  Snapshot s;
  s.uptime = now;
  s.lidOpen = lid.isOpen();
  s.handHasSample = hand.hasSample;
  s.handValid = handValid;
  s.handCm = hand.cm;
  s.handAge = now - hand.sampledAt;
  s.trashHasSample = environment.trashHasSample;
  s.trashValid = environment.trashValid;
  s.trashAge = now - environment.trashAt;
  s.trashStale = trashRefreshNeeded || !settled || !s.trashHasSample ||
                 !s.trashValid || s.trashAge > Config::trashFreshMs;
  s.fill = environment.fill;
  s.gas = environment.gas;
  s.gasValid = environment.gasHasSample;
  s.full = environment.full;
  s.gasHigh = environment.gasHigh;
  s.heightMm = environment.heightMm;
  s.batteryPercent = battery.percent;
  s.batteryValid = battery.valid;
  s.batteryLow = battery.low;
  s.batteryCritical = battery.critical;
  static bool oldHandValid = false, oldTrashValid = false, oldStale = true;
  const bool event = settingsChanged || lidChanged || alarmChanged || s.handValid != oldHandValid ||
                     s.trashValid != oldTrashValid || s.trashStale != oldStale ||
                     batteryLowBefore != battery.low || batteryCriticalBefore != battery.critical || batteryValidBefore != battery.valid;
  oldHandValid = s.handValid;
  oldTrashValid = s.trashValid;
  oldStale = s.trashStale;
  if (event) ++sequence;
  s.sequence = sequence;
  if (telemetryReady) Telemetry::update(s, event);
  if (event || uint32_t(now - lastLog) >= Config::telemetryMs) {
    lastLog = now;
    char fillLabel[24] = "unknown";
    if (environment.configured() && s.trashValid) snprintf(fillLabel, sizeof(fillLabel), "%.1f%%", s.fill);
    Serial.printf("[STATE %lu] lid=%s hand=%s fill=%s valid=%d stale=%d gas=%d full=%d gas_high=%d height_mm=%u\n",
      (unsigned long)now, s.lidOpen ? "open" : "closed", s.handValid ? "ok" : "unknown",
      fillLabel, s.trashValid, s.trashStale, s.gas, s.full, s.gasHigh, unsigned(s.heightMm));
  }
  delay(1); // RTOS yield; no echo or network waits in the control loop.
}
