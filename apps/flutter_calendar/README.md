# Flutter calendar experiment

Isolated macOS prototype on `experiment/flutter-calendar`. Not the production application and not a replacement for `main`.

- Flutter **3.47.9** / Dart **3.13.7**, pinned in the experimental workflow.
- Run: `flutter pub get`, then `flutter run -d macos` from this directory.
- Release: `flutter build macos --release` (full Xcode required).
- Check: `flutter analyze`, `flutter test`.

Day/week time grid, board, event editor, pointer drag with 15-minute snapping, top/bottom resizing, stationary hold to select a date, light/dark appearance, independent local persistence and JSON v2 import/export. A generated 40-event week makes the initial prototype immediately usable; editing never touches the existing Potok profile.

No cloud adapter, sign-in, maps, template designer, reminders, full history UI or mobile implementation. Basic recurring-event projection is for experimentation and is not yet a complete port of the JavaScript domain model. Do not use this prototype as the only copy of valuable data.

See [architecture](ARCHITECTURE.md) and [benchmark methodology](../../benchmarks/README.md).
