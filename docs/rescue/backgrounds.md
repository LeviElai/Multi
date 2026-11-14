# Page worlds — 2026-11-04

Evidence: frame at 2 seconds of `ScreenRecording_11-04-2026 00-01-29_1.mp4` (4.3 seconds) shows homepage plaza ending beneath the legal footer, with a navy tail filling the remaining phone viewport. This is a background coverage defect, not evidence of a narrow CSS width.

Changes:
- `PageBackdrop` is the single fixed viewport background owner, independent of document height; body establishes its stacking context. Home uses `100dvh`, retains existing plaza artwork, and no longer paints a second page-height background.
- Daily uses the existing star scene, archive/community/library existing library artwork, account/login existing workshop artwork. Quiet four-pixel glimmers use stepped animation and stop for reduced motion. Active gameplay retains its own opaque game scene.
- Join uses a new low-detail 320×200 harbor SVG derived from the existing blue/teal/parchment palette. Rectilinear moon, lights, hills, water, and docks use coherent coarse pixels.
- Join uses the same Header and Footer as other pages. Its compact single form replaces separate brand, home backlink, and duplicated legal links.

Validation: `npx tsc --noEmit` passed. Rendered visual acceptance is **pending**: root must inspect Home at short/tall phone viewport sizes and after scrolling, Join code/name/error/keyboard states, and the Daily/archive/library/account backgrounds at mobile and desktop sizes. This implementation has not yet been accepted as visually finished or verified in production.
