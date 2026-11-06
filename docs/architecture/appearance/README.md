# Внешний вид

`AppearanceSettings.jsx` — раздел личного кабинета. `src/lib/appearance.js` хранит качество под ключом `potok:animation-quality` и сообщает об изменениях через `potok:appearance-change`; между вкладками используется storage event. Настройка индивидуальна для устройства.

Landing render quality and world-engine now belong to the private website. The shared appearance preference remains in core.

`src/theme/ThemeProvider.jsx` назначает светлое оформление. Переключателей тёмной темы нет, но в старых CSS остались неактивные правила `.dark`. Текущая итерация редакторов не исследует оставшееся поведение тёмной темы на устройстве пользователя.

`calendar-workspace.css` задаёт новую оболочку приложения, `editor-ui.css` — панели, меню и формы. Семантические переменные цвета берутся из существующей системы; отдельная палитра редактора не создаётся.
Проверки: `tests/appearance.test.jsx`, `tests/entry.test.jsx`.

ThemeProvider применяет светлое оформление и качество анимаций перед отображением; неиспользуемого контекста темы и useTheme больше нет.
