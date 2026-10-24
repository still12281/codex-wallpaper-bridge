# Inspected DSH startup effects

Inspected revision: DSH v1.4.0, `3b0103bc1d5431840208966ce67155f392c4095c`.

- `lib/startup-sweep.js:33-77` schedules cache/temp cleanup three seconds after startup. It is not an opening animation and has filesystem side effects.
- `src/styles-base.js:138-168` retains a still fallback while a realtime iframe reaches its first frame, then fades the realtime layer in over 1.8 seconds. The old still retires later to prevent a black gap.
- `src/client-rotation.js:11,40` and `src/layer-core.js:84` implement wipes, strips, iris, zoom, push and fade transitions. The flow keeps at most two layers and cleans timers/media after transition completion; motion preferences are handled by companion CSS.

These MIT algorithms and CSS can be adapted with attribution. Codex still needs its own first-frame readiness, renderer disposal, rapid-switch handling and startup-failure behavior. No standalone branded DeepSeek intro-video implementation was located in the inspected revision; the video shown in the external post should not be assumed to be a redistributable asset of this repository. Character art, fonts and video assets have separate licensing questions.

This follow-up inspects startup behavior only. It does not install a branded intro or pet integration.
