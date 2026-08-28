---
name: frum-game-design
description: Rules for designing, building, reviewing, or extending a Jewish educational game or app for Dan. Covers the non-negotiable content and imagery constraints (no sun/moon/star art, tznius, nothing for Shabbos or Yom Tov), how to pick a mechanic that carries halacha honestly, target and fairness rules, the gentle-by-default tone, where teaching is allowed to appear, source citation standards, the single-file HTML5 build shape, and a catalogue of designs that were built and rejected. Use this before writing any game code, any halacha card, any in-game message, or any character art.
---

# Building Jewish games for Dan

## Who you are building for

Dan builds arcade games that teach real Halacha through play, aimed at kids who will
replay them many times. The bar is: **fun first, educational second, and correct always.**
A game that teaches beautifully but is not fun has failed. A game that is fun but teaches
something wrong has failed worse. A game that is fun and correct but *lectures* has failed
in the way that is hardest to see coming, and it is the mistake agents make most often.

---

## 1. Hard constraints. Not trade-offs, not preferences.

### No sun, moon, or star imagery. Anywhere.
Not in a sky. Not on a timer. Not as a decorative sparkle, a sunburst, a twinkle, a
loading spinner with rays, or a star rating. Not in an icon set you generate "just in
case". This is a standing avodah zarah concern and it is absolute.

**Substitutes that work:** a rosette, a clock face, a lamp flame, a flat gradient sky,
silhouetted rooftops, a magen david. A **Magen David is permitted** and is the right
accent when you want an unmistakably Jewish mark.

This covers **text too**. A countdown is "the zman", never "beat the sun to it". Check
your prompt strings and comments, not only your draw calls.

### Everybody is dressed b'tznius.
Every character in every game, background figures included. Long sleeves to the wrist,
a collar, a hat or head covering. **Only the face and the hands show.** No bare arms, no
bare legs, no neckline. When a character has to read clearly at 40 pixels, solve it with
coat colour and hat silhouette — never by showing more skin.

### Nothing is built for Shabbos or Yom Tov.
The app does not work then, so do not add anything for those days: no daily streak that
breaks if you miss Shabbos, no scheduled notification, no calendar row, no "play every
day" achievement, no leaderboard reset that lands on Yom Tov. Any date-driven feature
skips those days entirely and silently.

### Shemos.
Do not render Hashem's name or write shemos into a game that gets closed, deleted, or
thrown away. Use "Hashem", "the Ribbono shel Olam", or work around it.

### Halacha is summary-level.
Cards teach; they do not pasken. Every body of halachic content ends up next to a real
citation and the app says plainly that a practical question goes to a rav.

---

## 2. Choosing a mechanic: the halacha must BE the game

The good version is when the halacha and the mechanic are the same act. Landing a coin in
somebody's open hand *is* "into his hand, not into the dust" — nothing needs to be said.
Keeping oil in a cup so the flame lasts *is* the shiur of the lighting. Sorting a fleishig
pot away from a milchig one *is* the halacha. The player learns by doing, and the card at
the end just names what they were already doing.

The bad version is a quiz taped onto an unrelated game, or worse, a mechanic invented to
justify a halacha that does not belong in that setting.

**The test: does this mechanic make sense in its own world, with the halacha removed?**
If you have to explain why a halachic concept applies here, it does not belong here.

> **Rejected:** a "pe'ah" mechanic in a street-throwing game, where a coin that missed
> could be picked up later. Pe'ah is the corner of a *field*. Throwing coins in a street
> has nothing to do with it, and the mechanic turned a miss into a hit — the exact
> opposite of what the game was about. Deleted entirely.

**Never let an educational mechanic contradict the point of the game.** If the game is
about precision, nothing may rescue a miss. If the game is about giving generously,
nothing may punish generosity.

---

## 3. Targets, aiming, and fairness

* **Every target is a visible, concrete opening.** A palm. The slot in a pushka lid. The
  mouth of a sack. A cart tray. The player must be able to point at the pixel they are
  aiming for.
* **The hit box is the opening, not the person.** Hitting a shoulder is a miss and scores
  zero. A near-miss says nothing warm — it just missed.
* **Art is drawn at exactly hit-box size.** If the drawn palm is smaller than the box
  behind it, a shot the player *saw* miss will score, and it reads as the game cheating.
  Assert this in a test.
* **No lock-on, no magnetism, no assist.** The fun is in judging it yourself. If getting
  close is enough, there is no skill left.
* **Nothing invisible or ambient may change a score.** No hidden state, no "conditions
  were right", no bonus for something the player cannot see and cannot aim at.
* **Nothing tells the player when to act.** No "LET GO!" prompt, no perfect-timing flash.
  Give them a readable world and let them read it. Test for this by scanning every method
  for release prompts.
* **Difficulty comes from readable physics.** Wind with an actual meter and visible gusts
  crossing the screen. Targets that walk, so you have to lead them. Obstacles that move
  slowly enough to plan around.
* **Complications arrive late.** Birds, wind gusts, extra hazards: higher levels only, and
  slow enough that a good player can account for them.
* **Mix the verbs.** One input gets stale. A hold-to-drop plus a pull-back-to-sling gives
  two ways to solve the same street. Variety of *scene* matters too — four settings, not
  one background reskinned.

---

## 4. Tone: gentle by default. This is the one to get right.

**A mitzvah you did not manage is never punished.** No life lost because a coin missed a
hand. No red flash, no screen shake, no alarm sound because you failed to give tzedaka.
Missing is just missing: the streak breaks, the next person is already walking in.

Punishment mechanics are fine where the *game world* punishes you — a not-kosher truck
flattens you, a grease fire cracks the glass. They are not fine where the *mitzvah* is
the thing you failed at. Getting that backwards makes the game feel like a rebuke, and
the whole thing stops being fun. This was the single loudest piece of feedback in the
project: "it's extremely jarring... the random halachic things are scary."

Practical rules:

* No red `flash`, no screen shake, no `damage()` call anywhere in a mitzvah-failure path.
  Write a test that walks every method on the class and fails the build if one appears.
* Ending a run happens on a clock, not on a moral failure. Say "Time ran out — 4 of 11
  coins landed", never "The market closed on you."
* When something scores less, **let the number say it.** Do not raise a banner explaining
  what the player did wrong. They can see the score.

---

## 5. Where the teaching goes

**During play: directions only.** Short, warm, concrete, about what to *do*.

> "A PUSHKA — a tzedaka tin, aim for the slot in the lid."
> "THE QUIET ONE — he never calls out, and his hand is small. Worth more!"
> "DOUBLE POINTS! — lots of little coins beat one big one."

**Not during play:** transliterated Hebrew terms, citations, or a lesson. These are all
wrong in a banner mid-throw, however true they are:

> ~~"aniyei ircha kodmin — the poor of your own city come first"~~
> ~~"a coin in the dust makes him stoop for it in public"~~
> ~~"RIBUI PE'AMIM x2"~~

The player is busy. A lesson thrown at somebody mid-aim is noise at best and a scolding at
worst. If the scoring already encodes the halacha, the scoring is the teaching.

**After play: the card.** This is where the real content lives, and the player is free to
read it. Cards are separate from the game and can be as rich as you like.

### How to write a card for a child

* **Open with the story or the surprise, not the ruling.** "Surprising one: the mitzvah
  happens at the moment you light." "They dug through the mess and found exactly one small
  jug still sealed."
* **Define every Hebrew word on the card, in its own glossary line.** A card that uses a
  term it never explains teaches nobody anything. Dan specifically flagged not knowing
  *dei machsoro* — that is how the glossary band came to exist.
  Format: **term** — plain English, short, no second Hebrew word inside the definition.
  `Dei machsoro — "enough for what he lacks" — you fill THIS person's gap`
* **Name the people.** "Rambam — Rav Moshe ben Maimon (Maimonides), who wrote a huge code
  of Jewish law." Do not assume a child knows who a Rishon is.
* **Warm, plain, a little funny. Never stern.** Short sentences. Second person is fine.
* **Mark the game's own liberties.** When gameplay departs from the halacha, say so in a
  separate visually-distinct note: *"So really you were finished the second you lit.
  Mitzvah Dash does not roll like that — here you fight for every last flame."* Never let
  a game mechanic silently misrepresent the halacha.

### Hebrew is a language of the game, not a decoration
Every user-facing string has a Hebrew side, written by hand in `Lang.he`. English is the
key. **Do not machine-translate.** Write it the way a kid would hear it in the kitchen:
short, spoken, not biblical and not English word-order in Hebrew letters. Add both
sides in the same change. A Hebrew UI is not a mid-play lecture — it is the same
directions in the player's language. Unexplained terms still belong on the card, with
a glossary line, in whichever language the card is showing.

---

## 6. Sources

Every card carries a real, checkable citation, and **you check it before you ship it.**

* Gemara by masechta and daf: `Shabbos 21b`, `Kesubos 67b`
* Shulchan Aruch by siman:seif: `OC 673:2`, `YD 118`
* Mishnah Berurah, Rema, Rambam by their own numbering:
  `Rambam Hilchos Matnos Aniyim 7:3`
* Chumash by sefer chapter:pasuk: `Devarim 15:8`

Do not invent a daf because it sounds right. Do not cite a masechta you have not verified
carries that sugya. Two citations in this project were wrong on first pass and had to be
corrected on review — assume yours are too until you have checked them one at a time.

---

## 7. Technical shape

* **One self-contained HTML file.** Canvas2D, no external assets, no CDN, no build step,
  no fonts to fetch. It has to run offline from a file:// URL and wrap cleanly in
  Capacitor for iOS and Android.
* **Author in numbered part files, concatenate to ship.** `p00_head.html p01_core.js …
  p14_tail.html > index.html`. A 400KB single file is unworkable to edit; a dozen 30KB
  parts are fine. Keep the concatenation order written down.
* **Portrait, touch-first**, a fixed logical stage letterboxed onto the real screen,
  DPR-aware, safe-area insets respected.
* **Fixed-timestep update loop.** Physics that changes with frame rate is not testable.
* **All art is code.** Shapes, gradients, paths. No sprite sheets, no image files.

---

## 8. Build discipline

* **Every bug the user reports becomes a permanent test.** Not a fix — a fix and an
  assertion. The same class of bug comes back otherwise.
* **Every audit finding becomes a permanent test.** Numeric geometry and physics claims
  ("the narrowest opening leaves at least 0.2s of release window", "the fastest bird takes
  0.55s to cross the drop column") belong in the suite, where they keep being true.
* **Behaviour tests do not catch rendering.** Deleting a draw function and leaving the call
  behind passes every state test and crashes on screen. Keep a render smoke pass that draws
  every level of every game and fails on any throw.
* **Scan the source, not only the behaviour.** Useful permanent scans: no method defined
  twice (a stale later copy silently wins); no `damage`/`shake`/red-flash in a gentle game;
  no removed mechanic's strings left anywhere.
* **When patching a large file with a script, assert your anchor occurs exactly once
  before replacing.** A Python slice between two markers where the second appears *before*
  the first yields an empty string, and `replace("", new, 1)` silently prepends. This
  duplicated 880 lines once and the stale copy was the one that ran.
* **Screenshot the result and look at it.** Several of the worst problems in this project
  were invisible to a green test suite and obvious in one PNG.

---

## 9. Working with Dan

* **Do not ask a lot of questions. Build it.** He would rather correct a working build than
  answer a questionnaire. Ship something playable, then iterate on what he says.
* **Deliver a full working build every round** to the path he has named. Not a diff, not a
  snippet — the file he can double-click.
* **Take corrections literally and completely.** "Remove pe'ah" means delete the mechanic,
  its art, its scoring, its badge, and its strings. If he ever says *"I think I already told
  you to remove that"*, the first removal was partial — go find every trace, including
  test fixtures and screenshot scripts.
* **Do not hand him someone else's spec.** He rejected an imported design outright and
  asked for an original one. Design it yourself.
* **Design objections are usually about coherence, not taste.** "An awning on the building
  is going to stop a coin falling in the street? It makes no sense." When he says something
  makes no sense, he is right, and the fix is to delete it — not to tune it.

---

## 10. Catalogue of designs that were built and rejected

Read this before proposing anything. Each of these seemed reasonable when written.

| Built | Why it was wrong |
|---|---|
| Losing a life for a missed tzedaka coin, with a red screen jolt | Punishing a mitzvah. "Extremely jarring... not fun." |
| A "people are watching" state that quietly cut the score | Invisible, unaimable, ambient. Only real openings may score. |
| A coat-pocket target for the man who won't ask | Not a thing you can see and drop into. |
| A pe'ah gleaner who rescued missed coins | Wrong halacha for the setting, and it undid the game's own point. |
| Awnings over the street that blocked falling coins | Physically absurd — an awning on a building cannot block the road. |
| A solid canopy over part of the play area | A falling projectile trades height for horizontal reach, so a roofed column is not merely hard, it is unreachable. Test reachability numerically. |
| A hand drawn a third smaller than its hit box | Reads as lock-on. The player watched a coin miss and score. |
| Three circling crosshairs while aiming | Unreadable. One dotted line to one ring. |
| A "LET GO" prompt | Removes the only skill in the game. |
| A window frame floating in open sky | Put the player somewhere real — a lit window in a building. |
| Hebrew terms and citations in mid-play banners | The player is busy. Save it for the card. |
| Halacha cards that used terms they never defined | Kids cannot learn from a word nobody explained. Glossary every one. |
| All eight levels sharing one background | Four distinct settings minimum — a city, a frontier town, an old stone quarter, a harbour. |

---

## The one-line version

Make it fun, make it exact, make it kind, put the halacha in the mechanic and the
explanation on the card, define every Hebrew word, draw nobody's arms, no sun, no moon,
no stars, and never punish a child for missing a mitzvah.
