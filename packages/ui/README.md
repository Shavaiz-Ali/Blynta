# Shared Blynta UI

Both the main app and Studio consume this package. The main app is the visual reference. Use the shared theme, buttons, inputs, selects, dialogs, and tabs instead of redefining their colors or styling their internal markup in an app.

## Workspace chrome

Import AppSidebar, AppSidebarItem, and AppHeader from @blynta/ui. AppSidebar handles desktop widths and collapse. Apps supply their own navigation, mobile Sheet, logo, user controls, and actions. AppSidebarItem supports links through renderLink, disabled items, collapsed tooltips, and a labeled rail variant for the editor. AppHeader accepts children and a className for app-specific layout.

## Player

Import StudioVideoPlayer, ClipMediaStage, useVideoPlayback, PlayerControls, or PlayerScrubber from @blynta/ui/player. The player implementation lives here; the old main-app player paths re-export it for compatibility.

Studio uses PlayerControls with its timeline playhead, volume, frame stepping, zoom action, and fullscreen callbacks. Its canvas continues composing synchronized video, audio, image, and text tracks. Speed and loop controls appear only when the consuming player provides those callbacks.

The main app and Studio load the same Inter, Instrument Serif, and JetBrains Mono font variables in their Next root layouts.

## Shared collections and CSS ownership

Use AppViewModeToggle for grid/list selection in both apps. AppMediaCard provides the main app thumbnail-card surface (radius, border, shadow and hover states); apps provide the media and actions.

PlayerControls defaults to appearance="overlay" for controls over video. Use appearance="surface" for controls on a themed application surface, including Studio, so timestamps and icons remain visible in light mode.

Studio layout styles live in the studio-layout cascade layer, before shared component utilities. Keep geometry in that layer and use shared component props/classes for controls; do not override their internal markup or focus states.
