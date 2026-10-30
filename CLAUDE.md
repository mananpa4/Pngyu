# Pngyu project guide

## Mandatory session behavior

Before making important changes, always read `CLAUDE_CONTEXT.md`. It is the living handoff record for current status, active work, decisions, known problems and recommended next steps. Update `CLAUDE_CONTEXT.md` whenever an important task is completed, a meaningful technical decision changes, or a new limitation is discovered.

Keep this file limited to relatively permanent architecture, commands and conventions. Do not add temporary tasks, short-lived branch state, debugging notes or session-specific plans here.

## Project purpose

Pngyu is a dual-surface media utility:

1. A native Qt 6/C++17 desktop app for batch image compression. PNG/APNG uses `pngquant`; supported still-image formats use Qt image encoders. It also provides general batch image/video conversion through an external FFmpeg process.
2. A Next.js/React web app under `web/` for a utility-style universal media workflow: upload or remote URL, metadata, output-format/options, server-side FFmpeg conversion, preview and download.

One format-aware engine handles image→image, image→video, video→image and video→video. Add new formats through shared definitions/presets without duplicating upload, storage, FFmpeg execution or shared UI.

## Architecture

### Desktop

- Entry point: `src/main.cpp`; initializes `PngyuApplication`, translations, settings and `PngyuMainWindow`.
- Main UI: `src/pngyumainwindow.{h,cpp,ui}`; file discovery, compression options, output rules, settings and worker coordination.
- Compression: `ExecuteCompressThread`/`ExecuteCompressWorkerThread`; PNG/APNG delegates to `pngquant`, other formats use Qt `QImage`/`QImageWriter` behavior.
- pngquant adapter: `src/pngyu_execute_pngquant_command.*` and `src/pngyu_pngquant_option.h`.
- Preview/preferences: dedicated folders under `src/` with Qt Designer `.ui` files.
- Universal converter dialog: `src/animated_webm_converter_dialog.*` (legacy filename); programmatic Qt UI, sequential batch queue, format presets and one `QProcess` per conversion.
- FFmpeg management: `src/ffmpeg_util.*`; lookup order is per-user managed binary, bundled application binary, then system `PATH`. Windows/macOS can download a portable build.
- Persistent settings: INI file in `QStandardPaths::AppDataLocation`; do not move settings into the repository.
- Build system: root `CMakeLists.txt` with Qt AUTOMOC/AUTORCC/AUTOUIC and platform-specific bundling.

Desktop conversions must use the `QProcess::start(program, arguments)` overload. Never concatenate user-controlled paths/options into a shell command. Preserve sequential output-name collision handling and do not overwrite existing outputs silently.

### Web

- Pages: `web/app/`; App Router pages provide landing, upload, options, result and placeholder routes.
- Shared UI: `web/components/`; workflow components are client components only where browser state/events are required.
- API Route Handlers: `web/app/api/`; all media endpoints use the Node.js runtime and dynamic rendering.
- Format catalog: `web/lib/formats.ts`; public output definitions, compatible codecs, MIME types and accepted input extensions.
- Media boundary: `web/lib/media.ts`; binary-signature checks, URL/network validation, option parsing, ffprobe and format-aware FFmpeg child processes.
- Storage boundary: `web/lib/storage.ts`; opaque UUID directories, JSON job records, one-hour expiry and public-record projection.
- Errors/types: `web/lib/errors.ts` and `web/lib/types.ts`.
- Styling: one design system in `web/app/globals.css`; no Tailwind dependency is currently used.

Web data flow:

```text
browser → POST /api/upload → signature validation → temp UUID directory → ffprobe
        → /convert/:id → select target/preset → POST /api/convert → FFmpeg
        → /convert/:id/result → range-enabled /api/files/:id/output
```

Raw filesystem paths must never be returned by APIs or process error messages. Remote URL support must keep HTTP(S)-only rules, redirect revalidation, local/private-network blocking, size limits, known-container signature validation and ffprobe verification. All new FFmpeg options require explicit allow-list/range validation before becoming arguments.

## Stable technology choices

- Desktop: C++17, Qt 6 (Core/Gui/Widgets/LinguistTools), CMake 3.16+, pngquant, FFmpeg CLI.
- Web: Node.js, Next.js App Router, React, TypeScript, CSS, `ffmpeg-static`, `ffprobe-static`.
- CI: GitHub Actions, MSVC 2022 Windows build and Qt clang macOS build.
- Temporary storage: local OS temp filesystem for the MVP; jobs expire after one hour and a process-local timer performs best-effort cleanup.
- Processing: synchronous child processes with a hard timeout; no Redis/BullMQ worker yet.
- Output formats: WebM, MP4, MOV, MKV, AVI, GIF, WebP, AVIF, PNG, JPEG, TIFF and BMP. Input acceptance is broader and still depends on the active FFmpeg build.

`package-lock.json` is authoritative for web dependency resolution. Keep the explicit PostCSS override unless the resolved Next.js dependency no longer needs it and `npm audit` remains clean without the override.

## Directory conventions

- Add native source files under `src/` and register them in `PROJECT_SOURCES` in `CMakeLists.txt`.
- Keep platform packaging/download behavior in `scripts/` and CMake, not in source-tree build artifacts.
- Downloaded FFmpeg binaries belong in `ffmpeg_bin/`, which is ignored by Git.
- Add web pages/endpoints with App Router filesystem conventions under `web/app/`.
- Put reusable React UI in `web/components/`; server-only processing/storage belongs in `web/lib/`.
- Build outputs (`build/`, `web/.next/`, `web/node_modules/`) must remain untracked.
- Translation source files live in `translations/`; generated `.qm` files remain untracked.

## Coding conventions

### C++/Qt

- Follow the repository `.clang-format` (Google style) and existing `m_` member naming.
- Prefer typed Qt signal/slot connections in new code.
- Parent all `QObject`/widget allocations or manage their lifetime explicitly.
- Keep UI mutations on the GUI thread; long-running external work must be cancellable.
- Wrap every visible string in `tr()`/`QObject::tr()`.
- Avoid altering the established image-compression behavior while extending media tools.

### TypeScript/React

- Keep strict TypeScript enabled; avoid `any` and validate data crossing HTTP/process boundaries.
- Use server components by default and add `"use client"` only for browser APIs, events or local state.
- Do not expose stack traces or internal paths in client responses.
- Use `AppError` for expected HTTP failures and `errorResponse` at route boundaries.
- Keep temporary job metadata serializable and project it through `toPublicJob()`.
- Preserve responsive and keyboard-accessible interactions when changing UI.

## Important commands

Desktop setup/build:

```powershell
.\scripts\download_ffmpeg.ps1
.\scripts\build_win.ps1
.\scripts\build_win.ps1 -BuildType Debug
.\scripts\deploy_win.ps1
```

```bash
./scripts/download_ffmpeg.sh
./scripts/batch_convert.sh -d ./media -f webp -q 80 -s 100
./scripts/build_mac.sh
BUILD_TYPE=Debug ./scripts/build_mac.sh
./scripts/deploy_mac.sh
```

Cross-platform CMake verification:

```bash
cmake -S . -B build/Release -DCMAKE_BUILD_TYPE=Release
cmake --build build/Release --config Release
```

Formatting/translations:

```bash
./scripts/format.sh
./scripts/update_translations.sh
```

Web development and verification:

```bash
cd web
npm install
npm run dev
npm run typecheck
npm run lint
npm run build
npm audit
npm start
```

## Release and deployment rules

- Version numbers for the native window title are in `src/pngyu_defines.h`.
- Download FFmpeg before native release builds so CMake can bundle it.
- Windows deployment must include Qt DLLs, `pngquant/pngquant.exe` and, when downloaded, `ffmpeg/ffmpeg.exe`.
- macOS deployment must include pngquant and FFmpeg in the app bundle Resources directory.
- The web app requires a writable temp directory, child-process permission and request timeouts long enough for synchronous conversion. Prefer a persistent Node/container host over constrained serverless functions.
- Tag names matching `v*` trigger native CI release builds.

## Work rules for future Claude sessions

- Inspect existing Git changes before editing and never discard user work.
- Read relevant source/configuration, not only README files, before changing architecture.
- Keep the desktop and web option semantics aligned where both expose the same converter.
- Validate file content as well as extension/MIME; treat URLs, paths and conversion options as untrusted input.
- After important implementation work, run proportional verification for both affected surfaces and record the evidence in `CLAUDE_CONTEXT.md`.
- Update `README.md` when installation, commands, public features, endpoints or deployment requirements change.
- Update translation catalogs when user-visible desktop strings stabilize.
- Do not store short-term task lists or speculative decisions in this file.
