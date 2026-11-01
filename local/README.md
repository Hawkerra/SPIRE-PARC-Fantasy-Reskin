# SPIRE Local

SPIRE Local is a standalone version of SPIRE that runs on your own device instead of inside a Chub chat. It packages
the same game as an Android app (Chromebooks run it too), with three changes:

- **It brings its own AI connection.** You choose the model and paste your own API key.
- **You summon by uploading character cards** in the Summoning Sanctum, instead of being offered random characters
  from Chub.
- **Your saves live on the device.**

## Installing

Every push to `main` builds the app and publishes it as **SPIRE-Local.apk** on the
[`local-latest` release](https://github.com/Hawkerra/SPIRE-PARC-Fantasy-Reskin/releases/tag/local-latest). Pull requests
attach it to their workflow run as the `SPIRE-Local-apk` artifact.

Download `SPIRE-Local.apk` and install it the same way as Echo RP or ChatForge. Later builds install over the top and
keep your saves, because every build is signed with the same key.

## First-time setup: AI Connection

On first launch SPIRE asks for an AI connection. You can reopen it later from the main menu (**AI Connection**).

| Provider | What to enter |
| --- | --- |
| **Chub Mars / Chub Mercury** | Your Chub API key. Leave **Model** blank for the default, or use **Fetch models**. |
| **OpenRouter** | An OpenRouter API key, and a model from **Fetch models**. |
| **Custom** | Any OpenAI-compatible endpoint ending in `/v1`, such as KoboldCpp, LM Studio or text-generation-webui on your network. Plain `http://` addresses work in the app. |

Use **Test connection** before saving. Your key is stored only on the device.

Chub's endpoints only accept requests from the Android app, not from a web page, and they may refuse some regions.
If Chub won't connect, another provider will still work.

## Summoning

In the **Summoning Sanctum**, choose **Upload character cards**, or drop files onto the bar. It accepts:

- PNG character cards (SillyTavern/TavernAI V1, V2 and V3, and Chub's card downloads);
- JSON cards (V1, V2, V3, Pygmalion-style, and Chub's export format).

Each card goes through the same AI step as a Chub summon, which works out how the character arrived and sets their
stats, voice and style. The card art becomes their portrait. The character then waits in the reserve; drag or tap
them into a slot and complete the summoning as usual.

## What's different from the Chub version

- **No AI image generation** (that service is Chub-only). Portraits are uploaded card art. Characters without art,
  such as the Tower Spirit or Fellow Summoned, faction envoys and new characters from scenes, get a placeholder.
  Expressions use the portrait, and rooms keep their default art. To give anyone a picture, open **Content Management**
  (the notepad icon in the tower view's top bar), pick the character, and click an image slot to upload one.
- **No voices** (text-to-speech is Chub-only).
- **Factions are invented by the AI** from a set of varied starting concepts, rather than drawn from Chub cards.
- **The Arcane Focus can't load characters from Chub links.** Upload the card file instead.
- **Saves stay in the app.** Use **Save Game → Export** to back one up or move it. A save exported from the Chub version
  can be imported, although its images are hosted on Chub and may not load wherever Chub is blocked.

## Building it yourself

From the repository root (requires Node, Yarn, JDK 17 and the Android SDK):

```
yarn install
yarn build:local
cd local
npm ci
npx cap sync android
cd android
./gradlew assembleDebug
```

`yarn dev:local` runs the standalone version in a browser for development. Chub's endpoints won't work from a browser,
so point the AI Connection at another provider, or at a local server that allows browser requests.

## How it fits together

- `src/local/` holds the platform layer:
  - the AI connection (`connection.ts`, with native HTTP in the app);
  - stand-ins for Chub's services (`services.ts`);
  - IndexedDB saves (`persistence.ts`);
  - the card reader (`cards.ts`) and upload bar;
  - faction seeds;
  - the runner that boots the game.
- The game code itself is shared with the Chub version. Local-only behaviour sits behind `IS_LOCAL`, which Vite sets
  for `--mode standalone` builds and strips from the Chub build.
- `local/` holds the Android wrapper (Capacitor), the bundled room art (`local/public`) and the signing key.
