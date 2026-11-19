// scan-bag: reads a photo of a coffee bag and returns its details for the New bag form.
//
// Deploy (Supabase dashboard): Edge Functions → Deploy a new function → Via editor → name it "scan-bag",
// paste this file, keep "Verify JWT" on, Deploy. Then Edge Functions → Secrets → add ANTHROPIC_API_KEY.
// Only signed-in users of the app can call it. Each scan is one Claude request with one photo.
import Anthropic from "npm:@anthropic-ai/sdk@1.5.0";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the function's secrets

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

// Every field is required so the answer always has the same shape; unknown values come back empty / 0.
const BAG_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["name", "roaster", "origin", "farm", "process", "roast", "roastDate", "weight", "price", "notes"],
  properties: {
    name: { type: "string", description: "Coffee name as printed, e.g. 'Guji Hambela'. Empty if not shown." },
    roaster: { type: "string", description: "Roastery name. Empty if not shown." },
    origin: { type: "string", description: "Country of origin in English, e.g. 'Ethiopia'. Empty if not shown." },
    farm: { type: "string", description: "Farm, washing station, cooperative or producer. Empty if not shown." },
    process: { type: "string", description: "Processing method in English, e.g. Washed, Natural, Honey, Anaerobic. Empty if not shown." },
    roast: { type: "integer", enum: [0, 1, 2, 3, 4, 5], description: "1 light … 5 dark; 0 if the bag doesn't say." },
    roastDate: { type: "string", description: "Roast date as YYYY-MM-DD if printed, else empty." },
    weight: { type: "number", description: "Net weight in grams (convert oz), 0 if not shown." },
    price: { type: "number", description: "Price if printed on the bag, 0 otherwise." },
    notes: { type: "array", items: { type: "string" }, description: "Tasting notes as short English words, e.g. ['Peach', 'Jasmine']." },
  },
};

const SYSTEM =
  "You read labels on specialty coffee bags. Report only what is printed on the bag in the photo; " +
  "never guess a value that isn't visible. Translate labels in other languages into English. " +
  "If the photo isn't a coffee bag, return every field empty.";

// The platform has already checked the token's signature (Verify JWT); this keeps out the public key.
function signedIn(req: Request): boolean {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload.role === "authenticated";
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "Use POST." }, 405);
  if (!signedIn(req)) return reply({ error: "Sign in to scan bags." }, 401);

  const TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
  let image = "", mediaType: (typeof TYPES)[number] = "image/jpeg";
  try {
    const body = await req.json();
    image = String(body.image || "");
    const t = TYPES.find((x) => x === body.mediaType);
    if (t) mediaType = t;
  } catch {
    return reply({ error: "Send one photo." }, 400);
  }
  if (!image || image.length > 7_000_000) return reply({ error: "Send one photo under 5 MB." }, 413);

  try {
    const res = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default", // a declined request is retried on Anthropic's recommended fallback model
      output_config: { effort: "low", format: { type: "json_schema", schema: BAG_SCHEMA } },
      system: SYSTEM,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: image } },
          { type: "text", text: "Read this coffee bag." },
        ],
      }],
    });
    if (res.stop_reason === "refusal") return reply({ error: "Couldn't read this photo." }, 422);
    const text = res.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") return reply({ error: "Couldn't read the label. Try a sharper photo." }, 422);
    return reply(JSON.parse(text.text));
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return reply({ error: "Scanning isn't set up: check ANTHROPIC_API_KEY." }, 500);
    if (e instanceof Anthropic.RateLimitError) return reply({ error: "Too many scans right now. Try again in a minute." }, 429);
    if (e instanceof Anthropic.APIError) return reply({ error: "The reader is busy. Try again." }, 502);
    return reply({ error: "Couldn't read the label. Try a sharper photo." }, 500);
  }
});
