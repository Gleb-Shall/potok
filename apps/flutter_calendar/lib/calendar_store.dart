import 'dart:io';

import 'calendar_model.dart';

// This prototype uses its own profile; benchmark mode bypasses the store entirely.
class CalendarStore {
  File get file {
    final home = Platform.environment['HOME'];
    if (home == null) {
      throw const FileSystemException('Не найден домашний каталог.');
    }
    return File(
      '$home/Library/Application Support/Potok Flutter Prototype/calendar.json',
    );
  }

  Future<CalendarData?> read() async {
    if (!await file.exists()) return null;
    return CalendarData.parse(await file.readAsString());
  }

  Future<void> write(CalendarData data, int expectedRevision) async {
    await file.parent.create(recursive: true);
    final lock = await File('${file.path}.lock').open(mode: FileMode.append);
    try {
      await lock.lock(FileLock.blockingExclusive);
      final current = await read();
      if (current != null && current.revision != expectedRevision) {
        throw const FileSystemException(
          'Календарь изменился в другом окне. Перезапусти прототип перед сохранением.',
        );
      }
      final temporary = File('${file.path}.tmp');
      await temporary.writeAsString(data.encode(), flush: true);
      await temporary.rename(file.path);
    } finally {
      await lock.close(); // Closing also releases the advisory file lock.
    }
  }
}
