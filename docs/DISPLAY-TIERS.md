# Display tiers

Each wallpaper has its own display tier. Existing entries remain custom; installing an update does not choose a high-load tier or enable audio. Advanced playback settings and the independent focus/audio preferences remain available.

| Tier | Budget | Effective behavior |
|---|---|---|
| Static | One PNG frame | Own WebGL/video/native source disposed; no spectrum capture or animated decorations |
| Economy | 960 / 12 FPS | Low effect-target and particle budgets; spectrum, parallax and decorations temporarily disabled |
| Balanced | 1280 / 24 FPS | Medium effects/particles; optional spectrum capped at 20 Hz |
| Smooth | 1920 / 30 FPS | High effects/particles; optional spectrum capped at 30 Hz |
| Highest | Native full project after confirmation | Window-proportional capture, desktop FPS cap, JPEG 92; plain media retains up to 3840 / 60 FPS |
| Custom | User settings | Advanced parameters remain independently adjustable |

Budgets are upper bounds. Video playback never invents resolution or frames. Lower tiers adjust the selected route's budgets; Highest now requests the native full-project route when available and retains its confirmation. It may increase resource usage and capture latency. WebGL quality cannot create unsupported effects, and its audio toggle does not control Wallpaper Engine's own audio processing.

Entering a tier retains custom playback parameters and the user's audio/focus preferences. Returning to Custom restores those playback parameters. Static uses a saved frame of the currently displayed wallpaper, including original scene source identity. A later Static selection captures a new frame after returning to dynamic mode. The PNG remains an app-owned cache referenced by the entry; deleting the entry uses the existing bounded cache-cleanup mechanism. Missing capture or failed candidate application restores the old configuration and reports failure.

WebGL automatic quality removal is disabled. Previously, adaptive quality could turn the entire effect chain off under load. A solid layer carrying an audio shader then became a giant white rectangle/polygon. The engine must not silently remove an effect to meet a target: the user chooses the explicit budget instead. Shader/script compatibility and host bottlenecks can still limit actual output.

The error/confirmation dialogs now use paired background and foreground theme variables. A forced dark background with inherited light-theme dark text caused the unreadable black dialog. The screenshot's player-readback error remains a real player-control limitation, separate from wallpaper rendering. No extra playback command was issued to hide it.

## Local verification, 2026-10-25

- 44 unit tests, isolated renderer lifecycle and headless panel wiring/theme contrast checks passed. Headless checks are not native rendering acceptance.
- Actual Codex: both windows switched to IMG with no remaining wallpaper WebGL iframe; spectrum capture stopped. Economy selected 12 FPS without changing the saved audio preference. Custom restored the prior dimensions, quality, audio and focus preferences.
- The frequency dropdown now sends `audioFps` and reads it back. Earlier backend-only checks did not cover that UI wiring; the new headless panel test does.
- A bounded, dedicated native-engine pop-out produced 68 JPEG frames, approximately 12.27 captured FPS at 960x674/12, with 8 distinct initial frame hashes and the original circular audio bars/font visible. Only this owned window was muted and closed; the desktop selection remained unchanged and the helper exited.
- The native probe first exposed raw-JSON command-line escaping. The corrected probe passes the documented RAW property payload verbatim. This was a source-window capture trial, not a Codex high-FPS, latency, total-GPU or long-duration acceptance. Native import remains experimental and requires confirmation.

Read-only review additionally identified and corrected three state boundaries: effective media options now follow every wallpaper application/fallback, manual advanced playback clears stale custom restore snapshots, and the dedicated native-full confirmation exits an existing static native reference. Full quality retains an explicitly saved anti-aliasing preference (or uses FXAA when unspecified). Native activation remains a separate confirmed action.

## Reopened-client regression follow-up

The higher tiers are now named High quality and Maximum quality rather than promising smoothness or complete native compatibility. The panel explains post-processing, particle, video-texture, audio and decoration budgets. Advanced controls expose post-processing, particles, texture scale and anti-aliasing independently; manual changes enter Custom and discard stale restore snapshots. Video and native capture do not pretend to apply WebGL scene-quality controls.

Transparent interface colors can follow the wallpaper or be explicitly Light/Dark. This preference is independent of the quality tier and is included in appearance presets. Glass opacity applies even when blur is zero. Settings spacing, wrapping and explicit option foreground/background pairs cover narrow panels.

Pausing takes an in-memory canvas copy once and retains it across backing-store or compositor changes. Resume releases the copy after rendering restarts. No per-frame readback, screenshot loop, background recorder or extra process is added. This is a defensive preservation fix; reproducing a native disappearance is a separate acceptance step.

Critical effect-compilation/missing-shader diagnostics now reject a candidate instead of adopting its solid fallback. A synthetic failed-effect regression verifies retention of the old renderer. The original scene rendered without the reported white polygon in isolated audio-off, zero/nonzero spectrum, resize and pause/resume trials, including AMD ANGLE D3D11. These results do not identify the original Codex-only trigger or establish that it is eliminated. Native visual and resource acceptance remains pending after the user exits the current ordinary non-CDP client.

## Native highest tier, 2026-10-26

The previous non-CDP-client statement is historical. The current verified client supports CDP and has run the original project through native window capture without restarting Codex. Highest-tier scene/web selection now requests native confirmation, matches the current window aspect and configured desktop FPS, and uses JPEG quality 92. The original source effects, scripts, font/date/time and audio response remain in Wallpaper Engine. Existing lightweight entries are retained as return targets. Arbitrary 3840x2700 capture is no longer the highest-tier default.

Per-window transmission permits at most two outstanding decodes, reuses one source base64 string and ignores out-of-order renderer results. A deliberately 500ms-delayed detached window did not block the main window. Native mouse forwarding remains unsupported. The original white-polygon trigger is still unknown; successful current native output is not proof that the earlier WebGL trigger was fixed.
