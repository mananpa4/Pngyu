#include "animated_webm_converter_dialog.h"

#include <QCheckBox>
#include <QComboBox>
#include <QDir>
#include <QDoubleSpinBox>
#include <QDragEnterEvent>
#include <QFileDialog>
#include <QFile>
#include <QFileInfo>
#include <QFormLayout>
#include <QGroupBox>
#include <QHBoxLayout>
#include <QLabel>
#include <QLineEdit>
#include <QListWidget>
#include <QMessageBox>
#include <QMimeData>
#include <QProgressBar>
#include <QPushButton>
#include <QSpinBox>
#include <QRegularExpression>
#include <QUrl>
#include <QVBoxLayout>

#include "ffmpeg_util.h"

namespace {
const QStringList kVideoOutputs{QStringLiteral("webm"), QStringLiteral("mp4"),
                                QStringLiteral("mov"), QStringLiteral("mkv"),
                                QStringLiteral("avi")};
const QStringList kAnimatedOutputs{QStringLiteral("gif"),
                                   QStringLiteral("webp")};
const QStringList kStaticInputs{
    QStringLiteral("png"),  QStringLiteral("jpg"),  QStringLiteral("jpeg"),
    QStringLiteral("avif"), QStringLiteral("heic"), QStringLiteral("heif"),
    QStringLiteral("jxl"),  QStringLiteral("bmp"),  QStringLiteral("tif"),
    QStringLiteral("tiff")};

int quality_to_value(const int quality, const int best, const int worst) {
  return qRound(worst - (quality / 100.0) * (worst - best));
}
}

AnimatedWebmConverterDialog::AnimatedWebmConverterDialog(QWidget* parent)
    : QDialog(parent),
      m_files(new QListWidget(this)),
      m_output_directory(new QLineEdit(this)),
      m_output_format(new QComboBox(this)),
      m_codec(new QComboBox(this)),
      m_bitrate(new QSpinBox(this)),
      m_quality(new QSpinBox(this)),
      m_width(new QSpinBox(this)),
      m_scale(new QSpinBox(this)),
      m_fps(new QComboBox(this)),
      m_crop(new QLineEdit(this)),
      m_loop(new QCheckBox(tr("Playback loop hint"), this)),
      m_include_audio(new QCheckBox(tr("Preserve audio when possible"), this)),
      m_still_duration(new QDoubleSpinBox(this)),
      m_ffmpeg_status(new QLabel(this)),
      m_status(new QLabel(this)),
      m_progress(new QProgressBar(this)),
      m_convert(new QPushButton(tr("Convert media"), this)),
      m_cancel(new QPushButton(tr("Cancel"), this)),
      m_process(new QProcess(this)),
      m_completed(0),
      m_failed(0),
      m_cancelled(false) {
  setWindowTitle(tr("Batch image and video converter"));
  resize(760, 720);
  setAcceptDrops(true);

  auto* root = new QVBoxLayout(this);
  auto* intro = new QLabel(
      tr("Convert common image and video formats in batches with FFmpeg. "
         "The available codecs depend on the installed FFmpeg build."),
      this);
  intro->setWordWrap(true);
  root->addWidget(intro);
  root->addWidget(m_files, 1);

  auto* file_buttons = new QHBoxLayout();
  auto* add = new QPushButton(tr("Add files..."), this);
  auto* remove = new QPushButton(tr("Remove selected"), this);
  file_buttons->addWidget(add);
  file_buttons->addWidget(remove);
  file_buttons->addStretch();
  root->addLayout(file_buttons);

  auto* options = new QGroupBox(tr("Conversion options"), this);
  auto* form = new QFormLayout(options);
  m_output_format->addItem(QStringLiteral("WebM"), QStringLiteral("webm"));
  m_output_format->addItem(QStringLiteral("MP4"), QStringLiteral("mp4"));
  m_output_format->addItem(QStringLiteral("MOV"), QStringLiteral("mov"));
  m_output_format->addItem(QStringLiteral("Matroska (MKV)"), QStringLiteral("mkv"));
  m_output_format->addItem(QStringLiteral("AVI"), QStringLiteral("avi"));
  m_output_format->insertSeparator(m_output_format->count());
  m_output_format->addItem(tr("Animated GIF"), QStringLiteral("gif"));
  m_output_format->addItem(QStringLiteral("WebP"), QStringLiteral("webp"));
  m_output_format->insertSeparator(m_output_format->count());
  m_output_format->addItem(QStringLiteral("AVIF"), QStringLiteral("avif"));
  m_output_format->addItem(QStringLiteral("PNG"), QStringLiteral("png"));
  m_output_format->addItem(QStringLiteral("JPEG"), QStringLiteral("jpg"));
  m_output_format->addItem(QStringLiteral("TIFF"), QStringLiteral("tiff"));
  m_output_format->addItem(QStringLiteral("BMP"), QStringLiteral("bmp"));
  m_bitrate->setRange(0, 100000);
  m_bitrate->setValue(1200);
  m_bitrate->setSuffix(QStringLiteral(" kbps"));
  m_bitrate->setSpecialValueText(tr("Auto"));
  m_quality->setRange(1, 100);
  m_quality->setValue(80);
  m_quality->setSuffix(QStringLiteral("%"));
  m_width->setRange(0, 16384);
  m_width->setSpecialValueText(tr("Original"));
  m_scale->setRange(1, 400);
  m_scale->setValue(100);
  m_scale->setSuffix(QStringLiteral("%"));
  m_fps->addItem(tr("Original"), 0);
  for (const int fps : {12, 15, 20, 24, 25, 30, 50, 60}) {
    m_fps->addItem(QString::number(fps), fps);
  }
  m_crop->setPlaceholderText(QStringLiteral("width:height:x:y"));
  m_loop->setChecked(true);
  m_include_audio->setChecked(true);
  m_still_duration->setRange(0.1, 3600.0);
  m_still_duration->setValue(3.0);
  m_still_duration->setSuffix(tr(" seconds"));
  m_loop->setToolTip(tr("Adds a loop metadata hint. Players decide whether to honor it."));
  form->addRow(tr("Output format"), m_output_format);
  form->addRow(tr("Codec"), m_codec);
  form->addRow(tr("Video bitrate"), m_bitrate);
  form->addRow(tr("Quality"), m_quality);
  form->addRow(tr("Output width"), m_width);
  form->addRow(tr("Scale (used when width is original)"), m_scale);
  form->addRow(tr("Maximum FPS"), m_fps);
  form->addRow(tr("Crop (optional)"), m_crop);
  form->addRow(QString(), m_loop);
  form->addRow(QString(), m_include_audio);
  form->addRow(tr("Still image video duration"), m_still_duration);

  auto* output_row = new QHBoxLayout();
  auto* output_button = new QPushButton(tr("Browse..."), this);
  output_row->addWidget(m_output_directory, 1);
  output_row->addWidget(output_button);
  form->addRow(tr("Output directory"), output_row);
  root->addWidget(options);

  auto* ffmpeg_row = new QHBoxLayout();
  auto* download = new QPushButton(tr("Download FFmpeg"), this);
  ffmpeg_row->addWidget(m_ffmpeg_status, 1);
  ffmpeg_row->addWidget(download);
  root->addLayout(ffmpeg_row);

  m_progress->setRange(0, 1);
  m_progress->setValue(0);
  root->addWidget(m_status);
  root->addWidget(m_progress);
  auto* actions = new QHBoxLayout();
  actions->addStretch();
  actions->addWidget(m_cancel);
  actions->addWidget(m_convert);
  root->addLayout(actions);
  m_cancel->setVisible(false);

  connect(add, &QPushButton::clicked, this,
          &AnimatedWebmConverterDialog::add_files);
  connect(remove, &QPushButton::clicked, this,
          &AnimatedWebmConverterDialog::remove_selected);
  connect(output_button, &QPushButton::clicked, this,
          &AnimatedWebmConverterDialog::choose_output_directory);
  connect(download, &QPushButton::clicked, this,
          &AnimatedWebmConverterDialog::download_ffmpeg);
  connect(m_convert, &QPushButton::clicked, this,
          &AnimatedWebmConverterDialog::start_conversion);
  connect(m_cancel, &QPushButton::clicked, this,
          &AnimatedWebmConverterDialog::cancel_conversion);
  connect(m_process, &QProcess::finished, this,
          &AnimatedWebmConverterDialog::process_finished);
  connect(m_process, &QProcess::errorOccurred, this,
          &AnimatedWebmConverterDialog::process_error);
  connect(m_output_format, &QComboBox::currentIndexChanged, this,
          &AnimatedWebmConverterDialog::output_format_changed);
  output_format_changed();

  const QString ffmpeg = pngyu::ffmpeg::find_executable();
  m_ffmpeg_status->setText(ffmpeg.isEmpty()
                               ? tr("FFmpeg is not installed")
                               : tr("FFmpeg: %1").arg(ffmpeg));
}

AnimatedWebmConverterDialog::~AnimatedWebmConverterDialog() {
  if (m_process->state() != QProcess::NotRunning) {
    m_process->kill();
    m_process->waitForFinished(2000);
  }
}

void AnimatedWebmConverterDialog::dragEnterEvent(QDragEnterEvent* event) {
  if (event->mimeData()->hasUrls()) event->acceptProposedAction();
}

void AnimatedWebmConverterDialog::dropEvent(QDropEvent* event) {
  QStringList paths;
  for (const QUrl& url : event->mimeData()->urls()) paths << url.toLocalFile();
  append_files(paths);
  event->acceptProposedAction();
}

void AnimatedWebmConverterDialog::add_files() {
  append_files(QFileDialog::getOpenFileNames(
      this, tr("Choose image or video files"), QString(),
      tr("Media files (*.gif *.apng *.png *.jpg *.jpeg *.webp *.avif *.heic "
         "*.heif *.jxl *.mng *.bmp *.tif *.tiff *.mp4 *.m4v *.mov *.mkv "
         "*.webm *.avi *.mpeg *.mpg *.wmv *.flv *.ts *.mts *.m2ts *.3gp "
         "*.3g2 *.ogv);;All files (*.*)")));
}

void AnimatedWebmConverterDialog::append_files(const QStringList& paths) {
  for (const QString& path : paths) {
    const QFileInfo info(path);
    if (!info.isFile()) continue;
    if (m_files->findItems(info.absoluteFilePath(), Qt::MatchExactly).isEmpty())
      m_files->addItem(info.absoluteFilePath());
  }
}

void AnimatedWebmConverterDialog::remove_selected() {
  qDeleteAll(m_files->selectedItems());
}

void AnimatedWebmConverterDialog::choose_output_directory() {
  const QString path = QFileDialog::getExistingDirectory(
      this, tr("Choose output directory"), m_output_directory->text());
  if (!path.isEmpty()) m_output_directory->setText(path);
}

void AnimatedWebmConverterDialog::download_ffmpeg() {
  QString error;
  if (!pngyu::ffmpeg::download(this, &error)) {
    QMessageBox::critical(this, tr("FFmpeg"), error);
    return;
  }
  m_ffmpeg_status->setText(
      tr("FFmpeg: %1").arg(pngyu::ffmpeg::find_executable()));
  QMessageBox::information(this, tr("FFmpeg"), tr("FFmpeg is ready to use."));
}

void AnimatedWebmConverterDialog::start_conversion() {
  if (m_files->count() == 0) {
    QMessageBox::warning(this, tr("Convert"), tr("Add at least one file."));
    return;
  }
  if (pngyu::ffmpeg::find_executable().isEmpty()) {
    QMessageBox::warning(this, tr("Convert"),
                         tr("Install or download FFmpeg first."));
    return;
  }
  if (!m_output_directory->text().isEmpty() &&
      !QDir(m_output_directory->text()).exists()) {
    QMessageBox::warning(this, tr("Convert"),
                         tr("The output directory does not exist."));
    return;
  }
  if (!m_crop->text().trimmed().isEmpty() &&
      !QRegularExpression(QStringLiteral("^\\d+:\\d+:\\d+:\\d+$"))
           .match(m_crop->text().trimmed())
           .hasMatch()) {
    QMessageBox::warning(this, tr("Convert"),
                         tr("Crop must use width:height:x:y with whole numbers."));
    return;
  }
  m_queue.clear();
  for (int i = 0; i < m_files->count(); ++i) m_queue << m_files->item(i)->text();
  m_completed = 0;
  m_failed = 0;
  m_cancelled = false;
  m_progress->setRange(0, m_queue.size());
  set_running(true);
  convert_next();
}

void AnimatedWebmConverterDialog::convert_next() {
  if (m_queue.isEmpty()) {
    set_running(false);
    m_status->setText(tr("Finished: %1 converted, %2 failed")
                          .arg(m_completed - m_failed)
                          .arg(m_failed));
    return;
  }
  const QString input = m_queue.takeFirst();
  const QString output = output_path_for(input);
  m_current_output = output;
  m_status->setText(tr("Converting %1...").arg(QFileInfo(input).fileName()));
  m_process->start(pngyu::ffmpeg::find_executable(),
                   ffmpeg_arguments(input, output));
}

QString AnimatedWebmConverterDialog::output_path_for(const QString& input) const {
  const QFileInfo info(input);
  const QDir directory(m_output_directory->text().isEmpty()
                           ? info.absolutePath()
                           : m_output_directory->text());
  const QString extension = m_output_format->currentData().toString();
  QString output = directory.filePath(info.completeBaseName() + "." + extension);
  int suffix = 1;
  while (QFileInfo::exists(output)) {
    output = directory.filePath(
        QStringLiteral("%1-%2.%3")
            .arg(info.completeBaseName())
            .arg(suffix++)
            .arg(extension));
  }
  return output;
}

QStringList AnimatedWebmConverterDialog::ffmpeg_arguments(
    const QString& input, const QString& output) const {
  const QString format = m_output_format->currentData().toString();
  const bool is_video = kVideoOutputs.contains(format);
  const bool is_animated = kAnimatedOutputs.contains(format);
  const bool source_is_still =
      kStaticInputs.contains(QFileInfo(input).suffix().toLower());
  QStringList args{QStringLiteral("-hide_banner"), QStringLiteral("-y")};
  if (source_is_still && is_video) {
    args << QStringLiteral("-loop") << QStringLiteral("1")
         << QStringLiteral("-framerate")
         << QString::number(m_fps->currentData().toInt() > 0
                                ? m_fps->currentData().toInt()
                                : 25);
  }
  args << QStringLiteral("-i") << input;
  QStringList filters;
  if (!m_crop->text().trimmed().isEmpty())
    filters << QStringLiteral("crop=%1").arg(m_crop->text().trimmed());
  if (m_width->value() > 0)
    filters << QStringLiteral("scale=%1:-2:flags=lanczos").arg(m_width->value());
  else if (m_scale->value() != 100)
    filters << QStringLiteral("scale=trunc(iw*%1/100/2)*2:"
                              "trunc(ih*%1/100/2)*2:flags=lanczos")
                   .arg(m_scale->value());
  if (m_fps->currentData().toInt() > 0)
    filters << QStringLiteral("fps=%1").arg(m_fps->currentData().toInt());
  if (is_video && m_width->value() == 0 && m_scale->value() == 100)
    filters << QStringLiteral("scale=trunc(iw/2)*2:trunc(ih/2)*2");
  if (!filters.isEmpty()) args << QStringLiteral("-vf") << filters.join(',');

  if (is_video) {
    const QString codec = m_codec->currentData().toString();
    args << QStringLiteral("-c:v") << codec;
    if (codec == QStringLiteral("mpeg4")) {
      args << QStringLiteral("-q:v")
           << QString::number(quality_to_value(m_quality->value(), 2, 20));
    } else {
      const bool is_vpx = codec.startsWith(QStringLiteral("libvpx"));
      args << QStringLiteral("-crf")
           << QString::number(quality_to_value(m_quality->value(), 18,
                                               is_vpx ? 50 : 40));
    }
    if (m_bitrate->value() > 0)
      args << QStringLiteral("-b:v")
           << QString::number(m_bitrate->value()) + QStringLiteral("k");
    if (m_include_audio->isChecked()) {
      args << QStringLiteral("-c:a")
           << (format == QStringLiteral("webm")
                   ? QStringLiteral("libopus")
                   : format == QStringLiteral("avi") ? QStringLiteral("libmp3lame")
                                                       : QStringLiteral("aac"));
    } else {
      args << QStringLiteral("-an");
    }
    args << QStringLiteral("-pix_fmt") << QStringLiteral("yuv420p");
    if (source_is_still)
      args << QStringLiteral("-t")
           << QString::number(m_still_duration->value(), 'f', 2);
    if (format == QStringLiteral("mp4") || format == QStringLiteral("mov"))
      args << QStringLiteral("-movflags") << QStringLiteral("+faststart");
    if (m_loop->isChecked())
      args << QStringLiteral("-metadata") << QStringLiteral("loop=0");
  } else {
    args << QStringLiteral("-an");
    if (!is_animated)
      args << QStringLiteral("-frames:v") << QStringLiteral("1")
           << QStringLiteral("-update") << QStringLiteral("1");
    if (format == QStringLiteral("gif")) {
      args << QStringLiteral("-loop")
           << (m_loop->isChecked() ? QStringLiteral("0") : QStringLiteral("-1"));
    } else if (format == QStringLiteral("webp")) {
      args << QStringLiteral("-c:v") << QStringLiteral("libwebp_anim")
           << QStringLiteral("-quality") << QString::number(m_quality->value())
           << QStringLiteral("-compression_level") << QStringLiteral("6")
           << QStringLiteral("-loop")
           << (m_loop->isChecked() ? QStringLiteral("0") : QStringLiteral("1"));
    } else if (format == QStringLiteral("avif")) {
      args << QStringLiteral("-c:v") << QStringLiteral("libaom-av1")
           << QStringLiteral("-crf")
           << QString::number(quality_to_value(m_quality->value(), 18, 55))
           << QStringLiteral("-still-picture") << QStringLiteral("1");
    } else if (format == QStringLiteral("jpg")) {
      args << QStringLiteral("-q:v")
           << QString::number(quality_to_value(m_quality->value(), 2, 31));
    } else if (format == QStringLiteral("png")) {
      args << QStringLiteral("-compression_level")
           << QString::number(qRound(m_quality->value() / 100.0 * 9));
    } else if (format == QStringLiteral("tiff")) {
      args << QStringLiteral("-compression_algo") << QStringLiteral("deflate");
    }
  }
  args << output;
  return args;
}

void AnimatedWebmConverterDialog::output_format_changed() {
  const QString format = m_output_format->currentData().toString();
  const bool is_video = kVideoOutputs.contains(format);
  const bool supports_loop = is_video || kAnimatedOutputs.contains(format);
  m_codec->clear();
  if (format == QStringLiteral("webm")) {
    m_codec->addItem(QStringLiteral("VP9"), QStringLiteral("libvpx-vp9"));
    m_codec->addItem(QStringLiteral("VP8"), QStringLiteral("libvpx"));
  } else if (format == QStringLiteral("mp4") || format == QStringLiteral("mov")) {
    m_codec->addItem(QStringLiteral("H.264"), QStringLiteral("libx264"));
    m_codec->addItem(QStringLiteral("H.265 / HEVC"), QStringLiteral("libx265"));
  } else if (format == QStringLiteral("mkv")) {
    m_codec->addItem(QStringLiteral("H.264"), QStringLiteral("libx264"));
    m_codec->addItem(QStringLiteral("H.265 / HEVC"), QStringLiteral("libx265"));
    m_codec->addItem(QStringLiteral("VP9"), QStringLiteral("libvpx-vp9"));
  } else if (format == QStringLiteral("avi")) {
    m_codec->addItem(QStringLiteral("MPEG-4 Part 2"), QStringLiteral("mpeg4"));
  } else {
    m_codec->addItem(tr("Automatic"), QString());
  }
  m_codec->setEnabled(is_video);
  m_bitrate->setEnabled(is_video);
  m_include_audio->setEnabled(is_video);
  m_still_duration->setEnabled(is_video);
  m_loop->setEnabled(supports_loop);
  m_convert->setText(tr("Convert to %1").arg(m_output_format->currentText()));
}

void AnimatedWebmConverterDialog::cancel_conversion() {
  m_cancelled = true;
  m_queue.clear();
  if (m_process->state() != QProcess::NotRunning) {
    m_process->kill();
    m_process->waitForFinished(2000);
  }
  if (!m_current_output.isEmpty()) QFile::remove(m_current_output);
  set_running(false);
  m_status->setText(tr("Conversion cancelled."));
}

void AnimatedWebmConverterDialog::process_finished(
    int exit_code, QProcess::ExitStatus status) {
  if (m_cancelled) return;
  ++m_completed;
  if (status != QProcess::NormalExit || exit_code != 0) {
    ++m_failed;
    if (!m_current_output.isEmpty()) QFile::remove(m_current_output);
    const QString detail =
        QString::fromLocal8Bit(m_process->readAllStandardError()).right(1000);
    m_status->setText(tr("A conversion failed: %1").arg(detail));
  }
  m_progress->setValue(m_completed);
  convert_next();
}

void AnimatedWebmConverterDialog::process_error(QProcess::ProcessError error) {
  if (error != QProcess::FailedToStart || m_cancelled) return;
  ++m_completed;
  ++m_failed;
  if (!m_current_output.isEmpty()) QFile::remove(m_current_output);
  m_status->setText(tr("FFmpeg could not be started: %1")
                        .arg(m_process->errorString()));
  m_progress->setValue(m_completed);
  convert_next();
}

void AnimatedWebmConverterDialog::set_running(bool running) {
  m_files->setEnabled(!running);
  m_convert->setVisible(!running);
  m_cancel->setVisible(running);
}
