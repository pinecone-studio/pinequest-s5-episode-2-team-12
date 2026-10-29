#!/usr/bin/env bash
# Суу-г энэ Mac дээр ажиллуулж, вэбсайтад холбоно.  Run Suu on this Mac and connect it to the website.
#
#   bash ai/serve/start.sh [model folder]      # default: ai/models/suu-v1 (git дэх загвар)
#   bash ai/serve/start.sh --local [folder]    # tunnel-гүй: вэбсайт энэ Mac дээр `bun dev`-ээр ажиллаж байвал
#
# Model folder: either a git model folder (build.env + adapter; suu.gguf is built once by ai/serve/build-model.sh)
# or a folder that already holds Modelfile + suu.gguf (e.g. downloaded from Drive).
# What it does: Ollama → `ollama create suu` → token gate (ai/serve/proxy.ts) → Cloudflare quick tunnel →
# prints OLLAMA_URL / OLLAMA_TOKEN for the website. Keeps the Mac awake while it runs. Ctrl+C stops everything.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/../.." && pwd)"
LOCAL=0
if [[ "${1:-}" == "--local" ]]; then LOCAL=1; shift; fi
MODEL_DIR="${1:-$REPO/ai/models/suu-v1}"
MODEL_NAME="${OLLAMA_MODEL:-suu}"
OLLAMA="http://127.0.0.1:11434"
GATE_PORT="${SUU_PROXY_PORT:-11435}"
STATE="$HOME/.suu"
mkdir -p "$STATE" && chmod 700 "$STATE"

say() { printf '\n\033[1;32m▸ %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1; }

PIDS=()
cleanup() { for p in "${PIDS[@]:-}"; do [[ -n "$p" ]] && kill "$p" 2>/dev/null || true; done; }
trap cleanup EXIT INT TERM

# 1 · tools
say "1/6 Хэрэгслүүдийг шалгаж байна (Homebrew, Ollama, cloudflared, Bun)"
need brew || die "Homebrew алга. https://brew.sh дээрх нэг мөр командыг Terminal-д ажиллуулаад дахин оролдоно уу."
need ollama || brew install ollama
[[ $LOCAL -eq 1 ]] || need cloudflared || brew install cloudflared
need bun || { curl -fsSL https://bun.sh/install | bash; export PATH="$HOME/.bun/bin:$PATH"; }

# 2 · model files
say "2/6 Загварын файлууд: $MODEL_DIR"
[[ -d "$MODEL_DIR" ]] || die "$MODEL_DIR хавтас алга."
if [[ ! -f "$MODEL_DIR/suu.gguf" && -f "$MODEL_DIR/build.env" ]]; then
  # git model folder: build suu.gguf once from the adapter (cached in ~/.suu/models)
  MODEL_DIR="$(bash "$REPO/ai/serve/build-model.sh" "$MODEL_DIR" | tail -n 1)"
fi
[[ -f "$MODEL_DIR/Modelfile" ]] || die "$MODEL_DIR/Modelfile алга."
[[ -f "$MODEL_DIR/suu.gguf" ]] || die "$MODEL_DIR/suu.gguf алга (git-ийн загварын хавтас эсвэл Drive-аас татсан хавтас өгнө үү)."
# what this model version learned (build.env SKILLS, e.g. "desmos" for v1); empty = every skill
SKILLS="$(sed -n 's/^SKILLS=//p' "$MODEL_DIR/build.env" 2>/dev/null | tail -n 1)"

# 3 · Ollama server
say "3/6 Ollama асааж байна"
if ! curl -sf "$OLLAMA/api/version" >/dev/null; then
  # keep Suu loaded between students (default: unloaded after 5 idle minutes, then a ~20 s reload)
  OLLAMA_KEEP_ALIVE="${OLLAMA_KEEP_ALIVE:-2h}" ollama serve >"$STATE/ollama.log" 2>&1 &
  PIDS+=($!)
  for _ in $(seq 1 30); do curl -sf "$OLLAMA/api/version" >/dev/null && break; sleep 1; done
fi
curl -sf "$OLLAMA/api/version" >/dev/null || die "Ollama асахгүй байна. $STATE/ollama.log-г харна уу."

# 4 · create the model (again only when the .gguf changed)
say "4/6 '$MODEL_NAME' загварыг Ollama-д нэмж байна"
STAMP="$(stat -f '%m %z' "$MODEL_DIR/suu.gguf" 2>/dev/null || stat -c '%Y %s' "$MODEL_DIR/suu.gguf")"
if [[ "$(cat "$STATE/model.stamp" 2>/dev/null)" != "$STAMP" ]] || ! ollama show "$MODEL_NAME" >/dev/null 2>&1; then
  (cd "$MODEL_DIR" && ollama create "$MODEL_NAME" -f Modelfile)
  echo "$STAMP" >"$STATE/model.stamp"
fi
REPLY_TEXT="$(curl -sf "$OLLAMA/api/chat" -d "{\"model\":\"$MODEL_NAME\",\"stream\":false,\"options\":{\"num_predict\":40},\"messages\":[{\"role\":\"user\",\"content\":\"Сайн уу, Суу!\"}]}" | bun -e 'const t=await Bun.stdin.text();try{console.log(JSON.parse(t).message.content)}catch{console.log("")}')"
[[ -n "$REPLY_TEXT" ]] || die "Загвар хариу өгсөнгүй. 'ollama run $MODEL_NAME' гэж туршаад алдааг харна уу."
echo "Суу: $REPLY_TEXT"

# keep the Mac awake while this script runs (the screen may still turn off)
caffeinate -dims -w $$ &
PIDS+=($!)

if [[ $LOCAL -eq 1 ]]; then
  say "Бэлэн (local). Вэбсайтын .env.local:"
  printf 'OLLAMA_URL=%s\nOLLAMA_MODEL=%s\nOLLAMA_TOKEN=\nOLLAMA_SKILLS=%s\n' "$OLLAMA" "$MODEL_NAME" "$SKILLS"
  wait
  exit 0
fi

# 5 · token gate
say "5/6 Нууц түлхүүртэй хаалга (proxy) асааж байна"
if [[ ! -s "$STATE/token" ]]; then
  (umask 077 && openssl rand -hex 24 >"$STATE/token")
fi
TOKEN="$(cat "$STATE/token")"
OLLAMA_TOKEN="$TOKEN" OLLAMA_MODEL="$MODEL_NAME" SUU_PROXY_PORT="$GATE_PORT" bun "$REPO/ai/serve/proxy.ts" >"$STATE/proxy.log" 2>&1 &
PIDS+=($!)
for _ in $(seq 1 20); do
  curl -sf -H "authorization: Bearer $TOKEN" "http://127.0.0.1:$GATE_PORT/api/version" >/dev/null && break
  sleep 0.5
done
curl -sf -H "authorization: Bearer $TOKEN" "http://127.0.0.1:$GATE_PORT/api/version" >/dev/null ||
  die "Proxy асахгүй байна. $STATE/proxy.log-г харна уу."

# 6 · public tunnel
say "6/6 Интернэт рүү tunnel нээж байна (Cloudflare)"
: >"$STATE/tunnel.log"
cloudflared tunnel --no-autoupdate --url "http://127.0.0.1:$GATE_PORT" >"$STATE/tunnel.log" 2>&1 &
PIDS+=($!)
URL=""
for _ in $(seq 1 60); do
  URL="$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$STATE/tunnel.log" | head -1 || true)"
  [[ -n "$URL" ]] && break
  sleep 1
done
[[ -n "$URL" ]] || die "Tunnel URL гарсангүй. $STATE/tunnel.log-г харна уу."
ok=0
for _ in $(seq 1 20); do
  curl -sf -H "authorization: Bearer $TOKEN" "$URL/api/version" >/dev/null && { ok=1; break; }
  sleep 2
done
[[ $ok -eq 1 ]] || die "Tunnel нээгдсэн ч хариу ирэхгүй байна: $URL"

printf 'OLLAMA_URL=%s\nOLLAMA_TOKEN=%s\nOLLAMA_MODEL=%s\nOLLAMA_SKILLS=%s\n' "$URL" "$TOKEN" "$MODEL_NAME" "$SKILLS" \
  >"$STATE/website.env"
chmod 600 "$STATE/website.env"
say "Бэлэн! Вэбсайтын environment variables-д эдгээрийг тавиад redeploy хийнэ үү:"
cat "$STATE/website.env"
echo
echo "(Хадгалсан: $STATE/website.env · Энэ цонхыг хаавал Суу унтарна · Дахин асаахад URL өөрчлөгдөнө.)"
wait
