#!/usr/bin/env bash
set -euo pipefail

QUALITY=80
SCALE=100
FORMAT=""
DIRECTORY=""
OVERWRITE=0
DURATION=3

usage() {
  printf '%s\n' \
    'Usage: batch_convert.sh -d <directory> -f <format> [-q <1-100>] [-s <1-400>] [-t <seconds>] [-y]' \
    '' \
    'Recursively converts common image/video files with FFmpeg.' \
    '' \
    '  -d  Input directory' \
    '  -f  Output: webm, mp4, mov, mkv, avi, gif, webp, avif, png, jpg, tiff, bmp' \
    '  -q  Quality percentage (default: 80)' \
    '  -s  Scale percentage (default: 100)' \
    '  -t  Duration when a still image becomes video (default: 3 seconds)' \
    '  -y  Overwrite existing output files (default: skip)'
  exit 2
}

while getopts "d:f:q:s:t:y" option; do
  case "$option" in
    d) DIRECTORY=$OPTARG ;;
    f) FORMAT=$(printf '%s' "$OPTARG" | tr '[:upper:]' '[:lower:]') ;;
    q) QUALITY=$OPTARG ;;
    s) SCALE=$OPTARG ;;
    t) DURATION=$OPTARG ;;
    y) OVERWRITE=1 ;;
    *) usage ;;
  esac
done

[[ -n "$DIRECTORY" && -d "$DIRECTORY" ]] || usage
[[ "$FORMAT" =~ ^(webm|mp4|mov|mkv|avi|gif|webp|avif|png|jpg|tiff|bmp)$ ]] || usage
[[ "$QUALITY" =~ ^[0-9]+$ && "$QUALITY" -ge 1 && "$QUALITY" -le 100 ]] || usage
[[ "$SCALE" =~ ^[0-9]+$ && "$SCALE" -ge 1 && "$SCALE" -le 400 ]] || usage
[[ "$DURATION" =~ ^[0-9]+([.][0-9]+)?$ ]] || usage
command -v ffmpeg >/dev/null 2>&1 || { echo "Error: ffmpeg is not in PATH." >&2; exit 1; }

quality_inverse() {
  local best=$1 worst=$2
  awk -v q="$QUALITY" -v best="$best" -v worst="$worst" 'BEGIN { printf "%.0f", worst-(q/100)*(worst-best) }'
}

converted=0
skipped=0
failed=0

file_list=$(mktemp)
trap 'rm -f "$file_list"' EXIT
find "$DIRECTORY" -type f \( \
  -iname '*.gif' -o -iname '*.apng' -o -iname '*.png' -o -iname '*.jpg' -o \
  -iname '*.jpeg' -o -iname '*.webp' -o -iname '*.avif' -o -iname '*.heic' -o \
  -iname '*.heif' -o -iname '*.jxl' -o -iname '*.mng' -o -iname '*.bmp' -o \
  -iname '*.tif' -o -iname '*.tiff' -o -iname '*.mp4' -o -iname '*.m4v' -o \
  -iname '*.mov' -o -iname '*.mkv' -o -iname '*.webm' -o -iname '*.avi' -o \
  -iname '*.mpeg' -o -iname '*.mpg' -o -iname '*.wmv' -o -iname '*.flv' -o \
  -iname '*.ts' -o -iname '*.mts' -o -iname '*.m2ts' -o -iname '*.3gp' -o \
  -iname '*.3g2' -o -iname '*.ogv' \) -print0 > "$file_list"

while IFS= read -r -d '' input; do
  base=${input%.*}
  output="${base}.${FORMAT}"
  if [[ "$output" == "$input" ]]; then output="${base}_converted.${FORMAT}"; fi
  if [[ -e "$output" && "$OVERWRITE" -eq 0 ]]; then
    echo "Skip (exists): $output"
    ((skipped+=1))
    continue
  fi

  filters=()
  if [[ "$SCALE" -ne 100 ]]; then
    filters+=("scale=trunc(iw*${SCALE}/100/2)*2:trunc(ih*${SCALE}/100/2)*2:flags=lanczos")
  fi
  input_extension=${input##*.}
  input_extension=$(printf '%s' "$input_extension" | tr '[:upper:]' '[:lower:]')
  is_video_output=0
  [[ "$FORMAT" =~ ^(webm|mp4|mov|mkv|avi)$ ]] && is_video_output=1
  is_still_input=0
  [[ "$input_extension" =~ ^(png|jpg|jpeg|avif|heic|heif|jxl|bmp|tif|tiff)$ ]] && is_still_input=1
  args=(-hide_banner -loglevel error -y)
  if [[ "$is_video_output" -eq 1 && "$is_still_input" -eq 1 ]]; then
    args+=(-loop 1 -framerate 25)
  fi
  args+=(-i "$input")
  if [[ ${#filters[@]} -gt 0 ]]; then args+=(-vf "$(IFS=,; echo "${filters[*]}")"); fi

  case "$FORMAT" in
    webm) args+=(-c:v libvpx-vp9 -crf "$(quality_inverse 18 50)" -b:v 0 -c:a libopus -pix_fmt yuv420p) ;;
    mp4|mov) args+=(-c:v libx264 -crf "$(quality_inverse 18 40)" -c:a aac -pix_fmt yuv420p -movflags +faststart) ;;
    mkv) args+=(-c:v libx264 -crf "$(quality_inverse 18 40)" -c:a aac -pix_fmt yuv420p) ;;
    avi) args+=(-c:v mpeg4 -q:v "$(quality_inverse 2 20)" -c:a libmp3lame) ;;
    gif) args+=(-an -loop 0) ;;
    webp) args+=(-an -c:v libwebp_anim -quality "$QUALITY" -compression_level 6 -loop 0) ;;
    avif) args+=(-an -frames:v 1 -update 1 -c:v libaom-av1 -crf "$(quality_inverse 18 55)" -still-picture 1) ;;
    jpg) args+=(-an -frames:v 1 -update 1 -q:v "$(quality_inverse 2 31)") ;;
    png) args+=(-an -frames:v 1 -update 1 -compression_level "$((QUALITY*9/100))") ;;
    tiff) args+=(-an -frames:v 1 -update 1 -compression_algo deflate) ;;
    bmp) args+=(-an -frames:v 1 -update 1) ;;
  esac
  if [[ "$is_video_output" -eq 1 && "$is_still_input" -eq 1 ]]; then args+=(-t "$DURATION"); fi
  args+=("$output")

  echo "Convert: $input -> $output"
  if ffmpeg "${args[@]}"; then ((converted+=1)); else ((failed+=1)); rm -f -- "$output"; fi
done < "$file_list"

echo "Complete: $converted converted, $skipped skipped, $failed failed."
[[ "$failed" -eq 0 ]]
