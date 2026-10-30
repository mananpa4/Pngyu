#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)

case "$(uname -s)" in
  Darwin)
    destination="${1:-$PROJECT_ROOT/ffmpeg_bin/mac/ffmpeg}"
    tmp_dir=$(mktemp -d)
    trap 'rm -rf "$tmp_dir"' EXIT
    mkdir -p "$(dirname "$destination")"
    curl -fL https://evermeet.cx/ffmpeg/getrelease/zip -o "$tmp_dir/ffmpeg.zip"
    unzip -q "$tmp_dir/ffmpeg.zip" -d "$tmp_dir"
    install -m 755 "$tmp_dir/ffmpeg" "$destination"
    ;;
  Linux)
    echo "Install FFmpeg with your distribution package manager (for example: sudo apt install ffmpeg)." >&2
    exit 2
    ;;
  *)
    echo "Unsupported operating system." >&2
    exit 2
    ;;
esac

"$destination" -version | head -n 1
echo "FFmpeg installed at $destination"
