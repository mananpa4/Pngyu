import { spawn } from "node:child_process";
import dns from "node:dns/promises";
import net from "node:net";
import path from "node:path";
import ffmpegStatic from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";
import { AppError } from "./errors";
import { INPUT_EXTENSIONS, OUTPUT_BY_ID } from "./formats";
import type { ConvertOptions, MediaMetadata, OutputFormat } from "./types";

export const MAX_BYTES =
  Math.max(1, Number(process.env.MAX_UPLOAD_MB || 200)) * 1024 * 1024;
const TIMEOUT_MS =
  Math.max(10, Number(process.env.CONVERSION_TIMEOUT_SECONDS || 180)) * 1000;
const extensions = new Set(INPUT_EXTENSIONS.map((item) => `.${item}`));
const videoExtensions = new Set([
  ".mp4", ".m4v", ".mov", ".mkv", ".webm", ".avi", ".mpeg", ".mpg",
  ".wmv", ".flv", ".ts", ".mts", ".m2ts", ".3gp", ".3g2", ".ogv",
]);

const resolvedFfmpegPath = process.env.FFMPEG_PATH || ffmpegStatic;
const ffprobePath = process.env.FFPROBE_PATH || ffprobeStatic.path;
if (!resolvedFfmpegPath) throw new Error("FFmpeg binary is unavailable.");
const ffmpegPath: string = resolvedFfmpegPath;

function run(executable: string, args: string[], timeout = TIMEOUT_MS) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(executable, args, { windowsHide: true });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback();
    };
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish(() => reject(new AppError("Media processing timed out.", 408)));
    }, timeout);
    child.stdout.on("data", (chunk) => (stdout += chunk.toString()));
    child.stderr.on("data", (chunk) => (stderr += chunk.toString()));
    child.on("error", (error) =>
      finish(() => reject(new AppError(`Unable to start the media processor: ${error.message}`, 500))),
    );
    child.on("close", (code) =>
      finish(() => code === 0
        ? resolve({ stdout, stderr })
        : reject(new AppError(stderr.trim().slice(-1600) || "Media processing failed."))),
    );
  });
}

export function validateFilename(filename: string) {
  const extension = path.extname(filename).toLowerCase();
  if (!/^\.[a-z0-9]{1,10}$/.test(extension))
    throw new AppError("The input needs a short alphanumeric file extension.");
  return extension;
}

export function validateFileSignature(bytes: Uint8Array, extension: string) {
  // Strongly validate containers we recognize. Unknown extensions continue to
  // ffprobe, which is the authoritative capability check for the active build.
  if (!extensions.has(extension)) return;
  const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = buffer.subarray(0, Math.min(buffer.length, 8192)).toString("latin1");
  const hex = buffer.subarray(0, 32).toString("hex");
  const riffType = ascii.slice(8, 12);
  const isoBrand = ascii.slice(4, 32);
  const isIsoMedia = ascii.slice(4, 8) === "ftyp";
  const isTransportStream = buffer[0] === 0x47 || buffer[4] === 0x47 ||
    (buffer.length > 376 && buffer[188] === 0x47 && buffer[376] === 0x47);
  const valid =
    ([".jpg", ".jpeg"].includes(extension) && hex.startsWith("ffd8ff")) ||
    ([".png", ".apng"].includes(extension) && hex.startsWith("89504e470d0a1a0a") &&
      (extension !== ".apng" || buffer.includes(Buffer.from("acTL")))) ||
    (extension === ".gif" && ascii.startsWith("GIF8")) ||
    (extension === ".webp" && ascii.startsWith("RIFF") && riffType === "WEBP") ||
    ([".avif", ".heic", ".heif"].includes(extension) && isIsoMedia &&
      /avif|avis|heic|heix|hevc|hevx|mif1|msf1/.test(isoBrand)) ||
    (extension === ".jxl" && (hex.startsWith("ff0a") || hex.startsWith("0000000c4a584c20"))) ||
    (extension === ".mng" && hex.startsWith("8a4d4e470d0a1a0a")) ||
    (extension === ".bmp" && ascii.startsWith("BM")) ||
    ([".tif", ".tiff"].includes(extension) &&
      (hex.startsWith("49492a00") || hex.startsWith("4d4d002a"))) ||
    ([".mp4", ".m4v", ".mov", ".3gp", ".3g2"].includes(extension) && isIsoMedia) ||
    ([".mkv", ".webm"].includes(extension) && hex.startsWith("1a45dfa3")) ||
    (extension === ".avi" && ascii.startsWith("RIFF") && riffType === "AVI ") ||
    ([".mpeg", ".mpg"].includes(extension) &&
      (hex.startsWith("000001ba") || hex.startsWith("000001b3"))) ||
    (extension === ".wmv" && hex.startsWith("3026b2758e66cf11")) ||
    (extension === ".flv" && ascii.startsWith("FLV")) ||
    ([".ts", ".mts", ".m2ts"].includes(extension) && isTransportStream) ||
    (extension === ".ogv" && ascii.startsWith("OggS"));
  if (!valid)
    throw new AppError("The file contents do not match its image/video extension.");
}

export async function probe(filePath: string): Promise<MediaMetadata> {
  let stdout: string;
  try {
    ({ stdout } = await run(ffprobePath, [
      "-v", "error", "-count_frames", "-show_streams", "-show_format", "-of", "json", filePath,
    ]));
  } catch {
    throw new AppError("The file is corrupt or unsupported by the active FFmpeg build.");
  }
  const data = JSON.parse(stdout) as {
    streams?: Array<Record<string, string | number>>;
    format?: Record<string, string>;
  };
  const stream = data.streams?.find((item) => item.codec_type === "video");
  if (!stream) throw new AppError("The file is corrupt or has no visual stream.");
  const number = (value: unknown) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const frames = number(stream.nb_read_frames ?? stream.nb_frames);
  const duration = number(stream.duration ?? data.format?.duration) ?? (() => {
    const rate = String(stream.avg_frame_rate || stream.r_frame_rate || "").split("/").map(Number);
    return frames && rate.length === 2 && rate[0] > 0 && rate[1] > 0
      ? frames / (rate[0] / rate[1]) : null;
  })();
  const detectedFormat = data.format?.format_name || String(stream.codec_name || "unknown");
  const detectedVideo = /mov|mp4|matroska|webm|avi|mpeg|asf|flv|mpegts|ogg|3gp/i.test(detectedFormat);
  return {
    width: number(stream.width),
    height: number(stream.height),
    frames,
    duration,
    format: detectedFormat,
    mediaType: videoExtensions.has(path.extname(filePath).toLowerCase()) || detectedVideo ? "video" : "image",
    hasAudio: Boolean(data.streams?.some((item) => item.codec_type === "audio")),
  };
}

function crfForQuality(quality: number, minimum: number, maximum: number) {
  return Math.round(maximum - (quality / 100) * (maximum - minimum));
}

export async function convert(
  input: string,
  output: string,
  options: ConvertOptions,
  source: MediaMetadata,
) {
  const definition = OUTPUT_BY_ID[options.format];
  const sourceIsStill = source.mediaType === "image" && (source.frames === null || source.frames <= 1);
  const args = ["-hide_banner", "-y"];
  if (sourceIsStill && definition.kind === "video")
    args.push("-loop", "1", "-framerate", String(options.fps || 25));
  args.push("-i", input);

  const filters: string[] = [];
  if (options.crop) filters.push(`crop=${options.crop}`);
  if (options.width) filters.push(`scale=${options.width}:-2:flags=lanczos`);
  if (options.fps) filters.push(`fps=${options.fps}`);
  if (definition.kind === "video" && !options.width)
    filters.push("scale=trunc(iw/2)*2:trunc(ih/2)*2");
  if (filters.length) args.push("-vf", filters.join(","));

  if (definition.kind === "video") {
    const codec = options.codec === "auto" ? definition.codecs[0].id : options.codec;
    const codecName: Record<string, string> = {
      vp9: "libvpx-vp9", vp8: "libvpx", h264: "libx264", hevc: "libx265", mpeg4: "mpeg4",
    };
    args.push("-c:v", codecName[codec]);
    if (codec === "mpeg4") args.push("-q:v", String(crfForQuality(options.quality, 2, 20)));
    else args.push("-crf", String(crfForQuality(options.quality, 18, codec.startsWith("vp") ? 50 : 40)));
    if (options.bitrate > 0) args.push("-b:v", `${options.bitrate}k`);
    if (options.includeAudio && source.hasAudio) {
      args.push("-c:a", options.format === "webm" ? "libopus" : options.format === "avi" ? "libmp3lame" : "aac");
    } else {
      args.push("-an");
    }
    args.push("-pix_fmt", "yuv420p");
    if (sourceIsStill) args.push("-t", String(options.stillDuration));
    if (options.format === "mp4" || options.format === "mov") args.push("-movflags", "+faststart");
    if (options.loop) args.push("-metadata", "loop=0");
  } else {
    args.push("-an");
    if (definition.kind === "still") args.push("-frames:v", "1", "-update", "1");
    switch (options.format) {
      case "gif":
        args.push("-loop", options.loop ? "0" : "-1");
        break;
      case "webp":
        args.push("-c:v", "libwebp_anim", "-quality", String(options.quality),
          "-compression_level", "6", "-loop", options.loop ? "0" : "1");
        break;
      case "avif":
        args.push("-c:v", "libaom-av1", "-crf", String(crfForQuality(options.quality, 18, 55)), "-still-picture", "1");
        break;
      case "jpg":
        args.push("-q:v", String(crfForQuality(options.quality, 2, 31)));
        break;
      case "png":
        args.push("-compression_level", String(Math.round((options.quality / 100) * 9)));
        break;
      case "tiff":
        args.push("-compression_algo", "deflate");
        break;
    }
  }
  args.push(output);
  try {
    await run(ffmpegPath, args);
  } catch (error) {
    if (error instanceof AppError) {
      throw new AppError(
        error.message.replaceAll(input, "<input>").replaceAll(output, "<output>"),
        error.status,
      );
    }
    throw error;
  }
}

function isPrivateIp(address: string) {
  if (net.isIPv4(address)) {
    const [a, b] = address.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  const normalized = address.toLowerCase();
  return normalized === "::1" || normalized === "::" || normalized.startsWith("fc") ||
    normalized.startsWith("fd") || normalized.startsWith("fe80:");
}

export async function validateRemoteUrl(value: string) {
  let url: URL;
  try { url = new URL(value); } catch { throw new AppError("Enter a valid direct URL."); }
  if (!["http:", "https:"].includes(url.protocol)) throw new AppError("Only HTTP and HTTPS URLs are allowed.");
  if (url.username || url.password) throw new AppError("URLs with credentials are not allowed.");
  if (url.hostname === "localhost") throw new AppError("Local addresses are not allowed.");
  const addresses = await dns.lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateIp(address)))
    throw new AppError("Private or local network addresses are not allowed.");
  return url;
}

export function parseOptions(value: unknown): ConvertOptions {
  if (!value || typeof value !== "object") throw new AppError("Missing conversion options.");
  const body = value as Record<string, unknown>;
  const format = typeof body.format === "string" && body.format in OUTPUT_BY_ID
    ? body.format as OutputFormat : null;
  if (!format) throw new AppError("Invalid output format.");
  const definition = OUTPUT_BY_ID[format];
  const codec = typeof body.codec === "string" ? body.codec : "auto";
  if (codec !== "auto" && !definition.codecs.some((item) => item.id === codec))
    throw new AppError("The selected codec is incompatible with the output format.");
  const bitrate = Number(body.bitrate);
  const quality = Number(body.quality);
  const stillDuration = Number(body.stillDuration ?? 3);
  if (!Number.isInteger(bitrate) || bitrate < 0 || bitrate > 100000 ||
      !Number.isInteger(quality) || quality < 1 || quality > 100 ||
      !Number.isFinite(stillDuration) || stillDuration < 0.1 || stillDuration > 3600)
    throw new AppError("Quality, bitrate or duration is outside the allowed range.");
  const optionalInt = (item: unknown, min: number, max: number) => {
    if (item === null || item === undefined || item === "") return null;
    const parsed = Number(item);
    if (!Number.isInteger(parsed) || parsed < min || parsed > max)
      throw new AppError("One or more numeric options are outside the allowed range.");
    return parsed;
  };
  const crop = typeof body.crop === "string" && body.crop.trim() ? body.crop.trim() : null;
  if (crop && !/^\d+:\d+:\d+:\d+$/.test(crop))
    throw new AppError("Crop must use width:height:x:y with whole numbers.");
  return {
    format,
    codec: codec as ConvertOptions["codec"],
    bitrate,
    quality,
    width: optionalInt(body.width, 16, 16384),
    fps: optionalInt(body.fps, 1, 120),
    crop,
    loop: body.loop !== false,
    includeAudio: body.includeAudio !== false,
    stillDuration,
  };
}
