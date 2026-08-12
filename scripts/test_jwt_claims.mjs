// Test: which JWT claim shapes does Supabase accept for RLS?
// Reads .env.local for URL/anon key/secret, mints variants with jose, hits REST.
import { SignJWT } from "jose";
import fs from "fs";

function loadEnv() {
  const env = {};
  const raw = fs.readFileSync(".env.local", "utf8");
  for (const line of raw.split("\n")) {
    const idx = line.indexOf("=");
    if (idx > 0) {
      const k = line.slice(0, idx).trim();
      const v = line.slice(idx + 1).trim().replace(/\r$/, "");
      if (k && !k.startsWith("#")) env[k] = v;
    }
  }
  return env;
}

const env = loadEnv();
const URL = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SECRET = new TextEncoder().encode(env.SUPABASE_JWT_SECRET);
const REF = URL.split("//")[1].split(".")[0];
const ADDR = "0xabc12345678901234567890123456789012345678"; // test address

async function mint(claims, { aud, role, exp = "1h" }) {
  let t = new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(ADDR)
    .setIssuedAt()
    .setExpirationTime(exp);
  if (aud) t = t.setAudience(aud);
  if (role !== undefined) claims.role = role;
  return t.sign(SECRET);
}

const variants = [
  { name: "A: current (aud=supabase, no role)", claims: { wallet_address: ADDR }, aud: "supabase", role: undefined },
  { name: "B: aud=authenticated, role=anon", claims: { wallet_address: ADDR }, aud: "authenticated", role: "anon" },
  { name: "C: aud=authenticated, role=authenticated", claims: { wallet_address: ADDR }, aud: "authenticated", role: "authenticated" },
  { name: "D: full (iss,ref,aud,role=anon)", claims: { wallet_address: ADDR, iss: "supabase", ref: REF }, aud: "authenticated", role: "anon" },
  { name: "E: full (iss,ref,aud,role=authenticated)", claims: { wallet_address: ADDR, iss: "supabase", ref: REF }, aud: "authenticated", role: "authenticated" },
];

for (const v of variants) {
  const token = await mint({ ...v.claims }, v);
  const res = await fetch(`${URL}/rest/v1/merchant_catalog?select=wallet_address&limit=2`, {
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${token}`,
    },
  });
  const body = await res.text();
  console.log(`${v.name}\n  -> HTTP ${res.status} | ${body.slice(0, 160)}`);
}
