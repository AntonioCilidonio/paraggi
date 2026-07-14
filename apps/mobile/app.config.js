const fs = require("node:fs");
const path = require("node:path");
const { expo } = require("./app.json");

const googleServicesPath = path.join(__dirname, "google-services.json");
const appleServicesPath = path.join(__dirname, "GoogleService-Info.plist");
const nativePushConfigured = {
  android: fs.existsSync(googleServicesPath),
  ios: fs.existsSync(appleServicesPath)
};

module.exports = {
  expo: {
    ...expo,
    android: {
      ...expo.android,
      ...(fs.existsSync(googleServicesPath) ? { googleServicesFile: "./google-services.json" } : {})
    },
    ios: {
      ...expo.ios,
      ...(fs.existsSync(appleServicesPath) ? { googleServicesFile: "./GoogleService-Info.plist" } : {})
    },
    extra: {
      ...expo.extra,
      nativePushConfigured
    }
  }
};
