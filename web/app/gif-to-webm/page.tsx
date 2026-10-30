import type { Metadata } from "next";
import { ToolShell } from "@/components/ToolShell";
import { UploadPanel } from "@/components/UploadPanel";

export const metadata: Metadata = { title: "Universal image and video converter", description: "Convert common image and video formats to WebM, MP4, MOV, MKV, AVI, GIF, WebP, AVIF, PNG, JPEG, TIFF or BMP." };

export default function GifToWebm() {
  return <ToolShell title="Image and video converter" description="Convert common images and videos to WebM, MP4, MOV, MKV, AVI, GIF, WebP, AVIF, PNG, JPEG, TIFF or BMP."><UploadPanel /></ToolShell>;
}
