import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { alertData } from '../src/notificationModel.ts';
import { createChannelInitializer, notificationChannelId } from '../src/notificationChannel.ts';

function adapter(expoGo: boolean, initiallyGranted = true, canAskAgain = true) {
  let channelCalls = 0;
  let permissionRequests = 0;
  let scheduled: { trigger: unknown; content: unknown } | undefined;
  const notifications = {
    __esModule: true,
    AndroidImportance: { HIGH: 6 },
    setNotificationHandler() {},
    async getPermissionsAsync() { return { granted: initiallyGranted, canAskAgain }; },
    async requestPermissionsAsync() { permissionRequests++; return { granted: true }; },
    async setNotificationChannelAsync() { channelCalls++; throw new Error('native NullPointerException'); },
    async scheduleNotificationAsync(request: { trigger: unknown; content: unknown }) { scheduled = request; return 'notification-1'; },
  };
  const modules: Record<string, unknown> = {
    'react-native': { Platform: { OS: 'android', Version: 35 } },
    // Reproduce conflicting legacy metadata: native ExpoGo is present but the
    // constants field does not say StoreClient.
    'expo-constants': { __esModule: true, default: { executionEnvironment: 'bare' }, ExecutionEnvironment: { StoreClient: 'storeClient' } },
    expo: { isRunningInExpoGo: () => expoGo },
    'expo-secure-store': {},
    './notificationModel': { alertData },
    './notificationChannel': { createChannelInitializer, notificationChannelId },
    'expo-notifications': notifications,
  };
  const source = readFileSync(new URL('../src/notificationDevice.native.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  const exports: Record<string, any> = {};
  runInNewContext(compiled, { exports, require(name: string) { if (!(name in modules)) throw new Error(`Unexpected module ${name}`); return modules[name]; }, setTimeout, clearTimeout, console: { error() {} } });
  return { device: exports.notificationDevice, channelCalls: () => channelCalls, scheduled: () => scheduled, permissionRequests: () => permissionRequests };
}

test('real native adapter uses ExpoGo capability, skips custom channel and creates an immediate local notification', async () => {
  const runtime = adapter(true);
  assert.equal(runtime.device.supportsPush, false);
  assert.equal(await runtime.device.permission(), true);
  await runtime.device.show({ title: 'Thử thông báo', body: 'Thùng bếp', data: {} });
  assert.equal(runtime.channelCalls(), 0);
  assert.equal(runtime.scheduled()?.trigger, null);
  await assert.rejects(runtime.device.token(), /Cần cài bản ứng dụng riêng/);
  assert.equal(runtime.channelCalls(), 0);
});

test('standalone native channel failure remains a failure and never reports a notification as sent', async () => {
  const runtime = adapter(false);
  assert.equal(runtime.device.supportsPush, true);
  await assert.rejects(runtime.device.show({ title: 'Thử', body: 'Thùng', data: {} }), /NullPointerException/);
  assert.equal(runtime.channelCalls(), 1);
  assert.equal(runtime.scheduled(), undefined);
});
test('Expo Go requests OS notification permission when needed and respects a blocked permission', async () => {
  const fresh = adapter(true, false);
  assert.equal(await fresh.device.permission(), true);
  assert.equal(fresh.permissionRequests(), 1);
  const blocked = adapter(true, false, false);
  assert.equal(await blocked.device.permission(), false);
  assert.equal(blocked.permissionRequests(), 0);
});
