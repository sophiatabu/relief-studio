# SVG gradients and effects

Linear/radial fill and stroke paint servers are rendered by the browser into a shared 512² paint atlas. Native SVG handles gradient units, transforms, href inheritance, stop opacity and filters. Extruded surfaces remain vector geometry. Paint descriptors and material roles are independent; gradient paint defaults to enamel. The detail editor can change role, override/restore paint, and enable or disable each source filter. Source SVG and detailAssignments persist in recipe projects and undo history; old solid-color recipes remain supported.

`svg-appearance.js` prepares paint only when the source or detail assignments change. A bounded four-entry CPU cache reuses preparations. `darkness.js` combines original pigment with current lighting, preserving alpha, and reuses the material texture. Moving lights does not parse SVG or retriangulate. Exterior filter pixels use a separate compositing plane, avoiding path-tracer noise in a source blur. Pipeline disposal explicitly frees that plane, material and texture. Appearance data is not placed in Three.js userData, avoiding huge JSON copies during export.

Contour validation keeps its original threshold and boundary tolerance. 054 needed validation draw order corrected; 059 needed original fill colors retained after metallic union; 087 needed strokes included in alpha-mask coverage. Each now has zero interior mismatches at 1024². Filter pixels are excluded only from vector-boundary validation; the actual render keeps them.

## Verification, 2026-09-22

- 92 Node tests pass; production build passes.
- `tools/svg-paint-qa.html`: native radial gradient, inherited stops, transformed gradient, gradient stroke, alpha, cache reuse, role change and project round trip pass.
- Actual editor: filter switch, local undo/redo, apply, global undo and reopen pass.
- Actual project round trip: disabled filter and changed gradient role persist; original source unchanged.
- Square PNG camera no longer inherits the wide/tall preview aspect ratio; independent regression covers both orientations.
- PNG export: transparent and opaque 304² outputs pass, transparent alpha retained.
- Lighting microbenchmark, same browser and five surfaces: solid before median 85.1 ms, after 78.1 ms; both 5 draw calls and 10 MiB lighting buffers. Gradient surfaces share one map: 43.2 ms, 2 MiB lighting buffer plus 4 MiB CPU source atlas. These are isolated update timings, not whole-app speedups.
- Repeated light changes kept geometry/texture counts stable. Explicit disposal returned measured renderer geometry/texture counts to zero. Samples, bounces and preview/export quality were not reduced.

The separate full-library report records import/render results. Warnings from SVGLoader URL paint parsing and the BVH dependency are not import errors; browser-native paint resolves the gradient URLs.

Full-library audit: **93/93 imported and rendered, zero runtime errors and invalid vertices**, including all 12 previously failing files. Each render completed 128 samples at 320². Detailed per-file timings and warnings: `svg-gradient-audit.json`. Review renders refreshed; comment file hash unchanged. Import success does not substitute for reviewing artistic choices in the detail editor.
