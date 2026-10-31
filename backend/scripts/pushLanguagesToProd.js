// Copies the app languages and all their texts from one backend to another through the admin APIs
// (no direct DB access): creates missing languages, uploads every key × language via the central
// App Texts endpoint, activates the complete ones and deactivates languages that don't exist at the source.
//
// usage:
//   SOURCE_URL=http://localhost:4001/api SOURCE_EMAIL=… SOURCE_PASSWORD=… \
//   TARGET_URL=https://www.nomnombabies.com/api TARGET_EMAIL=… TARGET_PASSWORD=… \
//   node backend/scripts/pushLanguagesToProd.js [--dry-run]
const DRY = process.argv.includes("--dry-run");
const need = (k) => process.env[k] || (console.error(`Missing ${k}`), process.exit(1));
const SOURCE = need("SOURCE_URL").replace(/\/?$/, "/");
const TARGET = need("TARGET_URL").replace(/\/?$/, "/");

const call = async (base, path, { token, method = "GET", body } = {}) => {
  const res = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${base}${path} → ${res.status} ${json.message || ""}`);
  return json.data;
};

const login = async (base, email, password) =>
  (
    await call(base, "auth/login", {
      method: "POST",
      body: {
        email,
        password,
        timezone: "UTC",
        userType: "admin",
        deviceType: "android", // bearer + refresh in the body; this script keeps no cookies
        deviceId: "language-push-script",
        language: "en",
      },
    })
  ).token;

(async () => {
  const src = await login(SOURCE, need("SOURCE_EMAIL"), need("SOURCE_PASSWORD"));
  const dst = await login(TARGET, need("TARGET_EMAIL"), need("TARGET_PASSWORD"));

  const table = await call(SOURCE, "admin/languages/translations", { token: src });
  const srcLangs = (await call(SOURCE, "admin/languages?limit=100", { token: src })) || [];
  const codes = table.languages.map((l) => l.code);
  console.log(`source: ${codes.join(", ")} · ${table.rows.length} keys`);

  let dstLangs = (await call(TARGET, "admin/languages?limit=100", { token: dst })) || [];
  console.log(`target before: ${dstLangs.map((l) => `${l.code}${l.active ? "" : " (off)"}`).join(", ")}`);

  // 1) Languages that exist at the source but not at the target (created inactive by the API).
  for (const l of srcLangs.filter((s) => !dstLangs.some((d) => d.code === s.code))) {
    console.log(`create ${l.code} (${l.title})`);
    if (!DRY)
      await call(TARGET, "admin/languages", {
        token: dst,
        method: "POST",
        body: { title: l.title, transliteration: l.transliteration, flag: l.flag, code: l.code, active: false },
      });
  }
  if (!DRY) dstLangs = await call(TARGET, "admin/languages?limit=100", { token: dst });

  // 2) Every key with every language's text, in one save.
  console.log(`upload ${table.rows.length} keys × ${codes.length} languages`);
  if (!DRY)
    await call(TARGET, "admin/languages/translations", {
      token: dst,
      method: "PUT",
      body: { rows: table.rows },
    });

  // 3) Same on/off state as the source: source languages on, anything else (e.g. Urdu) off.
  for (const d of dstLangs) {
    const s = srcLangs.find((x) => x.code === d.code);
    const active = Boolean(s?.active);
    if (d.active === active) continue;
    console.log(`${active ? "activate" : "deactivate"} ${d.code}`);
    if (!DRY)
      await call(TARGET, `admin/languages/${d._id}`, { token: dst, method: "PUT", body: { active } });
  }

  const after = await call(TARGET, "languages?limit=100");
  console.log(`target now (app sees): ${after.map((l) => `${l.code} v${l.translationsVersion ?? "?"}`).join(", ")}`);
})().catch((e) => {
  console.error(`✕ ${e.message}`);
  process.exit(1);
});
