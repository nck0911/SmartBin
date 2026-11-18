const fs = require('node:fs');
const path = require('node:path');

module.exports = ({ config }) => {
  const projectId = process.env.EAS_PROJECT_ID;
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON || './google-services.json';
  const packageName = 'com.smartbin.mobile';
  const firebasePath = path.resolve(__dirname, googleServicesFile);
  const hasFirebase = fs.existsSync(firebasePath);
  const androidBuild = process.env.EAS_BUILD === 'true' && process.env.EAS_BUILD_PLATFORM === 'android';
  if (hasFirebase) {
    const firebase = JSON.parse(fs.readFileSync(firebasePath, 'utf8').replace(/^\uFEFF/, ''));
    if (!firebase.client?.some(client => client.client_info?.android_client_info?.package_name === packageName)) {
      throw new Error(`Firebase config must register ${packageName}. Download the new SmartBin Android config; do not edit package_name in the old JSON.`);
    }
  }
  if (androidBuild && (!hasFirebase || !projectId)) {
    throw new Error('SmartBin Android build requires EAS_PROJECT_ID and GOOGLE_SERVICES_JSON for com.smartbin.mobile. See .local/README.planchange.md.');
  }
  const android = { ...config.android, package: packageName };
  delete android.googleServicesFile;
  if (hasFirebase) android.googleServicesFile = googleServicesFile;
  return {
    ...config,
    android,
    ios: { ...config.ios, bundleIdentifier: packageName },
    extra: { ...config.extra, ...(projectId ? { eas: { ...config.extra?.eas, projectId } } : {}) },
  };
};
