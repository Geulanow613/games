# Mitzvah Dash

Five fast arcade minigames with a halacha learning engine wired into the gameplay loop.
Everything ships in **one self-contained file** — `index.html` — with no external assets,
no CDN, no build step. Canvas2D renderer, fixed-timestep 60 FPS loop, full multi-touch
gesture stack, procedural WebAudio, and a persistent player profile.

---

## Run it

**Right now:** double-click `index.html`. It runs from `file://`.

**On your phone (same Wi-Fi):**

```bash
npx serve .          # or: python -m http.server 8080
```

then open `http://<your-computer-ip>:8080` on the phone and *Add to Home Screen*.
The meta tags make it launch full-screen with no browser chrome.

**Desktop QA shortcuts:** arrow keys / WASD = swipes, Space = tap, Esc / P = pause.

---

## Ship it as a native iOS + Android app

The game is written for a native WebView shell (the "React Native + Canvas/WebView native
wrapper" option). Capacitor is the shortest path — the game is already the web asset.

```bash
npm install
npx cap add ios
npx cap add android
npx cap sync
npx cap open ios        # builds/archives in Xcode
npx cap open android    # builds in Android Studio
```

`capacitor.config.json` already points `webDir` at this folder and locks the app to
portrait with a black background so the letterboxing reads as intended.

### Native haptics (recommended for iOS)

`navigator.vibrate` works on Android WebView but **not** on iOS/WKWebView. Install the
Capacitor Haptics plugin and route the game's haptics module to it — the game funnels every
buzz through one function, so this is the only change needed:

```bash
npm i @capacitor/haptics
```

```html
<!-- add just before </body> in index.html, after the game script -->
<script type="module">
  import { Haptics as Native, ImpactStyle } from '@capacitor/haptics';
  window.Haptics.fire = function (pattern) {
    if (!Profile.data || !Profile.data.opts.haptics) return;
    var ms = Array.isArray(pattern) ? pattern[0] : pattern;
    Native.impact({ style: ms > 40 ? ImpactStyle.Heavy : ms > 20 ? ImpactStyle.Medium : ImpactStyle.Light });
  };
</script>
```

`HapticFeedback.lightImpact()` in a Flutter shell maps the same way — override
`Haptics.fire` with a JS-channel call.

---

## The six minigames

The Play tab menu shows six tiles. Kitchen Match is still in the code and still
fully tested (`qa2.js`) - it is just hidden from the menu grid (`hidden: true`
in the `GAMES` array, filtered out into `VISIBLE_GAMES`) in favor of Camp Kosh,
which now sits in its old spot. Un-hide it by dropping that flag.

| Game | Halacha it teaches | Controls |
|---|---|---|
| **Menorah Keeper** | Ner Chanukah must burn a full half hour after nightfall; a lighting the wind will kill is not a valid lighting; olive oil, the shamash, lighting one light from another, and *me'ikkar hadin* — one light a night is already the mitzvah | Every light has **its own jug directly beneath it** — **tap the jug** (or the light) to top it up · **Swipe against the wind** along the marked lane — *window closed* — and the gust blows back out the way it came · **Swipe** jelly off the glass and burning latkes off the cups · **Tap** dreidels before they knock a jug over · **Tap the shamash** to lift it off its pin, then **drag it onto a dark wick and hold it there** to relight — the cup needs oil in it first |
| **Shul Crossing** | Sof Zman Tefillah, Plag HaMincha, zerizin makdimin, schar pesios, kavod Shabbos | **Tap** to leap forward · **Swipe left/right/down** to steer · the **food truck lane** is uncommon and mixed: ride a **KOSHER FOOD** truck for a free lift and invincibility, but a **NOT KOSHER** truck flattens you — read the label · dodge the sprinklers, because one soaking leaves you with a **WET HAT** and the dry hat bonus is gone for the whole crossing · beat the zman to the shul for a **Mitzvah Multiplier** |
| **Kosher Sort** | Basar b'chalav (cooking, eating and benefit), pareve, waiting between meat and milk, fins-and-scales, the two signs, hechsher, checking for insects | Dual conveyor: **swipe left** → meat bin · **right** → dairy · **down** → pareve · **flick up** → disposal. **Tap** a lid before you swipe. Survive the **Kashrus Rush**. Twelve named belt shifts |
| **Matzah Delivery Havoc** | The fourth halachic hour on Erev Pesach, bedikas chametz, bittul, eighteen minutes, matzah shemura, bal yeira'eh | **Drag the bottom-left slider** (or the truck) to steer · **slash** with your other hand to cut flying chametz · **giant croissants** need three cuts or one two-finger combo swipe · **tap** yeast clouds to disperse them · drive into the **Afikoman golden shield** |
| **Tzedaka Blast** | Rambam's eight levels of giving, *dei machsoro*, matan b'seter, aniyei ircha kodmin, giving before being asked, the kupah and its gabbai, words when the purse is empty, matanos l'evyonim (all of it on the cards — the banners during play stay short and plain) | **Hold and slide to aim a DROP** — sliding sideways leans the throw, a dotted line shows exactly where the coin will fall, and how long you hold sets how fast it goes · **pull UP for power**, shown on a force meter under the window · **tap** a bird to shoo it off your coin · with an empty purse, **tap** somebody and speak to him. The target is the **opening** — his palm, the slot in the tin — and a coin that misses is gone in the dark |
| **Camp Kosh** | Meat/dairy/fish/pareve grouping; fish-with-dairy by nusach (Ashkenaz, Sefard, Edot HaMizrach, Chabad) — where it is allowed, a fish-and-dairy plate fills both orders at once with a dual simcha bonus, and Edot HaMizrach rinse between the two the rest of the way round, same as fish and meat; six hours after meat on a clock that moves two hours a plate, explained to the player as **three pareve meals**, not a raw hour count; milchig never at a fleishig meal, so the boys **bentch** first; wash, drink and something pareve after milchig; netilas yadayim for bread, one washing for the whole meal; a rinse between fish and meat, either order. Every refusal flashes the card that teaches it, with the source on it | **Own engine** in `kosher-chain/` — you run the camp dining hall: drag a chain through neighbouring dishes that may share a plate, and keep the simcha bar off zero. The bar drains on the wall clock, faster every week, so slow plates cost you. **WASH**, **RINSE** and **BENTCH** are free actions. Six weeks, three days each. On the Mitz Mode Play tab it sits in Kitchen Match's old spot; the host swaps to `kosher-chain.html`. Sync with `npm run sync:app`. |
| ~~**Kitchen Match**~~ *(hidden from the menu, code and tests intact)* | Meat with meat, dairy with dairy, pareve with pareve | **Swipe** neighbouring dishes to swap. **Three of the same side** vanish. Meat and dairy never plate together. **Flick up** treif or mixed dishes. **Tap** a lid. Plate the quota before the stack **overloads**. Twelve named kitchen shifts |

Each minigame keeps its own combo, level and score, and hands a **Halacha flash card** to the
player between levels and on game over. Four of them have lives; Tzedaka Blast deliberately has
none — see below.

### How Menorah Keeper escalates

**Every hazard is live from night 1** — wind, jelly boys, dreidels and grease-fire latkes —
and the night opens about a second in, not ten. Night 1 is not a tutorial with one mechanic
in it; it is the whole game running slowly. A gust takes seven seconds to cross with a
two-and-a-half second warning, a latke gives you ten seconds before the glass gives, a full
cup lasts about fifty seconds. By night 8 the gust crosses in **under two seconds** and comes
every four, the jelly boys arrive three times as often, the glass cracks in four seconds, and
every one of those timers has tightened underneath you. Each night is thirty halachic minutes
counted down at the top of the screen, played out over ninety real seconds.

What gets *added* higher up is kind, not quantity — a new verb rather than more of the same:

| From | Attacker | How you answer it |
|---|---|---|
| Night 4 | Gusts from **both sides at once** | two swipes, opposite directions — only one lane is ever shown, so you clear them in order |
| Night 4 | **The cat**, prowling the windowsill toward the jugs | swipe at it to shoo it; let it through and it knocks over **two** jugs at once |
| Night 5 | **Double-sized latkes** | keep swiping — one flick will not shift them |
| Night 5 | **Moths**, fluttering in on a homing path for a specific flame | tap them out of the air; one that lands leaves the flame sputtering, a second puts it out |
| Night 7 | **Hard gusts** | the lane reads SWIPE ×2 — the first swipe only stalls it, the second shuts the window on it |
| Night 8 | **Jelly-Zilla** | the boss — see below |

Each new attacker announces itself the first time it appears in a run, so nothing arrives
unexplained.

**The shamash is not one of the lights.** If it burns out, or a latke cracks its cup, you lose
nothing at all — no life, no clean-night grade, no score. The only consequence is that you can
no longer lift it and carry a flame to a dark wick, so every light you still have has to be
kept alive on oil alone. That is the halacha: the shamash is a servant candle, not part of the
mitzvah.

### Night 8: the Jelly-Pocalypse

Night 8 does not end when the clock runs out. The timer hits zero, the victory fanfare plays,
every light is burning — and then one of the jelly boys walks in holding a gift box.

It is not a prize. It is **Jelly-Zilla, the Great Sufganiyah**: a moustachioed jelly donut the
size of the window, and his arrival blows out every light you spent the night defending. You
cannot reach the menorah while he is there. 100 HP, and the only way to hurt him is to send his
own ammunition back:

| His attack | Your answer |
|---|---|
| **Sufganiyot volley** — donuts fired across the glass | **slash** one out of the air; it splits into two halves that fly home and hit him for 3 each. Every 8th slice starts a **NAPKIN FRENZY**, doubling half-damage for five seconds |
| **Jelly Tidal Wave** — thick globs coating the screen | **scrub in circles** over each glob to wipe the glass. Let five pile up at once and you are smothered — that is a life |
| **Powdered Sugar Blizzard** — frost closing in from the edges | **swipe** through it to clear your view; it also settles on its own |
| **The lunge** — he rears back to swallow the whole window | **tap him seven times in 1.7 seconds** to shove him back, which costs him 9 HP. Miss it and it costs a life |

He picks attacks faster and harder as his HP drops. At zero he is still standing — and the
**Pach Shemen** appears on the sill, the sealed flask of the Chashmonaim. One tap sets him
alight, he goes out the window, and you relight all nine by hand: shamash first, then the eight,
because that is the order. The badge is **Jelly-Zilla Slayer**, and the card it unlocks is
*Pach Shemen* (Shabbos 21b).

The jug, its light and its jelly stack all share one invisible column — they line up exactly,
but nothing is drawn to say so. The only thing that travels the column is the oil itself, on
the way up from a jug you just tapped.

### Gesture handling

Two rules keep swipes honest across all four games:

* **No dead band.** A gesture that moved further than a tap is a swipe, full stop. There used
  to be a gap between the two thresholds where a short deliberate flick produced nothing at
  all, which read as the game ignoring you.
* **Kosher Sort biases horizontal.** Its bins sit left and right of a belt that runs *down*,
  so a flick toward a side bin nearly always drifts downward on the way. Horizontal wins unless
  the stroke is genuinely steep. The dish you touched is the dish that moves.
* **Kitchen Match swaps the dish you started on.** Any two uncovered neighbours can trade
  places, including meat and dairy — they just never plate together. Three of the same
  side vanish. A mixed row stays put. A clear flick **up** dumps treif or mixed dishes into the chute.

Matzah Havoc's truck likewise uses a real hitbox traced to its drawn body and pulled in a
little, tested circle-against-rectangle. The old check was "past this line and roughly
overhead", which counted chametz that had already fallen well below the truck. And the
**Afikoman shield means invincible** — while the aura is up, chametz, yeast and traffic are
all disintegrated on contact, nothing can touch the cargo, and even the fourth hour running
out is held off rather than costing a life.

Four rules keep the pressure fair rather than punishing:

* **Wind is a directional puzzle, not a reflex check.** A marked lane appears across the
  flames with chevrons, a gliding ghost hand and an arrow: swipe *against* the wind and
  **WINDOW CLOSED!** — the gust visibly reverses and blows back out the way it came. Swipe
  the wrong way and the game tells you which way it wanted. Only one lane is ever shown at a
  time, even for twin gusts.
* **One gust never kills a flame outright — but it always drinks the oil, and it leaves you
  a job.** A gust that lands takes a bite out of every cup it passes and leaves the flame
  **sputtering**: half-height, smoking, a warning triangle above it and an amber ring around
  it counting down. A sputtering flame burns its cup **2.2× faster** and, if you ignore the
  ring to the end, **it dies on its own** — full cup or not. The answer is fresh oil: pour
  into that cup (its jug flashes **POUR!**) and the wick settles instantly, even if the cup
  was already full. Only a **later** gust can snuff a sputtering flame early, and no single
  gust wave may ever take more than two lights — that pair of rules is what stops the twin
  gusts of night 4 from wiping a full menorah in one pass.
* **The shamash costs you nothing.** It is not one of the Chanukah lights, so it is left out
  of the nightly grade, out of the burning count, and out of any penalty: it can sit dark for
  the entire half hour without costing a life or spoiling a clean night. The only consequence
  is practical — with the shamash out there is nothing to relight a dark wick *from*, so the
  game just says *light the shamash first*, and one tap does it whenever you get to it.
  (Latkes are barred from targeting it, since a cracked shamash cup could never be relit.)
* **Nothing relights itself.** A dark wick stays dark until you carry the shamash to it. **Tap
  the shamash once** and it is in your hand; put a finger down anywhere and it comes to you;
  drag it onto the dark wick and hold it there. It lights on its own after about a second and a
  half — you do not have to keep a button pressed, and letting go leaves it where you put it
  rather than snapping it home mid-relight. That time is time not spent blocking or refilling,
  and the shamash burns down twice as fast while it is out in the open.
* **A cup with nothing in it will not take a flame**, which is the thing that used to look like
  a broken game: most lights go out *because* they ran dry, so carrying the shamash straight
  over does nothing. The cup now says **FILL THIS CUP FIRST** with an arrow down to its own jug,
  instead of a one-line prompt that scrolls away before you have read it.
* **A light going out never costs a life.** It costs you the grade. Lights go out — that is the
  game — and the mitzvah is judged at the end of the half hour, not moment by moment.
* **Every threat is a countdown you can see, and it says so out loud.** A squirt lands with
  **DONUT JELLY ON THE WINDOW!**; one glob is cosmetic, two put **THE JELLY IS ABOUT TO
  DRIP!** over that light, and the third drips down and douses it. A latke arrives shouting
  **FLYING LATKE!** while it is still in the air, then shows a heat ring filling
  around the cup — and if it fills, the glass **cracks and that light is gone for the night**,
  which is the one thing in the game you cannot undo.

### Tzedaka Blast: two verbs, and nothing to lose

The top of the screen is a city at night — towers of lit and dark windows running down to the
shopfronts. One of those windows is yours: a small lit square with somebody leaning out of it
and one arm reaching down into the street. That is the whole of you. Below, people walk the
market in three lanes at different speeds.

**Nothing in this game costs a life, shakes the screen, or flashes it red.** A test asserts
that — it walks every method on the class and fails the build if any of them calls `damage`,
`FX.shake`, or a red `FX.flash`. There are no hearts in the HUD, because there is nothing to
lose them to. Missing is just missing: you break your streak and the next person is already
walking in. The only thing that ends a run is the clock running out before you have landed
enough coins, and the halacha arrives afterwards on a card rather than as a klaxon.

**Every target is a real opening you can see.** A palm, the slot in a pushka lid, the mouth of
a sack, the tray on a cart. There is nothing invisible to judge and no state of the street that
quietly changes what a landing is worth — you either put the coin in the opening or you did
not. Two tests hold that line: one drops the same coin into the same hand with and without a
crowd standing beside him and fails if the two scores differ, the other scans every method on
the class for any leftover of the removed mechanics.

**Twelve streets, twelve places.** A tenement city, a frontier main street, a limestone old
city, a harbour, a brick alley with the sky a long way up, a village lane, a winter street
under snow, an adobe town, a canal bridge in the rain, a shuttered market row, hill terraces,
and the Purim street with lanterns strung end to end. Each brings its own roofline, window
shape, storey count, palette, weather and the cart standing in the road, and a test fails the
build if any two streets in a run look alike or if any street is calmer or easier than the one
before it.

**Three things can be in your way, and all three move.** The wind, which has a meter on it.
The birds, from street 5. And a covered wagon standing in the near lane from street 3 — its
canvas roof sits below every opening in the two far lanes, so it can only ever block the lane
closest to you, and it rolls straight through in about two seconds. Nothing hangs over the
road and nothing stands still.

**One gesture, and you can always see how hard you are throwing.** There used to be a charge
meter that ping-ponged up and down on its own while you held, so the speed you got depended on
catching it at the right instant — which from the player's side looks like the coin sometimes
going much slower for no reason at all. That is gone. Press, then move: sideways aims it, and
**pulling UP powers it**, like drawing a slingshot back. A notched force meter sits directly
under your window, fills as you pull, reads out a percentage, and never moves on its own —
what you see is exactly what the coin gets. A test pulls to nothing, half and full travel and
fails the build if the meter and the coin's actual speed ever disagree.

**Depth of field: a man further up the street cannot block one standing in front of him.**
A gentleman's box is 150px tall, so one walking the far pavement used to intercept coins meant
for somebody in the near lane — which is nonsense, he is yards further away. Gentlemen now
only ever get in the way in the lane **nearest you**, exactly like the wagon; anywhere further
up the street the coin passes in front of them. And people are now tested *before* obstacles,
so a throw that is on target lands, full stop — no bystander gets to steal a coin that was
going into somebody's hand. A test stands a gentleman in each far lane directly over a man in
the near lane and fails if the coin does not get through.

**The quiet one is gone.** He looked exactly like everybody else and paid 300 points for it,
which is not a thing a player can be expected to read. *Matan b'seter* now lives where it
actually belongs — the porter's sack, which takes the coin over his shoulder so he never finds
out who put it there — and the badge went with it.

**Sixteen different men, no two the same size.** Sixteen coat, hat, beard and skin
combinations for the poor, twelve for the gentlemen, three hat shapes (a cap, a homburg, a
tall black hat) and brims that vary by a third. Everybody is scaled between 0.90× and 1.10×,
and because the opening is built from the same size the drawing is, **a shorter man really
does have a smaller hand to hit**. A test walks five streets for seventy seconds each and
fails if fewer than five different men or five different heights turn up.

**Aiming a drop follows your finger, and never snaps back to anything.** It used to not: a
hold threw the coin *dead vertical out of the window whatever your finger was doing*, and any
27px drag in any direction flipped it into a sling. So the aim appeared to magnetise onto one
column, because it genuinely did. Now sliding sideways leans the throw, continuously from
zero — `aimLean()` is one number that the throw, the dotted line and the tests all read, and
sliding a pixel moves the landing about a pixel. The lean is an angle rather than a sideways
speed, so it reaches the same 283px whether you drop the coin gently or hard, and it stops at
full travel instead of running away. Only a deliberate pull straight *down* arms the sling, so
aiming sideways can never tip into a different throw by accident. A test slides the finger one
pixel at a time across the whole range and fails the build if the landing point ever jumps
more than 4px, goes backwards, or stops following.

**The opening you can see is the opening the coin is tested against.** The man bobs as he
walks, hops a little when you reach him, and bends right down when a coin lands in the dust
beside him. All of that used to move the *drawing* and leave the hit box standing where he
had been — so at up to fourteen pixels of disagreement on a fourteen-pixel-tall palm, you
could watch a coin pass through the middle of an open hand and score nothing. There is now
one `personLift(p)`, settled once per frame, that both the drawing and `targetBox` are built
from; `drawHolding` no longer shifts anything. The street also updates before the coins do,
so a coin is tested against where everybody is standing *this* frame rather than last one.
A sweep of 6,318 dead-centre shots — every kind of recipient, every lane, every walking
speed, every charge — lands 6,318 of them, and a permanent test fires at the middle of each
opening while its owner is bobbing, hopping and bent over.

**And a coin can no longer step over what it is aimed at.** The hit test is a point test, so
the substep count is now derived from how fast the coin is actually moving: never more than
three pixels between two tests, against a smallest opening of fourteen. At full charge that
is sixteen steps a frame. The catch radius went from 3px to 4px in the same pass.

**Not everybody on the street is poor.** From street 2 there are gentlemen about: good coat,
silk hat, stick, both hands busy. They never put a hand out, so there is nothing on them to
aim into, and a coin that catches one bounces off his shoulder and ends up in the road. They
crowd the street, which is the point of them — and the halacha underneath is on card t13:
tzedaka money is for *achicha ha'evyon*, your brother who is in need. Look for the hand.

There is only ever **one poor man on the street at a time** from street 5 on — two before
that, and two again on Purim — while the pavement around him fills with five or six
gentlemen. That is the point: he is the whole street, and what makes it hard is landing the
coin rather than finding somebody to land it on. The gentlemen spawn on their own clock, so a
busy pavement can never cost him his place, and when the street does empty the next man is
already on his way in. The quota came down to match — three on street 1 rising to six on
Purim — and the audit proves each street still sends between 1.8× and 6× as many people as
its own quota needs, computing supply from how fast his slot frees up rather than from the
spawn rate.

**They get quicker every single street.** 52–80 px/s on street 1, 118–163 by street 12 —
near enough twice as fast, which halves the moment you have to judge, from about half a
second down to a quarter. The audit fails the build if any street walks no faster than the one
before it, or if the release window on the narrowest opening ever drops below 0.22s.

**The wagon and the gentleman are drawn exactly the size of the box that stops a coin.** Not
approximately — a test renders each of them to an offscreen canvas, scans for the topmost,
bottom-most, leftmost and rightmost solid pixel, and fails the build if the ink and the hit box
disagree by more than a couple of pixels. Soft glows and cast shadows are excluded by alpha, so
a lantern's halo is never mistaken for a blocker. A blocker drawn smaller than its box eats
coins out of thin air; drawn bigger, it lets them through what you can plainly see. Both read
as the game cheating, and both used to be real bugs here.

**DROP** — press and hold anywhere. A dotted line runs from your hand to the street showing
**exactly** where the coin will land, curved by whatever the wind is doing, with a ring at the
end of it. How long you hold sets how *fast* it falls — a floated coin takes over two seconds
and the wind has all of that time to work on it; a hard one arrives almost at once and barely
drifts.

What the game will **not** tell you is when to let go. It shows you where the coin lands and it
shows you the wind; judging how far ahead of a walking man to release is the entire skill, and
having it announced took the game out of it. Nothing lights up, nothing counts you down.

The wind is a real opponent now and it has its own meter — a needle running out from centre,
left or right, that turns bright when a gust is strong. From street 5 on you can also *see* it:
wide translucent bands sweeping across the window ahead of the gust, so you can watch one coming
and wait it out rather than fight it. A slow, gentle coin is the dignified way to place one in
an open hand, and it is exactly the coin the wind can steal.

**SLING** — pull back instead of holding still and it becomes a slingshot: a dotted arc, real
gravity, real wind. It reaches the people your column does not — somebody who has already walked
past, somebody still coming.

**Every target walks.** There is nothing fixed to aim at and nothing to bounce off: no
windowsills, no crates, no courtyard, no awnings. An awning hangs over a *pavement* — it was
never going to stop a coin thrown into the road, and having it do so was difficulty for its own
sake. Between your window and his hand there is the wind, and from street 5 the birds. Nothing
else.

Each person carries his own opening and it says what it is — **HAND**, **PUSHKA**, **SACK**,
**POCKET**, **CART**, **TRAY** — and the target *is* that opening. Not his coat, not his hat,
not his general vicinity: the palm of his hand, the slot in the tin lid, the mouth of the sack.
The coin has to arrive within three pixels of going in.

**Nothing is drawn smaller than the thing you have to hit.** Every opening is painted at exactly
the size of the box the coin is tested against, so a coin that visibly missed *did* miss. That
was the real source of the lock-on feeling: the palm used to be drawn a third smaller than its
own hitbox, which reads as the coin bending toward the hand. A test throws at dead centre for
each of the six kinds and then repeats the identical throw one coin-width to the side, and fails
the build if the second one lands or scores a single point.

That is also why it is night on every street. A coin that misses his hand does not get picked up
and it does not get announced — it lands in the dark between the lamplight and it is simply gone.
No points, no rescue, no consolation. That is the whole game: land it in the exact opening, with
the wind against you.

#### Four places

The streets are not all the same town. Two streets each in the **city** (tenement windows and
fire-escape brick), the **frontier** (two storeys of timber under a big sky, false-front
parapets with painted sign boards, a water tower on stilts, a hitching rail along the
boardwalk), the **old city** (limestone, arched windows, domed rooflines and cypresses), and the
**harbour** (gabled warehouses, masts and rigging behind them, crates on the quay, everything
lit cold instead of warm). Each one changes the sky, the roofline heights, the window shape, the
road and the colour of the lamplight — the layout underneath is identical, so nothing about the
aiming changes, but you are somewhere else.

#### The eight streets

| Street | What arrives | The halacha under it |
|---|---|---|
| 1 | open hands and tin pushkas | *dei machsoro* — sufficient for what he lacks |
| 2 | porters with sacks over their shoulders | give so he never has to know it was you |
| 3 | **the bashful one** — give only while nobody is watching | *matan b'seter*, the Chamber of Secrets (Shekalim 5:6) |
| 4 | **the one who will not ask** — into his coat pocket, unprompted; and the priority rule switches on | giving before he is asked; *aniyei ircha kodmin* |
| 5 | **birds** — slow enough to see coming and count, but they will take a coin out of the air. Tap one to shoo it | — |
| 6 | the gusts turn into wave bands you can watch crossing the street | — |
| 7 | the gabbai's kupah cart, and a man whose cart has a broken wheel | the highest rung: a loan, not a gift — **he pays you back** |
| 8 | **Matanos LaEvyonim** — everybody's hand is out, nobody is checked, everything scores double | on Purim you do not investigate; whoever puts out a hand, you give |

#### What actually ends a run

Each street gives you a quota and a clock. Reach the quota and you move on with a bonus; let
the market close short of it and the run ends there — *"The market closed with 6 of 10
helped"*. That is the only ending.

Everything else is scoring. Somebody who walks off unhelped costs you your streak and nothing
else; the third time it happens the game says, gently, that nobody should have to leave with
his hand still out. Giving to the bashful one in front of a crowd still helps him — it just
embarrasses him, so it scores about a third and the game suggests waiting for a gap next time.
Serving an out-of-towner while a local is waiting still counts; it just scores less, with
*aniyei ircha kodmin* named underneath.

And the purse runs dry. It refills slowly — that is your ma'aser coming in, not an infinite
supply — and while it is empty you can still **tap somebody and speak to him**. It scores
little, but Rambam is explicit: if you have nothing to give, appease him with words. The streak
multiplier is *ribui pe'amim*, because a thousand gifts of one coin outweigh one gift of a
thousand.

### The nightly grade

Each night is scored on how much of the mitzvah actually survived the half hour:

| Grade | When |
|---|---|
| **Kosher L'Mehadrin** | every light still burning — full bonus plus 250 |
| **Kosher** | two or more still burning |
| **Me'ikkar HaDin** | exactly one left — by the letter of the law, still the mitzvah |
| **Not fulfilled** | every light dark — **the run ends here** |

**One light still burning carries the night.** Anything from Me'ikkar HaDin upward and you move
on to the next night with your lives intact, because one light per household each night *is* the
mitzvah. The only way a night ends the run is a menorah that is completely dark when the half
hour is up — and while it is dark the game says so in as many words, across the middle of the
window, so nobody watches the clock run out without knowing what is about to happen.

The grade is not a consolation prize; it is the halacha the game is built on, and the card it
unlocks says so: *ner ish u'beiso* — one light per household each night fulfils the mitzvah
completely. Lighting one for each person is beautifying it; adding one every night is
beautifying it further still, and that is what almost every family does.

---

## Geometry and physics audit

Every layout and collision rule is asserted numerically in the test suite rather than eyeballed.
What that pass turned up, and what it cleared:

**Found by an adversarial audit pass, after the tests were already green**

A separate reviewer was pointed at the two changed modules with instructions to prove defects
rather than describe them. Six were real, and all six were the kind a play-through would not
surface:

* *A pigeon stealing a coin deleted a different coin.* The capture spliced the array from inside
  the substep loop that was iterating it, so whichever coin shifted into the freed index was
  dropped out of the game mid-flight. The captured coin also kept simulating, so it could reach
  a hand and be **credited as given** while the bird flew off with it. Coins are now marked dead
  and removed by the loop that owns the array.
* *Night 8 was never graded.* `completeNight` handed off to the boss before it graded anything,
  so a player who let the entire menorah go dark on night 8 got the fanfare, all nine candles
  relit for free, a **Kosher L'Mehadrin** on the scoreboard, and a win. Night 8 is graded first
  now; a dark menorah ends the run and never reaches Jelly-Zilla.
* *Pausing while carrying the shamash disabled swiping for the rest of the night.* `Input.clear()`
  on resume drops the pointer without ever emitting the matching `up`, so `held` stayed true
  forever — and `held` was rejecting **every** swipe, including the one that shuts the window on
  a gust. The carry now releases when its pointer disappears, and only the carrying finger's own
  swipes are ignored; the other hand still works.
* *The shamash sputtering out spoiled a clean night* — the one death path out of six that forgot
  the `if (!c.sham)` guard the file states three times.
* *`missed` was never reset between streets*, so a single person missed on street 1 permanently
  forfeited the clean-Purim badge on street 8.
* *The left ledge sat in the courtyard canopy's shadow.* Brute-forcing 44,161 legal throws found
  36 that reached it against 3,760 for its twin — a hundredfold difference, invisible to a test
  that only asks "is it reachable at all".

That last one turned out to be the tip of a design mistake rather than a bug: a falling coin
trades height for horizontal reach, so *anything* under a roof is unreachable from every angle
there is — and once you notice that, the honest question is why there were roofs over a road at
all. Both the roofs and the fixed targets under them are gone now. What the audit enforces in
their place is that every one of the six kinds of person is reachable by a plain drop, that the
birds are slow enough to plan around, and that each street's quota is fundable from the purse,
loose enough to reach and tight enough to miss.

**Fixed**

* *Awnings could stop a coin, which is nonsense.* A canvas over a shopfront hangs above the
  *pavement*; a coin thrown into the road passes nowhere near it. They were an obstacle for the
  sake of having an obstacle, and every one of them made the throw harder without making it more
  interesting. Gone, along with the bank-shot bonus that depended on them. A test greps the whole
  class and fails the build if anything to do with an overhang comes back.
* *Pe'ah was the wrong halacha for this game.* Leaving the corner of your field standing is not
  something you can do by throwing coins at cobbles, and building a gleaner to pick them up meant
  a miss could quietly become a hit — which is exactly the opposite of the point. The mechanic is
  gone and the card stays in the gallery where it belongs. Its badge was replaced with **Into the
  Wind**, for landing twelve coins while a strong gust is blowing, which rewards the thing the
  game is actually about.
* *The birds are the only interference left*, and they are deliberately slow — about 52–84 px/s,
  a third of the slowest coin — so you can see one coming, count it, and throw around or after
  it. They arrive at street 5 and never before. The audit measures how long the fastest possible
  bird takes to cross the column it threatens and fails the build under 0.55 seconds.
* *Tzedaka Blast was punishing, and it was the wrong game for it* — a missed coin took a life,
  shook the screen and flashed it red, and a halachic line arrived in red capitals at the moment
  you had just failed. The other four games teach gently and this one scolded. Lives are gone
  entirely (there are no hearts), the shake and the red flash are gone, and the halacha now
  arrives as a quiet aside after the fact. The **SOFT / FIRM / HARD** catch-speed system went
  with it: every target just says what it is, and any coin that reaches it counts.
* *Tzedaka Blast's aim was unreadable, and then it was too helpful* — first three crosshairs
  floated at three lane depths, technically correct and impossible to interpret; then a green
  highlight that told you the exact frame to release on, which answered the only interesting
  question in the game. What is left is one dotted line showing the coin's real path and a ring
  where it lands. A test asserts that line is drawn from the same numbers the coin flies on, and
  a second test greps every method on the class to make sure nothing anywhere prompts a release.
* *Tzedaka Blast's window was a box in the sky* — first a frame hanging against open air, then a
  slab of timber with shutters and a sill and an arm the width of a leg coming out of it. Both
  were wrong for the same reason: you are one person at one window, not a set piece. The top of
  the screen is now a city skyline of lit windows, one of which is yours — a small square with a
  man leaning out and a forearm's worth of arm reaching down to the coin.
* *Every fixed target is gone.* The upstairs sills, the walled courtyard and the quiet ledges
  were furniture: they sat still while the game's whole idea is judging a moving person. Pe'ah
  survived the cut by becoming a walker — the gleaner, who asks nobody and finds what you leave
  on the road in front of him — and the community fund was already a moving cart.
* *The target used to be the man.* Any part of his body counted, which made a 100-point success
  out of hitting his hat. The target is now the opening itself — 32 to 48 pixels wide — and the
  coin's centre has to land within three pixels of going in. Anything else is a miss worth
  nothing at all, and the game no longer pretends somebody picked it up.
* *Tzedaka Blast's outstretched hands* — first drawn at head height right beside the beard, so
  close up they read as limbs growing out of the men's mouths; then, at chest height, as a
  tapering blob with a paddle on the end. The arm is now three straight segments — shoulder,
  elbow, wrist — with a cuff where the sleeve ends, and the hand is a plain open palm with a
  thumb, drawn at exactly the size of its own hitbox.
* *Menorah Keeper, the night that could not be lost* — `completeNight` graded the night, said
  **NOT FULFILLED** out loud, and then advanced to the next night anyway. A completely dark
  menorah read as a win. A grade of `none` now ends the run on the game-over screen.
* *Menorah Keeper, the night that could not be won* — every dark light called `damage()` once
  per grace period, and reset its own timer, so a single light left out drained all three lives
  by itself. Losing lights is the game; the mitzvah is judged at the bell. Dark lights now cost
  the grade and nothing else, and any night ending with at least one light burning carries.
* *Menorah Keeper, the relight nobody could perform* — three separate things had to be true at
  once and none of them were visible: you had to find an undocumented double tap, then press a
  *second* time on the shamash to actually hold it, then keep that finger down for three seconds,
  and if the cup underneath was dry it refused with a prompt that had already scrolled away. Now
  one tap picks it up, any finger down moves it, it lights on its own after 1.7s over a wick, and
  an empty cup says **FILL THIS CUP FIRST** on the cup with an arrow to its jug.
* *Tzedaka Blast collision* — every hit test was calling the shared `circleRect` helper with four
  loose numbers where it wants a rect object, so the missing fields sailed through `clamp` and
  the function returned **true for everything**. Coins bounced in mid-air off nothing. Caught by
  the test asserting the arc preview matches the real flight, which is exactly the sort of thing
  that survives a play-through unnoticed.
* *Tzedaka Blast awnings* — the awning added on street 3 sat directly across the column below
  your window, which silently killed the drop verb from street 3 onward. The audit now asserts
  the drop column is clear on **every** street, not just the first.
* *Tzedaka Blast rebounds* — a coin that bounced out of somebody's hand was landing back in the
  same hand on the next substep at its new, slower speed, so throwing too hard scored anyway. A
  coin that has already come out of a hand is now on its way to the street and nothing can catch
  it.
* *Matzah Havoc steering* — the thumb slider mapped to a narrower range than the truck's own
  clamp, so the outermost strip of road at each kerb was reachable by dragging the truck
  directly but not by the slider. Both now derive from one pair of constants.
* *Menorah Keeper rings* — at night 8 the latke heat ring (radius 40) overflowed its 68px
  column by 12px each side, and jelly globs by about the same. Harmless while the columns were
  tinted; ambiguous once those tints were removed. Both now scale to the column width.
* *Tzedaka Blast layout* — the audit asserts that every kind of recipient carries a plain
  readable name, presents a target box that is on screen, big enough to be fair, clear of the
  bottom HUD strip and clear of his own hat in all three lanes facing either way, that the
  charge spans enough flight time for leading a walker to be a real choice, that no awning ever
  stands in the drop column on any street, and that the sling-only spots really are unreachable
  by a straight drop — otherwise the second verb is decoration.
* *Shul Crossing traffic* — the stated minimum clear space between vehicles (96px) did not
  actually guarantee a safe column, since columns sit 80px apart and the player needs ~20px of
  clearance either side. In practice the rounding in the spacing maths always pushed real gaps
  above 120, so no row was ever impassable — but the guarantee was accidental. The floor is now
  140px, and a test sweeps every generated row through its whole cycle looking for a moment
  with no safe column.

**Checked and sound**

* every oil jug shares its light's x exactly, jugs never overlap, and the tap column of one
  light never reaches into its neighbour's — at all eight nights
* jelly stacks clear the flame below and the HUD above at every night, and the jug row with its
  labels stays on screen under a safe-area inset
* gusts cross in 8.0s on night 1 and 2.4s on night 8 — enough to react to, tight enough to hurt
* Kosher Sort's four bins sit on the sides its gestures claim, and grabs stay unambiguous in a rush
* Kitchen Match's 6×8 board fits on screen, three of the same side plate, and meat-and-dairy never plates
* Matzah Havoc's four lane centres all sit on the road and inside the truck's reachable range,
  and the truck's hitbox is strictly inside its drawn body

## Chapters, locks and skipping ahead

Menorah Keeper has eight nights and Tzedaka Blast has twelve streets, and both now show them
as a grid of numbers on their own start screen. Night 1 and street 1 are open from the first
run; finishing one opens the next, and nothing ever closes again. Locked chapters show a
padlock and do nothing when tapped.

Pressing **PLAY** always means "start at the beginning". Skipping ahead is something you choose
by tapping a number — the game never does it for you, so a child who just wants to play from
the start is never dropped into street 11 because somebody else got there.

How far you have reached lives in `Profile.data.reached` and is saved with everything else, so
it survives closing the app. `Profile.unlockLevel(game, n)` only ever raises the number; a test
tries to lower it and fails the build if it succeeds. A second test sets `startLevel` past what
has been earned and asserts the game refuses and starts where you actually are.

The start screen has a lot on it — four tips, a chapter grid, two buttons — and phones are not
all the same height, so the layout steps its tip text down from 22px to 17px until the last
button fits above the safe area. A test walks all five games and fails if any start screen runs
off the top or bottom, if any chip hangs off the card, or if any two chips overlap enough that
one tap could hit both.

---

## A note on the artwork

There is **no sun, moon or star anywhere in the game**. The skies are plain, with drifting
cloud banks for depth, and the Chanukah night sky has no moon. This follows the halacha
against making forms of the sun, moon and stars (Avodah Zarah 42b–43b; YD 141:4). Where a
star would have been the natural icon — Mitzvah Points, the *Baal Mitzvos* and *Mehadrin*
badges, the generic fallback — there is a **rosette** instead, and Shul Crossing's zman
marker is a **clock** travelling the arc rather than a sun. The Magen David emblem is kept:
it is a Jewish emblem, not a depiction of a heavenly body.

Nothing draws a box around a gesture either: the wind lane has no outline or bar, only the
chevrons, the drawn arrow and a gliding ghost hand showing which way to sweep.

A test guards this so it cannot creep back: it asserts the starfield module is gone, no sun,
moon or star icon shapes exist, and no card or badge references one.

Everybody on the Tzedaka Blast street is dressed the same way: a long coat, sleeves to the
wrist, a hat. Only the face and the hands show — and the hands have to show, because the hands
are the target.

The five boys who squirt the sufganiyah jelly are dressed b'tznius — long sleeves with only
the hands showing, collars, and a shirt colour that is asserted in the tests to be clearly
distinct in luminance from every skin tone, so none of them can ever read as bare.

## The educational engine

* **50 flash cards, written for a child.** Every card tells the halacha as a short story or a
  surprise rather than a ruling — *"Surprising one: the mitzvah happens at the moment you
  light"* — and carries its primary source (Gemara / Shulchan Aruch / Mishnah Berurah) so it
  can be looked up. Cards prefer ones the player has not read yet before cycling.
* **A glossary band on every card.** Kids cannot learn from a card that uses a word it never
  explains, so every Hebrew term on a card gets its own teal-ruled line underneath in plain
  English — *dei machsoro — "enough for what he lacks", you fill THIS person's gap* — and the
  card grows to fit however many it needs.
* **35 Knowledge Badges.** Awarded for in-game choices that *mirror* the halacha — keeping
  every light burning a full night, blocking ten gusts, twenty correct kashrus calls in a
  row, reaching shul before the zman with your hat still dry, and so on. Each badge unlocks
  its card permanently in the **Halacha Gallery** on the main menu.
* **Nothing lectures you mid-throw.** Banners during play introduce a new kind of target and
  otherwise stay out of the way — no Hebrew, no citation, no sermon, and nothing at all when a
  coin misses or scores less than it could have. The score says that by itself. The teaching
  waits for the card at the end of the street, where the player is not busy.
* **Teachable mistakes.** A wrong bin in Kosher Sort names the food. In Kitchen Match, meat
  and dairy swap freely but never vanish as a plate. Overloading the top shelf is a kitchen fail.

All halachic content is summary-level and cites its source; it is for learning, not for
deciding a practical question — that is what a rav is for.

---

## Code map (`index.html`)

| Section | What lives there |
|---|---|
| 1 · Config / math | Logical 720×1280 stage, fixed step, colour system, math helpers |
| 2 · Storage | Memory-first store; `localStorage` is a best-effort mirror, so the game runs in private mode and sandboxed webviews |
| 3 · Profile | Mitzvah Points, badges, cards read, per-game high scores, option flags |
| 4 · Haptics | Single `Haptics.fire` funnel — the one place a native shell overrides |
| 5 · Sound | Procedural WebAudio: oscillator SFX, band-passed noise, and three chiptune niggun loops. No audio files |
| 6 · View | DPR-aware canvas, locked aspect with letterboxing, safe-area insets converted into game units |
| 7 · Input | Pointer/touch/mouse + keyboard. Emits `down / move / up / tap / swipe / multiswipe` with velocity and trail |
| 8 · FX | Particles, floating score text, slash trails, screen shake, colour flash |
| 9–11 · Draw / Icons / UI | Rounded rects, text wrapping, meters, flames, 26 vector icons, touch buttons with generous slop |
| 12 · Halacha | Card and badge database |
| 13 · Game core | State machine (`MENU / GALLERY / INTRO / PLAYING / PAUSED / HALACHA_POPUP / GAME_OVER`), HUD, toasts, badge awards, fixed-timestep loop |
| 14 · MiniGame base | Score, lives, combo, damage, level interstitials |
| 15–16 · Screens | Menu, gallery, intro, pause, flash card, game over |
| 17–20 · Minigames | One self-contained class each |

### Extending it

* **A new card:** append to `Halacha.cards` with `{ id, game, icon, title, hebrew, body, source }`.
* **A new badge:** append to `Halacha.badges` with `{ id, game, name, icon, card, how }`, then
  call `this.award('id')` from wherever the player earns it.
* **A new minigame:** subclass `MiniGame`, implement `reset / update / render / handle`
  (plus optional `renderHud` and `stats`), add it to the `GAMES` array and to the constructor
  map in `Game.startGame`. A separate full game (like Camp Kosh) is an `external`
  tile that asks the Play tab host via `mitz://game/…` instead.

---

## Verified

Automated Playwright pass against headless Chromium — 158/158 behaviour checks, zero console
errors, steady 60 FPS across 30-second endurance runs per minigame:

* every gesture path (tap, double-tap, swipe in four directions, drag-and-hold, drag-steer,
  two-finger combo, repeated tap)
* Menorah Keeper's full rule set: every hazard live on night 1 and every timer ramping to
  night 8, jug-to-light alignment, one gust sputters / two put it out, swiping against the
  wind reversing a gust (and a reversed gust no longer harming anything), swiping the wrong
  way being refused with a hint, twin gusts from both sides, dark wicks never relighting
  themselves, an empty cup refusing a flame *and saying so on the cup*, one tap lifting the
  shamash while a double tap does not lift-and-drop it, the drag-and-hold relight, two
  jelly globs being safe where three douse the flame, a latke flung off in time versus a cup
  cracking for good, the cat and the moths appearing only from their own nights, a hard gust
  needing two swipes, and all four halachic night grades
* the twin-gust regression specifically: two gusts of one wave sweeping the whole menorah
  leave every flame sputtering and **none** blown out, a later wave does put one out, and no
  wave takes more than two lights whatever it passes over
* pacing: the first hazard lands inside two seconds, and wind speed / jelly frequency both
  ramp hard from night 1 to night 8
* what sputtering costs: the accelerated burn rate, the flame dying when its ring runs out on
  an otherwise full cup, and pouring steadying it instantly
* text fitting: long toast copy wraps inside its panel, in-game prompts wrap, and single-line
  labels shrink and slide inward rather than run past the edge of the stage
* Shul Crossing: a kosher truck carries you while a treif truck flattens you, the food lane
  stays rare, and — the corner regression — a truck that carries you off the kerb sets you
  down one square inward with a beat of grace, so nothing can pick you straight back up in a
  loop, while a ride after the grace lapses still scores exactly once
* Kosher Sort: covered dishes refuse a swipe until tapped open, the dish you grabbed is the one
  that moves, and the Kashrus Rush speeds the belts and doubles the score. Twelve named belt
  shifts, shift-12 victory
* Kitchen Match: matching is three of the same side — meat with meat, dairy with dairy, pareve
  with pareve. Meat and dairy never vanish as one plate. Fish matches fish. Treif and mixed
  flick up. Kashrus Rush speeds the rise.
  Twelve named shifts, quota to card, shift-12 victory, overload knocks the top two rows off
* Matzah Havoc hitboxes: chametz on the body counts, chametz beside, above or already fallen
  past the truck does not; the same for yeast clouds and for traffic in an adjacent lane
* the night-8 boss end to end: the fake victory before he arrives, the gift box opening and
  blowing out every light, a sliced sufganiyah sending both halves home for damage, five blobs
  smothering you, the lunge repelled and the lunge missed, the Pach Shemen appearing at zero HP,
  and the run ending on a **victory** screen — gold ribbon, badge, all nine relit — rather than
  a failure one
* the relighting halacha: card m2 carries the ruling that you are *not* obligated to relight
  along with the game's own aside, and the Pach Shemen card exists
* Tzedaka Blast's two verbs and every giving situation: holding still aims a drop whose meter
  really is the fall speed, pulling back slings away from the pull, **both the dotted line and
  the arc are drawn from the same numbers the coin flies on** rather than separate drawings that
  could quietly disagree with it, and nothing anywhere on the class prompts a release; giving to
  the bashful one while watched scoring a third of the usual with a soft note rather than a
  penalty, and giving unwatched paying the most; serving the out-of-towner while a local waits
  scoring less and naming *aniyei ircha kodmin*; somebody walking off unhelped costing the streak
  and nothing else; words from an empty purse counting as not leaving him empty; a coin in the
  road scoring nothing and staying missed; the loan costing three, setting him up and paying
  itself back; nothing overhanging the road at all; a quick tap shooing a bird
  while a charge held over one still throws; and the Purim street dropping the priority rule and
  doubling the score
* **that Tzedaka Blast cannot hurt you**: a test walks every method on the class and fails if any
  of them calls `damage`, `FX.shake`, or a red `FX.flash`, and asserts the game shows no hearts
* scoring, combos, strikes, life loss and the mistake hints
* level interstitials and the return to play from a flash card
* badge unlock, toast and profile persistence to `localStorage`
* **a render smoke pass**: every game is stepped through all eight of its levels with several
  frames drawn at each, plus a pause and a resume, and the check fails on any thrown error. This
  was added after the screenshot script caught a call to a deleted draw function that the whole
  behavioural suite had sailed straight past — behaviour tests poke at state, and a scene can be
  perfectly correct and still throw the moment somebody looks at it. It has since caught two more
  of exactly that kind
* **a duplicate-definition guard**: the built file is scanned for any `Class.prototype.method`
  assigned twice. A bad edit had left an 880-line stale copy of half a module further down the
  file, and since a later assignment silently wins, every fix in the newer copy would have been
  inert — the kind of thing that produces hours of *"but I changed that"*
* the five-game menu: the odd game out takes the full width instead of leaving a half-empty row,
  and nothing lands underneath the gallery button or the toggles
* portrait ↔ landscape resize, letterboxing and safe-area handling
* bounded memory: particle, entity and world-row pools all stay flat over long runs

Run it yourself with `node qa2.js` (needs `playwright`).

---

## Debug surface

`window.MitzvahDash` is exposed for native shells and QA:

```js
MitzvahDash.start('tzedaka')  // jump straight into a minigame
MitzvahDash.menu()            // back to the main menu
MitzvahDash.resetProfile()    // wipe points, badges and high scores
MitzvahDash.game.state        // current state machine node
```
