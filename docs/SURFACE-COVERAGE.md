# Surface coverage

## alpha.7 update — 2026-11-09

Coverage now follows trusted main/detached app documents and the parent chain of their webviews and nested frames, rather than a ChatGPT-only list. Main-window routes such as chat, settings, projects and side panels share the shell stylesheet; they are not a list of separately hardcoded pages. Unrelated browser pages and the wallpaper's own renderers are excluded.

Shared tokens and structural surface CSS apply to later matching components. Owned embedded documents receive one bounded neutral-background pass after load. Native shells skip this automatic pass. The wallpaper panel's **扫描并适配** button explicitly rescans all currently open owned documents, including shell content and narrower side panels, once per click. The result reports new adaptations, native/disabled skips, failures and pass limits; no recurring adaptation scan or theme repair observer is installed.

Code/terminal native-background preferences and embedded-content opt-outs remain effective, including same-process nested frames. Buttons, menus/dialogs, semantic colours, editor contents, images, gradients and canvas pixels are protected from the heuristic pass. Native guest parents are handled structurally, without provider-specific names.

Focused generated-browser checks passed for cross-origin creation/navigation, strict CSP, late shell/frame backgrounds, narrow panels, manual-call coalescing, disable/restore, input, semantic/media preservation, wallpaper/external-page exclusion and idle stability. Actual Windows-client checks confirmed Notion's nested content reveals the wallpaper. The real panel action checked 10 open documents, preserved the existing wallpaper layer and exact settings bytes, and reported its limits. The client was retained while the local wallpaper host was reloaded.

This is presentation evidence, not acceptance of every application operation. Late independent hardcoded backgrounds can still require the manual button; closed components, painted canvas content and arbitrary future rendering are not guaranteed. Per-pass limits cannot preempt an individual synchronous browser style/layout calculation. Real-client cold-start timing was not measured in this iteration.

## Historical native-page sweep — 2026-10-23

The development runtime was checked in the installed Windows client (26.1016.8622.0). Pages were actually opened, their rendered backgrounds/foregrounds inspected, and representative screenshots reviewed. This checks wallpaper presentation, not every business operation or every possible future remote state.

## Pages opened and rechecked

| Area | Observed result / boundary |
| --- | --- |
| Existing conversation and new conversation | Wallpaper, composer, project/device rail and header present; no message sent |
| Scheduled tasks | Existing list and suggestion surfaces follow wallpaper; tasks unchanged |
| Library | Header, filters and loading skeleton checked; remote item content did not finish loading during the visit |
| Plugins and skills | Public plugin list, installed skills and plugin-detail shell opened; no installation or account changes |
| Code review | Native error state and local no-repository state checked; remote PR data unavailable; no repository created |
| Sites | Empty state, toolbar and tabs follow wallpaper |
| GPT | Native page shell, search and notice banner checked; remote catalog was loading |
| Projects | Existing project list opened; no project changes |
| Maps | Onboarding, composer and map frame checked; precise location was not enabled |
| File viewer / file tree | Existing workspace Markdown content and directory item rendered; editor uses readable tint and tree loses the old opaque block |
| Terminal | Existing xterm session switches between native and wallpaper themes; live persistence checked; returning from another page retains matching container and text colors |
| Browser start page | Address toolbar and tool/recommendation area checked |
| Side chat | Empty side-chat composer and surrounding panel checked; no message sent |
| Account / application / exploration menus | Solid readable menu backgrounds retained |
| Wallpaper settings | Two folded native-background preferences, viewport bounds, persisted toggle and restoration checked |

All 29 settings destinations were opened: General, Notifications, Import, Profile, Appearance, Account, Archived chats, Parental controls, Trusted contact, Voice, Storage, Configuration, Personalization, Mini/pets, Keyboard shortcuts, Usage/billing, Data controls, Plugins, Passwords, Computer use, App snapshots, Browser, Cloud computer, Hooks, Connections, Codex cloud, Code review, Git and Worktrees. The profile link opens its own page and was returned from. No settings fields were changed during the page sweep.

## Presentation policy

Application shells, navigation, file trees, settings cards and composers follow wallpaper automatically through the native surface tokens. Menus, dialogs, controls and semantic content such as maps, image/media pixels, diff colors and syntax colors retain their visual purpose.

Only two optional native backgrounds remain, inside a collapsed section: code/terminal and embedded web content. Retired layout switches migrate to automatic styling; existing embedded-content opt-outs survive. The native code preference restores the terminal's latest original theme, not a guessed replacement.

The terminal adapter is explicitly gated to the inspected native module/version. It changes public xterm options through an instance wrapper and tracks remounted containers. It does not inspect terminal buffers, send input, restart the shell, alter account theme settings, or modify signed client files. An unknown client module falls back to its native terminal theme; a new client version requires a compatibility check.

Detached-window target discovery and external ChatGPT styling retain source coverage from earlier work. No new detached client window was created in this sweep. Arbitrary external websites are not restyled. Changing an embedded page's native-background preference also restores its default browser clear color.

Runtime screenshots and DOM reports stay outside the release repository. Local evidence includes `audit-navigation-after.json`, `audit-settings-after.json`, `audit-trusted-contact-after.json`, `native-surface-controls-final.json`, and the corresponding page screenshots. They are not bundled or represented as business-function acceptance.
