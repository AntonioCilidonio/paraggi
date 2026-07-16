const { AndroidConfig, withAndroidStyles } = require("@expo/config-plugins");

const systemBarStyles = [
  ["android:statusBarColor", "#3B82C4"],
  ["android:windowLightStatusBar", "false"],
  ["android:windowDrawsSystemBarBackgrounds", "true"],
  ["android:enforceStatusBarContrast", "false", "29"],
];

module.exports = function withAndroidSystemBars(config) {
  return withAndroidStyles(config, (mod) => {
    const parent = AndroidConfig.Styles.getAppThemeGroup();
    for (const [name, value, targetApi] of systemBarStyles) {
      mod.modResults = AndroidConfig.Styles.assignStylesValue(mod.modResults, {
        add: true,
        parent,
        name,
        value,
        targetApi,
      });
    }
    return mod;
  });
};
