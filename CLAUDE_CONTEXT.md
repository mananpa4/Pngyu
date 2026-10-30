# Pngyu living context

> Update this file after important completed work, technical decisions, newly discovered problems or changes to recommended next steps. Keep it synchronized with the repository; move stable guidance to `CLAUDE.md` and remove obsolete state instead of accumulating history.

## Current state

- Last synchronized: 2026-07-13 (America/Hermosillo).
- Native application version: 1.2.0.
- Repository branch observed during implementation: `gh-pages` tracking `origin/gh-pages`.
- The original Qt image-compression application remains functional and now includes an independent universal batch image/video converter.
- The Next.js web app under `web/` provides a universal image/video upload, options, conversion and download workflow.
- The implementation and documentation changes described here are present in the working tree and have not been committed by this session.
- `repos/prompt.txt` is the original feature brief and remains untracked; it was used as a source and was not modified.

## Implemented functionality

### Existing desktop compression

- Recursive file/folder addition, drag and drop, table results and multi-threaded compression workers.
- PNG/APNG quantization through bundled `pngquant`.
- Qt-based JPEG, WebP, AVIF, TIFF, HEIC and BMP output where the corresponding Qt plugin exists.
- Default/custom compression settings, output directories/names, overwrite controls and preview window.
- Persistent INI settings, English/Japanese/Chinese translation infrastructure and macOS ImageOptim integration.
- Windows/macOS build, deployment and GitHub Actions release workflows.

### Desktop universal conversion

- **File → Image and video converter…** opens a dedicated modal converter.
- Batch selection/drag-drop for common images and videos, including PNG/JPEG/GIF/APNG/WebP/AVIF/HEIC/JXL/TIFF/BMP and MP4/MOV/MKV/WebM/AVI/MPEG/WMV/FLV/TS/3GP/OGV families.
- Outputs: WebM, MP4, MOV, MKV, AVI, GIF, WebP, AVIF, PNG, JPEG, TIFF and BMP.
- Compatible codec presets: VP8/VP9, H.264, HEVC and MPEG-4 Part 2; image formats use format-specific FFmpeg encoders.
- Quality percentage, optional bitrate, output width or scale percentage, FPS cap, crop, loop hint, audio preservation and still-image video duration.
- Sequential FFmpeg queue, per-file progress, cancellation, failure count and non-destructive output naming.
- FFmpeg lookup in managed user data, application bundle/directory and system `PATH`.
- In-app portable FFmpeg download on Windows/macOS.
- Standalone download scripts: `scripts/download_ffmpeg.ps1` and `scripts/download_ffmpeg.sh`.
- CMake and deploy scripts bundle downloaded FFmpeg; native CI downloads it before release builds.
- Local Windows portable FFmpeg 8.1.2 was downloaded to the ignored `ffmpeg_bin/win/ffmpeg.exe` and copied into the local Release build.
- `scripts/batch_convert.sh` generalizes the supplied `batch_webp.sh` workflow with recursive null-delimited traversal, output presets, quality, scale and overwrite control.

### Web universal converter

- Responsive original utility UI with landing page, category/subtool navigation and reusable layout/components.
- `/convert`: click, drag/drop, clipboard paste or direct URL upload; 200 MB default limit and upload feedback.
- `/convert/[id]`: image/video preview, stream metadata, output selection and format-aware codec/quality/bitrate/size/FPS/crop/audio/duration controls.
- `/convert/[id]/result`: image or video preview, correct MIME/extension, size comparison, download and restart actions.
- Legacy `/gif-to-webm` routes remain compatible and use the same universal components/API.
- API handlers for upload, conversion, safe job metadata and range-enabled input/output streaming.
- ffprobe metadata extraction and FFmpeg conversion using npm-provided binaries or environment overrides.
- UUID-scoped local temp storage, one-hour logical expiry, cleanup during API activity and a best-effort ten-minute process timer.
- Validation for size, broad image/video extensions, container signatures, format/codec compatibility, option ranges and crop syntax.
- Direct-URL controls: HTTP(S) only, no embedded credentials, DNS rejection of local/private addresses, redirect revalidation and download timeout/size checks.
- Basic SEO metadata, result `noindex`, keyboard-accessible upload area, mobile breakpoints and progress states.
- Production Next.js build/start scripts and documented environment variables.

## Work in progress

- No feature is intentionally half-implemented at this handoff.
- Translation coverage and automated tests are pending follow-up work rather than active partial implementations.

## Verification completed

### Desktop

- `cmake -S . -B build/Release` completed successfully on Windows.
- `cmake --build build/Release --config Release` completed successfully with MSVC and produced `build/Release/Release/Pngyu.exe`.
- The downloaded FFmpeg executable was copied to `build/Release/Release/ffmpeg/ffmpeg.exe` by CMake.
- A pre-existing MSVC unreachable-code warning in `pngyupreferencesdialog.cpp` was removed after confirming the switch is exhaustive.
- macOS compilation and packaging were not run in this Windows session.
- The 1.2.0 universal dialog compiled without warnings after adding format/codec presets and generalized FFmpeg arguments.
- `scripts/batch_convert.sh` passed ShellCheck with no findings. Native Bash execution was unavailable on this Windows host (`REGDB_E_CLASSNOTREG`).

### Web

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run build`: passed; all intended static/dynamic routes were generated.
- `npm audit`: zero known vulnerabilities after pinning the safe PostCSS resolution.
- End-to-end smoke test passed with a locally generated 160×120, 12-frame GIF:
  - `POST /api/upload` returned metadata and a UUID job.
  - `POST /api/convert` produced VP9 WebM with width 120 and FPS 10.
  - `/api/files/:id/output` downloaded a 4,620-byte WebM from a 15,825-byte GIF.
  - The downloaded result decoded successfully with FFmpeg.
  - Duration fallback estimated the one-second GIF correctly, and a fake `.gif` payload was rejected with HTTP 400 by binary-signature validation.
- Universal conversion matrix passed for all exposed targets:
  - GIF → MP4 (H.264) and animated WebP (12 frames).
  - MP4 with AAC audio → WebM/VP9 with Opus, animated GIF, PNG, MOV, MKV and AVI.
  - MP4 → AVIF, JPEG, TIFF and BMP first-frame outputs.
  - Static PNG → one-second MP4/H.264.
  - FFmpeg 8.1 decoded all results except animated WebP; Pillow successfully opened all 12 WebP frames. This is an FFmpeg animated-WebP decoder limitation.
  - A valid PNG renamed to unknown extension `.xyz` was accepted through ffprobe, while a non-media `.xyz` payload was rejected. Probe/conversion errors now redact or avoid internal temporary paths.

## Technical decisions

- Keep the mature Qt desktop application and the Next.js web application in one repository but separate build roots; the web app is not embedded in Qt/Electron.
- Use direct FFmpeg/ffprobe child processes rather than fluent-ffmpeg (deprecated) or a media wrapper, keeping argument construction explicit and testable.
- Use `ffmpeg-static`/`ffprobe-static` for web portability; allow production overrides through environment variables.
- Use local temporary storage and synchronous processing for MVP simplicity. The storage and converter modules form boundaries for later S3/queue replacement.
- Store one JSON record per UUID job and expose only a projected public shape; do not encode paths in URLs or return paths to clients.
- Perform physical cleanup opportunistically on API activity while enforcing expiry on every read. External scheduling is optional hardening for production.
- Use custom CSS rather than Tailwind; the prompt described Tailwind as suggested, and the current design avoids an unnecessary runtime/build dependency while preserving reusable UI classes.
- Keep universal media conversion in a separate desktop dialog so the original compression table/options and worker model remain stable.
- Centralize web output formats/codecs/MIME types in `web/lib/formats.ts`; backend validation and frontend selectors consume the same catalog.
- Permit arbitrary short alphanumeric input extensions when ffprobe confirms a visual stream; retain strict binary signatures for recognized common containers.
- Static output formats take the first visual frame. Static image→video loops the source for a configurable duration. Animated/video output preserves time where the target supports it.
- Preserve audio only for video targets and transcode it to Opus (WebM), AAC (MP4/MOV/MKV) or MP3 (AVI).
- Treat WebM loop as a metadata/player hint, not an infinite encoded stream. Infinite `-stream_loop` would never terminate and is not acceptable for conversion.
- Use third-party binaries linked from FFmpeg's official download page because FFmpeg itself distributes source rather than official Windows/macOS executables.

## Known problems and limitations

- Web `Request.formData()` and remote downloads buffer the whole input in memory before writing it. The configured 200 MB maximum can therefore require substantial process memory and concurrent large uploads can exhaust a small host.
- Conversion is synchronous inside a request. Large files can hit reverse-proxy/platform timeouts despite the configurable internal timeout; there is no BullMQ/Redis worker or progress websocket yet.
- Physical temp cleanup relies on the Node process timer/API activity. Serverless process recycling can prevent the timer from firing, so external cleanup is still recommended; expired jobs cannot be read through the API.
- DNS validation reduces SSRF risk but does not pin the resolved IP for the subsequent fetch; a production threat model should address DNS rebinding with a pinned/custom HTTP agent or an isolated fetch service.
- Direct remote URLs are downloaded into memory and do not expose byte-level progress to the browser.
- Desktop progress is per file, not per encoded frame/time, and the converter currently processes files sequentially.
- WebM loop metadata is not honored consistently by all players; the web preview explicitly uses the HTML `loop` attribute.
- The universal desktop converter strings are not yet in the Qt translation catalogs. The web interface is English-only.
- Input support ultimately depends on the exact FFmpeg build. Rare HEIC/JXL/MNG/animated-AVIF inputs still need representative fixtures on packaged binaries.
- FFmpeg's own WebP decoder fails on otherwise valid animated WebP files emitted by libwebp; browsers/Pillow can consume the tested outputs. Do not use FFmpeg re-decoding alone as the WebP-animation validity check.
- There is no automated unit, integration or browser test suite.
- macOS-specific FFmpeg download, bundle placement and DMG creation have not been verified in this session.

## Pending tasks

1. Add unit tests for signature validation, option parsing, storage expiry/public projection and SSRF address classification.
2. Add API integration tests for multipart upload, URL redirects, corrupt files, oversize files, timeout behavior, range requests and expired jobs.
3. Add Playwright coverage for upload → options → result on desktop/mobile viewports and clipboard/drag interactions.
4. Stream uploads and remote responses to disk with an enforcing byte-count transform instead of buffering whole files.
5. Move conversions to a durable queue/worker and add real upload/encoding progress for production scale.
6. Add an external cleanup scheduler or a dedicated cleanup command for deployments where Node processes are short-lived.
7. Pin remote fetch connections to validated public IPs or isolate remote retrieval to close the remaining DNS-rebinding gap.
8. Update `translations/*.ts` with the universal converter strings and add Spanish/web localization if desired.
9. Run macOS CI/manual packaging and verify signed app behavior plus FFmpeg executable permissions.
10. Test representative APNG, HEIC, animated AVIF, JXL, MNG, WMV, MPEG-TS and 3GP inputs on both packaged desktop and deployed web binaries.
11. When adding another format, extend the shared output catalog/preset builder and its compatibility tests instead of creating format-specific duplicate routes.

## Recommended next steps

Prioritize automated API tests and streaming upload storage before public deployment; those changes reduce the largest correctness and resource risks. Then validate/translate the native dialog on macOS. Only after those foundations are covered should the next media format route be implemented.
