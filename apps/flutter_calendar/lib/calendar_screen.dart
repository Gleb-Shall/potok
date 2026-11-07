import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'calendar_model.dart';
import 'calendar_store.dart';
import 'event_editor.dart';

const hourHeight = 76.0, axisWidth = 52.0, dayHeight = hourHeight * 24;
const accent = Color(0xffff6835);
Color eventColor(String name, bool dark) {
  const light = {
    'violet': 0xffe9e3f3,
    'blue': 0xffe0ecf7,
    'green': 0xffe5eddd,
    'peach': 0xfff6decc,
    'pink': 0xfff1dfe7,
  };
  const dim = {
    'violet': 0xff41384d,
    'blue': 0xff2d4354,
    'green': 0xff384734,
    'peach': 0xff584336,
    'pink': 0xff513845,
  };
  return Color((dark ? dim : light)[name] ?? (dark ? 0xff41384d : 0xffe9e3f3));
}

class DragPreview {
  const DragPreview(this.source, this.event, {this.edge});
  final CalendarEvent source, event;
  final bool? edge;
}

class CalendarScreen extends StatefulWidget {
  const CalendarScreen({
    super.key,
    required this.initial,
    required this.benchmark,
    required this.onTheme,
    this.initialError,
  });
  final CalendarData initial;
  final bool benchmark;
  final VoidCallback onTheme;
  final String? initialError;
  @override
  State<CalendarScreen> createState() => _CalendarScreenState();
}

class _CalendarScreenState extends State<CalendarScreen> {
  late CalendarData data = widget.initial;
  late DateTime anchor = dateFromKey(
    data.json['benchmark']?['start'] as String? ??
        dateKey(monday(calendarToday())),
  );
  int days = 7;
  bool board = false, saving = false;
  final scroll = ScrollController(initialScrollOffset: 8 * hourHeight);
  final gridKey = GlobalKey();
  final preview = ValueNotifier<DragPreview?>(null);
  final now = ValueNotifier<DateTime>(
    DateTime.now().toUtc().add(const Duration(hours: 3)),
  );
  Timer? timer;
  double grabMinutes = 0, resizeY = 0;
  CalendarEvent? dragging;
  bool? resizeTop;
  @override
  void initState() {
    super.initState();
    timer = Timer.periodic(
      const Duration(seconds: 30),
      (_) => now.value = DateTime.now().toUtc().add(const Duration(hours: 3)),
    );
    if (widget.initialError != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) message(widget.initialError!);
      });
    }
  }

  @override
  void dispose() {
    timer?.cancel();
    scroll.dispose();
    preview.dispose();
    now.dispose();
    super.dispose();
  }

  void message(String text) =>
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
  Future<void> commit(CalendarData next) async {
    if (saving) throw StateError('Подожди завершения сохранения.');
    setState(() => saving = true);
    try {
      if (!widget.benchmark) await CalendarStore().write(next, data.revision);
      if (mounted) setState(() => data = next);
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  Future<void> save(CalendarEvent event) async => commit(data.save(event));
  Future<void> edit(CalendarEvent event) => showDialog<void>(
    context: context,
    barrierDismissible: false,
    builder: (_) => EventEditor(
      event: event,
      onSave: save,
      onDelete: () => commit(data.remove(event)),
    ),
  );
  CalendarEvent newEvent(DateTime date, int start) => CalendarEvent({
    'id': 'flutter-${DateTime.now().microsecondsSinceEpoch}',
    'title': 'Новое событие',
    'date': dateKey(date),
    'start': start,
    'duration': 60.clamp(5, 1440 - start),
    'color': 'violet',
    'status': 'planned',
    'typeId': 'personal',
    'busy': true,
    'history': <dynamic>[],
    'fields': <String, dynamic>{},
  });
  Future<void> pickDate(CalendarEvent event) async {
    if (saving) return;
    final next = await showDatePicker(
      context: context,
      initialDate: dateFromKey(event.date),
      firstDate: DateTime(2020),
      lastDate: DateTime(2100),
      helpText: 'Перенести событие',
    );
    if (next != null && mounted) {
      try {
        await save(event.timed(dateKey(next), event.start, event.duration));
      } catch (e) {
        if (mounted) message('$e');
      }
    }
  }

  RenderBox? get grid =>
      gridKey.currentContext?.findRenderObject() as RenderBox?;
  void beginDrag(CalendarEvent event, DragStartDetails details, {bool? top}) {
    if (saving) return;
    final box = grid;
    if (box == null) return;
    dragging = event;
    resizeTop = top;
    final point = box.globalToLocal(details.globalPosition);
    grabMinutes = point.dy / hourHeight * 60 - event.start;
    resizeY = details.globalPosition.dy;
    preview.value = DragPreview(event, event, edge: top);
  }

  void moveDrag(DragUpdateDetails details) {
    final source = dragging, box = grid;
    if (source == null || box == null) return;
    final point = box.globalToLocal(details.globalPosition);
    CalendarEvent next;
    if (resizeTop != null) {
      final value = resized(
        source,
        resizeTop!,
        ((details.globalPosition.dy - resizeY) / hourHeight * 60).round(),
      );
      next = source.change({'start': value.start, 'duration': value.duration});
    } else {
      final index =
          ((point.dx - axisWidth) / ((box.size.width - axisWidth) / days))
              .floor()
              .clamp(0, days - 1);
      final start =
          (((point.dy / hourHeight * 60 - grabMinutes) / 15).round() * 15)
              .clamp(0, 1440 - source.duration);
      next = source.change({
        'date': dateKey(anchor.add(Duration(days: index))),
        'start': start,
      });
    }
    preview.value = DragPreview(source, next, edge: resizeTop);
  }

  void cancelDrag() {
    dragging = null;
    resizeTop = null;
    preview.value = null;
  }

  Future<void> endDrag() async {
    final value = preview.value;
    cancelDrag();
    if (value == null ||
        (value.source.date == value.event.date &&
            value.source.start == value.event.start &&
            value.source.duration == value.event.duration)) {
      return;
    }
    try {
      await save(
        value.source.timed(
          value.event.date,
          value.event.start,
          value.event.duration,
        ),
      );
    } catch (e) {
      if (mounted) message('$e');
    }
  }

  Future<void> transfer() async {
    final controller = TextEditingController();
    String? error;
    await showDialog<void>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, update) => AlertDialog(
          title: const Text('Данные прототипа'),
          content: SizedBox(
            width: 520,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  'JSON формата Потока v2. Импорт заменит только календарь этого прототипа. Облако не подключено.',
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: controller,
                  minLines: 4,
                  maxLines: 8,
                  decoration: const InputDecoration(
                    labelText: 'JSON для импорта',
                  ),
                ),
                if (error != null)
                  Text(
                    error!,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.error,
                    ),
                  ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () async {
                await Clipboard.setData(ClipboardData(text: data.encode()));
                if (context.mounted) Navigator.pop(context);
              },
              child: const Text('Скопировать экспорт'),
            ),
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Закрыть'),
            ),
            FilledButton(
              onPressed: () async {
                try {
                  final imported = CalendarData.parse(controller.text);
                  await commit(
                    CalendarData({
                      ...imported.json,
                      'revision': data.revision + 1,
                    }),
                  );
                  if (context.mounted) Navigator.pop(context);
                } catch (e) {
                  update(() => error = '$e');
                }
              },
              child: const Text('Импортировать'),
            ),
          ],
        ),
      ),
    );
    // The dialog route disposes its editable text before the controller is released.
    await Future<void>.delayed(const Duration(milliseconds: 300));
    controller.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final events = data.project(anchor, days);
    final dark = Theme.of(context).brightness == Brightness.dark;
    return CallbackShortcuts(
      bindings: {const SingleActivator(LogicalKeyboardKey.escape): cancelDrag},
      child: Focus(
        autofocus: true,
        child: Scaffold(
          body: Column(
            children: [
              SizedBox(
                height: 60,
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  child: Row(
                    children: [
                      IconButton(
                        tooltip: 'Данные прототипа',
                        onPressed: widget.benchmark ? null : transfer,
                        icon: const Icon(Icons.data_object, size: 20),
                      ),
                      Text(
                        '${months[anchor.month - 1]} ${anchor.year}',
                        style: const TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      IconButton(
                        tooltip: 'Назад',
                        onPressed: () {
                          cancelDrag();
                          setState(
                            () =>
                                anchor = anchor.subtract(Duration(days: days)),
                          );
                        },
                        icon: const Icon(Icons.chevron_left),
                      ),
                      IconButton(
                        tooltip: 'Вперёд',
                        onPressed: () {
                          cancelDrag();
                          setState(
                            () => anchor = anchor.add(Duration(days: days)),
                          );
                        },
                        icon: const Icon(Icons.chevron_right),
                      ),
                      const Spacer(),
                      SegmentedButton<int>(
                        segments: const [
                          ButtonSegment(value: 1, label: Text('День')),
                          ButtonSegment(value: 7, label: Text('Неделя')),
                        ],
                        selected: {days},
                        showSelectedIcon: false,
                        onSelectionChanged: (value) {
                          cancelDrag();
                          setState(() {
                            days = value.first;
                            anchor = days == 7
                                ? monday(calendarToday())
                                : calendarToday();
                          });
                        },
                      ),
                      const Spacer(),
                      IconButton(
                        tooltip: 'Светлая / тёмная',
                        onPressed: widget.onTheme,
                        icon: Icon(
                          dark
                              ? Icons.light_mode_outlined
                              : Icons.dark_mode_outlined,
                          size: 20,
                        ),
                      ),
                      const SizedBox(width: 8),
                      FilledButton.icon(
                        onPressed: saving
                            ? null
                            : () => edit(newEvent(calendarToday(), 600)),
                        icon: const Icon(Icons.add, size: 18),
                        label: const Text('Событие'),
                      ),
                    ],
                  ),
                ),
              ),
              SizedBox(
                height: 42,
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Row(
                    children: [
                      TextButton(
                        onPressed: () {
                          cancelDrag();
                          setState(() => board = false);
                        },
                        child: Text(
                          'По времени',
                          style: TextStyle(
                            fontWeight: board
                                ? FontWeight.normal
                                : FontWeight.bold,
                          ),
                        ),
                      ),
                      TextButton(
                        onPressed: () {
                          cancelDrag();
                          setState(() => board = true);
                        },
                        child: Text(
                          'Доска',
                          style: TextStyle(
                            fontWeight: board
                                ? FontWeight.bold
                                : FontWeight.normal,
                          ),
                        ),
                      ),
                      const SizedBox(width: 16),
                      Text(
                        '${events.length} событий',
                        style: TextStyle(color: Theme.of(context).hintColor),
                      ),
                      const Spacer(),
                      if (widget.benchmark)
                        const Text(
                          'BENCHMARK · без сохранения',
                          style: TextStyle(fontSize: 11),
                        ),
                      if (saving) const Text('Сохраняем…'),
                    ],
                  ),
                ),
              ),
              Divider(height: 1, color: Theme.of(context).dividerColor),
              SizedBox(
                height: 44,
                child: Row(
                  children: [
                    if (!board)
                      const SizedBox(
                        width: axisWidth,
                        child: Center(
                          child: Text('МСК', style: TextStyle(fontSize: 11)),
                        ),
                      ),
                    for (var i = 0; i < days; i++)
                      Expanded(
                        child: Builder(
                          builder: (context) {
                            final date = anchor.add(Duration(days: i)),
                                today =
                                    dateKey(date) == dateKey(calendarToday());
                            return Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Text(
                                  weekdays[date.weekday - 1],
                                  style: TextStyle(
                                    color: Theme.of(context).hintColor,
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Container(
                                  padding: const EdgeInsets.all(6),
                                  decoration: BoxDecoration(
                                    color: today ? accent : null,
                                    shape: BoxShape.circle,
                                  ),
                                  child: Text(
                                    '${date.day}',
                                    style: TextStyle(
                                      fontSize: 19,
                                      fontWeight: FontWeight.w600,
                                      color: today
                                          ? const Color(0xff191c19)
                                          : null,
                                    ),
                                  ),
                                ),
                              ],
                            );
                          },
                        ),
                      ),
                  ],
                ),
              ),
              Divider(height: 1, color: Theme.of(context).dividerColor),
              Expanded(
                child: board
                    ? buildBoard(events)
                    : LayoutBuilder(
                        builder: (context, constraints) => SingleChildScrollView(
                          controller: scroll,
                          child: RepaintBoundary(
                            child: SizedBox(
                              key: gridKey,
                              width: constraints.maxWidth,
                              height: dayHeight,
                              child: ValueListenableBuilder<DragPreview?>(
                                valueListenable: preview,
                                builder: (context, moving, _) {
                                  final width =
                                      (constraints.maxWidth - axisWidth) / days;
                                  return Stack(
                                    clipBehavior: Clip.hardEdge,
                                    children: [
                                      Positioned.fill(
                                        child: GestureDetector(
                                          behavior: HitTestBehavior.opaque,
                                          onDoubleTapDown: (details) {
                                            final point = details.localPosition,
                                                day =
                                                    ((point.dx - axisWidth) /
                                                            width)
                                                        .floor()
                                                        .clamp(0, days - 1);
                                            final start =
                                                ((point.dy / hourHeight * 4)
                                                            .floor() *
                                                        15)
                                                    .clamp(0, 1380);
                                            edit(
                                              newEvent(
                                                anchor.add(Duration(days: day)),
                                                start,
                                              ),
                                            );
                                          },
                                          child: CustomPaint(
                                            painter: GridPainter(
                                              days: days,
                                              line: Theme.of(context)
                                                  .dividerColor,
                                            ),
                                          ),
                                        ),
                                      ),
                                      for (var hour = 0; hour < 24; hour++)
                                        Positioned(
                                          left: 0,
                                          top: hour * hourHeight + 2,
                                          width: axisWidth - 8,
                                          child: Text(
                                            '${hour.toString().padLeft(2, '0')}:00',
                                            textAlign: TextAlign.right,
                                            style: TextStyle(
                                              fontSize: 11,
                                              color: Theme.of(context)
                                                  .hintColor,
                                            ),
                                          ),
                                        ),
                                      for (final event in events)
                                        positionedEvent(
                                          event,
                                          width,
                                          moving?.source.id == event.id,
                                        ),
                                      if (moving != null)
                                        positionedEvent(
                                          moving.event,
                                          width,
                                          false,
                                          isPreview: true,
                                        ),
                                      ValueListenableBuilder<DateTime>(
                                        valueListenable: now,
                                        builder: (context, time, _) {
                                          final index = dateFromKey(
                                            dateKey(time),
                                          ).difference(anchor).inDays;
                                          if (index < 0 || index >= days) {
                                            return const SizedBox.shrink();
                                          }
                                          final top =
                                              (time.hour * 60 + time.minute) /
                                              60 *
                                              hourHeight;
                                          return Positioned(
                                            left: 0,
                                            right: 0,
                                            top: top,
                                            child: IgnorePointer(
                                              child: Row(
                                                children: [
                                                  Container(
                                                    width: axisWidth - 2,
                                                    padding:
                                                        const EdgeInsets.symmetric(
                                                          vertical: 2,
                                                        ),
                                                    color: accent,
                                                    child: Text(
                                                      clock(
                                                        time.hour * 60 +
                                                            time.minute,
                                                      ),
                                                      textAlign:
                                                          TextAlign.center,
                                                      style: const TextStyle(
                                                        fontSize: 10,
                                                        color: Colors.black,
                                                      ),
                                                    ),
                                                  ),
                                                  Expanded(
                                                    child: Container(
                                                      height: 1,
                                                      color: accent.withValues(
                                                        alpha: .35,
                                                      ),
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            ),
                                          );
                                        },
                                      ),
                                    ],
                                  );
                                },
                              ),
                            ),
                          ),
                        ),
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget positionedEvent(
    CalendarEvent event,
    double width,
    bool hidden, {
    bool isPreview = false,
  }) {
    final index = dateFromKey(event.date).difference(anchor).inDays;
    if (index < 0 || index >= days) return const SizedBox.shrink();
    return Positioned(
      left: axisWidth + index * width + 3,
      top: event.start / 60 * hourHeight,
      width: width - 6,
      height: (event.duration / 60 * hourHeight).clamp(18, dayHeight),
      child: Opacity(
        opacity: hidden ? .25 : 1,
        child: IgnorePointer(
          ignoring: isPreview,
          child: eventTile(event, isPreview: isPreview),
        ),
      ),
    );
  }

  Widget eventTile(
    CalendarEvent event, {
    bool isPreview = false,
    bool isBoard = false,
  }) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final content = DecoratedBox(
      decoration: BoxDecoration(
        color: eventColor(event.color, dark),
        borderRadius: BorderRadius.circular(5),
        border: isPreview ? Border.all(color: accent, width: 2) : null,
      ),
      child: Padding(
        padding: EdgeInsets.fromLTRB(9, isBoard ? 12 : 7, 9, 5),
        child: LayoutBuilder(
          builder: (context, c) => c.maxHeight < 14
              ? const SizedBox.shrink()
              : Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${clock(event.start)}–${clock(event.start + event.duration)}',
                      maxLines: 1,
                      overflow: TextOverflow.clip,
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    if (c.maxHeight > 33) ...[
                      const SizedBox(height: 3),
                      Flexible(
                        child: Text(
                          event.title,
                          maxLines: isBoard ? 3 : 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                    if (c.maxHeight > 76 && event.notes.isNotEmpty) ...[
                      const SizedBox(height: 5),
                      Text(
                        event.notes,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 11,
                          color: Theme.of(context).hintColor,
                        ),
                      ),
                    ],
                  ],
                ),
        ),
      ),
    );
    if (isPreview) return content;
    final interactive = GestureDetector(
      onTap: () => edit(event),
      onLongPressStart: (_) => pickDate(event),
      onPanStart: isBoard ? null : (details) => beginDrag(event, details),
      onPanUpdate: isBoard ? null : moveDrag,
      onPanEnd: isBoard ? null : (_) => endDrag(),
      onPanCancel: isBoard ? null : cancelDrag,
      child: MouseRegion(
        cursor: SystemMouseCursors.grab,
        child: Stack(
          children: [
            Positioned.fill(child: content),
            if (!isBoard)
              for (final top in [true, false])
                Positioned(
                  left: 12,
                  right: 12,
                  top: top ? 0 : null,
                  bottom: top ? null : 0,
                  height: 7,
                  child: MouseRegion(
                    cursor: SystemMouseCursors.resizeUpDown,
                    child: GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onPanStart: (details) =>
                          beginDrag(event, details, top: top),
                      onPanUpdate: moveDrag,
                      onPanEnd: (_) => endDrag(),
                      onPanCancel: cancelDrag,
                      child: Center(
                        child: Container(
                          width: 20,
                          height: 2,
                          color: Theme.of(context).hintColor
                              .withValues(alpha: .3),
                        ),
                      ),
                    ),
                  ),
                ),
          ],
        ),
      ),
    );
    return isBoard
        ? Draggable<CalendarEvent>(
            data: event,
            feedback: SizedBox(
              width: 220,
              height: 120,
              child: Material(color: Colors.transparent, child: content),
            ),
            childWhenDragging: Opacity(opacity: .3, child: interactive),
            child: interactive,
          )
        : interactive;
  }

  Widget buildBoard(List<CalendarEvent> events) => Row(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      for (var i = 0; i < days; i++)
        Expanded(
          child: DragTarget<CalendarEvent>(
            onWillAcceptWithDetails: (_) => !saving,
            onAcceptWithDetails: (details) async {
              try {
                await save(
                  details.data.timed(
                    dateKey(anchor.add(Duration(days: i))),
                    details.data.start,
                    details.data.duration,
                  ),
                );
              } catch (e) {
                if (mounted) message('$e');
              }
            },
            builder: (context, candidates, rejected) => DecoratedBox(
              decoration: BoxDecoration(
                color: candidates.isEmpty
                    ? null
                    : accent.withValues(alpha: .08),
                border: Border(
                  right: BorderSide(color: Theme.of(context).dividerColor),
                ),
              ),
              child: ListView(
                padding: const EdgeInsets.all(6),
                children: [
                  for (final event in events.where(
                    (event) =>
                        event.date == dateKey(anchor.add(Duration(days: i))),
                  ))
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: SizedBox(
                        height: 140,
                        child: eventTile(event, isBoard: true),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
    ],
  );
}

class GridPainter extends CustomPainter {
  const GridPainter({required this.days, required this.line});
  final int days;
  final Color line;
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = line
      ..strokeWidth = 1;
    final width = (size.width - axisWidth) / days;
    for (var i = 0; i <= days; i++) {
      canvas.drawLine(
        Offset(axisWidth + i * width, 0),
        Offset(axisWidth + i * width, size.height),
        paint,
      );
    }
    for (var half = 0; half < 48; half++) {
      paint.color = line.withValues(alpha: half.isEven ? 1 : .45);
      final y = half * hourHeight / 2;
      canvas.drawLine(Offset(axisWidth, y), Offset(size.width, y), paint);
    }
  }

  @override
  bool shouldRepaint(GridPainter oldDelegate) =>
      days != oldDelegate.days || line != oldDelegate.line;
}
