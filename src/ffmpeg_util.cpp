#include "ffmpeg_util.h"

#include <QApplication>
#include <QDir>
#include <QFileInfo>
#include <QMessageBox>
#include <QProcess>
#include <QStandardPaths>

namespace pngyu::ffmpeg {
namespace {

QString executable_name() {
#ifdef Q_OS_WIN
  return QStringLiteral("ffmpeg.exe");
#else
  return QStringLiteral("ffmpeg");
#endif
}

}  // namespace

QString managed_executable_path() {
  const QString directory =
      QStandardPaths::writableLocation(QStandardPaths::AppDataLocation) +
      QStringLiteral("/ffmpeg");
  return QDir(directory).filePath(executable_name());
}

bool is_executable(const QString& path) {
  if (path.isEmpty() || !QFileInfo::exists(path)) {
    return false;
  }
  QProcess process;
  process.start(path, {QStringLiteral("-version")});
  return process.waitForStarted(3000) && process.waitForFinished(5000) &&
         process.exitStatus() == QProcess::NormalExit && process.exitCode() == 0;
}

QString find_executable() {
  QStringList candidates{managed_executable_path()};
#ifdef Q_OS_MACOS
  candidates << QApplication::applicationDirPath() +
                    QStringLiteral("/../Resources/ffmpeg");
#elif defined(Q_OS_WIN)
  candidates << QApplication::applicationDirPath() +
                    QStringLiteral("/ffmpeg/ffmpeg.exe");
#endif
  candidates << QStandardPaths::findExecutable(QStringLiteral("ffmpeg"));
  for (const QString& candidate : candidates) {
    if (is_executable(candidate)) {
      return QFileInfo(candidate).absoluteFilePath();
    }
  }
  return {};
}

bool download(QWidget* parent, QString* error) {
  const QString destination = managed_executable_path();
  QDir().mkpath(QFileInfo(destination).absolutePath());

  QProcess process;
#ifdef Q_OS_WIN
  const QString script = QStringLiteral(
      "$ErrorActionPreference='Stop';"
      "$zip=Join-Path $env:TEMP 'pngyu-ffmpeg.zip';"
      "$out=Join-Path $env:TEMP 'pngyu-ffmpeg';"
      "Remove-Item -LiteralPath $out -Recurse -Force -ErrorAction SilentlyContinue;"
      "Invoke-WebRequest -UseBasicParsing "
      "'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip' "
      "-OutFile $zip;"
      "Expand-Archive -LiteralPath $zip -DestinationPath $out -Force;"
      "$exe=Get-ChildItem -LiteralPath $out -Filter ffmpeg.exe -Recurse | "
      "Select-Object -First 1 -ExpandProperty FullName;"
      "if(-not $exe){throw 'ffmpeg.exe was not found in the archive'};"
      "Copy-Item -LiteralPath $exe -Destination '%1' -Force;"
      "Remove-Item -LiteralPath $zip -Force -ErrorAction SilentlyContinue;"
      "Remove-Item -LiteralPath $out -Recurse -Force -ErrorAction SilentlyContinue;")
                             .arg(QString(destination).replace("'", "''"));
  process.start(QStringLiteral("powershell.exe"),
                {QStringLiteral("-NoProfile"),
                 QStringLiteral("-ExecutionPolicy"), QStringLiteral("Bypass"),
                 QStringLiteral("-Command"), script});
#elif defined(Q_OS_MACOS)
  const QString command = QStringLiteral(
      "set -e; tmp=$(mktemp -d); "
      "curl -fL https://evermeet.cx/ffmpeg/getrelease/zip -o \"$tmp/ffmpeg.zip\"; "
      "unzip -q \"$tmp/ffmpeg.zip\" -d \"$tmp\"; "
      "install -m 755 \"$tmp/ffmpeg\" '%1'; rm -rf \"$tmp\"")
                              .arg(QString(destination).replace("'", "'\\''"));
  process.start(QStringLiteral("/bin/sh"),
                {QStringLiteral("-c"), command});
#else
  if (error) {
    *error = QObject::tr(
        "Automatic download is available on Windows and macOS. Install "
        "FFmpeg with your package manager and restart Pngyu.");
  }
  return false;
#endif

  QMessageBox progress(QMessageBox::Information, QObject::tr("FFmpeg"),
                       QObject::tr("Downloading and installing FFmpeg..."),
                       QMessageBox::NoButton, parent);
  progress.setStandardButtons(QMessageBox::NoButton);
  progress.show();
  while (!process.waitForFinished(100)) {
    QApplication::processEvents();
  }
  progress.close();

  if (process.exitStatus() != QProcess::NormalExit || process.exitCode() != 0 ||
      !is_executable(destination)) {
    if (error) {
      *error = QString::fromLocal8Bit(process.readAllStandardError()).trimmed();
      if (error->isEmpty()) {
        *error = QObject::tr("The FFmpeg download or installation failed.");
      }
    }
    return false;
  }
  return true;
}

}  // namespace pngyu::ffmpeg
