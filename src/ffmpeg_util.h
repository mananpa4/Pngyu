#ifndef PNGYU_FFMPEG_UTIL_H
#define PNGYU_FFMPEG_UTIL_H

#include <QString>

class QWidget;

namespace pngyu::ffmpeg {

QString find_executable();
QString managed_executable_path();
bool is_executable(const QString& path);

// Downloads a portable FFmpeg build into the per-user application data
// directory. The operation is synchronous and reports errors through error.
bool download(QWidget* parent, QString* error);

}  // namespace pngyu::ffmpeg

#endif  // PNGYU_FFMPEG_UTIL_H
