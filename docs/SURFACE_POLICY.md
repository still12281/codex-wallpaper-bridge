# Wallpaper surface policy

The shell uses one material owner: `paintShell` in `src/wallpaper-style.mjs`.
It paints backgrounds and foreground pairs using the saved display palette.
Native application theme attributes remain owned by the application.

| Surface | Material owner and behavior |
| --- | --- |
| Shell canvas, sidebar and transcript | Transparent canvas over the wallpaper overlay. |
| Composer, sent messages, file cards and utility rails | Saved glass opacity and blur, applied once. |
| Menus, dialogs, comments and preview cards | Raised glass: at least 0.72 opacity and 12px blur, with matching text. |
| Positioning wrappers | Transparent. In particular, the fixed-height `group/diff-preview` tooltip is a positioning box; only the card containing `diff-preview-scroll` receives material. |
| Native code and embedded-page opt-outs | Preserve their background when the corresponding saved option is disabled. Diff backgrounds cross their open shadow boundary through `--codex-diffs-surface`. |

`decorateShell` owns media effects, fonts and pointer effects; it does not paint
application surfaces. `installSurfaceTheme` provides a low-priority shell
bootstrap and independently styles owned guest documents. Its manual scan marks
large neutral canvases, protecting semantic UI and explicitly managed surfaces.
It does not repaint shell menus or override the native-background options.

## Transparent input and native scrolling

Native layout reserves composer space but also relies on a footer background to
occlude earlier turns. Making that background transparent is insufficient.
The bridge clips only the transcript content's painting at the native footer's
top edge. It never changes scrollport height, padding, scroll positions or the
composer's dimensions. Scroll, content/footer resize and document events update
the clip; streaming text growth is included. `clearShell` releases these document
listeners and removes paint markers when wallpaper is disabled or its host stops.

## Stable state and runtime compatibility

Each logical wallpaper stores its palette on its library entries. Renderer
variants share a sample; additional windows and host restarts reuse that sample.
Changing the saved light/dark display preference does not overwrite the sample.

The terminal adapter reads either a directly exported manager or the existing
cache of an already executed native Rspack module script. A unique factory-source
contract identifies the cached module. The adapter never calls the loader or
executes factories to discover a manager. Missing or ambiguous contracts retain
native terminal behavior and report `unsupported`. Only terminal appearance
options are adapted; session buffers and PTY data are not inspected.

Runtime status is written through an atomic rename and records hashes of source
modules loaded at host startup. Updating a source file alone does not prove the
running host has loaded that file.

## Regression coverage

- `test/theme-contrast-integration.mjs`: light/dark hydration, material order,
  positioning wrappers, native background options, content/composer pixel
  separation, streaming growth and cleanup.
- `test/panel-controls-integration.mjs`: real keyboard scan dispatch inside a
  modal, preserving focus and configuration, plus control behavior.
- `test/automatic-surfaces-integration.mjs`: owned shell/guest lifecycle,
  explicit rescans, semantic preservation and embedded opt-out.
- `test/widgets.test.mjs` and `test/display-regressions.test.mjs`: terminal cache
  discovery without factory execution, restoration, and persistent palettes.
