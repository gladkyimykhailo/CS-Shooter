#!/usr/bin/env bash
# Builds dist/sector.apk: a fullscreen WebView wrapper around dist/index.html.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SDK="${ANDROID_HOME:-$HOME/Android/Sdk}"
BT="$(ls -d "$SDK"/build-tools/* | sort -V | tail -1)"
JAR="$(ls -d "$SDK"/platforms/android-* | sort -V | tail -1)/android.jar"
KEYSTORE="${APK_KEYSTORE:-$HOME/.android/debug.keystore}"
OUT="$ROOT/dist/sector.apk"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

[ -f "$ROOT/dist/index.html" ] || { echo "Run npm run package first" >&2; exit 1; }
if [ ! -f "$KEYSTORE" ]; then
  mkdir -p "$(dirname "$KEYSTORE")"
  keytool -genkeypair -keystore "$KEYSTORE" -storepass android -keypass android \
    -alias androiddebugkey -keyalg RSA -keysize 2048 -validity 10000 \
    -dname "CN=Android Debug,O=Android,C=US" >/dev/null
fi

mkdir -p "$WORK/assets" "$WORK/classes" "$WORK/dex"
cp "$ROOT/dist/index.html" "$WORK/assets/index.html"
"$BT/aapt2" compile --dir "$ROOT/android/res" -o "$WORK/res.zip"
"$BT/aapt2" link -o "$WORK/base.apk" -I "$JAR" --manifest "$ROOT/android/AndroidManifest.xml" \
  -A "$WORK/assets" "$WORK/res.zip"
javac --release 11 -classpath "$JAR" -d "$WORK/classes" $(find "$ROOT/android/src" -name '*.java')
"$BT/d8" --lib "$JAR" --min-api 24 --output "$WORK/dex" $(find "$WORK/classes" -name '*.class')
(cd "$WORK/dex" && zip -q "$WORK/base.apk" classes.dex)
"$BT/zipalign" -f -p 4 "$WORK/base.apk" "$WORK/aligned.apk"
"$BT/apksigner" sign --v4-signing-enabled false --ks "$KEYSTORE" --ks-pass pass:android --key-pass pass:android \
  --out "$OUT" "$WORK/aligned.apk"
echo "APK: $OUT ($(stat -c %s "$OUT") bytes)"
