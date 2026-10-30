# Pngyu

Pngyu is a cross-platform media utility with two complementary interfaces:

- A Qt 6 desktop application for batch image compression and general image/video conversion.
- A responsive Next.js web application that implements the complete upload → format/options → FFmpeg conversion → download workflow.

The desktop application keeps the original Pngyu/pngquant workflow for PNG optimization and uses Qt encoders for other still-image formats. Version 1.2 adds a format-aware FFmpeg engine without changing that existing behavior.

## Features

| Capability | Desktop | Web |
|---|:---:|:---:|
| Batch PNG/APNG compression with pngquant | Yes | — |
| JPEG, WebP, AVIF, TIFF, HEIC and BMP recompression | Yes | — |
| Any FFmpeg-decodable image/video input¹ | Yes | Yes |
| WebM, MP4, MOV, MKV and AVI output | Yes | Yes |
| GIF, WebP, AVIF, PNG, JPEG, TIFF and BMP output | Yes | Yes |
| VP8/VP9, H.264, HEVC and MPEG-4 presets | Yes | Yes |
| Quality, bitrate, scale/width, FPS and crop controls | Yes | Yes |
| Preserve compatible audio during video conversion | Yes | Yes |
| Drag and drop | Yes | Yes |
| Paste from clipboard and direct URL input | — | Yes |
| Source metadata and size comparison | Per file | Yes |
| Automatic temporary-file expiry | Local output is permanent | 1 hour |
| Automatic FFmpeg setup | Windows/macOS | Installed by npm |

The web app also includes a utility-style landing page, responsive navigation, upload/conversion progress, SEO metadata, range-enabled video playback and placeholder routes for future tools.

¹ Common containers receive binary-signature validation before ffprobe. Files with other short extensions are accepted only if the active ffprobe build confirms a visual stream. Actual codec availability therefore follows the installed FFmpeg build.

## Desktop application

### Requirements

- Qt 6.x with Core, Gui, Widgets and LinguistTools
- CMake 3.16+
- A C++17 compiler (MSVC 2022 or Clang are used by the provided scripts)
- `pngquant` (binaries are included under `pngquant_bin/`)
- FFmpeg for general image/video conversion

### Download FFmpeg

FFmpeg is not stored in Git. Download a portable binary before building so it is bundled with the application:

```powershell
# Windows
.\scripts\download_ffmpeg.ps1
```

```bash
# macOS
chmod +x scripts/download_ffmpeg.sh
./scripts/download_ffmpeg.sh
```

The desktop converter can also install FFmpeg into the user's application-data directory through **File → Image and video converter… → Download FFmpeg**. On Linux, install FFmpeg with the system package manager.

### Build

```powershell
# Windows Release
.\scripts\build_win.ps1

# Windows Debug
.\scripts\build_win.ps1 -BuildType Debug
```

```bash
# macOS Release
./scripts/build_mac.sh

# macOS Debug
BUILD_TYPE=Debug ./scripts/build_mac.sh
```

Direct CMake commands also work:

```bash
cmake -S . -B build/Release -DCMAKE_BUILD_TYPE=Release
cmake --build build/Release --config Release
```

Windows output is normally `build/Release/Release/Pngyu.exe`; macOS output is `build/Release/Pngyu.app`.

### Use the batch media converter

1. Open **File → Image and video converter…**.
2. Add or drop one or more supported image/video files.
3. Choose the output format and compatible codec, then set quality, bitrate, width or scale, FPS, crop, audio and output directory.
4. Select **Convert**. Existing output names are preserved by adding a numeric suffix.

The loop option writes a playback hint. WebM does not define a universally honored infinite-loop flag, so applications should also set their own playback loop behavior (for example, the web result player uses the HTML `loop` attribute).

For terminal batch work, including the quality/scale workflow from `batch_webp.sh`:

```bash
# Recursively convert all supported media under a directory to WebP.
./scripts/batch_convert.sh -d ./media -f webp -q 80 -s 75

# Convert to MP4 and overwrite pre-existing outputs.
./scripts/batch_convert.sh -d ./media -f mp4 -q 85 -s 100 -y
```

Supported output names are `webm`, `mp4`, `mov`, `mkv`, `avi`, `gif`, `webp`, `avif`, `png`, `jpg`, `tiff` and `bmp`.

### Package a release

```powershell
.\scripts\deploy_win.ps1
```

```bash
./scripts/deploy_mac.sh
```

The Windows deployment script creates `build/Pngyu-Windows-x64.zip`. The macOS script deploys Qt frameworks and creates `build/Release/Pngyu.dmg`. GitHub Actions performs both builds for `v*` tags and publishes their artifacts.

## Web application

The web application lives in [`web/`](web/) and uses Next.js App Router, React, TypeScript, `ffmpeg-static` and `ffprobe-static`.

### Run locally

```bash
cd web
npm install
cp .env.example .env.local  # optional on Windows; copy manually if needed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), or go directly to `/convert`. The legacy `/gif-to-webm` route remains available and uses the same universal engine.

### Production build

```bash
cd web
npm run typecheck
npm run lint
npm run build
npm start
```

Deploy the application to a persistent Node.js host or container that permits child processes and writable temporary storage. Serverless platforms with short request limits or read-only filesystems are not suitable for this synchronous FFmpeg MVP.

### Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `FFMPEG_PATH` | binary from `ffmpeg-static` | Override the FFmpeg executable |
| `FFPROBE_PATH` | binary from `ffprobe-static` | Override the ffprobe executable |
| `PNGYU_TEMP_DIR` | OS temp directory + `pngyu-webm` | Temporary job storage |
| `MAX_UPLOAD_MB` | `200` | Maximum accepted upload/URL size |
| `CONVERSION_TIMEOUT_SECONDS` | `180` | Hard timeout for probe/conversion processes |

### HTTP endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/upload` | POST multipart | Accepts `file` or `url`, validates signatures/limits, stores input and returns metadata |
| `/api/convert` | POST JSON | Converts a job to the selected image/video format with validated options |
| `/api/jobs/:id` | GET | Returns safe job metadata and result state |
| `/api/files/:id/input` | GET | Streams the original file with range support |
| `/api/files/:id/output` | GET | Streams/downloads the converted result with its correct MIME type and range support |

Remote URLs are restricted to HTTP(S), credentials and private/local IP destinations are rejected, and redirects are revalidated. Known containers must match their binary signature; other extensions must pass ffprobe capability validation. Job IDs are opaque UUIDs and raw filesystem paths are never returned to clients.

Temporary files expire after one hour. Expired jobs become inaccessible immediately and are physically removed during API activity and by a best-effort ten-minute process timer. A production deployment may additionally run external cleanup so removal does not depend on one long-lived Node process.

## Project structure

```text
Pngyu/
├── src/                         Qt/C++ desktop application
│   ├── animated_webm_converter_dialog.*
│   ├── ffmpeg_util.*
│   ├── preview_window/
│   └── preferences_dialog/
├── resource/                    Desktop icons, Qt resources and platform metadata
├── translations/                Qt Linguist TS sources
├── pngquant_bin/                Bundled pngquant executables
├── ffmpeg_bin/                  Downloaded, Git-ignored FFmpeg executables
├── scripts/                     Build, deploy, format, translation and FFmpeg scripts
├── web/
│   ├── app/                     Pages and Route Handler APIs
│   ├── components/              Shared React UI and workflow components
│   ├── lib/                     Media, validation, storage and shared types
│   └── types/                   Third-party TypeScript declarations
├── CMakeLists.txt
├── CLAUDE.md                    Stable project guidance for coding sessions
└── CLAUDE_CONTEXT.md            Living development status and handoff memory
```

## Verification

Desktop:

```bash
cmake -S . -B build/Release
cmake --build build/Release --config Release
```

Web:

```bash
cd web
npm run typecheck
npm run lint
npm run build
npm audit
```

No automated test suite exists yet. The universal API has been smoke-tested across every exposed output: WebM, MP4, MOV, MKV, AVI, GIF, WebP, AVIF, PNG, JPEG, TIFF and BMP. Tests covered image→video, animation→video/image and video-with-audio→video/animation/still-image. FFmpeg decoded every result except animated WebP, which was validated as a 12-frame file with Pillow because FFmpeg's WebP decoder does not support that animation correctly.

## Internationalization

The desktop application ships English, Japanese and Chinese Qt translations. See [`translations/README.md`](translations/README.md) for the update workflow. The universal converter's new strings currently fall back to source-language English until translation catalogs are updated. The web UI is currently English-only.

## License and third-party software

Pngyu is distributed under the BSD license. Bundled `pngquant` is GPL v3 or later. FFmpeg licensing depends on the exact build and enabled codecs; consult the license included by the binary provider and the [FFmpeg legal page](https://ffmpeg.org/legal.html). Do not commit downloaded FFmpeg binaries to this repository.
