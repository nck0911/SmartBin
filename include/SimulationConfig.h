#pragma once
// Included after Secrets.h / Secrets.example.h. Wi-Fi and broker remain shared.
// Only the explicit simulation build environments override the device identity.
#if defined(SIMULATION_BIN)
#undef DEVICE_ID
#undef MQTT_TOPIC_ROOT
#if SIMULATION_BIN == 1
#define DEVICE_ID "smartbin-7c91a2-01"
#define MQTT_TOPIC_ROOT "smartbin/bins/smartbin-7c91a2-01"
#elif SIMULATION_BIN == 2
#define DEVICE_ID "smartbin-7c91a2-02"
#define MQTT_TOPIC_ROOT "smartbin/bins/smartbin-7c91a2-02"
#elif SIMULATION_BIN == 3
#define DEVICE_ID "smartbin-7c91a2-03"
#define MQTT_TOPIC_ROOT "smartbin/bins/smartbin-7c91a2-03"
#else
#error "SIMULATION_BIN must be 1, 2, or 3"
#endif
#endif
