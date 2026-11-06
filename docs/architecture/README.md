# Архитектура Потока

Preact + Vite: portable application and shared calendar core. src/main.jsx starts local personal mode; src/App.jsx coordinates the workspace. The hosted website lives in a separate private repository.

Описание разделено по ответственностям:

- [Календарь и переносы](calendar/README.md)
- [События и история](events/README.md)
- [Шаблоны событий](templates/README.md)
- [Записи и постоянные сведения](records/README.md)
- [Авторизация, хранение и синхронизация](sync/README.md)
- [Внешний вид и качество анимаций](appearance/README.md)
- [Общие элементы интерфейса](shared-ui/README.md)

Направление UI и размеры контролов — в [рабочей системе дизайна](../../.interface-design/system.md). Исследования и причины выбора — в [design-research](../design-research/).

При переносе ответственности между файлами нужно обновлять страницу соответствующего раздела. Здесь остаётся карта входа, а не полное описание каждого компонента.

- [Напоминания](reminders/README.md) — конкретное событие, время и доставка через Firebase.

- [Память и жизненный цикл](performance/README.md) — кеши, canvas/WebGL, очистка обработчиков и проверки.

- [Distributions](distributions/README.md)
