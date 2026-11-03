# Design direction and independent audit

## Evidence and acceptance status

Independent review: 2026-11-03, source 56fa3b0. Root previously inspected live desktop production 8881c5. The reviewer inspected the stored `docs/evidence/20261031/home-390.png` rendering and the supplied user captures: these are **historical baseline evidence**, not current production screenshots. The pinched full-page image does not establish a CSS width defect.

No new rendered candidate has passed independent review. This child has no CUA browser surface; the managed environment has no installed Chromium executable. Root reports that the candidate preview at terminal.local:4173 is refused by its browser. This is an unresolved preview-access limitation, not evidence the product is broken. Do not call desktop captures mobile evidence or infer successful touch interaction from bounds tests.

## Ranked findings

| Severity | Evidence / cause | User consequence | Required correction and proof |
|---|---|---|---|
| High | Historical 390px home puts Daily, duplicate brand/title, large join form, slogan, and host panel in sequence | Host unavailable in initial viewport; unclear two main choices | Two-destination home. Capture at 390×844 and 320×568, 100% zoom; Daily and Friends visible without scroll at normal text size |
| High | Current Home.tsx still composes DailyEntrance, full JoinForm, hosting panel and eleven-game accordion | A header fix alone retains the poor page architecture | Move code entry to Join, gallery to Quizzes; one Friends group with Join/Host actions |
| High | app/layout imports fourteen style layers; Daily CSS repeats page/calendar/game rules and arcade board `!important` overrides | Import order controls layout; fixes regress other screens | Migrate component ownership into scoped modules, remove superseded selectors as each screen moves |
| High | Daily currently has timer-centric shell; numeric/word modes can become plain forms | Product still feels like a timed quiz despite five mode IDs | Show actual interactive stage and progress; a clear timer for the restored speed bonus. Demonstrate every selected mechanic in a full five-game run |
| High | Current DailyArcade hardcodes Size comparison to Earth and some labels/units | Content may not match the visual comparison | Validate every content-to-mechanic pairing; test max, units and long questions |
| High | User supplied Account failed-load screenshot | Account failure cannot be fixed through appearance | Reproduce persistent session and network failures separately from visual QA |
| Medium | Old mobile header squeezed logo, sound, library links; old footer repeated logo/account | Navigation competes with content | New Navigation.module.css is a reasonable structural fix; reject if any competing menu remains at another edge |
| Medium | Parchment nested inside parchment across account, ranking and entry | Borders dominate content and reduce usable space | One decorated outer surface per task; use simple separators inside |
| Medium | Empty archive/loading book is drawn before tiles arrive | Looks broken while fetching | A short explicit skeleton/state in content-sized region, then stable tiles |
| Medium | Dense pixel font used for long text or very small labels | Poor scanability and legibility | Pixel font only for short headings/numbers, readable body font for questions and labels |

## Alternatives evaluated before implementation

These are structural alternatives, not accepted rendered designs. Render both Home alternatives using the same assets before the final choice.

| Screen | A | B | Recommendation and tradeoff |
|---|---|---|---|
| Home | Illustrated menu: Daily feature with Play, reset and compact own-rank; Friends group with Join and Host; one top navigation | Arcade cabinet: two equally sized Daily/Friends destination tiles; selecting Friends expands Join/Host | A. Daily remains the focal point, multiplayer remains immediate. B is compact but introduces another interaction and two equal focal points |
| Daily entry | Five small mode badges across a quest ticket, large Play, short standings below | Map path with five nodes and current-day illustration, Play at destination | A. The modes communicate variety without a tutorial. B adds atmosphere but is slower to scan and harder at 320px |
| Login | Single compact player-card form, sign-in/register switch, visible labels | Illustration beside a narrow form, with image removed/reduced on phones | A on mobile. B only on wide desktop if the existing art adds useful balance. No viewport-height parchment |
| Game frame | Compact progress header, question, flexible interactive stage, fixed control dock; feedback inside transition | Wide desktop stage with side question/control rail, collapsing to A on mobile | A mobile and B desktop. Consistent control location without shrinking the stage to arbitrary fixed heights |

Home target composition at 390×844: header approximately 96px, outer padding 12px, Daily approximately 220px, Friends approximately 130px, discreet legal links. These are prototype budgets, **not fixed CSS heights**. At enlarged text, permit menu scrolling rather than clipping. Gameplay has a stricter essential-controls viewport constraint and requires specific compact treatments for keyboard states.

## Common design rules

- Preserve existing sky/island artwork, handmade game sprites, wood borders and parchment. Do not introduce new smooth illustration families.
- Tokens: ink #244758, parchment #fff1d1, gold #ffd37b, sky #bfe5ec, teal #397d79, wood #76543c. Verify contrast per actual pair before approval.
- Spacing: 4, 8, 12, 16, 24, 32px. Outer mobile inset 12–16px. Form row gap 12px. One border treatment per hierarchy level.
- Main action gold, secondary action neutral parchment, tertiary plain text with visible focus. Do not style all links like primary buttons.
- Product touch targets ≥44×44px; retain visible focus, native labels, password-manager attributes, and reduced motion.
- Short stepped transitions around 150–250ms; result reveal up to 400ms. Animations must not delay input or move essential controls. Decorative motion respects reduced-motion preference.
- Sprite coordinates snap to integer scale when practical. Circles/projectiles retain pixel silhouettes and aspect ratio during movement.
- Loading is bounded and content-sized. One status message, one recovery action. No repeated identical loading copy.
- Error feedback preserves typed data and session. Success feedback belongs to the relevant action/round; never show old answer feedback beneath a new question.

## Visual gate (reviewer can reject)

For Home, Login/Register, Profile, Daily entry/play/result/leaderboard/archive, Community, Create, Join/Host and all modes: capture initial and populated state at 320×568, 390×844 and 1440×900; include full page for menus and viewport captures during play. Include keyboard-open input modes, longest supported names, long questions, and empty/error/reconnect states.

Reject if: any essential control clipped/overlapping; unexplained large blank panel; duplicate primary navigation; primary actions below normal first mobile viewport unnecessarily; nested decorations obscure hierarchy; unreadable labels; inconsistent sprites; stale feedback; unintended horizontal scroll. Record the actual defect and screenshot, not an invented design quality score.

Bounds tests must include clipping ancestors and element overlap, not just bounding rectangles inside the window. Assert document horizontal overflow separately. A test pass does not prove enjoyment: independently play each mechanic, record confusing interactions, and distinguish synthetic QA from human playtesting.

## Research basis

W3C WCAG 2.2 Reflow explains the 320 CSS-pixel reference and preserving information/function without two-dimensional scrolling: https://www.w3.org/WAI/WCAG22/Understanding/reflow.html . This supports reflow checks, not a universal prohibition on vertical scrolling. The no-scroll active-game requirement is MULTIGAME's product constraint.

W3C target-size criterion uses a 24px minimum with exceptions; MULTIGAME intentionally adopts the larger 44px product target for touch play: https://github.com/w3c/wcag/blob/main/understanding/22/target-size-minimum.html . Do not falsely claim a 44px minimum is WCAG 2.2 AA's universal rule.

Additional primary references checked 2026-11-03:

| Source | Decision and verification consequence |
| --- | --- |
| [W3C Animation from Interactions (SC 2.3.3, AAA)](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html) | Disable nonessential interaction motion when reduced motion is requested. Keep core physics feedback when it conveys essential state; replace ornamental camera movement, bouncing panels and long score flights with an immediate state change. Verify both motion settings. This is adopted product guidance, not a claim of overall AAA conformance. |
| [web.dev: large, small and dynamic viewport units](https://web.dev/blog/viewport-units) | Size the gameplay frame against the available mobile viewport, not an assumed `100vh`. `dvh` handles expanding browser UI but does not automatically solve virtual-keyboard overlap, and updates may be throttled. Test browser bars and keyboard-open numeric games separately; do not mark mobile Safari passed from a fixed desktop viewport. |
| [Microsoft Xbox Accessibility Guideline 107: Input](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/107) | Avoid repeated button presses and provide simpler alternatives to sustained holds or drag-only controls. Fishing's single catch attempt follows this direction. Stack/Slingshot should expose equivalent discrete controls where practical, with the same authoritative outcome rules. Inspect cancel/release behavior and accidental activation interactively. |

These are standards explanations, browser implementation guidance and platform game-accessibility guidance, not experiments establishing that a particular layout is enjoyable. The two-card menu choice still requires rendered comparison and actual playtesting.

## Independent rendered review: candidate desktop, 2026-11-03

Actually inspected `/workspace/scratch/multigame-candidate-home-desktop.jpg`, `multigame-candidate-profile-desktop.jpg`, `multigame-candidate-login-desktop.jpg`, and `multigame-candidate-daily-desktop.jpg`; compared Home with `multigame-baseline-home-20261103.jpg`. Candidate link supplied by release owner: https://multigame-heasglleu-levi-6fe6.vercel.app/ . These captures represent a partial candidate; legacy ten-question backend copy is excluded from composition judgments. No mobile pass is implied.

| Screen/state | Verdict | Evidence and correction |
| --- | --- | --- |
| Home desktop | Needs revision | Single navigation and two action groups substantially clarify the baseline. But Friends card starts about 20px above Daily and ends about 20px below, with three sprites and a stronger title; it draws attention away from Today. Align card edges and heading/action baselines where useful. Restore the existing globe or actual daily-mode art to Daily. Do not add fixed empty panel height simply to fill the sky. |
| Profile, signed out | Composition accepted for this state | Content-sized card, integrated avatar, clear account and guest actions. Background landscape is intentional surrounding space, not an empty content panel. Signed-in editing, errors and mobile remain unreviewed. |
| Login, initial sign-in tab | Composition accepted for this state | Compact centered card; clear tabs, field labels and primary action; existing sprite integrates the form. Low-contrast footer needs the already-planned correction. Registration, validation, recovery and keyboard/mobile states remain unreviewed. |
| Daily landing, empty leaderboard | Needs revision | Broad parchment sheet contains a narrow left-aligned title/action cluster and uncomposed empty space on the right. Use the existing globe or five mode badges as deliberate illustration; tighten action/countdown grouping. Remove redundant Home backlink when primary navigation is present. Prefer a readable localized date. Keep empty standings compact until real rows exist. |
| Community | Not reviewed | Supplied screenshot path was absent at inspection; do not infer visual quality from source. |

The desktop Home's large sky region is not automatically a defect; test shorter windows before changing it. Avoid turning intentional background into another oversized card. Current captures do not establish focus behavior, contrast measurements, responsive fit, gameplay comprehension or enjoyment.
