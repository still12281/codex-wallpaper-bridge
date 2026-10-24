# Migration progress

2026-10-24: Baseline clean at 1c1036e. Previous implementation chat idle. Read launcher/current runtime and upstream API. Started read-only upstream-module review. No production runtime changes yet.

WebWallGL milestone: added a bounded project capability, opaque sandbox runtime, pinned optional runtime preparation, renderer mode and meaningful tests. Chromium fixture and two native Codex scene probes passed (including script-enabled repeat). Native Web loading remains a separate unsatisfied gate, so it is explicitly rejected by this mode. Existing native capture remains available.

Errors resolved: first fixture mount raced document navigation/layout; wait for the synthetic document to complete before installing. A missing source path was investigated through actual file inventory. No production files or settings have been deployed yet.

Library/appearance milestone: upstream picker and FX adapters, page/preview/filter/hide UI, appearance presets, glass/fonts/flip/speed/volume, parallax and a foreground rotation scheduler. Tests cover 17 unit cases and an isolated Chromium UI flow including presets, effects cleanup, page filtering, automatic rotation and background deferral. Fixed the transport presetId collision and the baseline/default-settings mismatch; did not weaken those assertions.
