# Single wallpaper entry

Use the generated CodexEntry shortcut as the unified wallpaper entry. Repeated clicks activate the existing wallpaper client when its supervisor is alive. A normal session encountered on this entry is asked to close gracefully before the wallpaper client starts; it is never force-killed, and failed graceful shutdown stops the switch instead of opening a second profile.

The current wallpaper session still uses its dedicated data directory. Accounts/profiles are not copied or linked. An already running ordinary process cannot acquire a CDP port retroactively. This change does not edit the signed application package, the Start-menu package registration or Taskband registry bytes.

An original package-pinned icon can still use the operating system's original activation route. To make that icon use the unified launcher, replace the original pin with the generated shortcut using Windows' normal pinning UI. Matching AppUserModelIDs alone does not rewrite an existing pin. Warm activation and future cold startup must be reported separately.
