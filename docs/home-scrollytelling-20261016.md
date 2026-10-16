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

## Character story extension

The approved scroll-only homepage is separately preserved on
`backup/home-scroll-story-20261016`, commit
`3629ce8f87ae642117cb9d7f1d0c64fb4e429512`.

The new protagonist is Ahmed, an explicitly illustrative applicant (not a real
customer testimonial). Six first-person captions follow the same steps. The
first scene visibly enters a company name and example.com email, then shows the
user's files. Later scenes show preferences, drafting, review, channel choice,
and follow-up. The three consistent character poses change with the scenes;
UI cursor/typing effects use the existing reversible scroll playhead.
Static-mode chapters retain the first-person story as blockquotes.

Character asset: `public/assets/characters/ahmed-poses.webp`, 1152×768 RGBA WebP,
about 61KB. Generated using the built-in Imagegen tool, then encoded for the web.
The sprite is decorative and contains no text; all text is localised HTML.

Generation prompt: illustration-story; transparent three-column pose sheet of
the same friendly Egyptian young man, short dark curly hair, warm olive skin,
forest green overshirt and ivory tee, polished editorial 2D SaaS infographic;
left typing behind a mint laptop, centre reviewing thoughtfully with hand at
chin, right giving a small thumbs-up. Equal columns, same scale, no labels,
letters, logos, UI or watermark. Forest-green, mint and cream palette.

Manual browser checks: portrait should stay separate from message text at
320/360/390/768px, poses switch in forward and reverse scroll, English captions
fit, static mode retains the story, light/dark backgrounds preserve cutout alpha.
