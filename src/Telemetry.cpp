#include "Telemetry.h"
#include "Config.h"
#include <WiFi.h>
#include <PubSubClient.h>
#include <Preferences.h>
#include <esp_system.h>
#if __has_include("Secrets.h")
#include "Secrets.h"
#else
#include "Secrets.example.h"
#endif
#include "SimulationConfig.h"
namespace {
QueueHandle_t snapshots;
QueueHandle_t events;
QueueHandle_t settingsRequests, settingsResults;
uint32_t settingsSession = 0;
uint16_t storedHeight = 0;
bool settingsPending = false;
char lastRequestId[49] = {};
WiFiClient socketClient;
PubSubClient mqtt(socketClient);
constexpr char stateTopic[] = MQTT_TOPIC_ROOT "/state";
constexpr char eventTopic[] = MQTT_TOPIC_ROOT "/events";
constexpr char availabilityTopic[] = MQTT_TOPIC_ROOT "/availability";
constexpr char settingsTopic[] = MQTT_TOPIC_ROOT "/config/set";
constexpr char resultTopic[] = MQTT_TOPIC_ROOT "/config/result";
void publishResult(const BinSettings::Request& request, const char* error) {
  char payload[256];
  snprintf(payload, sizeof(payload),
    "{\"device_id\":\"%s\",\"request_id\":\"%s\",\"ok\":%s,\"height_mm\":%lu,\"error\":\"%s\"}",
    DEVICE_ID, request.id, *error ? "false" : "true", (unsigned long)request.heightMm, error);
  mqtt.publish(resultTopic, payload, false);
}
void onMessage(char* topic, uint8_t* payload, unsigned int length) {
  if (strcmp(topic, settingsTopic) != 0) return;
  BinSettings::Request request;
  if (!BinSettings::parse(payload, length, request)) return;
  if (!BinSettings::current(request, settingsSession, millis())) {
    publishResult(request, "expired"); return;
  }
  if (!BinSettings::validHeight(request.heightMm)) {
    publishResult(request, "invalid_height"); return;
  }
  // Do not apply a duplicate of the most recently accepted request.
  if (strcmp(lastRequestId, request.id) == 0) return;
  if (settingsPending) { publishResult(request, "busy"); return; }
  if (BinSettings::validHeight(storedHeight)) { publishResult(request, "already_configured"); return; }
  if (storedHeight != request.heightMm) {
    Preferences preferences;
    if (!preferences.begin("smartbin-bin", false)) {
      publishResult(request, "storage"); return;
    }
    const bool saved = preferences.putUShort("height-mm", request.heightMm) == sizeof(uint16_t);
    preferences.end();
    if (!saved) { publishResult(request, "storage"); return; }
    storedHeight = request.heightMm;
  }
  strcpy(lastRequestId, request.id);
  settingsPending = true;
  xQueueReset(events);
  xQueueOverwrite(settingsRequests, &request);
}
bool publishSnapshot(const char* topic, const Snapshot& s, bool retained) {
  if (s.heightMm != storedHeight) return false;
  char hand[24] = "null", fill[24] = "null", gas[16] = "null";
  char handAge[16] = "null", trashAge[16] = "null";
  if (s.handValid) snprintf(hand, sizeof(hand), "%.1f", s.handCm);
  const bool configured = BinSettings::validHeight(s.heightMm);
  char height[24] = "null";
  if (configured) snprintf(height, sizeof(height), "%.1f", s.heightMm / 10.0f);
  if (configured && s.trashValid) snprintf(fill, sizeof(fill), "%.1f", s.fill);
  if (s.gasValid) snprintf(gas, sizeof(gas), "%d", s.gas);
  if (s.handHasSample) snprintf(handAge, sizeof(handAge), "%lu", (unsigned long)s.handAge);
  if (s.trashHasSample) snprintf(trashAge, sizeof(trashAge), "%lu", (unsigned long)s.trashAge);
  char payload[768];
  const int size = snprintf(payload, sizeof(payload),
      "{\"schema\":1,\"device_id\":\"%s\",\"sequence\":%lu,\"uptime_ms\":%lu,"
      "\"lid_command\":\"%s\",\"hand_cm\":%s,\"hand_valid\":%s,\"hand_age_ms\":%s,"
      "\"fill_percent\":%s,\"trash_valid\":%s,\"trash_stale\":%s,\"trash_age_ms\":%s,"
      "\"gas_adc\":%s,\"gas_valid\":%s,\"full\":%s,\"gas_high\":%s,"
      "\"configured\":%s,\"bin_height_cm\":%s,\"settings_session\":%lu}",
      DEVICE_ID, (unsigned long)s.sequence, (unsigned long)s.uptime,
      s.lidOpen ? "open" : "closed", hand, s.handValid ? "true" : "false", handAge,
      fill, s.trashValid ? "true" : "false", s.trashStale ? "true" : "false", trashAge,
      gas, s.gasValid ? "true" : "false", s.full ? "true" : "false", s.gasHigh ? "true" : "false",
      configured ? "true" : "false", height, (unsigned long)settingsSession);
  return size > 0 && size < int(sizeof(payload)) && mqtt.publish(topic, payload, retained);
}
void networkTask(void*) {
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(onMessage);
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
          if (mqtt.subscribe(settingsTopic, 0)) mqtt.publish(availabilityTopic, "online", true);
          else mqtt.disconnect();
          backoff = 1000;
          force = true;
        } else {
          Serial.printf("[NET] MQTT failed (%d), retry in %lu ms\n", mqtt.state(), (unsigned long)backoff);
          backoff = backoff < 15000 ? backoff * 2 : 30000;
        }
      }
      if (mqtt.connected()) {
        mqtt.loop();
        BinSettings::Request applied;
        if (xQueueReceive(settingsResults, &applied, 0) == pdTRUE) {
          settingsPending = false;
          publishResult(applied, "");
          force = true;
        }
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
uint16_t Telemetry::loadHeight() {
  Preferences preferences;
  if (!preferences.begin("smartbin-bin", true)) return 0;
  const uint16_t mm = preferences.getUShort("height-mm", 0);
  preferences.end();
  storedHeight = BinSettings::validHeight(mm) ? mm : 0;
  return storedHeight;
}
bool Telemetry::begin() {
  settingsSession = esp_random();
  if (!settingsSession) settingsSession = 1;
  snapshots = xQueueCreate(1, sizeof(Snapshot));
  events = xQueueCreate(12, sizeof(Snapshot));
  settingsRequests = xQueueCreate(1, sizeof(BinSettings::Request));
  settingsResults = xQueueCreate(1, sizeof(BinSettings::Request));
  if (!snapshots || !events || !settingsRequests || !settingsResults) return false;
  return xTaskCreatePinnedToCore(networkTask, "mqtt", 8192, nullptr, 1, nullptr, 0) == pdPASS;
}
bool Telemetry::takeSettings(BinSettings::Request& request) {
  return xQueueReceive(settingsRequests, &request, 0) == pdTRUE;
}
void Telemetry::settingsApplied(const BinSettings::Request& request) {
  xQueueOverwrite(settingsResults, &request);
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
