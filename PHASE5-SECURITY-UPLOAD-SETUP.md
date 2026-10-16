# Green Wonderland — Boss PIN Security & Direct Image Uploads

## What changed
- Product/catalog management uses server-validated Boss employee PIN sessions.
- Direct image uploads now use the `boss-image-upload` Supabase Edge Function.
- The image function checks the caller's expiring Boss PIN token BEFORE accessing storage; the service-role key is never sent to the browser.
- Only PNG, JPEG and WebP files of 3 MB or less are accepted, with file signature checks and unique storage object names.
- Checkout now requires an active employee PIN and a server-calculated total. Old arbitrary-total sale RPCs are revoked.
- Existing sales, reward balances and images are preserved.

## Setup: two SQL scripts
In **Supabase Dashboard → SQL Editor**, run these files in order:

1. `supabase-boss-image-upload-storage.sql` — configure the private-write/public-read image bucket and inspect existing storage policies.
2. `supabase-checkout-security-audit.sql` — enforce authenticated checkout and revoke the old browser-priced sales functions.

The earlier `supabase-boss-pin-admin.sql` should already have been run. If not, run it first.

**Important:** The storage script prints existing policies. Check that no `INSERT`, `UPDATE`, or `DELETE` policy allows unrestricted anonymous uploads. The migration does not add any write policies.

## Deploy the Edge Function
Deploy the function from this GitHub repository using the Supabase CLI (project ref is found under Supabase Project Settings):

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy boss-image-upload --no-verify-jwt
```

**Why `--no-verify-jwt`?** This POS uses its own employee PIN sessions rather than a Supabase email Auth JWT. The function rejects any request without a valid, active Boss token checked via `gw_boss_pin_check`. Do not remove the token verification. Do not place your `SUPABASE_SERVICE_ROLE_KEY` in `config.js` or GitHub Pages: it must remain server-side in Edge Function secrets. Hosted Supabase functions normally provide `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

The upload endpoint is `https://YOUR_PROJECT_REF.supabase.co/functions/v1/boss-image-upload`.

## Use it
1. Open Green Wonderland MDT and refresh (Ctrl+Shift+R).
2. Sign in with an employee account whose role is **Boss** using the Employee PIN screen.
3. Open **Settings & Appearance** and find **Store Images**.
4. Choose logo/favicon/product, choose a PNG/JPG/WebP file (up to 3 MB), then click **Upload Image**.
5. Alternatively, paste a HTTPS image URL and save it. There is still no email requirement.

## Checkout smoke test
- Log out, then try an order: must refuse checkout.
- Sign in with an employee PIN; add a product, apply a discount, and check out: compare receipt total to checkout total.
- Change product price in another tab before confirming an order: server should reject a mismatched total (no sale written).
- Apply a promotion and loyalty points: confirm one sale record, one receipt, and the expected earned/redeemed point entries.
- Void/refund through an authorized role: confirm adjustment audit and loyalty reversal/restoration.
- Try unauthorized/non-Boss image upload: must return 403 without storing an image.
- After revoking Boss PIN session in Security Center: upload and admin changes should stop working.

**Not a live test report:** These tests must be performed in your Supabase environment after deployment. A JavaScript syntax check alone cannot verify the database, Edge Function deployment, storage policies, or network permissions.

## Storage note
The `gw-images` bucket is public-READ so logos appear to customers. Public-READ is not public-WRITE; the upload Edge Function uses server-side credentials only after validating the Boss session. If your project previously had permissive storage INSERT/UPDATE/DELETE policies, review and remove them.
