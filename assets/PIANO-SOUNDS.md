# Bundled piano sounds

The 88 MP3 files in `piano/` cover a standard piano, A0 through C8. They are
packaged with the application; playing notes does not contact a sound CDN.

Source: https://github.com/fuhton/piano-mp3

The source repository credits https://github.com/gleitz/midi-js-soundfonts.
The source license is preserved verbatim in `piano.LICENSE.txt`.
`piano-manifest.json` records the source revision, size and SHA-256 of each file.

To restore missing samples and regenerate the static Metro imports:

```sh
node scripts/download-piano-samples.mjs
```

The installed Android/iOS build embeds these files through `expo-asset` and
static imports. Expo Go and development builds running from Metro still need
their local development server to obtain the app and its assets initially.
The web export serves the MP3s from its own assets directory; this change does
not add offline caching for reloading the entire website.
