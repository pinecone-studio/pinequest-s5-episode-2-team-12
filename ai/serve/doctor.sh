#!/usr/bin/env bash
# Checks this Mac before running Suu, and changes nothing:  bash ai/serve/doctor.sh
# Prints ✓ / ✗ for each thing start.sh needs, with what to do when something is missing.
set -uo pipefail
STATE="${SUU_HOME:-$HOME/.suu}"
# tools start.sh downloads without admin rights live here (ai/serve/tools.sh)
export PATH="$STATE/tools/ollama:$STATE/tools:$HOME/.bun/bin:$PATH"
ok=0
bad=0
good() { printf '  \033[32m✓\033[0m %s\n' "$*"; ok=$((ok + 1)); }
fail() { printf '  \033[31m✗\033[0m %s\n' "$*"; bad=$((bad + 1)); }
have() { command -v "$1" >/dev/null 2>&1; }

echo "Суу — компьютерийн шалгалт"
arch="$(uname -m)"
if [[ "$arch" == arm64 ]]; then good "Apple Silicon ($arch) — хичээл ~10–30 сек"
else fail "$arch процессор — 3B загвар удаан (хичээл 55 сек-ээс урт байж магадгүй)"; fi

if [[ "$(uname -s)" == Darwin ]]; then
  gb=$(( $(sysctl -n hw.memsize) / 1000000000 ))
else
  gb=$(( $(awk '/MemTotal/ {print $2}' /proc/meminfo) / 1000000 ))
fi
if (( gb >= 16 )); then good "RAM ${gb} GB"
elif (( gb >= 8 )); then good "RAM ${gb} GB (бусад програмаа хаа — загвар 6.2 GB)"
else fail "RAM ${gb} GB — 6.2 GB загварт хүрэлцэхгүй"; fi

free=$(df -Pk "$HOME" | awk 'NR==2 {print int($4/1000000)}')
if (( free >= 15 )); then good "Сул зай ${free} GB"
else fail "Сул зай ${free} GB — 15 GB хэрэгтэй (Qwen 3.6 + угсарсан 6.2 + Ollama хуулбар)"; fi

if have git; then good "git"; else fail "git алга → xcode-select --install"; fi
if [[ "$(uname -s)" == Darwin ]]; then
  if xcrun --sdk macosx --show-sdk-path >/dev/null 2>&1; then good "macOS SDK ($(xcrun --sdk macosx --show-sdk-path))"
  else fail "macOS SDK олдсонгүй → xcode-select --install"; fi
fi
if have brew; then
  if [[ -w "$(brew --prefix)/Cellar" ]]; then good "Homebrew (бичих эрхтэй)"
  else good "Homebrew өөр хэрэглэгчийнх — start.sh хэрэгслийг ~/.suu/tools руу татна"; fi
else good "Homebrew алга — start.sh хэрэгслийг ~/.suu/tools руу татна"; fi
for t in ollama cloudflared cmake bun; do
  if have "$t"; then good "$t ($(command -v "$t"))"; else good "$t одоо алга — start.sh татна"; fi
done

built="$(find "$STATE/models" -name suu.gguf 2>/dev/null | head -1)"
if [[ -n "$built" ]]; then good "Угсарсан загвар: $built"
else good "Загвар хараахан угсраагүй — start.sh анх удаа ~20–30 мин"; fi
if curl -sf http://127.0.0.1:11434/api/version >/dev/null 2>&1; then
  good "Ollama ажиллаж байна"
  if have ollama && ollama show "${OLLAMA_MODEL:-suu}" >/dev/null 2>&1; then good "'${OLLAMA_MODEL:-suu}' загвар Ollama-д бий"; fi
else good "Ollama унтраалттай (start.sh асаана)"; fi

echo
if (( bad == 0 )); then echo "Бэлэн: bash ai/serve/start.sh"; else echo "$bad асуудал засаад дахин шалгана уу."; exit 1; fi
