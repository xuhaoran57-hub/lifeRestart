# WeChat Mini Game POC

This folder is a WeChat Mini Game shell for the Gaokao Restart POC.

## Build

```sh
pnpm build:wxgame
```

The build writes `js/game.bundle.js`, which is loaded by `game.js`.

## Open In WeChat DevTools

1. Build the bundle.
2. Import this `wxgame` folder in WeChat DevTools.
3. Use a real Mini Game AppID when publishing. `touristappid` is only for local POC import.

## Scope

The POC reuses the existing content and engine, renders a Canvas UI, supports touch input and scroll, lets the player select talents, allocate properties, advance rounds, view the ending/admission summary, choose inherited talent, and stores progress with `wx.getStorageSync` / `wx.setStorageSync`.
