#pragma once
#include "Config.h"
enum class LidState { Closed, Confirming, Open, WaitingToClose };
// Pure logic. Output is a command, not feedback about physical position.
class LidController {
 public:
  bool update(uint32_t now, bool valid, float distance) {
    const bool wasOpen = isOpen();
    if (!valid) {
      state_ = wasOpen ? LidState::Open : LidState::Closed;
      lastSeen_ = now; // Unknown distance must never trigger a close.
      return false;
    }
    if (distance <= Config::handThresholdCm) {
      lastSeen_ = now;
      if (state_ == LidState::Closed) {
        state_ = LidState::Confirming;
        confirmSince_ = now;
      } else if (state_ == LidState::Confirming &&
                 uint32_t(now - confirmSince_) >= Config::confirmMs) {
        state_ = LidState::Open;
      } else if (wasOpen) state_ = LidState::Open;
    } else if (wasOpen) {
      state_ = LidState::WaitingToClose;
      if (uint32_t(now - lastSeen_) >= Config::closeMs) state_ = LidState::Closed;
    } else state_ = LidState::Closed;
    return wasOpen != isOpen();
  }
  bool isOpen() const {
    return state_ == LidState::Open || state_ == LidState::WaitingToClose;
  }
  LidState state() const { return state_; }
 private:
  LidState state_ = LidState::Closed;
  uint32_t confirmSince_ = 0, lastSeen_ = 0;
};
