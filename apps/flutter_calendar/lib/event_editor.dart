import 'package:flutter/material.dart';

import 'calendar_model.dart';

class EventEditor extends StatefulWidget {
  const EventEditor({
    super.key,
    required this.event,
    required this.onSave,
    required this.onDelete,
  });
  final CalendarEvent event;
  final Future<void> Function(CalendarEvent) onSave;
  final Future<void> Function() onDelete;
  @override
  State<EventEditor> createState() => _EventEditorState();
}

class _EventEditorState extends State<EventEditor> {
  late final title = TextEditingController(text: widget.event.title);
  late final notes = TextEditingController(text: widget.event.notes);
  late DateTime date = dateFromKey(widget.event.date);
  late int start = widget.event.start, duration = widget.event.duration;
  late String color = widget.event.color;
  bool saving = false;
  String? error;
  @override
  void dispose() {
    title.dispose();
    notes.dispose();
    super.dispose();
  }

  Future<void> save() async {
    if (title.text.trim().isEmpty) {
      setState(() => error = 'Введи название.');
      return;
    }
    setState(() {
      saving = true;
      error = null;
    });
    try {
      await widget.onSave(
        widget.event.timed(dateKey(date), start, duration).change({
          'title': title.text.trim(),
          'notes': notes.text,
          'color': color,
        }),
      );
      if (mounted) Navigator.pop(context);
    } catch (e) {
      if (mounted) {
        setState(() {
          error = '$e';
          saving = false;
        });
      }
    }
  }

  Future<void> pickTime(bool end) async {
    final value = end ? start + duration : start;
    final result = await showTimePicker(
      context: context,
      initialTime: TimeOfDay(
        hour: (value ~/ 60).clamp(0, 23),
        minute: value % 60,
      ),
      builder: (context, child) => MediaQuery(
        data: MediaQuery.of(context).copyWith(alwaysUse24HourFormat: true),
        child: child!,
      ),
    );
    if (result == null || !mounted) return;
    final next = result.hour * 60 + result.minute;
    setState(() {
      if (end) {
        if (next > start) duration = next - start;
      } else {
        start = next;
        duration = duration.clamp(5, 1440 - start);
      }
    });
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: Row(
      children: [
        const Expanded(child: Text('Событие')),
        IconButton(
          onPressed: saving ? null : () => Navigator.pop(context),
          icon: const Icon(Icons.close),
        ),
      ],
    ),
    content: SizedBox(
      width: 430,
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(
              controller: title,
              autofocus: true,
              decoration: const InputDecoration(labelText: 'Название'),
            ),
            const SizedBox(height: 18),
            OutlinedButton.icon(
              icon: const Icon(Icons.calendar_today, size: 18),
              label: Text(
                '${date.day} ${months[date.month - 1].toLowerCase()} ${date.year}',
              ),
              onPressed: saving
                  ? null
                  : () async {
                      final next = await showDatePicker(
                        context: context,
                        initialDate: date,
                        firstDate: DateTime(2020),
                        lastDate: DateTime(2100),
                      );
                      if (next != null && mounted) {
                        setState(
                          () => date = DateTime.utc(
                            next.year,
                            next.month,
                            next.day,
                          ),
                        );
                      }
                    },
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: saving ? null : () => pickTime(false),
                    child: Text('Начало ${clock(start)}'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton(
                    onPressed: saving ? null : () => pickTime(true),
                    child: Text('Конец ${clock(start + duration)}'),
                  ),
                ),
              ],
            ),
            Row(
              children: [
                const Text('Длительность'),
                Expanded(
                  child: Slider(
                    value: duration.clamp(15, 240).toDouble(),
                    min: 15,
                    max: 240,
                    divisions: 15,
                    onChanged: saving
                        ? null
                        : (v) => setState(
                            () => duration = v.round().clamp(5, 1440 - start),
                          ),
                  ),
                ),
                Text('$duration мин'),
              ],
            ),
            Wrap(
              spacing: 8,
              children: ['violet', 'blue', 'green', 'peach', 'pink']
                  .map(
                    (value) => ChoiceChip(
                      label: Text(
                        {
                          'violet': 'Сирень',
                          'blue': 'Небо',
                          'green': 'Лист',
                          'peach': 'Персик',
                          'pink': 'Роза',
                        }[value]!,
                      ),
                      selected: color == value,
                      onSelected: saving
                          ? null
                          : (_) => setState(() => color = value),
                    ),
                  )
                  .toList(),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: notes,
              maxLines: 3,
              decoration: const InputDecoration(labelText: 'Заметки'),
            ),
            if (error != null)
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: Text(
                  error!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ),
          ],
        ),
      ),
    ),
    actions: [
      TextButton(
        onPressed: saving
            ? null
            : () async {
                setState(() => saving = true);
                try {
                  await widget.onDelete();
                  if (context.mounted) Navigator.pop(context);
                } catch (e) {
                  if (mounted) {
                    setState(() {
                      error = '$e';
                      saving = false;
                    });
                  }
                }
              },
        child: const Text('Удалить'),
      ),
      FilledButton(
        onPressed: saving ? null : save,
        child: Text(saving ? 'Сохраняем…' : 'Сохранить'),
      ),
    ],
  );
}
