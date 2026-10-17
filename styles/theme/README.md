# Theme styling modules

The previous monolithic `themes-global.css` stylesheet has been divided into four smaller files, loaded **in this exact order** by `index.html`:

1. `theme-foundation.css` — base theme variables, MDT layouts, product editor, role and permissions styling.
2. `theme-header.css` — personal header effects, layout, receipt and sidebar appearance.
3. `theme-effects.css` — selectable animation cards and header effect combinations.
4. `theme-features.css` — themed dashboard, security, offers, loyalty and employee controls.

All four files were split directly at existing CSS comment boundaries. At extraction time, their concatenation **exactly matched** the content of the previous `themes-global.css`, in original cascade order. No selector, declaration or animation was intentionally changed.

## Updating styles safely

- Prefer editing the module that owns the feature. Avoid new duplicate overrides in another stylesheet when possible.
- Keep the four links in the order above; later declarations may intentionally override earlier rules.
- Run `node scripts/check-static-site.mjs` to verify the active assets and ordering.
- For historical comparison only, `node scripts/check-static-site.mjs --verify-original-theme` confirms whether the current four modules still reconstruct the original CSS bytes. It is expected to fail after **intentional** future theme changes; this optional flag is not used by CI.
- Browser-test light and dark palettes, custom colors, active navigation, modals, checkout, and mobile layouts after significant CSS edits.

No new build system or bundler is required. GitHub Pages serves these files directly.
