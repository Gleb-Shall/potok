import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:potok_flutter/calendar_model.dart';
import 'package:potok_flutter/main.dart';

void main() {
  final fixture = CalendarData.parse(
    File('assets/calendar.json').readAsStringSync(),
  );
  test('UTC date keys retain the Moscow calendar date', () {
    expect(dateFromKey('2026-11-07'), DateTime.utc(2026, 11, 7));
    expect(monday(dateFromKey('2026-11-07')), DateTime.utc(2026, 11, 2));
  });
  test(
    '40 events project without loss and collision rejects an occupied slot',
    () {
      final week = dateFromKey(fixture.json['benchmark']['start'] as String);
      final events = fixture.project(week, 7);
      expect(events.length, 40);
      expect(
        () =>
            fixture.save(events[0].timed(events[1].date, events[1].start, 60)),
        throwsFormatException,
      );
      expect(fixture.revision, 0);
    },
  );
  test('resizing keeps the opposite edge and bounds intact', () {
    final event = fixture
        .project(dateFromKey(fixture.json['benchmark']['start'] as String), 1)
        .first;
    final top = resized(event, true, 30);
    expect(top.start + top.duration, event.start + event.duration);
    expect(top.duration, 30);
    expect(resized(event, false, -120).duration, 15);
    expect(
      resized(event, false, 2000).start + resized(event, false, 2000).duration,
      1440,
    );
  });
  testWidgets('calendar, board and editor render in a desktop window', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(1280, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(PotokPrototype(initial: fixture, benchmark: true));
    await tester.pumpAndSettle();
    expect(find.text('40 событий'), findsOneWidget);
    expect(tester.takeException(), isNull);
    await tester.tap(find.text('Доска'));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    await tester.tap(find.text('Событие'));
    await tester.pumpAndSettle();
    expect(find.text('Длительность'), findsOneWidget);
    expect(tester.takeException(), isNull);
    await tester.tap(find.byIcon(Icons.close));
    await tester.pumpAndSettle();
    await tester.pumpWidget(const SizedBox());
  });
}
