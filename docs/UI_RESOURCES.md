# Визуальные материалы Потока

Новая визуальная система и рабочий пример на лендинге описаны в [DESIGN_DIRECTION.md](DESIGN_DIRECTION.md).

## Изучено и использовано в прототипах

- [Animate UI skill](https://github.com/imskyleen/animate-ui/blob/main/skills/animate-ui/SKILL.md): изучены рекомендации и переключатель темы. Прототип переключателя снят вместе с тёмной темой; неиспользуемые зависимости Animate UI и Motion удалены.
- [Aceternity Text Flipping Board](https://ui.aceternity.com/components/text-flipping-board): изучен открытый исходник. Конструкция разделённых половинок адаптирована для Preact и CSS; добавлены кириллица, короткий перебор символов, три примера, пауза и остановка вне экрана. Звук не добавлен. [Условия использования Aceternity](https://ui.aceternity.com/licence).
- [React Bits SpotlightCard](https://reactbits.dev/components/spotlight-card): адаптирован приём подсветки через CSS-переменные координат указателя. Без постоянного цикла отрисовки, без обновления состояния компонентов при движении мыши; на сенсорных устройствах эффект не запускается. Исходник: https://github.com/DavidHDev/react-bits/blob/main/src/content/Components/SpotlightCard/SpotlightCard.jsx. Лицензия сохранена в `licenses/react-bits.txt`.

- [React Bits Threads](https://reactbits.dev/backgrounds/threads): референс интерактивного WebGL-фона. Старый неподключённый прототип удалён; текущая сцена реализована в landing/world.

## Текущая реализация

Интерфейс использует светлую тему. Старые переключатель и React-bridge удалены; Preact совместимость подключается напрямую. Настройка качества анимаций остаётся доступна во внешнем виде. Владение текстурами, очистка сцены и проверки описаны в [архитектуре производительности](architecture/performance/README.md).

## Дальнейший выбор

- Rough Notation: на момент просмотра последний коммит основной ветки — 30 октября 2020 года. Стабильный небольшой пакет может оставаться пригодным; отсутствие коммитов само по себе не означает поломку.
- [Anime.js SVG createDrawable](https://animejs.com/documentation/svg/createdrawable/) — актуальный движок для управления рисованием SVG; геометрию аннотаций нужно задавать отдельно.
- [GSAP DrawSVG](https://gsap.com/docs/v3/Plugins/DrawSVGPlugin/) — ещё один вариант управления SVG-штрихами и последовательностями.
- Текущая Z-заливка карточек остаётся на SVG + CSS, без добавления движка для неё.
- **Uiverse: любые материалы брать только после отдельного согласия владельца.**
