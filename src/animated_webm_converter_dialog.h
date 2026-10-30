#ifndef PNGYU_ANIMATED_WEBM_CONVERTER_DIALOG_H
#define PNGYU_ANIMATED_WEBM_CONVERTER_DIALOG_H

#include <QDialog>
#include <QProcess>
#include <QStringList>

class QCheckBox;
class QComboBox;
class QDoubleSpinBox;
class QLabel;
class QLineEdit;
class QListWidget;
class QProgressBar;
class QPushButton;
class QSpinBox;

class AnimatedWebmConverterDialog : public QDialog {
  Q_OBJECT

 public:
  explicit AnimatedWebmConverterDialog(QWidget* parent = nullptr);
  ~AnimatedWebmConverterDialog() override;

 protected:
  void dragEnterEvent(QDragEnterEvent* event) override;
  void dropEvent(QDropEvent* event) override;

 private slots:
  void add_files();
  void remove_selected();
  void choose_output_directory();
  void download_ffmpeg();
  void start_conversion();
  void cancel_conversion();
  void process_finished(int exit_code, QProcess::ExitStatus status);
  void process_error(QProcess::ProcessError error);
  void output_format_changed();

 private:
  void append_files(const QStringList& paths);
  void convert_next();
  QString output_path_for(const QString& input) const;
  QStringList ffmpeg_arguments(const QString& input,
                               const QString& output) const;
  void set_running(bool running);

  QListWidget* m_files;
  QLineEdit* m_output_directory;
  QComboBox* m_output_format;
  QComboBox* m_codec;
  QSpinBox* m_bitrate;
  QSpinBox* m_quality;
  QSpinBox* m_width;
  QSpinBox* m_scale;
  QComboBox* m_fps;
  QLineEdit* m_crop;
  QCheckBox* m_loop;
  QCheckBox* m_include_audio;
  QDoubleSpinBox* m_still_duration;
  QLabel* m_ffmpeg_status;
  QLabel* m_status;
  QProgressBar* m_progress;
  QPushButton* m_convert;
  QPushButton* m_cancel;
  QProcess* m_process;
  QStringList m_queue;
  int m_completed;
  int m_failed;
  bool m_cancelled;
  QString m_current_output;
};

#endif  // PNGYU_ANIMATED_WEBM_CONVERTER_DIALOG_H
