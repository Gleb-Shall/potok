# Isolated UI review

With the local Vite server running, open `/tests/ui/`. The fixture renders the
actual application components with populated in-memory sample records. Section,
theme and dialog controls make dark/light and narrow-screen review repeatable.
It does not load account sessions or save changes to workspace data. Theme choice
uses the normal device preference. Save callbacks are intentionally inert.

This is a development entry, not an application route or a production bundle
entry. Production builds start at the root `index.html` only.

Use `/tests/ui/?dialog=card-style` to open the card appearance editor directly.
Enable “Показать выделение” and move the pointer over the preview to inspect the
smoke and letter displacement without touching saved templates.
