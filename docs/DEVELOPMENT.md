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
