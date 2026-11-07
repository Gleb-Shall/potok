import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'calendar_model.dart';
import 'calendar_store.dart';
import 'calendar_screen.dart';

Future<void> main(List<String> args) async {
  WidgetsFlutterBinding.ensureInitialized();
  final benchmark =
      args.contains('--benchmark') || args.contains('--bench-empty');
  final fixture = CalendarData.parse(
    await rootBundle.loadString('assets/calendar.json'),
  );
  CalendarData initial = args.contains('--bench-empty')
      ? fixture.empty
      : fixture;
  String? error;
  if (!benchmark) {
    try {
      initial = await CalendarStore().read() ?? fixture;
    } catch (exception) {
      error = 'Не удалось прочитать сохранённый календарь: $exception';
    }
  }
  runApp(
    PotokPrototype(initial: initial, benchmark: benchmark, initialError: error),
  );
}

class PotokPrototype extends StatefulWidget {
  const PotokPrototype({
    super.key,
    required this.initial,
    required this.benchmark,
    this.initialError,
  });
  final CalendarData initial;
  final bool benchmark;
  final String? initialError;
  @override
  State<PotokPrototype> createState() => _PotokPrototypeState();
}

class _PotokPrototypeState extends State<PotokPrototype> {
  bool dark = false;
  @override
  Widget build(BuildContext context) {
    final scheme = ColorScheme.fromSeed(
      seedColor: const Color(0xffff6835),
      brightness: dark ? Brightness.dark : Brightness.light,
    );
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Potok Flutter Prototype',
      theme: ThemeData(
        colorScheme: scheme,
        scaffoldBackgroundColor: dark ? const Color(0xff1d211d) : Colors.white,
        fontFamily: '.AppleSystemUIFont',
        useMaterial3: true,
        dividerColor: dark ? const Color(0xff363b34) : const Color(0xffe5e7e1),
        inputDecorationTheme: const InputDecorationTheme(
          border: OutlineInputBorder(),
          isDense: true,
        ),
        filledButtonTheme: FilledButtonThemeData(
          style: FilledButton.styleFrom(
            backgroundColor: const Color(0xffff6835),
            foregroundColor: const Color(0xff191c19),
          ),
        ),
      ),
      home: CalendarScreen(
        initial: widget.initial,
        benchmark: widget.benchmark,
        initialError: widget.initialError,
        onTheme: () => setState(() => dark = !dark),
      ),
    );
  }
}
