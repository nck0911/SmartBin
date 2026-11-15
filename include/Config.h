#pragma once
#include <stdint.h>
namespace Config {
constexpr uint8_t handTrig = 5, handEcho = 18;
constexpr uint8_t trashTrig = 12, trashEcho = 14;
constexpr uint8_t servoPin = 13, gasPin = 34;
constexpr float handThresholdCm = 20.0f;
constexpr float fullDistanceCm = 5.0f;
// Distance the sensing face protrudes below the underside of the closed lid.
// Zero assumes a flush mount; set to the measured offset for the hardware mount.
constexpr float sensorOffsetCm = 0.0f;
constexpr uint16_t minBinHeightMm = 100, maxBinHeightMm = 4000;
constexpr float fullOn = 80.0f, fullOff = 75.0f;
constexpr int gasOn = 2000, gasOff = 1800;
constexpr uint32_t confirmMs = 500, closeMs = 3000;
constexpr uint32_t sensorGapMs = 60, echoTimeoutUs = 30000;
constexpr uint32_t handFreshMs = 250, trashFreshMs = 5000;
constexpr uint32_t environmentMs = 2000, gasMs = 100, settleMs = 500;
constexpr uint32_t telemetryMs = 2000;
constexpr uint16_t servoClosedUs = 500, servoOpenUs = 1450;
}
