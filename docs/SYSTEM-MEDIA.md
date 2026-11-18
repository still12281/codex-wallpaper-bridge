# System media on Windows

The Windows x64 installer prepares the SHA-256-pinned stereo component built from `oneincase/media-bridge` v0.1.5 and the repository's stereo spectrum patch. The component and its MIT license are stored with the local runtimes.

In **系统音乐联动**, enable **显示歌曲信息与播放控制** for track information and playback controls, or enable **启用壁纸音频响应（WebGL 场景）** for system audio spectrum. Both switches are off on first install. A playback command targets the current Windows media session. If Windows changes the active player, confirm the new player before sending a command.

WebGL audio response supports 10, 20, 30, 60, 90 and 120 spectrum updates per second. The default is 30. Each result uses a new window on the WASAPI sample clock and carries separate left and right bands. The panel shows the incoming rate while audio capture is active. Windows can deliver several windows in one audio packet, so arrival intervals can vary. Higher targets use more CPU. Wallpaper render FPS is set separately. The Custom and Highest display tiers allow the full range. Lower tiers apply their own spectrum caps.

Changing the rate restarts the capture component and keeps the current scene. Capture requires a visible, unpaused WebGL scene with audio processing enabled. Switching away from Codex pauses the scene when **仅聚焦 Codex 时播放动态壁纸** is enabled. Minimizing the window or enabling reduced motion pauses rendering and capture. The helper debounces focus changes for 600 ms and stops the old capture before starting its replacement.

The WebGL scene volume controls the wallpaper soundtrack. Windows and each media player control system playback volume. Wallpaper Engine controls audio response in native render modes.

The helper communicates over local standard input and output. It uses `--no-online` to disable online lyrics lookup. With track information enabled, the helper polls Windows media metadata once per second. The adapter forwards selected track fields and spectrum bands to the scene without saving continuous audio. When system audio is unavailable, the scene receives zero bands. Runtime status includes the helper PID, spectrum rate, queue drops and sequence gaps for diagnostics.
