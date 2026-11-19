import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as model from '../src/notificationModel.ts';

function runtime(allowed = true, saved?: string, supportsPush = false) {
  const cells: any[] = [], dependencies: unknown[][] = [];
  let cursor = 0, effectCursor = 0;
  let effects: (() => unknown)[] = [];
  let permissionCalls = 0, tokenCalls = 0;
  const shown: model.AlertMessage[] = [];
  let stored = saved;
  const react = {
    useState(initial: any) {
      const index = cursor++;
      if (!(index in cells)) cells[index] = typeof initial === 'function' ? initial() : initial;
      return [cells[index], (next: any) => { cells[index] = typeof next === 'function' ? next(cells[index]) : next; }];
    },
    useRef(initial: any) { const index = cursor++; return cells[index] ?? (cells[index] = { current: initial }); },
    useCallback(callback: any) { return callback; },
    useEffect(effect: () => unknown, next: unknown[]) {
      const index = effectCursor++;
      const previous = dependencies[index];
      if (!previous || previous.length !== next.length || next.some((value, i) => value !== previous[i])) effects.push(effect);
      dependencies[index] = next;
    },
  };
  const device = {
    supported: true, supportsPush,
    async permission() { permissionCalls++; return allowed; },
    async permissionStatus() { return allowed; },
    async token() { tokenCalls++; throw Error('Unexpected push token request'); },
    async secret() { return null; },
    onTokenChange() { return () => {}; },
    listen() { return () => {}; },
    async show(message: model.AlertMessage) { shown.push(message); },
  };
  const modules: Record<string, unknown> = {
    react,
    '@react-native-async-storage/async-storage': { __esModule: true, default: { async getItem() { return stored; }, async setItem(_key: string, value: string) { stored = value; } } },
    'react-native': { AppState: { addEventListener() { return { remove() {} }; } } },
    './notificationDevice': { notificationDevice: device },
    './notificationModel': model,
  };
  const exports: Record<string, any> = {};
  const source = readFileSync(new URL('../src/useNotifications.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  runInNewContext(compiled, { exports, require(name: string) { if (!(name in modules)) throw Error(name); return modules[name]; } });
  const monitor: any = { bins: [{ id: 'a', topic: 'bins/a', name: 'Thùng sân', location: 'Sân' }], broker: 'wss://mqtt.example/mqtt', readings: {}, ready: true, connected: false, now: 1000 };
  const openBin = () => {};
  const render = () => {
    cursor = 0; effectCursor = 0; effects = [];
    const state = exports.useNotifications(monitor, openBin);
    for (const effect of effects) effect();
    return state;
  };
  return { render, monitor, shown, stored: () => stored, permissionCalls: () => permissionCalls, tokenCalls: () => tokenCalls };
}
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

test('Expo Go switch requests permission, enables local alerts without backend, persists and disables', async () => {
  const app = runtime(); app.render(); await tick();
  let state = app.render();
  assert.equal(await state.enableNotifications(), true);
  state = app.render();
  assert.equal(state.settings.mode, 'local');
  assert.equal(app.permissionCalls(), 1);
  assert.equal(app.tokenCalls(), 0);
  const saved = app.stored();
  assert.equal(JSON.parse(saved!).mode, 'local');
  app.monitor.connected = true;
  app.monitor.readings = { a: { liveAt: 1000, receivedAt: 1000, data: { configured: true, trash_valid: true, trash_stale: false, fill_percent: 85, full: true, gas_valid: true, gas_adc: 1200, gas_high: false } } };
  state = app.render(); await tick();
  assert.equal(app.shown.length, 1);
  assert.equal(app.shown[0].data.kind, 'full');
  app.render(); await tick(); assert.equal(app.shown.length, 1);
  assert.equal(await state.disable(), true);
  assert.equal(app.render().settings.mode, 'off');
  const restarted = runtime(true, saved); restarted.render(); await tick();
  assert.equal(restarted.render().settings.mode, 'local');
});
test('denied permission leaves the switch off; standalone builds never silently enable local mode', async () => {
  const denied = runtime(false); denied.render(); await tick();
  assert.equal(await denied.render().enableNotifications(), false);
  assert.equal(denied.render().settings.mode, 'off');
  assert.match(denied.render().error, /cho phép thông báo/);
  const standalone = runtime(true, undefined, true); standalone.render(); await tick();
  assert.equal(await standalone.render().enableNotifications(), false);
  assert.equal(standalone.render().settings.mode, 'off');
  assert.match(standalone.render().error, /chưa được thiết lập/);
});
