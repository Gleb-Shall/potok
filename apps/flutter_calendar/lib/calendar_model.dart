import 'dart:convert';

String dateKey(DateTime date) =>
    '${date.year.toString().padLeft(4, '0')}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
DateTime dateFromKey(String value) => DateTime.parse('${value}T00:00:00Z');
DateTime calendarToday() {
  final now = DateTime.now().toUtc().add(const Duration(hours: 3));
  return DateTime.utc(now.year, now.month, now.day);
}

DateTime monday(DateTime day) => DateTime.utc(
  day.year,
  day.month,
  day.day,
).subtract(Duration(days: day.weekday - 1));
String clock(int value) =>
    '${(value ~/ 60).toString().padLeft(2, '0')}:${(value % 60).toString().padLeft(2, '0')}';
const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const months = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
];

class CalendarEvent {
  CalendarEvent(Map<String, dynamic> data) : json = Map.unmodifiable(data);
  final Map<String, dynamic> json;
  String get id => json['id'] as String;
  String get title => json['title'] as String? ?? 'Событие';
  String get date => json['date'] as String? ?? '';
  int get start => (json['start'] as num).toInt();
  int get duration => (json['duration'] as num).toInt();
  String get color => json['color'] as String? ?? 'violet';
  String get status => json['status'] as String? ?? 'planned';
  String get notes => json['notes'] as String? ?? '';
  bool get moved => json['originalDate'] != null;
  CalendarEvent change(Map<String, dynamic> fields) =>
      CalendarEvent({...json, ...fields});
  CalendarEvent timed(String date, int start, int duration) {
    if (start < 0 || duration < 5 || start + duration > 1440) {
      throw const FormatException('Событие должно закончиться в тот же день.');
    }
    if (this.date == date && this.start == start && this.duration == duration) {
      return this;
    }
    final history = List<Map<String, dynamic>>.from(
      (json['history'] as List? ?? []).map(
        (item) => Map<String, dynamic>.from(item as Map),
      ),
    );
    if (this.date != date || this.start != start || this.duration != duration) {
      history.add({
        'fromDate': this.date,
        'fromStart': this.start,
        'fromDuration': this.duration,
        'toDate': date,
        'toStart': start,
        'toDuration': duration,
        'at': DateTime.now().toUtc().toIso8601String(),
      });
    }
    return change({
      'date': date,
      'start': start,
      'duration': duration,
      'status': 'planned',
      'originalDate': json['originalDate'] ?? this.date,
      'originalStart': json['originalStart'] ?? this.start,
      'originalDuration': json['originalDuration'] ?? this.duration,
      'history': history,
    });
  }
}

class CalendarData {
  CalendarData(Map<String, dynamic> data) : json = Map.unmodifiable(data);
  final Map<String, dynamic> json;
  int get revision => (json['revision'] as num? ?? 0).toInt();
  factory CalendarData.parse(String text) {
    final root = jsonDecode(text);
    if (root is! Map) {
      throw const FormatException('Нужен JSON календаря Потока.');
    }
    final value = Map<String, dynamic>.from(
      root['data'] is Map ? root['data'] as Map : root,
    );
    if (value['version'] != 2 ||
        value['events'] is! List ||
        value['series'] is! List) {
      throw const FormatException('Поддерживается формат Потока version=2.');
    }
    for (final raw in value['events'] as List) {
      if (raw is! Map ||
          raw['id'] is! String ||
          raw['start'] is! num ||
          raw['duration'] is! num) {
        throw const FormatException('Некорректное событие.');
      }
      final start = (raw['start'] as num).toInt(),
          duration = (raw['duration'] as num).toInt();
      if (start < 0 || duration < 5 || start + duration > 1440) {
        throw const FormatException('Некорректное время события.');
      }
    }
    return CalendarData(value);
  }
  CalendarData get empty => CalendarData({
    ...json,
    'events': <dynamic>[],
    'series': <dynamic>[],
    'revision': 0,
  });
  List<CalendarEvent> project(DateTime first, int count) {
    final all = <String, CalendarEvent>{};
    for (final raw in json['events'] as List) {
      final event = CalendarEvent(Map<String, dynamic>.from(raw as Map));
      all[event.id] = event;
    }
    final result = <CalendarEvent>[];
    for (var index = 0; index < count; index++) {
      final date = first.add(Duration(days: index)), key = dateKey(date);
      for (final raw in json['series'] as List) {
        final series = Map<String, dynamic>.from(raw as Map);
        final from = series['from'] as String?;
        if (from == null ||
            key.compareTo(from) < 0 ||
            (series['until'] is String &&
                (series['until'] as String).isNotEmpty &&
                key.compareTo(series['until'] as String) > 0)) {
          continue;
        }
        if (series['weekday'] != date.weekday) continue;
        final interval = (series['intervalWeeks'] as num? ?? 1).toInt();
        if (interval < 1) continue;
        final weeks = date.difference(monday(dateFromKey(from))).inDays ~/ 7;
        if (weeks % interval != 0 ||
            (series['excludedDates'] as List? ?? []).contains(key)) {
          continue;
        }
        final id = '${series['id']}:$key';
        if (all.containsKey(id)) continue;
        result.add(
          CalendarEvent({
            ...series,
            'id': id,
            'seriesId': series['id'],
            'date': key,
            'anchorDate': key,
            'status': 'planned',
            'title': series['title'] ?? _recordTitle(series),
          }),
        );
      }
      result.addAll(
        all.values.where(
          (event) =>
              event.date == key &&
              !['pending', 'cancelled'].contains(event.status),
        ),
      );
    }
    result.sort(
      (a, b) => a.date.compareTo(b.date) != 0
          ? a.date.compareTo(b.date)
          : a.start.compareTo(b.start),
    );
    return result;
  }

  String _recordTitle(Map<String, dynamic> event) {
    final records = [
      ...(json['students'] as List? ?? []),
      ...(json['records'] as List? ?? []),
    ];
    for (final raw in records) {
      if (raw is Map &&
          raw['id'] == (event['recordId'] ?? event['studentId'])) {
        return raw['name'] as String? ?? 'Событие';
      }
    }
    return 'Событие';
  }

  CalendarData save(CalendarEvent event) {
    if (event.date.isNotEmpty &&
        !['pending', 'cancelled'].contains(event.status) &&
        event.json['busy'] != false) {
      for (final other in project(dateFromKey(event.date), 1)) {
        if (other.id != event.id &&
            other.json['busy'] != false &&
            event.start < other.start + other.duration &&
            other.start < event.start + event.duration) {
          throw FormatException('Пересечение с событием «${other.title}».');
        }
      }
    }
    final events =
        (json['events'] as List)
            .where((raw) => (raw as Map)['id'] != event.id)
            .toList()
          ..add(event.json);
    return CalendarData({...json, 'events': events, 'revision': revision + 1});
  }

  CalendarData remove(CalendarEvent event) {
    if (event.json['seriesId'] != null) {
      return save(event.change({'status': 'cancelled'}));
    }
    return CalendarData({
      ...json,
      'events': (json['events'] as List)
          .where((raw) => (raw as Map)['id'] != event.id)
          .toList(),
      'revision': revision + 1,
    });
  }

  String encode() => const JsonEncoder.withIndent('  ').convert(json);
}

({int start, int duration}) resized(CalendarEvent event, bool top, int delta) {
  final shift = (delta / 15).round() * 15,
      minDuration = event.duration < 15 ? event.duration : 15;
  if (top) {
    final start = (event.start + shift).clamp(
      0,
      event.start + event.duration - minDuration,
    );
    return (start: start, duration: event.start + event.duration - start);
  }
  return (
    start: event.start,
    duration: (event.duration + shift).clamp(minDuration, 1440 - event.start),
  );
}
