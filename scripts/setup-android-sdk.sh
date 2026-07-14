#!/bin/sh
set -eu

SDK_ROOT="${1:-${ANDROID_HOME:-$HOME/Library/Android/sdk}}"
COMMAND_LINE_TOOLS_VERSION="14742923"
COMMAND_LINE_TOOLS_SHA1="cc27cca4b84bfdbc7df17e3d0a01d0c640d8ee71"
COMMAND_LINE_TOOLS_URL="https://dl.google.com/android/repository/commandlinetools-mac-${COMMAND_LINE_TOOLS_VERSION}_latest.zip"
SDK_MANAGER="$SDK_ROOT/cmdline-tools/latest/bin/sdkmanager"

if [ "$(uname -s)" != "Darwin" ]; then
  echo "Automatic Android SDK setup currently supports macOS only."
  exit 1
fi

if [ ! -x "$SDK_MANAGER" ]; then
  echo "Installing Android command-line tools in $SDK_ROOT"
  TEMP_DIR="$(mktemp -d)"
  trap 'rm -rf "$TEMP_DIR"' EXIT INT TERM
  ARCHIVE="$TEMP_DIR/commandlinetools.zip"

  curl --fail --location --retry 3 "$COMMAND_LINE_TOOLS_URL" --output "$ARCHIVE"
  printf '%s  %s\n' "$COMMAND_LINE_TOOLS_SHA1" "$ARCHIVE" | shasum -a 1 --check
  unzip -q "$ARCHIVE" -d "$TEMP_DIR"
  mkdir -p "$SDK_ROOT/cmdline-tools/latest"
  cp -R "$TEMP_DIR/cmdline-tools/." "$SDK_ROOT/cmdline-tools/latest/"
fi

echo "Accepting Android SDK licenses"
yes | "$SDK_MANAGER" --sdk_root="$SDK_ROOT" --licenses >/dev/null || true

echo "Installing Android SDK packages required by Expo SDK 53"
"$SDK_MANAGER" --sdk_root="$SDK_ROOT" \
  "platform-tools" \
  "platforms;android-35" \
  "build-tools;35.0.0" \
  "ndk;27.1.12297006"

echo "Android SDK ready in $SDK_ROOT"
