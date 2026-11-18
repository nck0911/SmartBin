import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { parseHeight } from '../src/heightSettings.ts';

type Node = { type: unknown; props: Record<string, any> };
function runtime(file: string, component: string) {
  const state: any[] = [], refs: any[] = [];
  let stateIndex = 0, refIndex = 0;
  const react = {
    createElement: (type: unknown, props: unknown, ...children: unknown[]) => ({ type, props: { ...(props as object), children } }),
    useState(initial: unknown) {
      const index = stateIndex++;
      if (!(index in state)) state[index] = initial;
      return [state[index], (value: any) => { state[index] = typeof value === 'function' ? value(state[index]) : value; }];
    },
    useRef(initial: unknown) { const index = refIndex++; return refs[index] ?? (refs[index] = { current: initial }); },
    useEffect() {},
  };
  const native = new Proxy({ Platform: { OS: 'android' }, StyleSheet: { create: (value: unknown) => value }, Keyboard: { dismiss() {} } } as Record<string, unknown>, { get: (value, key: string) => value[key] ?? key });
  const modules: Record<string, unknown> = {
    react, 'react-native': native, 'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    './heightSettings': { parseHeight }, './components/ConfirmationDialog': { ConfirmationDialog: 'ConfirmationDialog' },
  };
  const source = readFileSync(new URL(file, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
  const exports: Record<string, any> = {};
  runInNewContext(compiled, { exports, require(name: string) { if (!(name in modules)) throw new Error(name); return modules[name]; } });
  return { render(props: object): Node | null { stateIndex = refIndex = 0; return exports[component](props); } };
}
function nodes(tree: unknown): Node[] {
  if (!tree || typeof tree !== 'object' || !('props' in tree)) return [];
  const node = tree as Node;
  return [node, ...(node.props.children ?? []).flat(Infinity).flatMap(nodes)];
}
function button(tree: Node | null, label: string): Node {
  const found = nodes(tree).find(node => node.type === 'Pressable' && nodes(node).some(child => child.type === 'Text' && child.props.children.flat(Infinity).join('') === label));
  assert.ok(found, `Button: ${label}`);
  return found;
}
const props = {
  bin: { id: 'a', name: 'Thùng bếp', location: 'Bếp', topic: 'test/a' },
  reading: { data: { configured: false, settings_session: 1 }, liveAt: 1000 },
  connected: true, now: 1000,
};

test('height confirmation cancel/back preserves input; confirm saves the displayed measurement once', async () => {
  const ui = runtime('../src/BinHeightSettings.tsx', 'BinHeightSettings');
  const measurements: number[] = [];
  const input = { ...props, saveHeight: async (_bin: unknown, mm: number) => { measurements.push(mm); } };
  let tree = ui.render(input);
  button(tree, 'Thiết lập').props.onPress(); tree = ui.render(input);
  nodes(tree).find(node => node.type === 'TextInput')!.props.onChangeText('45,5');
  tree = ui.render(input); button(tree, 'Lưu thiết lập').props.onPress(); tree = ui.render(input);
  let dialog = nodes(tree).find(node => node.type === 'ConfirmationDialog')!;
  assert.equal(dialog.props.visible, true);
  assert.equal(dialog.props.details[0].value, 'Thùng bếp');
  assert.equal(dialog.props.details[1].value, '45.5 cm');
  assert.equal(measurements.length, 0);
  dialog.props.onCancel(); tree = ui.render(input);
  assert.equal(nodes(tree).find(node => node.type === 'TextInput')!.props.value, '45,5');
  button(tree, 'Lưu thiết lập').props.onPress(); tree = ui.render(input);
  dialog = nodes(tree).find(node => node.type === 'ConfirmationDialog')!;
  dialog.props.onConfirm(); dialog.props.onConfirm();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(measurements, [455]);
  tree = ui.render(input); button(tree, 'Hoàn tất').props.onPress();
  assert.equal(ui.render(input), null);
});

test('a preset bin hides setup without hiding setup for another unconfigured bin', () => {
  const ui = runtime('../src/BinHeightSettings.tsx', 'BinHeightSettings');
  const input = { ...props, saveHeight: async () => {} };
  assert.equal(ui.render({ ...input, reading: undefined }), null);
  assert.equal(ui.render({ ...input, reading: { ...props.reading, data: { configured: true, settings_session: 1, bin_height_cm: 45 } } }), null);
  assert.ok(runtime('../src/BinHeightSettings.tsx', 'BinHeightSettings').render({ ...input, bin: { ...props.bin, id: 'b' } }));
});

test('QR height prefills setup; confirmation sends the displayed measurement and never overwrites a configured bin', async () => {
  const ui = runtime('../src/BinHeightSettings.tsx', 'BinHeightSettings');
  const measurements: number[] = [];
  const input = { ...props, bin: { ...props.bin, heightCm: 60 }, saveHeight: async (_bin: unknown, mm: number) => { measurements.push(mm); } };
  let tree = ui.render(input);
  button(tree, 'Thiết lập').props.onPress(); tree = ui.render(input);
  assert.equal(nodes(tree).find(node => node.type === 'TextInput')!.props.value, '60');
  assert.deepEqual(measurements, []);
  button(tree, 'Lưu thiết lập').props.onPress(); tree = ui.render(input);
  const dialog = nodes(tree).find(node => node.type === 'ConfirmationDialog')!;
  assert.equal(dialog.props.details[1].value, '60 cm');
  dialog.props.onConfirm();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(measurements, [600]);
  const locked = runtime('../src/BinHeightSettings.tsx', 'BinHeightSettings');
  assert.equal(locked.render({ ...input, reading: { ...props.reading, data: { configured: true, settings_session: 1, bin_height_cm: 45 } } }), null);
  assert.deepEqual(measurements, [600]);
});

test('shared dialog routes Android Back to cancel and exposes a disabled confirmation', () => {
  const ui = runtime('../src/components/ConfirmationDialog.tsx', 'ConfirmationDialog');
  let cancelled = 0, confirmed = 0;
  const tree = ui.render({ visible: true, title: 'Xác nhận', description: 'Một lần', confirmLabel: 'Lưu', confirmDisabled: true, onCancel: () => cancelled++, onConfirm: () => confirmed++ });
  nodes(tree).find(node => node.type === 'Modal')!.props.onRequestClose();
  assert.equal(cancelled, 1); assert.equal(confirmed, 0);
  assert.equal(button(tree, 'Lưu').props.disabled, true);
});
