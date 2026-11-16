const fs = require('node:fs');
const path = require('node:path');

module.exports = ({ config }) => {
  const projectId = process.env.EAS_PROJECT_ID;
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON || './google-services.json';
  return {
    ...config,
    android: { ...config.android, package: 'com.smarttrashcan.mobile', ...(fs.existsSync(path.resolve(__dirname, googleServicesFile)) ? { googleServicesFile } : {}) },
    ios: { ...config.ios, bundleIdentifier: 'com.smarttrashcan.mobile' },
    extra: { ...config.extra, ...(projectId ? { eas: { ...config.extra?.eas, projectId } } : {}) },
  };
};
