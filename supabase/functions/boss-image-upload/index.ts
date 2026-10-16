// Green Wonderland Boss-PIN image upload.
// Deploy with Supabase CLI: supabase functions deploy boss-image-upload --no-verify-jwt
// JWT verification is disabled only because this endpoint authenticates every request
// against a hashed, active, expiring Boss employee PIN session on the server.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-gw-employee-token",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};
const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers });
const MAX_BYTES = 3 * 1024 * 1024;
const SLOTS = new Set(["main_logo", "login_logo", "receipt_logo", "dashboard_logo", "favicon", "product"]);

function identify(bytes: Uint8Array): { mime: string; ext: string } | null {
  if (bytes.length >= 8 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v))
    return { mime: "image/png", ext: "png" };
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
    return { mime: "image/jpeg", ext: "jpg" };
  if (bytes.length >= 12 &&
    new TextDecoder().decode(bytes.subarray(0, 4)) === "RIFF" &&
    new TextDecoder().decode(bytes.subarray(8, 12)) === "WEBP")
    return { mime: "image/webp", ext: "webp" };
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "Upload service is not configured" }, 503);

  const token = req.headers.get("x-gw-employee-token") || "";
  // This is the opaque random session token issued by gw_pin_login, not the 4-digit PIN.
  if (token.length < 32 || token.length > 512) return json({ error: "Boss employee PIN sign-in required" }, 401);
  const declared = Number(req.headers.get("content-length") || 0);
  if (declared > MAX_BYTES + 16 * 1024) return json({ error: "Image exceeds 3 MB" }, 413);

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  try {
    const { data: authorized, error: verifyError } = await admin.rpc("gw_boss_pin_check", { p_token: token });
    if (verifyError || authorized !== true) return json({ error: "Boss employee PIN session required" }, 403);

    if (!req.headers.get("content-type")?.startsWith("multipart/form-data")) {
      return json({ error: "Submit an image file as multipart form data" }, 400);
    }
    const form = await req.formData();
    const slot = String(form.get("slot") || "");
    const product = String(form.get("product") || "");
    const file = form.get("file");
    if (!SLOTS.has(slot)) return json({ error: "Invalid image location" }, 400);
    if (slot === "product" && !product) return json({ error: "Select a product" }, 400);
    if (!(file instanceof File)) return json({ error: "Select a valid image file" }, 400);
    if (file.size === 0 || file.size > MAX_BYTES) return json({ error: "Image must be between 1 byte and 3 MB" }, 413);

    const bytes = new Uint8Array(await file.arrayBuffer());
    const actual = identify(bytes);
    if (!actual || actual.mime !== file.type) return json({ error: "Use a valid PNG, JPEG or WebP image" }, 415);

    const path = `${slot}/${crypto.randomUUID()}.${actual.ext}`;
    const { error: uploadError } = await admin.storage.from("gw-images").upload(path, bytes, {
      contentType: actual.mime,
      cacheControl: "3600",
      upsert: false,
    });
    if (uploadError) return json({ error: "Storage upload failed: " + uploadError.message }, 500);

    const publicUrl = admin.storage.from("gw-images").getPublicUrl(path).data.publicUrl;
    const { error: saveError } = await admin.rpc("gw_boss_set_image_url", {
      p_token: token,
      p_slot: slot,
      p_product: slot === "product" ? product : null,
      p_url: publicUrl,
    });
    if (saveError) {
      await admin.storage.from("gw-images").remove([path]);
      return json({ error: "Unable to save image: " + saveError.message }, 403);
    }
    return json({ ok: true, url: publicUrl });
  } catch (e) {
    // Never include the PIN session token, service key, or request headers in errors.
    return json({ error: "Unable to process image upload" }, 500);
  }
});
