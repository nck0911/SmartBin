#include "Telemetry.h"
#include "Config.h"
#include <WiFi.h>
#include <PubSubClient.h>
#if __has_include("Secrets.h")
#include "Secrets.h"
#else
#include "Secrets.example.h"
#endif
namespace {
QueueHandle_t snapshots;
QueueHandle_t events;
WiFiClient socketClient;
PubSubClient mqtt(socketClient);
constexpr char stateTopic[] = MQTT_TOPIC_ROOT "/state";
constexpr char eventTopic[] = MQTT_TOPIC_ROOT "/events";
constexpr char availabilityTopic[] = MQTT_TOPIC_ROOT "/availability";
bool publishSnapshot(const char* topic, const Snapshot& s, bool retained) {
  char hand[24] = "null", fill[24] = "null", gas[16] = "null";
  char handAge[16] = "null", trashAge[16] = "null";
  if (s.handValid) snprintf(hand, sizeof(hand), "%.1f", s.handCm);
  if (s.trashValid) snprintf(fill, sizeof(fill), "%.1f", s.fill);
  if (s.gasValid) snprintf(gas, sizeof(gas), "%d", s.gas);
  if (s.handHasSample) snprintf(handAge, sizeof(handAge), "%lu", (unsigned long)s.handAge);
  if (s.trashHasSample) snprintf(trashAge, sizeof(trashAge), "%lu", (unsigned long)s.trashAge);
  char payload[768];
  const int size = snprintf(payload, sizeof(payload),
      "{\"schema\":1,\"device_id\":\"%s\",\"sequence\":%lu,\"uptime_ms\":%lu,"
      "\"lid_command\":\"%s\",\"hand_cm\":%s,\"hand_valid\":%s,\"hand_age_ms\":%s,"
      "\"fill_percent\":%s,\"trash_valid\":%s,\"trash_stale\":%s,\"trash_age_ms\":%s,"
      "\"gas_adc\":%s,\"gas_valid\":%s,\"full\":%s,\"gas_high\":%s}",
      DEVICE_ID, (unsigned long)s.sequence, (unsigned long)s.uptime,
      s.lidOpen ? "open" : "closed", hand, s.handValid ? "true" : "false", handAge,
      fill, s.trashValid ? "true" : "false", s.trashStale ? "true" : "false", trashAge,
      gas, s.gasValid ? "true" : "false", s.full ? "true" : "false", s.gasHigh ? "true" : "false");
  return size > 0 && size < int(sizeof(payload)) && mqtt.publish(topic, payload, retained);
}
void networkTask(void*) {
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setBufferSize(1024);
  mqtt.setKeepAlive(15);
  mqtt.setSocketTimeout(2);
  socketClient.setTimeout(2); // Arduino-ESP32 2.x API uses seconds.
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  Snapshot latest;
  bool haveSnapshot = false, force = false, wasWifiUp = false;
  uint32_t wifiAttempt = 0, mqttAttempt = 0, lastPublish = 0, backoff = 1000;
  bool firstWifi = true, firstMqtt = true;
  for (;;) {
    Snapshot received;
    if (xQueueReceive(snapshots, &received, 0) == pdTRUE) {
      latest = received;
      haveSnapshot = true;
    }
    const uint32_t now = millis();
    if (WiFi.status() != WL_CONNECTED) {
      if (wasWifiUp) {
        socketClient.stop();
        wasWifiUp = false;
        firstMqtt = true;
      }
      if (firstWifi || uint32_t(now - wifiAttempt) >= 10000) {
        firstWifi = false;
        wifiAttempt = now;
        Serial.println("[NET] Connecting Wi-Fi (control continues)");
        WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
      }
    } else {
      wasWifiUp = true;
      if (!mqtt.connected() && (firstMqtt || uint32_t(now - mqttAttempt) >= backoff)) {
        firstMqtt = false;
        // Drop queued history; current state is authoritative after reconnect.
        xQueueReset(events);
        const bool connected = mqtt.connect(DEVICE_ID, MQTT_USER, MQTT_PASSWORD,
                                             availabilityTopic, 1, true, "offline");
        mqttAttempt = millis();
        if (connected) {
          Serial.println("[NET] MQTT connected: " MQTT_TOPIC_ROOT);
          mqtt.publish(availabilityTopic, "online", true);
          backoff = 1000;
          force = true;
        } else {
          Serial.printf("[NET] MQTT failed (%d), retry in %lu ms\n", mqtt.state(), (unsigned long)backoff);
          backoff = backoff < 15000 ? backoff * 2 : 30000;
        }
      }
      if (mqtt.connected()) {
        mqtt.loop();
        // Refresh after a possibly slow connect.
        if (xQueueReceive(snapshots, &received, 0) == pdTRUE) {
          latest = received;
          haveSnapshot = true;
        }
        for (int i = 0; i < 4 && mqtt.connected(); ++i) {
          if (xQueueReceive(events, &received, 0) != pdTRUE) break;
          if (!publishSnapshot(eventTopic, received, false)) break;
          force = true;
        }
        if (haveSnapshot && (force || uint32_t(now - lastPublish) >= Config::telemetryMs)) {
          if (publishSnapshot(stateTopic, latest, true)) {
            lastPublish = now;
            force = false;
          }
        }
      }
    }
    vTaskDelay(pdMS_TO_TICKS(20));
  }
}
}
bool Telemetry::begin() {
  snapshots = xQueueCreate(1, sizeof(Snapshot));
  events = xQueueCreate(12, sizeof(Snapshot));
  if (!snapshots || !events) return false;
  return xTaskCreatePinnedToCore(networkTask, "mqtt", 8192, nullptr, 1, nullptr, 0) == pdPASS;
}
void Telemetry::update(const Snapshot& snapshot, bool event) {
  if (!snapshots || !events) return;
  xQueueOverwrite(snapshots, &snapshot);
  if (event && xQueueSend(events, &snapshot, 0) != pdTRUE) {
    Snapshot discarded;
    xQueueReceive(events, &discarded, 0);
    xQueueSend(events, &snapshot, 0);
  }
}
