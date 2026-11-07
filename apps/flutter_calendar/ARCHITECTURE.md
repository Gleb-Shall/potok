# Native calendar prototype

## Boundaries

- `main.dart`: loads bundled fixture or independent local profile, owns theme lifetime. Benchmark arguments bypass disk persistence.
- `calendar_model.dart`: immutable event/workspace wrappers, date projection, overlap validation, resize math. Dates are UTC date keys while the displayed clock follows the application's existing Moscow timezone.
- `calendar_store.dart`: macOS-only file adapter. A file lock serializes writers, revision comparison rejects stale saves, temporary-file rename commits changes. Profile: `$HOME/Library/Application Support/Potok Flutter Prototype/calendar.json`; in a sandboxed build HOME is the app container.
- `calendar_screen.dart`: day/week viewport, board, grid painter, pointer interaction and preview. Pointer motion changes a ValueNotifier; only pointer release saves. Escape, pointer cancellation and navigation discard a preview. Minute clock timer and controllers are disposed with the screen.
- `event_editor.dart`: disposable form state; validation errors preserve the draft. Start, end and duration are linked.
- `macos/Runner`: standard Flutter host, independent bundle ID `app.potok.flutterprototype`, 1280×800 content area.

## Visual intent

The existing compact calendar direction applies: uninterrupted window surface, system typography, 60px toolbar, 44px day header, 76px hour, 52px time axis. Hierarchy is date → navigation → event content. Orange indicates today and active drag; semantic card colors stay quiet. Thin grid lines provide structure without a surrounding card frame. Controls use Flutter's native rendered widgets and keyboard semantics; there is no webview.

## Comparison limits

This is a vertical calendar slice, not a shared Dart/JavaScript implementation. The production Preact domain and its tests remain authoritative. The prototype's missing features must be included before claiming equivalent full-product memory usage. Local JSON portability is not a live synchronization protocol. Production adapters and conflict resolution must be designed separately if the experiment is adopted.
