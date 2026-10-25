# Green Wonderland POS & MDT

Green Wonderland's point-of-sale and management dashboard. This is a **static JavaScript website** hosted from the repository root on GitHub Pages, backed by a **live Supabase project** for employee PIN sessions, checkout, sales, loyalty, products, offers, and administrative functions.

## Start here

- **`index.html`** — the deployed entry point. Its stylesheet and script references determine what loads in production.
- **`app-pos-upgrade.js`** — the active POS application, catalog, cart, receipts, and checkout UI.
- **`phase4-pos.js`** and **`pos-deals.js`** — offer pricing, loyalty checkout support, and the Bundles & Deals POS section.
- **`employees.js`**, **`business-mdt.js`**, **`mdt-insights.js`**, **`phase4-management.js`** — management and reporting screens.
- **`help-guide.js`** and **`help-guide.css`** — public searchable How to Use page, accessible from the sidebar or by appending `#help` to the site URL. No PIN or additional database setup is required.
- **`branding.js`** — logos, favicon, image slots, and related branding controls.
- **`styles.css`**, **`pos-storefront.css`**, **`styles/theme/`**, and **`ui-polish.css`** — base styling, POS presentation, modular theme overrides, and a final shared layer for accessible controls and consistent cards. See [theme styles](styles/theme/README.md).
- **`config.js`** — public Supabase client configuration. **Never put a service-role key, database password, or other secret here.**
- **`supabase/functions/`** — Supabase Edge Function source.
- **`supabase/sql/`** — SQL migrations, patches, and historical setup scripts. See [SQL guidance](supabase/sql/README.md).
- **`archive/legacy-pos/`** — preserved superseded POS application versions; not used by the active `index.html`.

## Validate before merging or deploying

Run this from the repository root using Node.js 20 or newer:

```bash
node scripts/check-static-site.mjs
```

This checks local assets, external and inline JavaScript syntax, duplicate page IDs, versioned asset URLs, and final stylesheet order without installing packages. GitHub Actions runs it on pull requests and pushes.

Because this application depends on live Supabase functions and persisted data, static checks are **not sufficient** to confirm checkout, discounts, employee PIN permissions, or loyalty behavior. Before deploying important changes, use the [MDT release checklist](MDT-RELEASE-CHECKLIST.md), then test the POS in a browser with a safe test transaction.

## Offers and custom items

- **Product Specials** apply a percentage discount to one catalog product per unit. Add an optional custom item as a descriptive inclusion, with a quantity. Use **Product Bundle** for a fixed price covering multiple catalog products.
- **Custom Items** are informational extras: they display in the offer and the POS deal details but **are not charged separately and do not create receipt item lines**. A bundle still needs at least one catalog product for server-side pricing.
- Changes to discounts, checkout amounts, loyalty redemption or PIN permissions require validating the corresponding Supabase RPCs before deploying. The front end does not set authoritative prices.

## UI and caching

- `ui-polish.css` is intentionally loaded **last** so theme palettes and existing branded header effects remain intact; do not move it before the other stylesheets.
- Static asset versions (`?v=...`) control cache refresh. The site does **not** force a second page reload on first visit; bump the version on a changed active asset when deploying.
- Cart and local order history are stored in the browser for convenience. Corrupted or unavailable local storage should not stop the POS from loading, but local unsynced state may not persist.

## Safe changes

1. Work in a separate branch and open a pull request. Avoid direct edits to `main` while features are in use.
2. Keep `index.html` at the root while GitHub Pages publishes from the root.
3. When renaming an **active** JS/CSS module, update every reference in `index.html` and all relative imports. Mind versioned `?v=` URLs that control browser caches.
4. Avoid restructuring the runtime CSS or changing checkout calculations as part of a file-organization cleanup; those warrant separate review and browser testing.
5. Treat `supabase/sql/` as deployment history, **not** a repeatable install script. The active Supabase database is the source of truth for deployed stored functions.

## Scope of the repository cleanup

Unused older POS entry files and one-time SQL scripts were moved into organized archive/history folders with no changes to the deployed `index.html` or checkout/MDT application logic. File history is preserved by Git.
