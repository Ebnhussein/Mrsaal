# Homepage scroll story — 16 October 2026

## Saved version

The complete pre-change version is preserved at GitHub branch
`backup/home-before-scrollytelling-20261016`, commit
`f9b33f46ca0cdd5fcedaa42be321e1bc7b8777cb`.
Do not reset production/main to that branch after unrelated updates. To undo only
this homepage change, revert the homepage story commit in Git, then deploy.

## Scope

Only the public homepage changes. Other public pages, authentication, the tool
and admin dashboard keep their existing behavior. The current public navigation
shell and footer are retained.

- `utils/home-story.js`: bilingual copy, six illustrative workflow scenes, links,
  guides, FAQ and signup call to action.
- `public/assets/home-story.css`: scoped light/dark, desktop/tablet/mobile layout.
- `public/assets/home-story.js`: scroll playhead, reversible scenes and progress.
- `utils/stitch-render.js`: homepage integration and versioned local assets.
- `tests/home-story.test.cjs`: actual forward/reverse behavior, static fallback,
  user motion toggle, bilingual content and route integration.

The experience uses DOM elements, not a video. Native page scrolling remains
available; no scroll hijacking, remote animation library or continuous timer.
Scroll updates are batched with requestAnimationFrame. Motion is optional;
without JavaScript, reduced motion, or a viewport <=520px tall, text steps remain
readable without a long pinned sequence. Illustrative scenes are aria-hidden;
all explanatory text remains accessible in the six chapters. No fake delivery
or read guarantees; company data is supplied by the user.

## Verification

Project syntax/assets check and 27 targeted tests pass. Browser rendering was
not available in the editing environment. After deploying, verify:

1. `/ar/` and `/en/`: six steps, correct language and signup destinations.
2. Scroll down, then back up: scenes and progress return to the same point.
3. Light/dark mode and 360px, 768px, 1440px widths: readable cards, no sideways scroll.
4. Mobile browser address-bar resize and landscape: usable native scrolling.
5. OS reduced motion and manual static toggle: every chapter remains readable.
6. Skip journey, guides, FAQ and both signup buttons work with keyboard/touch.
7. Sign in, plans, product, help and the tool keep their prior layouts.
