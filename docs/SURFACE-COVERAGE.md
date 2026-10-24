# Surface coverage review

This is a selector/target coverage review, not a claim that every page was navigated and visually accepted. New native UI structures may need further matching rules.

| Surface | Handling |
| --- | --- |
| Main conversation, header, navigation rail | Native wallpaper layer and wallpaper-derived variables |
| Permanent sidebar and floating sidebar | Navigation surface setting; sidebar/popover structural selectors |
| Side chat and right panel | Actual `data-app-shell-focus-area="right-panel"` root, panel background variable and native bg-surface containers |
| Built-in browser new tab | Actual `data-new-tab-scroll-root` canvas and address-toolbar bg-surface container; external page content stays intact |
| Summary/resource panels | Summary panel structural attributes; readable foreground colors |
| Settings cards | Existing settings-card surface option |
| Composer / project-device utility bar | Separate existing surface options |
| Account menus / popup menus | Respects the existing menu option, including the user's disabled value |
| Wallpaper settings and confirmation dialogs | Nearly opaque wallpaper-derived panel; separately movable settings title |
| Wallpaper entry | Inline next to the native application menu, with DOM replacement recovery; no fixed workspace coordinates |
| Detached application window | Included in native target discovery and wallpaper mounting |
| Embedded ChatGPT / GPT pages | Separate webview target discovery, transparent default clear color, token/sidebar/composer/dialog rules |
| Other external web content / code / images | Kept intact; no arbitrary-site injection or blanket removal of all element backgrounds |

Rules live in src/wallpaper-style.mjs; target lifecycle lives in src/video-cdp-host.mjs. Embedded browser compositing and future vendor page changes remain platform-dependent. No navigation-through-all-pages acceptance was performed for this review.
