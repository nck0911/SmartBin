import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const require = createRequire(import.meta.url);
const configure = require('../app.config.js');
const base = require('../app.json').expo;

test('SmartBin config rejects old Firebase registration and requires credentials for Android cloud builds', t => {
  const folder = mkdtempSync(join(tmpdir(), 'smartbin-config-'));
  const keys = ['GOOGLE_SERVICES_JSON', 'EAS_PROJECT_ID', 'EAS_BUILD', 'EAS_BUILD_PLATFORM'];
  const original = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  t.after(() => {
    for (const key of keys) {
      if (original[key] === undefined) delete process.env[key]; else process.env[key] = original[key];
    }
    rmSync(folder, { recursive: true, force: true });
  });
  process.env.GOOGLE_SERVICES_JSON = join(folder, 'missing.json');
  process.env.EAS_PROJECT_ID = '00000000-0000-4000-8000-000000000001';
  delete process.env.EAS_BUILD;
  delete process.env.EAS_BUILD_PLATFORM;
  const development = configure({ config: { ...base, android: { ...base.android, googleServicesFile: 'stale.json' } } });
  assert.equal(development.name, 'SmartBin');
  assert.equal(development.slug, 'smartbin');
  assert.equal(development.scheme, 'smartbin');
  assert.equal(development.android.package, 'com.smartbin.mobile');
  assert.equal(development.ios.bundleIdentifier, 'com.smartbin.mobile');
  assert.equal(development.android.googleServicesFile, undefined);
  process.env.EAS_BUILD = 'true';
  process.env.EAS_BUILD_PLATFORM = 'android';
  assert.throws(() => configure({ config: base }), /requires EAS_PROJECT_ID and GOOGLE_SERVICES_JSON/);
  const filename = join(folder, 'firebase.json');
  process.env.GOOGLE_SERVICES_JSON = filename;
  writeFileSync(filename, JSON.stringify({ client: [{ client_info: { android_client_info: { package_name: 'com.example.legacy' } } }] }));
  assert.throws(() => configure({ config: base }), /must register com.smartbin.mobile/);
  writeFileSync(filename, JSON.stringify({ client: [{ client_info: { android_client_info: { package_name: 'com.smartbin.mobile' } } }] }));
  assert.equal(configure({ config: base }).android.googleServicesFile, filename);
  delete process.env.EAS_PROJECT_ID;
  assert.throws(() => configure({ config: base }), /requires EAS_PROJECT_ID and GOOGLE_SERVICES_JSON/);
});
