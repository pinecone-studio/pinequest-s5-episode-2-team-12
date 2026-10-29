# shellcheck shell=bash
# Shared by start.sh and build-model.sh: make sure a tool is on PATH, without needing admin rights.
# On a shared Mac (e.g. a school iMac) Homebrew often belongs to another user ("/opt/homebrew/Cellar is not
# writable"), so when brew can't install we download the official release into ~/.suu/tools instead.
SUU_TOOLS="${SUU_HOME:-$HOME/.suu}/tools"
CMAKE_VERSION="3.31.6"
export PATH="$SUU_TOOLS/ollama:$SUU_TOOLS:$SUU_TOOLS/cmake-$CMAKE_VERSION-macos-universal/CMake.app/Contents/bin:$HOME/.bun/bin:$PATH"

_have() { command -v "$1" >/dev/null 2>&1; }
_say() { printf '\033[1;32m▸ %s\033[0m\n' "$*" >&2; }

# brew is usable only when this user can write to its Cellar
brew_ok() { _have brew && [[ -w "$(brew --prefix 2>/dev/null)/Cellar" ]]; }

_arch() { [[ "$(uname -m)" == "arm64" ]] && echo arm64 || echo amd64; }

# ensure_tool <name>: ollama | cloudflared | cmake | bun
ensure_tool() {
  local t="$1"
  _have "$t" && return 0
  if [[ "$t" != bun ]] && brew_ok; then
    _say "$t суулгаж байна (Homebrew)"
    brew install "$t" >&2 && _have "$t" && return 0
  fi
  mkdir -p "$SUU_TOOLS"
  _say "$t-г ~/.suu/tools руу татаж байна (admin эрх хэрэггүй)"
  case "$t" in
    ollama)
      mkdir -p "$SUU_TOOLS/ollama"
      curl -fL --retry 3 https://github.com/ollama/ollama/releases/latest/download/ollama-darwin.tgz |
        tar xz -C "$SUU_TOOLS/ollama" ;;
    cloudflared)
      curl -fL --retry 3 "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-$(_arch).tgz" |
        tar xz -C "$SUU_TOOLS" ;;
    cmake)
      curl -fL --retry 3 "https://github.com/Kitware/CMake/releases/download/v$CMAKE_VERSION/cmake-$CMAKE_VERSION-macos-universal.tar.gz" |
        tar xz -C "$SUU_TOOLS" ;;
    bun)
      curl -fsSL https://bun.sh/install | bash >&2 ;;
    *) return 1 ;;
  esac
  _have "$t"
}

# C++ builds on macOS: some Macs' compilers can't find the standard headers ("'array' file not found") until
# they are told where the SDK is.
macos_sdk() {
  [[ "$(uname -s)" == Darwin ]] || return 0
  [[ -n "${SDKROOT:-}" ]] && return 0
  local sdk
  sdk="$(xcrun --sdk macosx --show-sdk-path 2>/dev/null || true)"
  [[ -n "$sdk" ]] && export SDKROOT="$sdk"
  return 0
}
