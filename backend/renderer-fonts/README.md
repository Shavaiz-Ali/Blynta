Montserrat and Anton are vendored from the Google Fonts `ofl/montserrat` and
`ofl/anton` directories, with their SIL Open Font Licenses. Docker performs no
font downloads. Noto language fonts and Liberation editing fonts come from Debian.

Impact and Georgia are proprietary: the container uses explicit Fontconfig aliases
to Anton and Liberation Serif. Supply licensed Impact/Georgia files in this folder
and remove their aliases if exact proprietary typography is required. Visually
compare all presets in the smoke test before enabling Batch.
