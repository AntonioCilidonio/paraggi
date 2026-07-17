const fs = require("node:fs");
const path = require("node:path");
const { expo } = require("./app.json");

const googleServicesPath = path.join(__dirname, "google-services.json");
const appleServicesPath = path.join(__dirname, "GoogleService-Info.plist");
const personalIosBuild = process.env.PARAGGI_IOS_PERSONAL_TEAM === "1";
const nativePushConfigured = {
  android: fs.existsSync(googleServicesPath),
  ios: !personalIosBuild && fs.existsSync(appleServicesPath)
};

const plugins = personalIosBuild
  ? expo.plugins.filter((plugin) => {
      const pluginName = Array.isArray(plugin) ? plugin[0] : plugin;
      return pluginName !== "expo-notifications";
    })
  : expo.plugins;

module.exports = {
  expo: {
    ...expo,
    name: personalIosBuild ? "Paraggi Dev" : expo.name,
    android: {
      ...expo.android,
      ...(fs.existsSync(googleServicesPath) ? { googleServicesFile: "./google-services.json" } : {})
    },
    ios: {
      ...expo.ios,
      bundleIdentifier: personalIosBuild
        ? "com.antoniocilidonio.paraggi.dev"
        : expo.ios.bundleIdentifier,
      ...(!personalIosBuild && fs.existsSync(appleServicesPath) ? { googleServicesFile: "./GoogleService-Info.plist" } : {})
    },
    plugins,
    extra: {
      ...expo.extra,
      nativePushConfigured,
      personalIosBuild
    }
  }
};
