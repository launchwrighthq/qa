---
name: lw-qa-device
description: Use to drive the product on a real device and measure it as Playwright measures a web page. The Mini App inside the real Telegram app on Android, Safari or a WebView on a real iPhone, an iOS simulator, and a cloud iPhone on BrowserStack. Use when a layout, inset, gesture, overlay or player question needs a real host instead of a desktop browser: "what does this look like on a phone", "measure the bottom inset on a device", "does the back gesture work", "screenshot the Mini App in Telegram", "read the console from the device", "test it on iOS". Also the device legs of a QA pass. Use it before you ask the operator for a screenshot.
---

# Devices

`lw qa device <verb> [--device <name>]` is the whole interface. Rigs and devices come from config
`qa.device`. No device, bot, host or address is written in the module.

| Verb | What it does |
|---|---|
| `list` | The rigs and devices of `qa.device`. |
| `doctor` | Start here. Checks ssh, adb, the Android SDK, `ios_webkit_debug_proxy`, `scrcpy`, `ffmpeg`, pairing and the Android lock screen, and names the fix of each failure. It installs and starts nothing, and never enters a PIN. |
| `open --bot <bot>` or `open --url <url>` | Boots the device, applies the ingress, opens the Mini App of the bot or the page, and attaches. Run it again whenever you are not sure. |
| `eval <js>` or `eval @file` | Evaluates in the visible page. `--probe video` reads every `<video>`. |
| `logs [seconds]` | Page errors, console output and failed requests. Default 15 s. |
| `mirror` | Shows the Android screen on this machine with `scrcpy`, for a sign-in or to watch a flow. |
| `tap <label> [--x 0..1]` | Taps a native control by its accessibility label, never by a coordinate. |
| `point <x> <y>` | Taps a screen point, for an element that only the WebView draws. |
| `back`, `key <code>` | The system back gesture, or a raw Android keyevent. They are different events. |
| `shot [file]`, `record <seconds> [file]` | A PNG or a video of the screen. A video stops at `qa.evidence.videoCapS`. |
| `snapshot [label]`, `restore [path] --force` | Copies the AVD folder on the rig, and puts a copy back. |
| `install [--force]` | Installs the pinned Telegram APK. It refuses an APK whose SHA-256 differs from `qa.device.telegram.apkSha256`. |
| `down` | Stops the emulator, clears the ingress, closes the ssh master, and ends a BrowserStack session. |
| `budget` | BrowserStack minutes used, and the budget of one run. |

The QA legs `telegram-android` and `safari-ios` run through the same drivers: `android-adb`,
`android-emulator`, `ios-webkit`, `ios-simulator` and `browserstack`. The `lw-qa-pass` skill
covers a whole change. Come here when the question names a device.

## Rigs and devices

```ts
qa: { device: {
  rigs: { local: { transport: 'local' }, lab: { transport: 'ssh', host: '<ssh alias>', adbPort: 5038, ingress: 'host-proxy' } },
  devices: { phone: { rig: 'lab', kind: 'android', serial: '<serial>' }, avd: { rig: 'lab', kind: 'android-emulator', avd: '<avd name>' } },
} }
```

- A rig is `local`, `ssh` or `cloud`. One `ssh -M -o BatchMode=yes -o ExitOnForwardFailure=yes`
  master per rig carries every forward: adb, the WebView CDP ports, the WebKit ports and the
  `scrcpy` video. A rig never asks for a password.
- Each rig owns its adb port. The local adb server is 5037, so a rig uses another port, and a
  message about the rig never reaches a local emulator.
- A command names its device. Two devices on one rig with one serial pattern film the wrong
  device, and an emulator of another architecture behaves differently.
- An AVD holds the signed-in Telegram account. Two people on one AVD share one sign-in, and the
  second `open` reports success against the session of the first.

## Ingress

The device must reach the dev server through the tunnel URL.

| `ingress` | What it does |
|---|---|
| `direct` | The device opens the tunnel URL as it is. |
| `host-proxy` | For a gateway that does not hairpin: the rig runs the host proxy, `adb reverse` maps its port into the device, and the guest `http_proxy` sends the tunnel hostname to `hostProxy.upstream`. Every other request passes through. |

The symptom of a missing correction is a Telegram loading placeholder over a blank page, with no
console error and no failed request: the WebView never connected. `down` removes the correction.

## Android

- Playwright cannot attach to an Android WebView. The WebView omits `webSocketDebuggerUrl` from
  `/json/version`, and `connectOverCDP` fails on browser context management. The target speaks
  raw CDP to the socket that `/json/list` names.
- Use a `google_apis` system image, never `google_apis_playstore`. A Play Store image is a user
  build, and its WebViews are closed to the debugger.
- The CDP page outlives the visible Mini App. When a user closes it, `eval` still answers from a
  page in the background. Confirm a route or a visibility claim with `shot` or the accessibility
  dump.
- A per-chat menu button wins over the default button until the next `/start`. After a tunnel
  URL changes, send `/start` before you trust the menu. Read the button with
  `getChatMenuButton` and the user's `chat_id`.
- `https://t.me/<bot>` opens a browser. The target opens `tg://resolve?domain=<bot>`.
- A label search finds the message before the button when both hold the text. Take the shortest
  label that holds the phrase. Confirm a send by a new message time, never by the tap.
- `sys.boot_completed` fires before SystemUI lays out, so an inset read at that time is 0. Read
  the navigation mode with `settings get secure navigation_mode`, never from the overlay list.
- Keep the sign-in alive. Let `down` finish its clean shutdown. Take a `snapshot` before a risky
  step. Prove persistence with a marker file in `/data/local/tmp`, never with the sign-in.

## The real iPhone (`ios-webkit`)

The chain is this machine, the rig's ssh master, `ios_webkit_debug_proxy` on the rig, and the
Web Inspector of the phone over USB.

- A person taps the phone, and the target reads it. There is no input route without XCUITest, so
  `tap`, `point`, `back` and `key` refuse. A row with `act` is `n/a` with `input`.
- `shot` photographs the WebView through the inspector, without the Safari or Telegram chrome.
  Video is `n/a`.
- The phone must be unlocked, with Auto-Lock off, and Web Inspector on in the Safari settings. A
  locked phone still answers `/json` with no documents. `doctor` names that case.
- The inspector socket accepts only `Target.*` messages: a command travels in
  `Target.sendMessageToTarget`, and its answer comes in `Target.dispatchMessageFromTarget`.
- `Runtime.evaluate` ignores `awaitPromise`. The target reads a promise in a second call. Never
  trust an empty object from your own client.
- Never restart the proxy. It runs under sudo from a console session on the rig. `doctor` prints
  the command that a person runs at that console.
- A non-login ssh shell has no Homebrew `PATH`. The target puts the path in front of each remote
  command.
- Prove that a page belongs to Telegram before you report a Mini App value from it. A page in
  Safari with the dev fake Telegram host looks the same.

## The iOS simulator (`ios-simulator`)

`xcrun simctl` on a rig opens a URL, takes a full-screen shot and records video. It has no input
tool, so `doctor` reports it as not ready until one is configured.

## The cloud iPhone (`browserstack`)

BrowserStack Automate drives Safari on a real iPhone over W3C WebDriver. Prefer it for the newest
iOS or the newest model. It drives Safari only, not the Telegram WebView.

- Every open session spends Automate minutes, idle or not. `budget` reads the minutes. A run
  stops at `qa.device.browserstack.budgetMinutes` with `qa.device.browserstack.budget`.
- Always run `down` after a session. `idleTimeoutS` ends a forgotten one.
- The screenshot is the real screen with the Safari chrome.
- Safari over WebDriver has no console, so `logs` refuses. The session page in the BrowserStack
  dashboard holds the console log.
- Read the iOS version from the `Version/` token of the user agent, not from the OS token.
- The keys are `BROWSERSTACK_USERNAME` and `BROWSERSTACK_ACCESS_KEY` in the secret store. Ask
  `{{lw:envCommand}}` whether a key is set. Never print a value.

## The sign-in is the operator's

A login code goes to the operator's own devices. A target stops at the Telegram login screen.
Never ask for a code, and never report a working device against a Telegram that nobody signed
into. `mirror` shows the screen so that the operator can sign in.

A target never installs or erases a signed-in Telegram without `--force`.

## The usual flow

```sh
lw qa device doctor
lw qa device open --device <name> --bot <bot username>
lw qa device eval --device <name> @measure.js
lw qa device logs --device <name> 15
lw qa device shot --device <name> screen.png
lw qa device down --device <name>
```

## Product facts

Facts about this project sit in `{{lw:adapterDir}}/qa-device/`: the rigs and what each one hosts,
the device names, the dev bot username, the Telegram account of each device, the ingress of each
rig, and the known faults of each device. No adapter means no product facts are known. Say that,
and do not invent them.
