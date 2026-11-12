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
