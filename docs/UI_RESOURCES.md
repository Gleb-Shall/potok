# Визуальные материалы Потока

Новая визуальная система и рабочий пример на лендинге описаны в [DESIGN_DIRECTION.md](DESIGN_DIRECTION.md).

## Использовано

- [Animate UI skill](https://github.com/imskyleen/animate-ui/blob/main/skills/animate-ui/SKILL.md): прочитаны основной навык, каталог, правила, рекомендации по CSS-токенам и воспроизведению эффектов. Используется официальный `ThemeToggler` из `@animate-ui/react/primitives/effects/theme-toggler`: View Transition на 700 мс, плавное раскрытие слева направо, мгновенная смена при reduced motion или отсутствии поддержки браузера. Уровень — как в указанном примере. Иконка использует CSS-аналог `transition.spin` (300 мс, ease.out). Постоянные анимации останавливаются вне экрана, в скрытой вкладке и при reduced motion.
- [Aceternity Text Flipping Board](https://ui.aceternity.com/components/text-flipping-board): изучен открытый исходник. Конструкция разделённых половинок адаптирована для Preact и CSS; добавлены кириллица, короткий перебор символов, три примера, пауза и остановка вне экрана. Звук не добавлен. [Условия использования Aceternity](https://ui.aceternity.com/licence).
- [React Bits SpotlightCard](https://reactbits.dev/components/spotlight-card): адаптирован приём подсветки через CSS-переменные координат указателя. Без постоянного цикла отрисовки, без обновления состояния компонентов при движении мыши; на сенсорных устройствах эффект не запускается. Исходник: https://github.com/DavidHDev/react-bits/blob/main/src/content/Components/SpotlightCard/SpotlightCard.jsx. Лицензия сохранена в `licenses/react-bits.txt`.

- [React Bits Threads](https://reactbits.dev/backgrounds/threads): интерактивный WebGL-фон лендинга. Адаптирован к Preact, загружается отдельно, поддерживает паузу и reduced motion.

## Темы

Светлая, тёмная и системная тема. Настройка хранится отдельно от расписаний в `potok:theme`, синхронизируется между вкладками и не зависит от входа в аккаунт. Тема применяется до первого отображения страницы. Настройки доступны в рабочем пространстве; быстрая кнопка — на главной, экране входа и в шапке приложения.

В `src/lib/react-compat.js` вызов React 19 `use(Context)` направляется в Preact `useContext`; работа с Promise остаётся на Preact Suspense. Это позволяет использовать официальный переключатель, сохранив Preact. Vitest обрабатывает Animate UI и Motion с теми же алиасами, что и сборка.

## Дальнейший выбор

- Rough Notation: на момент просмотра последний коммит основной ветки — 30 октября 2020 года. Стабильный небольшой пакет может оставаться пригодным; отсутствие коммитов само по себе не означает поломку.
- [Anime.js SVG createDrawable](https://animejs.com/documentation/svg/createdrawable/) — актуальный движок для управления рисованием SVG; геометрию аннотаций нужно задавать отдельно.
- [GSAP DrawSVG](https://gsap.com/docs/v3/Plugins/DrawSVGPlugin/) — ещё один вариант управления SVG-штрихами и последовательностями.
- Текущая Z-заливка карточек остаётся на SVG + CSS, без добавления движка для неё.
- **Uiverse: любые материалы брать только после отдельного согласия владельца.**
