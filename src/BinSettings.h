#pragma once
#include <stddef.h>
#include <stdint.h>
#include <string.h>
#include "Config.h"

namespace BinSettings {
inline bool validHeight(uint32_t mm) {
  return mm >= Config::minBinHeightMm && mm <= Config::maxBinHeightMm &&
         mm / 10.0f - Config::sensorOffsetCm > Config::fullDistanceCm;
}
struct Request {
  char id[49] = {};
  uint32_t session = 0, deadline = 0, heightMm = 0;
};
// Compact wire format: request_id:session:deadline_uptime_ms:height_mm.
// Bounded parsing avoids allocation in the MQTT task. No signs or trailing data.
inline bool parse(const uint8_t* payload, size_t length, Request& result) {
  if (!payload || length == 0 || length > 90) return false;
  Request parsed;
  size_t cursor = 0;
  while (cursor < length && payload[cursor] != ':') {
    const char c = payload[cursor];
    if (cursor >= sizeof(parsed.id) - 1 ||
        !((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') ||
          (c >= '0' && c <= '9') || c == '-' || c == '_')) return false;
    parsed.id[cursor++] = c;
  }
  if (cursor == 0 || cursor >= length) return false;
  ++cursor;
  uint32_t* fields[] = {&parsed.session, &parsed.deadline, &parsed.heightMm};
  for (size_t field = 0; field < 3; ++field) {
    const size_t start = cursor;
    uint32_t number = 0;
    while (cursor < length && payload[cursor] != ':') {
      const uint8_t digit = payload[cursor++] - '0';
      if (digit > 9 || number > (UINT32_MAX - digit) / 10) return false;
      number = number * 10 + digit;
    }
    if (cursor == start) return false;
    *fields[field] = number;
    if (field < 2) {
      if (cursor >= length) return false;
      ++cursor;
    } else if (cursor != length) return false;
  }
  result = parsed;
  return true;
}
inline bool current(const Request& request, uint32_t session, uint32_t now) {
  const uint32_t remaining = request.deadline - now;
  return request.session == session && remaining > 0 && remaining <= 20000;
}
}
