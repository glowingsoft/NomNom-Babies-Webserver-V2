// Replaces every FAQ on a backend with the app's current FAQ set, through the admin API (no direct DB access).
// The app lists FAQs newest first, so they are created last-to-first to show in the order below.
//
// usage:
//   API_URL=https://www.nomnombabies.com/api ADMIN_EMAIL=… ADMIN_PASSWORD=… node backend/scripts/replaceFaqs.js [--dry-run]
const DRY = process.argv.includes("--dry-run");
const need = (k) => process.env[k] || (console.error(`Missing ${k}`), process.exit(1));
const API = need("API_URL").replace(/\/?$/, "/");

const FAQS = [
  {
    question: "What is NomNom Babies?",
    answer:
      "NomNom Babies is a feeding companion for babies starting solid foods. It brings age-based meal plans, culturally inspired recipes, a daily feeding schedule with reminders, grocery lists and a food introduction tracker together in one app.",
  },
  {
    question: "Which ages is the app for?",
    answer:
      "Babies from 6 to 12 months, grouped into stages: 6, 7, 8 and 9–12 months. Recipes and daily plans follow the stage you choose. Update it in Settings › Baby Age as your baby grows.",
  },
  {
    question: "How do cultures work?",
    answer:
      "Choose one or more cuisines (for example Pakistan + Nigeria) in Settings › Culture. Recipes and daily plans mix dishes from them, so your baby gets used to your family's flavours early.",
  },
  {
    question: "Can I add more than one baby?",
    answer:
      "Yes. Add babies in Settings › Babies Profiles, and switch the active baby by tapping the name at the top of Home. Each baby has their own plan, schedule and food tracker.",
  },
  {
    question: "How does the feeding schedule work?",
    answer:
      "Home shows today's recommended plan; tap Start Feeding Plan to use it. In the Schedule tab you can add, edit or remove milk and meal feeds for any day and tick each one as done. Tick every feed of the day to earn a daily badge.",
  },
  {
    question: "Will I be reminded at feeding time?",
    answer:
      "Yes. With notifications on, the app reminds you at each scheduled feed time, even when you are offline. Allow notifications when Home asks; if they are off, tap the banner on Home to turn them on in your phone settings.",
  },
  {
    question: "How do I track new foods and allergies?",
    answer:
      "Open Settings › Tracker and log each new food with your baby's reaction (good, neutral or allergic). Introduce one new food at a time and wait 3–5 days before the next, so any reaction is easy to spot.",
  },
  {
    question: "How does the grocery list work?",
    answer:
      "On a recipe, tap Add to Grocery List. The Grocery tab combines the ingredients of all added recipes; tick items as you shop. You can also download the list as a PDF.",
  },
  {
    question: "How do I save recipes?",
    answer:
      "Tap the heart on a recipe to add it to your favourites, or download it as a PDF. Both are listed in Settings › Favorite / Downloaded Recipes.",
  },
  {
    question: "Where are downloaded PDFs saved?",
    answer:
      "On Android they are saved in Downloads › NomNomBabies (visible in your Files app), and they open inside the app, even offline. If you delete one, the app downloads it again the next time you open it while online.",
  },
  {
    question: "Does the app work offline?",
    answer:
      "Yes. Screens you have opened show their last saved data, downloaded PDFs open, and feeds you tick while offline are saved as soon as you are back online.",
  },
  {
    question: "How do I change the language?",
    answer:
      "Go to Settings › Language (English, French or Hindi). Before signing in, use the language button at the top right of the login screen.",
  },
  {
    question: "Is this medical advice?",
    answer:
      "No. NomNom Babies offers general guidance and every baby is different. Talk to your paediatrician before starting solids, about allergies, or if your baby has a health condition. Get medical help straight away if you notice swelling, hives, vomiting or trouble breathing after a new food.",
  },
  {
    question: "How do I delete my account?",
    answer:
      "Go to Settings › Delete Account. This permanently deletes your account and your babies' data.",
  },
  {
    question: "How do I contact support?",
    answer:
      "Go to Settings › Contact Support and send us your question. We reply by email.",
  },
];

const call = async (path, { token, method = "GET", body } = {}) => {
  const res = await fetch(API + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${API}${path} → ${res.status} ${json.message || ""}`);
  return json.data;
};

(async () => {
  const { token } = await call("auth/login", {
    method: "POST",
    body: {
      email: need("ADMIN_EMAIL"),
      password: need("ADMIN_PASSWORD"),
      userType: "admin",
      deviceType: "android",
      deviceId: "faq-script",
      timezone: "UTC",
      language: "en",
    },
  });
  const old = (await call("admin/settings/faqs?limit=200", { token })) || [];
  console.log(`delete ${old.length} old FAQ(s): ${old.map((f) => `"${f.question}"`).join(", ")}`);
  console.log(`create ${FAQS.length} FAQs`);
  if (DRY) return;
  for (const f of old) await call(`admin/settings/faqs/${f._id}`, { token, method: "DELETE" });
  for (const f of [...FAQS].reverse()) await call("admin/settings/faqs", { token, method: "POST", body: f });
  const now = (await call("app/settings/faqs?limit=200")) || [];
  console.log(`app now shows ${now.length}: ${now.map((f) => f.question).join(" | ")}`);
})().catch((e) => {
  console.error(`✕ ${e.message}`);
  process.exit(1);
});
