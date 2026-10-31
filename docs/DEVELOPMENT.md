# Running on an iPhone with Expo Go

This project targets Expo SDK 58, matching the SDK 58 Expo Go runtime confirmed
on the user's iPhone. Match the SDK reported by the installed Expo Go app rather
than assuming a transition notice describes that device. Installing a JavaScript
package cannot add a native module to Expo Go.

After switching SDK versions, close the old project in Expo Go and start Metro
from the project directory with a clean cache:

```sh
npm run start:clean
```

Scan the new QR code with the iPhone. Do not reopen an old development-build link.

Expo Go 58 on iOS has a reported in-place reload bug that produces missing
`ExpoAsset`, missing `ExponentConstants`, and `main has not been registered`
even when the SDK versions match. See https://github.com/expo/expo/issues/52146.
Fully terminate Expo Go from the iPhone app switcher, restart Metro with the
command above, and scan the fresh QR to launch a new runtime. Update Expo Go
when an App Store update is available. Do not downgrade the project to SDK 57
when the phone explicitly reports an SDK 58 Expo Go installation.

SDK and dependency mismatches can also cause missing native modules. Verify
them with `npx expo install --check` and `npx expo-doctor`. A successful Metro
export cannot by itself confirm that Expo Go's native reload path works on a
physical iPhone. Do not suppress the error or patch installed native modules.

The piano MP3s are local project assets and work in Expo Go through Metro.
An installed standalone build is needed to include the entire application and
its sounds on the device independently of Metro. Native projects generated with
a different SDK also need regeneration before making a standalone native build;
they are not used when opening this project in Expo Go.

References:

- https://docs.expo.dev/versions/v58.0.0/sdk/asset/
- https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/

## Standalone iPhone build

`eas.json` includes a `preview` profile for internal distribution. This bundles
the application and local piano samples, so Metro and Expo Go are not needed
after installation. The iOS identifier is `com.gusajr35.pianotrainer`.

```sh
npx eas-cli@latest login
npx eas-cli@latest build:configure --platform ios
npx eas-cli@latest device:create
npx eas-cli@latest build --platform ios --profile preview
```

Sign in to Expo locally. For a physical iPhone, EAS also needs a paid Apple
Developer membership, signing credentials, and the device registered before
building. Enter passwords and verification codes directly into EAS, never into
chat. Open the device registration link on the iPhone and follow its prompts.
After the build finishes, open the installation link on that registered device.

The `production` profile is for store distribution and increments the build
number automatically; it does not submit the application to the App Store.

Reference: https://docs.expo.dev/build/internal-distribution/

## External piano through a microphone (web)

In practice, choose **Activar micrófono** and allow microphone access. Use an
HTTPS deployment (such as Netlify) or localhost. The browser analyses the audio
locally with Web Audio; no recording is saved or uploaded. Stop listening before
playing the app's own preview. Listening also stops on navigation, backgrounding,
or completion of the fragment.

Microphone answers compare pitch classes: C2, C3 and C4 all satisfy a C target,
including octave doublings within a chord. Accidentals remain distinct. The
on-screen keyboard still uses exact MIDI pitches. For repeated notes, briefly
release the key and let the sound fall below the sensitivity threshold. Adjust
sensitivity while stopped. Simple simultaneous notes are estimated; use separate
notes for chords the detector cannot separate, especially with sustain pedal,
strong overtones or ambient sound.

Expo Go does not expose live microphone PCM through expo-audio. The native screen
therefore directs users to the web version rather than attempting an unavailable
native module. A future native live analyser would require a development build.

Run `npm run test:microphone` for synthetic pitch/noise/chord and browser-capture
lifecycle tests, and `npm run test:input` for practice-screen evaluation. These do
not replace verification with a physical piano and the target phone microphone.
