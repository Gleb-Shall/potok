# Calendar memory comparison

An isolated experiment, never a production deployment. `.github/workflows/flutter-experiment.yml` builds two **release** macOS applications on pushes to `experiment/flutter-calendar`, uploads temporary artifacts and has no deployment credentials or main-branch trigger.

## Comparable workload

`generate-fixture.mjs` writes the same 40 one-off synthetic events to both apps. Same current week, Moscow dates, light theme, 1280×800 content area, 24-hour time grid, 76px/hour; no maps, cloud, login, landing animation or developer tools. Two scenarios: `--bench-empty`, `--benchmark` (40 events). The web baseline runs the current `App` from the branch base (298c01a), not a simplified HTML calendar. It uses a separate native bundle ID `app.potok.webbaseline`. The only Rust addition selects the fixture scenario; the production UI is unchanged.

The Flutter prototype is a smaller feature set, so this compares the calendar workload, not future full-feature parity. Never infer a universal “Flutter uses X MB” from it.

## Measurement

Compile `clang -Wall -Wextra -Werror -O2 benchmarks/memory-macos.c -o /tmp/potok-memory-macos`. The helper reads `ri_phys_footprint` via macOS `proc_pid_rusage`, and groups the app's processes using its resource coalition. Include WebKit renderer, networking and graphics processes. Do not compare only Tauri's small host process. RSS is included for diagnostics but is not the reported footprint.

The coalition structure is documented in [Apple's XNU source](https://github.com/apple-oss-distributions/xnu/blob/main/bsd/sys/proc_info_private.h). This diagnostic tool is not part of either distributed application. It refuses to report an incomplete total when grouping or a process read fails. Run apps via LaunchServices (`open -na`) so each gets its own app coalition.

Warm up each app for 20 seconds; take 10 samples spaced by 2 seconds. Repeat fresh launches in alternating order. Report median and min–max in **MiB**, plus process members, OS/hardware, source commit and release settings. No sudo. Only the benchmark instances may be closed by the runner. Existing user applications and profiles are left intact.

## Files

- `fixtures/calendar.json`: committed identical synthetic workload; no personal data.
- `web/main.jsx`, `vite.config.js`, `tauri.conf.json`: isolated baseline entry/build overlay.
- `memory-macos.c`: read-only process memory collector.
- `results/`: generated samples and report; JSON is ignored to avoid accidentally committing process diagnostics.
