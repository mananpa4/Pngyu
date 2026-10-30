import type { OutputFormat } from "./types";

export type OutputDefinition = {
  id: OutputFormat;
  label: string;
  kind: "video" | "animated" | "still";
  mime: string;
  codecs: Array<{ id: string; label: string }>;
};

export const OUTPUT_FORMATS: OutputDefinition[] = [
  { id: "webm", label: "WebM", kind: "video", mime: "video/webm", codecs: [{ id: "vp9", label: "VP9" }, { id: "vp8", label: "VP8" }] },
  { id: "mp4", label: "MP4", kind: "video", mime: "video/mp4", codecs: [{ id: "h264", label: "H.264" }, { id: "hevc", label: "H.265 / HEVC" }] },
  { id: "mov", label: "MOV", kind: "video", mime: "video/quicktime", codecs: [{ id: "h264", label: "H.264" }, { id: "hevc", label: "H.265 / HEVC" }] },
  { id: "mkv", label: "Matroska (MKV)", kind: "video", mime: "video/x-matroska", codecs: [{ id: "h264", label: "H.264" }, { id: "hevc", label: "H.265 / HEVC" }, { id: "vp9", label: "VP9" }] },
  { id: "avi", label: "AVI", kind: "video", mime: "video/x-msvideo", codecs: [{ id: "mpeg4", label: "MPEG-4 Part 2" }] },
  { id: "gif", label: "Animated GIF", kind: "animated", mime: "image/gif", codecs: [{ id: "auto", label: "GIF" }] },
  { id: "webp", label: "WebP", kind: "animated", mime: "image/webp", codecs: [{ id: "auto", label: "WebP" }] },
  { id: "avif", label: "AVIF", kind: "still", mime: "image/avif", codecs: [{ id: "auto", label: "AV1" }] },
  { id: "png", label: "PNG", kind: "still", mime: "image/png", codecs: [{ id: "auto", label: "PNG" }] },
  { id: "jpg", label: "JPEG", kind: "still", mime: "image/jpeg", codecs: [{ id: "auto", label: "JPEG" }] },
  { id: "tiff", label: "TIFF", kind: "still", mime: "image/tiff", codecs: [{ id: "auto", label: "TIFF" }] },
  { id: "bmp", label: "BMP", kind: "still", mime: "image/bmp", codecs: [{ id: "auto", label: "BMP" }] },
];

export const OUTPUT_BY_ID = Object.fromEntries(
  OUTPUT_FORMATS.map((format) => [format.id, format]),
) as Record<OutputFormat, OutputDefinition>;

export const INPUT_EXTENSIONS = [
  "gif", "apng", "png", "jpg", "jpeg", "webp", "avif", "heic", "heif",
  "jxl", "mng", "bmp", "tif", "tiff", "mp4", "m4v", "mov", "mkv",
  "webm", "avi", "mpeg", "mpg", "wmv", "flv", "ts", "mts", "m2ts",
  "3gp", "3g2", "ogv",
] as const;

export const INPUT_ACCEPT = INPUT_EXTENSIONS.map((item) => `.${item}`).join(",");
