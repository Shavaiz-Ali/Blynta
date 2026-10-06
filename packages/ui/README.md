# Shared Blynta UI

Both the main app and Studio consume this package. The main app is the visual reference. Use the shared theme, buttons, inputs, selects, dialogs, and tabs instead of redefining their colors or styling their internal markup in an app.

## Workspace chrome

Import AppSidebar and AppSidebarItem from @blynta/ui. AppSidebar handles desktop widths and collapse. Apps supply navigation, mobile Sheet, and logo. AppSidebarItem supports links through renderLink, disabled items, collapsed tooltips, and a labeled rail variant for the editor.

Use AppProductHeader for the shared product topbar, including mobile navigation and desktop collapse controls. AppHeaderActions composes AppCreditsControl, AppNotificationControl, and AppAccountMenu with the main app's visual styling. Both the main app and Studio use these components. Do not recreate account dropdown markup or separate header skins inside a product.

Apps provide identity, real balance/plan data, navigation elements (Next Link or external anchors), notification content, and the existing logout callback. AppAccountMenu owns the shared Appearance submenu. AppCreditsControl accepts an optional allowance; omit it when the backend cannot supply a reliable product allowance. Missing balances display a dash, never a fabricated zero. UI components do not fetch data, access auth tokens, or implement billing.

## Player

Import StudioVideoPlayer, ClipMediaStage, useVideoPlayback, PlayerControls, or PlayerScrubber from @blynta/ui/player. The player implementation lives here; the old main-app player paths re-export it for compatibility.

Studio uses PlayerControls with its timeline playhead, volume, frame stepping, zoom action, and fullscreen callbacks. Its canvas continues composing synchronized video, audio, image, and text tracks. Speed and loop controls appear only when the consuming player provides those callbacks.

The main app and Studio load the same Inter, Instrument Serif, and JetBrains Mono font variables in their Next root layouts.

## Shared collections and CSS ownership

Use AppViewModeToggle for grid/list selection in both apps. AppMediaCard provides the main app thumbnail-card surface (radius, border, shadow and hover states); apps provide the media and actions.

PlayerControls defaults to appearance="overlay" for controls over video. Use appearance="surface" for controls on a themed application surface, including Studio, so timestamps and icons remain visible in light mode.

Studio layout styles live in the studio-layout cascade layer, before shared component utilities. Keep geometry in that layer and use shared component props/classes for controls; do not override their internal markup or focus states.

## Cross-app controls

Reusable controls must have one implementation in this package. App-level files may re-export a shared component for compatibility, but must not define a parallel implementation or reskin its internals. Product adapters may load data and supply routes, auth actions, or callbacks.

Studio uses the same default `AppTabs`, `AppInput`, `AppSelect`, `AppButton`, `AppDropdown`, header, and account controls as the main app. Its editor layout CSS owns panel geometry, canvas, and timeline presentation; shared controls own their variants and interaction states.

Additional shared controls include `AppTooltip`, `AppContextMenu`, `AppDisclosure`, `AppFileInput`, `AppSlider`, `AppResizeHandle`, `AppScrollArea`, `AppIdentityAvatar`, and `ThemeToggle`. `AppContextMenu` uses the same menu item configuration as `AppDropdown`. File accept rules are supplied by the consuming app. Resize handles support transient preview callbacks and commit on pointer release.

Studio's ESLint rules reject feature imports from local `components/common/App*` and raw local primitives; import from `@blynta/ui` instead.
