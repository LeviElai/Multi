# MULTIGAME arcade upgrade

## Preservation and release
- Existing quiz IDs, mode IDs, owner accounts, scoring and persisted versions are retained.
- Pre-change Git backup: backup-before-arcade-upgrade-20261017.
- No schema migrations or private-to-public conversions.
- Word mode is now publicly Guess; numeric fermi mode is Estimate. Internal IDs are unchanged.
- Count public question projection no longer exposes fillTarget. Knowledge-question answers remain secret.
- Counts remain server acknowledged. Visual candy physics never determine a score.

## Reference to implementation
| Reference | Actual inspection | Resulting design |
| --- | --- | --- |
| Magnitudle Size It Up | Opened live puzzle, locked a round, observed 75/100 and comparison/next-round controls. No full five-round completion. | Stable reference and camera; drag/pinch and accessible slider; truth outline comparison; clearer pixel silhouettes. |
| Amountle | Opened Fill introduction, started tutorial, used Space to drop; saw target, hold-to-pour instructions and ten-second clock. Did not finish full mode. | Tap/hold with elapsed-time rate, accepted-only candy animation, explicit lock, no target leak for knowledge questions. |
| Krillion | Started descent; saw timed category prompt and timeout result. Did not complete seven prompts. | One answer; actual room rarity; accepted groups and names; ocean setting. No invented worldwide rarity or player data. |
| Fermi | Read official instructions, submitted 25,000 in a live round and observed the answer/reveal and too-high feedback. | Large numeric input, K/M/B parsing, optional private scratchpad, too-high/low comparison and positive-only multiplicative error. |
| Wordle | Browser safety gate blocked access. No workaround attempted and no claim of live play. | Existing multi-guess deduction, duplicate-letter feedback and author-configured word validation retained; pixel tiles and touch-key feedback improved. |

## Visual system and route audit
Six original code-authored SVG environments replace painted backgrounds on home, join, intros, practice and live stages. SVG shapes use a fixed pixel grid and crispEdges. The old raster files remain for history, but those scene surfaces use /art/pixel/.
Shared app/arcade.css applies textured opaque panels, squared controls, inset highlights, physical press states, readable feedback and mobile layout across creator, library, auth, utility, lobby, game, modal, error and result surfaces.
Existing PixelSprite mode artwork is canonical across home, mode pickers, creator round list/header, saved mixed-mode cards, live headers and intros. Arbitrary text glyph replacements were removed from these uses.
Interim navigation is Answer and Placements. The final ceremony groups actual ranks, supports ties and uses original pixel characters, podium rises, limited confetti and an original fanfare. Reduced motion disables decorative animation.

## Sound
Web Audio square/triangle cues are original synthesis. No remote audio or tracking.
Audio cannot start before pointer/keyboard interaction. Header and live sound controls persist mute, synchronize within the page and immediately cancel scheduled notes. Hidden documents stop sounds.
Actions have distinct cues: click, letter, pour, size snap, lock, invalid submission, last-five-seconds, reveal and final fanfare.
No music or long animation blocks controls.

## Random play
Existing creator quizzes are private, including published versions. They are never exposed by random play.
The eligible public pool is therefore empty. /random honestly labels MULTIGAME starter quizzes and their author, avoids immediate repeats, respects each selected starter's mode order, runs actual gameplay/scoring with one local player, and creates no multiplayer room.
Public community publishing/discovery is not introduced in this release.

## Validation
94 unit/integration tests pass, including audio lifecycle and Count answer secrecy.
Two ten-player HTTP/Socket.IO end-to-end tests pass, including process recovery and origin rejection.
Browser checks and production release evidence are recorded in the delivery report. Automated checks do not establish whether real groups find the games fun.
