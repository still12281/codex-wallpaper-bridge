# Contributing

This is an experimental Windows integration. Keep changes narrow, preserve native input and client behavior, and clearly distinguish synthetic tests from real native-client validation.

Installation packages are distributed through GitHub Releases. `package.json` is marked `private` to prevent accidental npm publication; that flag does not control the GitHub repository's visibility or the code license.

Run `npm test` and `npm run check:privacy`. Integration tests require a locally supplied Chrome/Chromium and FFmpeg and must use an isolated temporary profile, synthetic media, and their own loopback port. Do not automate tests against a real account or attach to an existing Codex session in CI.

Do not commit runtime data, captures, real settings, personal paths, browser profiles, proprietary wallpaper files, extracted brand icons, compiled binaries, secrets, or dependency caches. Use an anonymous public handle if desired; the maintainer should configure a GitHub no-reply commit email before the first commit.

Preserve third-party license text and update source/hash notices when vendor files change. Intentional release-file updates require regenerating `release-manifest.json` and reviewing the diff; generating a new manifest does not itself prove the new content is safe.
