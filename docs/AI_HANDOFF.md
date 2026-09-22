# Relief Studio — handoff для следующего ИИ-агента

Этот документ нужно прочитать в начале работы с репозиторием. Приложение — браузерный редактор рельефных значков из SVG: импортирует вектор, строит объёмную модель Three.js/WebGL, даёт редактировать свет, тени, металл и эмаль, показывает сравнение с примерами и экспортирует PNG/GLB.

## Что уже сделано

В `public/achievement-library/` находятся 93 SVG из рекурсивного обхода пользовательской папки «ачиффки». Уникальные имена: `achievement-001.svg` — `achievement-093.svg`. Соответствие исходным относительным путям и SHA-256 хранится в `manifest.json`. Прежние 79 SVG удалены из текущей библиотеки.

- Канонический шаблон по умолчанию называется `По умолчанию` и настроен по роборуке.
- SVG импортирует маски, clipPath, прозрачные поля и чёрные непрозрачные cutout-элементы. Точный фон удаляется только когда это действительно экспортный фон.
- Stroke и почти совпадающий fill объединяются в одну металлическую область, чтобы на стыке не появлялась лишняя разделяющая линия. Чёрные нейтральные контуры распознаются как металл.
- У металла и цветной эмали раздельно регулируется влияние источника света и затемнения через `surfaceInfluence` и `contourInfluence`.
- Контурный блик ограничен скосом, не перетекает на плато; ширина скоса и ширина блика имеют расширенные диапазоны, при этом исходные значения по умолчанию сохранены.
- Панели «Настройки», «Цвета» и «Примеры ачивок» можно закреплять, перемещать, менять по ширине и оставлять плавающими. Панель примеров можно расширять за ручку.
- Панель сравнения — сетка из пяти колонок. Текущий рендер вписывается в плитку с полями, центрируется и перетаскивается между примерами.
- Управление превью находится поверх области рендера. Превью заполняет доступную область, масштаб работает программными кнопками, а Shift + перетаскивание сохраняет панорамирование.
- Выбор деталей модели отключается, когда панель «Цвета» скрыта; при закрытии панели выделение очищается. Это снижает лишние raycast и перерисовки.
- При наведении на `?` используется одна кастомная подсказка; нативные дублирующие title/aria-подсказки не добавляются.
- Лишние переключатели источников и поясняющие подписи удалены, но внутренние флаги совместимости рецептов сохранены.
- Сбросы настроек показываются только после изменения значения.
- PNG экспорт по умолчанию предлагает 304×304 с полями 16 px; доступны также 68×68 и скрытые дополнительные параметры. Максимальное качество проверяется отдельным тестом.
- При загрузке SVG показывается прогресс. Загрузка примеров отложенная (`loading="lazy"`).

## Производительность

Главное узкое место — WebGL path tracer, а не обычный DOM. Типичный широкий viewport теперь получает прямоугольный буфер вместо квадратного, что заметно уменьшает число пикселей на sample. После достижения целевого числа samples контурный composite выполняется один раз.

Цикл `requestAnimationFrame` не работает постоянно в простое: он запускается только при наличии модели и активного расчёта, останавливается для скрытой вкладки и возобновляется после изменения модели. Размер tile path tracer меняется только при фактическом переключении режима, а не на каждом кадре. Изменения источников света во время drag объединяются в отложенное обновление.

Не возвращай бесконечный render loop и не вызывай `setScene`, `updateMaterials` или полную перестройку на каждый pointermove без замера. Любую оптимизацию проверяй на обычном качестве и во время перетаскивания источника.

## Важные точки кода

- `src/main.js` — сборка приложения, Three.js сцена, камера, управление превью, панели, история и жизненный цикл path tracer.
- `src/geometry.js` — импорт и построение геометрии из SVG.
- `src/validate-svg.js` — проверка контуров и SVG-структуры.
- `src/contour-settings.js`, `src/contour-effects.js` — скос, контурный блик и тень.
- `src/lighting.js`, `src/light-cards.js`, `src/darkness.js` — источники, раздельное влияние на поверхности и металл.
- `src/part-selection.js` — выбор деталей и overlay.
- `src/panel-workspace.js` — docking, floating и resize панелей.
- `src/export-dialog.js`, `src/export-quality.js`, `src/export-presets.js` — PNG/GLB экспорт.
- `src/preview-resolution.js` — расчёт прямоугольного буфера превью.
- `tests/marker-visibility-source.test.mjs` — UI, сравнение, viewport и performance source checks.

## Проверка перед изменениями и публикацией

1. `npm test` — сейчас ожидается 80/80 тестов.
2. `npm run build` — production bundle должен собраться без ошибки. Предупреждение о крупном Three.js chunk ожидаемо.
3. В браузере проверить: импорт SVG с mask/clipPath, обычный и максимальный preview, Shift + drag, масштаб, сравнение 5 колонок, перестановку текущего рендера, закрытие/открытие «Цвета», undo/redo и PNG 304×304.
4. Не добавлять в коммит `node_modules`, `.git`, серверные логи и временные QA-пробы.

## История последних значимых изменений

- `66ca805` — polish comparison UI and preview performance.
- `d2470e4` — fill the complete preview viewport.
- `9cafffe` — исправление программного масштаба превью.
- `a381fd1` — остановка preview loop в простое.
- `ab46f31` — исключение повторных tile updates.
- `c2ce75a` — отключение выбора деталей при скрытой панели цветов.

При изменении поведения обновляй этот handoff, чтобы следующий агент сначала понял существующие решения, а не переписал их вслепую.

## Оптимизация цветовых мешей (2026-09-22)

`src/render-pipeline.js` содержит `batchByColor`, `refreshBatchMaterials`, `setModelDepth`, `disposeRenderPipeline` и `createRenderScheduler`. Модель объединяется по цвету, роли и совместимым физическим свойствам материала; одинаковый цвет не объединяет металл с эмалью. `userData.parts` сохраняет диапазоны вершин и идентификаторы деталей. Контурный проход читает атрибут `surfaceRole`; выбор деталей использует диапазоны, а не только `mesh.userData.regionId`.

Экструзия использует curveSegments=3, steps=1, bevelSegments=1. Точные SVG-полигоны и отдельные поверхности скоса/эмали сохраняются: эти параметры не ограничивают общее число вершин уже распрямлённого SVG. Толщина меняется через scale.z относительно baseDepth; перестроение BVH объединено до одного обновления на кадр. Скос и выпуклость по-прежнему меняют геометрию.

Планировщик не работает в простое. Изменение сцены запускает конечную серию samples path tracer, после последнего composite серия завершается. Это не одиночный raster-render: физический рендер намеренно сохраняет прогрессивное уточнение и экспорт.

Предыдущая рабочая модель сохраняется до успешной подготовки новой сцены, затем её материалы и геометрия освобождаются. Цветовые изменения повторно группируют готовые вершины без триангуляции. Ресурсы общих текстур остаются у владельцев darkness/environment. Для трассировщика всем мешам нужен RGBA-атрибут color с непрозрачным белым по умолчанию.

Контроллеры для внешнего UI экспортируются как `studioControls` из main.js: setDepth(number), setAppearance(object), requestRender(), getMetrics(). Камера трассировщика синхронизируется при resize; иначе контурный проход расходится с изображением. Решения мембран кешируются ограниченным кешем из 32 поверхностей.

## SVG review page (2026-09-22)

`tools/svg-review/README.md` documents the local three-column review page on port 5190.
All 93 SVGs were tested using the local optimized build: 81 completed rendering, 12 import failures.
Audit data and renders: `../relief-svg-audit-2026-09-22/` (outside the application repository).
User annotations autosave to that directory's `comments.json`; read it when asked to fix review feedback.
Do not replace or clear user annotations when rerunning the audit.


## Separate detail editor and render performance (2026-09-22)

`src/detail-editor.js` edits CPU-side SVG paint elements in a modal 2D editor. The physical renderer pauses while it is open. Fill and stroke have stable independent IDs; multi-selection and select-same-color are available. Roles: rim, enamel, hidden, cutout. Hidden removes a paint and reveals lower layers; cutout removes overlapped lower paints without becoming geometry. No automatic white deletion is performed.

`src/detail-document.js` compiles explicit assignments with SVG paint order. Original masks/clips are applied when editablePaints are prepared. Source SVG remains unchanged. Recipe projects persist sourceSVG and detailAssignments. Old recipes still load. Eight reviewed recipes are in public/reviewed-projects, accessible under Test SVGs or ?review=055 etc.

The render scene no longer creates part-selection WebGL overlays or raycasters. Old part-selection module remains for compatibility tests but is not imported by main. Per-part data stays on CPU. Material updates reuse geometry/material objects when batch membership is unchanged; only regrouping or pigment-dependent vertex attribute changes require scene regeneration. Keep distinct lighting response groups even if pigments match.

Gradient field calculation reuses output arrays and precomputes channel chroma. Preserve exact old half-float outputs; tests verify the scalar formula. Do not reduce samples, texture resolution, bounces or preview/export quality as a performance shortcut.

Run npm test and npm run build. The audit outputs and user comments remain outside the repo in ../relief-svg-audit-2026-09-22 and ../relief-detail-audit-2026-09-22. Never overwrite comments when refreshing renders.
