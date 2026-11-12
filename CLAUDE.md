# GitHub accounts and where each repo pushes (read before any `git push`)

Two GitHub accounts are logged in on this PC. Only ONE is active at a time. Check with `gh auth status`.
Switch with (the name is CASE-SENSITIVE, copy it exactly):

    gh auth switch --user Geulanow613
    gh auth switch --user sebproductionsmail-dev

If a push says "Repository not found", the wrong account is active. Switch and retry. Do not force-push to fix it.

## Which account for which repo
| Folder | Remote | GitHub repo | Account to use |
|---|---|---|---|
| C:\apps\hehehe (Mitz Mode Android app), branch master | origin | Geulanow613/Mitzmodeandroid | Geulanow613 |
| same folder | backup | Geulanow613/mitzmodebackup | Geulanow613 (has 10 commits our master lacks as of 12 Nov 2026; do NOT force-push, merge first or ask Dan) |
| C:\apps\hehehe\sharedmodule (shared Kotlin + bundled games), branch main | origin | Geulanow613/sharedmodule | Geulanow613 |
| C:\apps\games (website games / Beardy Top hub, GitHub Pages), branch main | origin | Geulanow613/games | Geulanow613 |
| C:\apps\newgame\chaimcraft (NEW ChaimCraft) | origin | sebproductionsmail-dev/chaimcraft | sebproductionsmail-dev |
| same folder | geula | Geulanow613/chaimcraft (private) | Geulanow613 |

Note: sharedmodule and chaimcraft are separate git repos inside/next to the app folder; hehehe's git does not track sharedmodule.

## How things connect
- Pushing sharedmodule runs .git/hooks/pre-push, which runs tools/sync_to_games_repo.sh. That copies the bundled games (mitzvah-dash hub etc.) into C:\apps\games and pushes it to Geulanow613/games. So the SAME account (Geulanow613) must be active for sharedmodule pushes.
- The Beardy Top website embeds https://geulanow613.github.io/games/ (the Mitzvah Dash hub) in an iframe.

## ChaimCraft: OLD vs NEW (keep separate)
- OLD ChaimCraft (website only): C:\apps\games\chaimcraft\index.html. It is NOT synced from the app any more (the sync script no longer touches chaimcraft). Hub shows it with an orange BETA flag on the website only. Hidden inside the app (window.MITZ_MODE) via `webBeta: true` in mitzvah-dash.html.
- NEW ChaimCraft (hidden everywhere for now): C:\apps\newgame\chaimcraft. Pushed as branch work/nov12 to sebproductionsmail-dev/chaimcraft and as branch new-engine to Geulanow613/chaimcraft. Neither is merged to main anywhere. Do not add the new one to the app, the hub or the games repo until Dan says it is ready.
- Push new ChaimCraft: `cd C:\apps\newgame\chaimcraft`, switch account per the table, then `git push origin work/nov12` (seb) or `git push geula work/nov12:new-engine` (Geulanow613).

## Rules
- After a push, switch back is NOT needed unless the next repo uses the other account. Always check `gh auth status` first.
- Never commit/push without Dan asking. Never force-push.

## ChaimCraft OLD game: creative mode, auto-save, fullscreen (added 12 Nov 2026)
- OLD game source = `C:\apps\newgame\chaimcraft\old\` (src + build.cjs). It has NO vendor/ or assets/: to build it, copy those two folders and package.json from a checkout of commit f12d423 (the old game's last commit on Geulanow613/chaimcraft main) into a scratch folder next to a copy of old/src, then `node build.cjs`.
- Branch `old-live-creative` (repo C:\apps\newgame\chaimcraft, pushed to both remotes) = commit f12d423 + creative mode + sturdier saving + points-wording removed. This is EXACTLY what is deployed on the website. `old/` on `work/nov12` holds the same changes on top of newer, undeployed old-game edits.
- Deploy to the website by hand (the sync script no longer touches chaimcraft): build, insert tools/web-embed-snippet.html (sharedmodule) right after `<head>`, write to `C:\apps\games\chaimcraft\index.html`, commit + push the games repo (Geulanow613).
- New in the old game: `src/08zza_creative.js` (Creative mode button on the title screen under Load game; each creative world is its own save slot; G opens the Creative kit: hotbar keys 1-9 + 5 weapons; endless items/coins; hold jump to fly; damage stays ON). Saves: `__ccStore` in shell.html mirrors the save into IndexedDB and restores it if localStorage is wiped; `saveGet/saveSet/saveDel` in 01_core.js must be used instead of touching localStorage directly. Everything is open (08zz_testopen.js, TEST_OPEN_ALL).
- Tests: `NODE_PATH=C:\apps\newgame\node_modules node test/qa12.cjs` (2 known old failures: star emoji scan, jump-swings). Playwright lives in C:\apps\newgame\node_modules.

## Mitzvah Dash hub fullscreen (website only)
- The hub (sharedmodule/shared/src/commonMain/composeResources/files/games/mitzvah-dash.html, synced to the games repo) has a top-left fullscreen button. In fullscreen, ChaimCraft / Camp Kosh / Sukkah Scramble / Shabbat Sprint open in a layer over the hub so fullscreen is not lost; a game's link back to `../index.html` closes the layer (see `__mdashHub`).
- It only works if the Fourthwall embed iframe has `allow="autoplay; gamepad; fullscreen" allowfullscreen`. Without that the button is simply hidden.
