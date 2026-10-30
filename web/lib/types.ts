export type MediaMetadata = {
  width: number | null;
  height: number | null;
  frames: number | null;
  duration: number | null;
  format: string;
  mediaType: "image" | "video";
  hasAudio: boolean;
};

export type OutputFormat =
  | "webm" | "mp4" | "mov" | "mkv" | "avi"
  | "gif" | "webp" | "avif" | "png" | "jpg" | "tiff" | "bmp";

export type JobRecord = {
  id: string;
  inputName: string;
  inputPath: string;
  mime: string;
  originalSize: number;
  createdAt: string;
  expiresAt: string;
  metadata: MediaMetadata;
  output?: {
    path: string;
    size: number;
    createdAt: string;
    format: OutputFormat;
    mime: string;
  };
};

export type PublicJob = Omit<JobRecord, "inputPath" | "output"> & {
  inputUrl: string;
  output?: {
    size: number;
    createdAt: string;
    url: string;
    format: OutputFormat;
    mime: string;
  };
};

export type ConvertOptions = {
  format: OutputFormat;
  codec: "auto" | "vp8" | "vp9" | "h264" | "hevc" | "mpeg4";
  bitrate: number;
  quality: number;
  width: number | null;
  fps: number | null;
  crop: string | null;
  loop: boolean;
  includeAudio: boolean;
  stillDuration: number;
};
