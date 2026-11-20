# Wallpaper surface policy

The shell uses one material owner: `paintShell` in `src/wallpaper-style.mjs`.
It paints backgrounds and foreground pairs using the saved display palette.
Native application theme attributes remain owned by the application.

| Surface | Material owner and behavior |
| --- | --- |
| Shell canvas, sidebar and transcript | Transparent canvas over the wallpaper overlay. |
| Composer, sent messages, file cards and utility rails | Saved glass opacity and blur, applied once. |
| Menus, dialogs, comments and preview cards | Raised glass: at least 0.72 opacity and 12px blur, with matching text. |
| Code blocks, editors and terminal containers | Reading glass budgets the combined wallpaper overlay and local tint to at least 0.72 coverage, retaining stronger saved tint and saved blur. Fenced code uses local syntax-colour tokens; ordinary unowned `pre` elements retain their styling. |
| Positioning wrappers | Transparent. In particular, the fixed-height `group/diff-preview` tooltip is a positioning box; only the card containing `diff-preview-scroll` receives material. |
| Native code and embedded-page opt-outs | Preserve their background when the corresponding saved option is disabled. Diff backgrounds cross their open shadow boundary through `--codex-diffs-surface`. |

`decorateShell` owns media effects, fonts and pointer effects; it does not paint
application surfaces. `installSurfaceTheme` provides a low-priority shell
bootstrap and independently styles owned guest documents. Its manual scan marks
large neutral canvases, protecting semantic UI and explicitly managed surfaces.
It does not repaint shell menus or override the native-background options.

Composer suggestions have roleless native cards. The floating positioning shell
stays transparent; its ordinary/floating suggestion card or expanded top-tray
panel owns the raised material. Global search similarly paints its actual cmdk
card, not the unstyled dialog wrapper. Internal cmdk roots and lists share that
card's material instead of receiving another layer merely for `role="listbox"`.
Selection and hover colours remain native. These component roots and alert
dialogs are protected from neutral-canvas rescans.

For reading surfaces, let `O` be the saved wallpaper overlay and `F` the reading
floor: at least 0.72, increased for palettes that need stronger text contrast.
The palette-dependent floor bounds the worst-case composited channels to at most
80 in dark themes or at least 172 in light themes, including alpha-rounding
headroom for the syntax palette. Let `T = max(F, saved glass opacity, O)`.
The local tint is `(T - O) / (1 - O)`;
when `O` is 1 it is zero. Thus `O + (1 - O) * local tint = T`, avoiding repeated
whitening/darkening. The terminal's transparent RGB contrast reference uses the
same final coverage. Saved wallpaper palettes drive both layers; playback does
not resample colours each frame. Font size and line height retain their existing
owners and values.

## Transparent input and native scrolling

The bridge uses Codex's native bottom-inset variable to shorten the scrollport and
remove the matching spacer. In the supported layout, browser overflow clips the
transcript above the composer and the footer can stay transparent. Other layouts
use an opaque footer so history remains covered.

Document scroll and resize events clip a code block's source below its native sticky
control bar. The header inherits the block's single material layer, and source
text cannot show through it. Native code-background opt-out removes this code
clip along with the wallpaper code styles.

## Local style updates

The shell uses escaped class selectors for exact native class tokens. This keeps
unrelated class changes, including the native thinking shimmer, out of broad
class-attribute invalidation chains involving relational selectors. Substring
selectors remain limited to native generated class names that lack stable tokens.

The sticky code clipping length is registered with `inherits: false`.
It affects its marked element. Shared palette tokens still inherit and change with saved
appearance settings. The registrations disappear with the owned stylesheet.

`npm test` checks the generated production stylesheet's dependency contract in
both themes and code-background modes, so local edits can detect these patterns
without launching a browser. The style invalidation integration check executes
the production painter against
more than 3,000 elements. It rejects exact-class attribute selectors, checks that
the code clipping length stays out of descendants, and reads Chromium's affected-node
counts to catch local updates that restyle a substantial part of the document.
The check uses structural limits rather than machine-dependent time thresholds.

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
Transparent terminal backgrounds retain zero alpha and a conservative RGB
reference for the saved palette, overlay and reading glass. Contrast uses the
lightest possible dark-theme background or darkest light-theme background;
reverse-video text and the terminal's contrast algorithm still use this RGB.
The base ANSI table uses xterm's opaque defaults rather than native UI tokens
that may alias both black and white to foreground ink. The bridge enforces a minimum contrast option of 4.5 while active;
the latest native contrast option and colours return on opt-out or disposal.

Runtime status is written through an atomic rename and records hashes of source
modules loaded at host startup. Updating a source file alone does not prove the
running host has loaded that file.

## Regression coverage

- `test/style-invalidation-integration.mjs`: local class/clip updates, bounded
  restyling, escaped class matching and preserved surface/semantic colours.
- `test/theme-contrast-integration.mjs`: light/dark hydration, material order,
  positioning wrappers, native background options, content/composer pixel
  separation, streaming growth and cleanup.
- `test/panel-controls-integration.mjs`: real keyboard scan dispatch inside a
  modal, preserving focus and configuration, plus control behavior.
- `test/automatic-surfaces-integration.mjs`: owned shell/guest lifecycle,
  explicit rescans, semantic preservation and embedded opt-out.
- `test/widgets.test.mjs` and `test/display-regressions.test.mjs`: terminal cache
  discovery without factory execution, restoration, and persistent palettes.
- `test/code-reading-integration.mjs`: plain/syntax code contrast on both
  wallpaper themes, single-layer materials, sticky control occlusion, native
  scrolling and code-background opt-out.
