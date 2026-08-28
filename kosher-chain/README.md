# Camp Kosh - the dining hall

You run the dining hall at Camp Kosh. Six weeks, three meals a day, a room full
of hungry boys, and everything that leaves the kitchen has to be kosher.

Drag your finger through foods that touch. The chain **is** the plate, so it
only keeps going while everything on it may be eaten together. Lift your finger
to serve it. Your nusach decides whether fish will sit beside dairy, and the
board answers in your nusach, not somebody else's.

Every plate is two hours of camp, so the six hours between fleishig and milchig
are six hours you can watch go by on the clock. It is the same boys at that
table all week - a fresh group would mean a fresh stomach, and then none of the
waiting would mean anything.

The simcha bar runs down on the wall clock, not on your moves, so a plate you
take too long to find costs you even though it costs no move. Let it empty and
the week ends: *the boys lost all their simcha.*

One file, no build step, no network at runtime: `index.html`.

## Playing it right now

```
node kosher-chain/serve.js
```

It prints an address for this computer and an address for your phone. Same
wifi, open it in Safari or Chrome, then **Add to Home Screen** - it opens
full screen with no browser bars, and after the first load it plays with the
phone in airplane mode.

## Built for a touch screen, not a mouse

- One finger, ever. No hover, no right click, no keyboard needed.
- Dishes are never smaller than 40 css px, tested on iPhone SE through iPad.
- The page cannot scroll, bounce, pinch-zoom, select text or show a long-press
  menu. `touch-action: none`, fixed body, and the canvas takes every touch.
- The logical space stretches to the real screen, so there are no black bars
  on a tall phone, and rotating re-lays everything out.
- Safe-area insets are respected, so nothing hides under a notch or a home bar.
- Leaving mid-drag (a phone call, the app switcher) cancels the chain and
  pauses the table instead of eating your move.
- Android's back button and back gesture step back through the game. On the
  menu, and only inside a packaged app, back leaves.
- Audio unlocks on the first touch, the way iOS requires, and never blocks play.
- Haptics where a phone has them, silently skipped where it does not.
- Frame budget is checked in the test suite on a Pixel 5 profile.

## The halacha it actually enforces

Every rule lives in one function, `plateAccepts`. Nothing clears unless the
whole plate may be eaten together.

- Meat and dairy never share a plate, in either order.
- Fish never joins a meat plate.
- Fish with dairy depends on the nusach: Ashkenaz and Nusach Sefard allow it,
  Edot HaMizrach does not, Chabad allows cheese but never liquid milk. Where it
  is allowed, a plate that rides both fills the fish order and the milchig
  order at once, with a small dual bonus to the simcha bar.
- Edot HaMizrach never share a plate between fish and dairy, and also rinse
  between the two the rest of the way round - the same idea as fish and meat,
  whichever one came to the table first.
- Treif can never join anything - tap it to throw it out.
- After a fleishig plate, milchig waits six hours - three more plates on the
  camp clock.
- Milchig is not served at a fleishig meal at all, even once the six hours are
  up. **BENTCH** ends the meal and starts a new one - it does not shorten the
  wait and it does not change who is sitting there.
- After a milchig plate, meat needs three things: **WASH**, **RINSE**, and a
  pareve plate.
- Bread needs washed hands. One washing covers the whole meal, more challah
  included; it only lapses when the boys bentch.
- Between fish and meat everyone rinses, whichever of the two came first.

A table isn't the same table for everybody. Edot HaMizrach can't chain a
fish plate through dairy, so a fish order gets a little more fish on the
board to make up for it (`Board.foodWeights`) - and on a table that also
orders dairy, where thinning the board would just starve that order
instead, Edot HaMizrach and Chabad get a few extra moves rather than a
different board (`LEVELS[i].moveBonus`, added onto `play.totalMoves`).
Ashkenaz and Sefard play the table exactly as written.

And on a table with no fish order at all - fish only ever sitting there as
filler - the same rule cuts the other way. Ashkenaz can still fold a stray
fish tile into a milchig chain even though nothing's asking for it; Edot
HaMizrach can't fold it into either the fleishig or the milchig order, so
that tile was just clutter thinning out the whole board. `Board.foodWeights`
shrinks fish down to almost nothing for Edot HaMizrach on those tables and
hands the room to whichever order is actually on it.

The suite sweeps all 1296 food pairs against a rule table written out
separately from the game code, for all four nusachs.

### It says why, and where it comes from

The first time a rule turns a plate away, the card for that rule comes up in the
middle of the table with the source on it - *Pesachim 76b*, *Shulchan Aruch,
Yoreh Deah 89:1*, and so on. Being refused costs no move and the simcha bar
holds still while you read. After that the rule just gives the one-line reason.
`WHY_CARD` maps every refusal the rules can produce to the card that teaches it,
and a test walks every reason string to prove none of them is orphaned.

## Working on it

```
node kosher-chain/qa.js            all tests
node kosher-chain/qa.js rule       just the halacha ones
node kosher-chain/qa.js --headed   watch it play
node kosher-chain/balance.js       greedy solver, per-table win rates
node kosher-chain/shots.js [he]    screenshots of every screen
node kosher-chain/shots-sizes.js   the same table on four phone sizes
node kosher-chain/demo-shots.js    the title-screen demo, per nusach
node kosher-chain/probe.js         menu layout numbers per phone
node kosher-chain/icons.js         rebuild the home-screen icons
```

Every readable string is keyed in English with a hand-written Hebrew side, and
a test fails the build if anything is English-only.

## Mitz Mode Play tab

In the Be a Tzaddik app, Camp Kosh sits on the Play tab menu grid in Kitchen
Match's old spot - Kitchen Match is hidden (not deleted) so the grid stays at
six tiles. The host loads `files/games/kosher-chain.html`,
injects `MITZ_MODE` / `MITZ_LANG` / `MITZ_NUSACH`, and the in-game language and
nusach pickers stay hidden. **MORE GAMES** (and Android back on the title screen)
returns to the arcade menu.

```
npm run sync:app          # copies Dash + Chain into sharedmodule
```

## Shipping to the App Store and Play Store

`pack.js` collects the only files a phone needs into `www/`, which is what
Capacitor wraps. Run it from this folder:

```
node pack.js
npx cap add ios
npx cap add android
npx cap sync
npx cap open ios          # Xcode: signing, then Archive
npx cap open android      # Android Studio: signed bundle
```

`capacitor.config.json` here already pins the app to `com.mitzvahdash.game`,
portrait, no scrolling, no content inset, dark splash. The root
`capacitor.config.json` still belongs to the old build; this game's config is
this folder's.

App icons for the stores come from `icons/icon-512.png`.
