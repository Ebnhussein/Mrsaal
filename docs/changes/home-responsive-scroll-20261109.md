# Responsive homepage story — 9 November 2026

The homepage card now sizes and pins below the measured header and above the
mobile bottom navigation. The reading line uses that pinned position, and each
chapter provides enough scrolling space for the complete card to pin. Scene
changes remain reversible and scroll updates use requestAnimationFrame.

- ResizeObserver, visual viewport resize and font readiness refresh the geometry.
- Captured scroll events also update the story inside a scrolling ancestor.
- The homepage no longer clips the ancestor of the sticky card.
- Miniature message paragraphs inherit the scene typography instead of the
  public page's larger paragraph font. Tablet scenes use the compact artwork.
- When there is insufficient vertical room, each chapter displays its own
  illustration and counter in a natural-height inline card. Reduced motion and
  the manual static mode use the same layout, so no frozen first card accompanies
  unrelated text. Resizing back restores the pinned experience without reload.
- Both homepage asset URLs are versioned for cache invalidation.

## Validation

`npm run check`

`node --test tests/home-story.test.cjs tests/home-faq.test.cjs tests/website.test.cjs tests/website-bilingual.test.cjs tests/site-motion.test.cjs tests/public-auth-pages.test.cjs`

`node tests/browser/home-story-responsive.cjs` (requires Playwright and Chromium)

The browser suite checks 17 viewport sizes in both languages (320×480 through
2049×926, including tablet breakpoints and 1280×480), all six scenes forwards and
backwards, card/text synchronization, navigation clearance, scene content bounds,
inline cards, horizontal overflow, repeated rotation/resizing, reduced-motion
changes, script-free fallback and JavaScript console errors.

A locally installed browser can be selected with
`PLAYWRIGHT_CHROMIUM_EXECUTABLE`; additional runner-specific launch flags can be
supplied as a JSON array in `PLAYWRIGHT_LAUNCH_ARGS`.
