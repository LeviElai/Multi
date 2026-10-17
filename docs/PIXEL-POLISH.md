# Pixel arcade polish — 18 October 2026

The navy, cream, pastel surfaces, pixel fonts and original low-resolution SVG worlds
are preserved. No generated bitmap backgrounds, game engine download, new paid
service or AI inference call is introduced.

## Shipped behavior

- Full-width homepage scenery; matching AI/sample creator cards; first four quiz
  icons plus an accessible +N indicator instead of clipped icons.
- Compatible game cards with animated examples, Preview and Change. Small quantities
  favor Count/Stack with variety; 206/999 favor Draw; semantic years/codes favor
  Crack; measurements and other large quantities favor Estimate. Missing choices
  remain incomplete drafts rather than an unofficial playable Answer mode.
- Claw uses one board coordinate space and explicit drop/grab/lift/return/release/
  complete phases. A capsule stays attached to the gripper throughout its lift and
  return. Held directional controls and Space/Enter use the same submission path.
- Drop uses deterministic circular collision bodies, aspect-correct peg positions,
  restitution, gravity and a physical divider preserving the chosen answer side.
  Ball and pegs remain circular on non-square boards; impacts produce quiet feedback.
- Sling launches from the actual pulled position with a shared ballistic equation
  for guide and flight, elastic snap, forgiving target assistance, impact animation
  and exactly two targets for True/False. Keyboard alternatives remain available.
- Fish has animated tails/fins, layered coral/rocks/seaweed/bubbles, forward swimming,
  captured-pointer selection, readable answer names and a reviewable catch basket.
  New multi-answer rounds store selectionScoring=balanced-v1 in existing JSON config.
  Score = round(1000 * max(0, correctCaught / correctTotal - wrongCaught / wrongTotal)).
  Selecting everything earns zero. Published rounds without this policy retain exact
  set matching. Correct catches, missed fish and wrong catches are distinguished.
- Draw retains original strokes, confirms a read-only recognition and supports redraw.
  Added common closed-loop/straight-stem 9 and rectangular 0 templates after real
  browser handwriting exposed a 9-to-1 recognition failure. Recognition stays local.
- Stack has correct proportional drag positioning and practical denomination buckets.
  Crack supports direct digit dragging alongside keyboard and mechanical buttons.
  Count tap/hold/stop, Estimate entry, Guess repeated-letter feedback and stable Size
  resizing were played and retained. Existing detailed original stages remain intact.

## Verification

- TypeScript passes; 181 unit/integration tests and 3 service end-to-end tests pass.
- Real HTTP/WebSocket session: three independent player credentials, thirteen rounds
  (all eleven modes plus boolean Sling and multi-answer Fish), 11,001 points for the
  correct players, ties, privacy, replay/idempotency, reconnect and 90 socket events.
- Browser: entered a new question, verified Draw for 206, changed to Estimate, saved,
  previewed, added multi-Fish and boolean Sling, published privately, hosted and joined
  through the public join UI. Host and guest finished with identical 2,500-point
  results. A separate partial Fish catch earned 500 and revealed the missed fish.
- All eleven actual controls were operated: tap/hold Count, Estimate input, Guess
  keyboard, Draw strokes/read/confirm/reveal, Size drag, Claw movement/drop, Drop,
  Sling backward drag/release, Fish catch, Stack physical placements and Crack dial.
- Browser trace recorded all six Claw commit phases in 60 samples. Twenty-six held
  frames maintained the same 27-pixel capsule-to-gripper offset; no detached lift.
- Actual pointer-drawn 96 recognized correctly, submitted and showed its original
  strokes with an exact-match 1,000-point reveal. Guess handled repeated ROTOR letters
  correctly before solving ORBIT. Size reference transform stayed unchanged on drag.
- 33 fully loaded game layouts checked at actual widths 320, 390 and 1280. No document
  horizontal overflow. Screenshots and traces are in the task outputs directory.
- Eleven-mode sample creation and +7 icon overflow indicator checked in the browser.

## Limits of the verification

The available browser tool provides mouse/keyboard input and responsive viewports,
not physical touch/stylus hardware. Host and guest UI clients use separate roles/tabs
in one available browser profile; three isolated HTTP credentials provide additional
multiplayer coverage. No external human playtest or universal handwriting accuracy
is claimed. Messy, connected or overlapping digits may still require redraw; the
recognized number is never silently submitted. No paid generation was used in QA.

## Technical references

Original art and mechanics; no third-party assets copied. Reviewed circle/peg
collisions and restitution in [The Coding Train Plinko example](https://thecodingtrain.com/tracks/physics-libraries/62-plinko-with-matterjs/),
[Phaser pointer input](https://docs.phaser.io/phaser/concepts/input), and
[finite-state patterns](https://gameprogrammingpatterns.com/state.html).
