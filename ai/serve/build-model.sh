#!/usr/bin/env bash
# Суу-гийн бүтэн загварыг (suu.gguf) git дэх жижиг adapter-аас энэ компьютер дээр нэг удаа угсарна.
# Build Suu's full model (suu.gguf) on this computer, once, from the small trained adapter kept in git:
#
#   official Qwen2.5-3B-Instruct GGUF (Q8_0, ~3.6 GB from Hugging Face)
#     + ai/models/<version>/<adapter>.gguf (the LoRA we trained, ~60 MB)
#     → merged with llama.cpp's llama-export-lora (built once from the pinned commit in build.env)
#
# Why: Ollama no longer loads LoRA adapters ("LoRA adapters are no longer supported"), and the merged file is too
# big for git (GitHub refuses files over 100 MB). Everything is checked against the sha256 sums in build.env.
#
#   bash ai/serve/build-model.sh [model folder]      # default: ai/models/suu-v1
#
# Needs ~10 GB free disk (base 3.6 GB + merged 6.2 GB, both in ~/.suu).
# Progress goes to stderr; the last line on stdout is the folder holding Modelfile + suu.gguf (start.sh uses it).
set -euo pipefail

REPO="$(cd "$(dirname "$0")/../.." && pwd)"
SRC="$(cd "${1:-$REPO/ai/models/suu-v1}" && pwd)"
STATE="${SUU_HOME:-$HOME/.suu}"
OUT="$STATE/models/$(basename "$SRC")"

say() { printf '\033[1;32m▸ %s\033[0m\n' "$*" >&2; }
die() { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1; }
sha256() { if need sha256sum; then sha256sum "$1" | cut -d' ' -f1; else shasum -a 256 "$1" | cut -d' ' -f1; fi; }
cpus() { getconf _NPROCESSORS_ONLN 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4; }

[[ -f "$SRC/build.env" ]] || die "$SRC/build.env алга (загварын хавтас буруу байна)."
# shellcheck source=/dev/null
source "$SRC/build.env"
for v in BASE_URL BASE_SHA256 ADAPTER ADAPTER_SHA256 LLAMA_CPP_COMMIT; do
  [[ -n "${!v:-}" ]] || die "build.env-д $v алга."
done

# 1 · the adapter from git (a clone without the file, or a broken download, stops here)
say "Adapter шалгаж байна: $ADAPTER"
[[ -f "$SRC/$ADAPTER" ]] || die "$SRC/$ADAPTER алга. 'git pull' хийгээд дахин оролдоно уу."
[[ "$(sha256 "$SRC/$ADAPTER")" == "$ADAPTER_SHA256" ]] || die "$ADAPTER эвдэрсэн байна (sha256 таарахгүй)."

DONE="$ADAPTER_SHA256 $BASE_SHA256 $LLAMA_CPP_COMMIT"
if [[ -f "$OUT/suu.gguf" && "$(cat "$OUT/.built" 2>/dev/null)" == "$DONE" ]]; then
  cp "$SRC/Modelfile" "$SRC/build.env" "$OUT/"
  [[ -f "$SRC/prompts.json" ]] && cp "$SRC/prompts.json" "$OUT/"
  say "Өмнө угсарсан загвар бэлэн байна: $OUT"
  echo "$OUT"
  exit 0
fi
mkdir -p "$OUT" "$STATE/base"

# 2 · llama-export-lora from the pinned llama.cpp commit (the one tested in Colab)
LLAMA="$STATE/llama.cpp"
TOOL="$LLAMA/build/bin/llama-export-lora"
if [[ ! -x "$TOOL" || "$(git -C "$LLAMA" rev-parse HEAD 2>/dev/null)" != "$LLAMA_CPP_COMMIT"* ]]; then
  say "llama.cpp-ийн merge хэрэгслийг бүтээж байна (нэг удаа, ~2–5 мин)"
  need git || die "git алга. Mac дээр: xcode-select --install"
  if ! need cmake; then
    need brew || die "cmake алга. https://cmake.org эсвэл Homebrew-ээр суулгана уу."
    brew install cmake >&2
  fi
  rm -rf "$LLAMA" && mkdir -p "$LLAMA"
  git -C "$LLAMA" init -q
  git -C "$LLAMA" fetch -q --depth 1 https://github.com/ggml-org/llama.cpp "$LLAMA_CPP_COMMIT"
  git -C "$LLAMA" checkout -q FETCH_HEAD
  cmake -S "$LLAMA" -B "$LLAMA/build" -DCMAKE_BUILD_TYPE=Release -DGGML_METAL=OFF -DLLAMA_CURL=OFF \
    -DLLAMA_BUILD_TESTS=OFF -DLLAMA_BUILD_EXAMPLES=OFF -DLLAMA_BUILD_SERVER=OFF >"$STATE/llama-build.log" 2>&1 ||
    die "cmake алдаа. $STATE/llama-build.log-г харна уу."
  cmake --build "$LLAMA/build" --target llama-export-lora -j "$(cpus)" >>"$STATE/llama-build.log" 2>&1 ||
    die "Build алдаа. $STATE/llama-build.log-г харна уу."
  [[ -x "$TOOL" ]] || die "llama-export-lora бүтээгдсэнгүй. $STATE/llama-build.log-г харна уу."
fi

# 3 · the official base model (resumes if the download was cut)
BASE="$STATE/base/$(basename "${BASE_URL%%\?*}")"
if [[ ! -f "$BASE" || "$(sha256 "$BASE")" != "$BASE_SHA256" ]]; then
  say "Qwen2.5-3B-Instruct-ийг татаж байна (~3.6 GB, нэг удаа)"
  curl -fL --retry 5 -C - -o "$BASE" "$BASE_URL" ||
    curl -fL --retry 5 -o "$BASE" "$BASE_URL" || die "Base загварыг татаж чадсангүй: $BASE_URL"
  [[ "$(sha256 "$BASE")" == "$BASE_SHA256" ]] || { rm -f "$BASE"; die "Татсан base файл эвдэрсэн (sha256). Дахин ажиллуулна уу."; }
fi

# 4 · merge
say "Adapter-ийг base загвартай нэгтгэж байна (~1–3 мин)"
rm -f "$OUT/suu.gguf" "$OUT/.built"
"$TOOL" -m "$BASE" --lora "$SRC/$ADAPTER" -o "$OUT/suu.gguf.part" -t "$(cpus)" >"$STATE/merge.log" 2>&1 ||
  die "Нэгтгэж чадсангүй. $STATE/merge.log-г харна уу."
mv "$OUT/suu.gguf.part" "$OUT/suu.gguf"
cp "$SRC/Modelfile" "$SRC/build.env" "$OUT/"
[[ -f "$SRC/prompts.json" ]] && cp "$SRC/prompts.json" "$OUT/"
echo "$DONE" >"$OUT/.built"
say "Бэлэн: $OUT/suu.gguf"
echo "$OUT"
