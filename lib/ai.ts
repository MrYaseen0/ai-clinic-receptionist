import {
  DOCTORS,
  CLINIC,
  findDoctor,
  doctorsSummary,
  feesSummary,
  timingsSummary,
  type Doctor,
} from "./doctors";
import { loadDb, cleanText, type LabTest } from "./lab-store";
import { seedIfEmpty } from "./lab-seed";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface BookingSlots {
  name?: string;
  phone?: string;
  doctor?: string; // doctor id
  date?: string;
  time?: string;
  labTests?: string[]; // lab test ids (lab booking flow)
  labDate?: string; // sample date for lab booking
}

export interface ChatResult {
  reply: string;
  slots: BookingSlots;
  bookingReady: boolean;
}

type Lang = "en" | "ur";

const URDU_MARKERS =
  /\b(kya|hai|ka|ki|ko|mein|mujhe|chahiye|karna|karo|batao|bataein|kitne|kitna|kitni|kab|kahan|wala|wali|se|kaun|konsa|konsi|acha|acha|theek|haan|han|nahi|nahin|shukriya|mera|mere|meri|aap|apka|apki|koi|aur|bhi|liye|par|tak|wala|aana|jana|milna|band|khula|baje|subah|sham|raat|din|itwar|jumma|hafta)\b/;

function detectLang(text: string): Lang {
  return URDU_MARKERS.test(text.toLowerCase()) ? "ur" : "en";
}

function nextWeekday(target: number): Date {
  const d = new Date();
  const diff = (target - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d;
}

/** Machine-readable date for slots (YYYY-MM-DD) — matches /api/book and /api/lab/orders validation. */
function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

const DAY_MAP: Array<[RegExp, number]> = [
  [/\b(sunday|itwar)\b/, 0],
  [/\b(monday|somwar|peer)\b/, 1],
  [/\b(tuesday|mangal)\b/, 2],
  [/\b(wednesday|budh)\b/, 3],
  [/\b(thursday|jumerat)\b/, 4],
  [/\b(friday|jumm?ah?)\b/, 5],
  [/\b(saturday|hafta)\b/, 6],
];

function extractDate(text: string): string | undefined {
  const t = text.toLowerCase();
  if (/\b(today|aaj)\b/.test(t)) return fmtDate(new Date());
  if (/\b(tomorrow|kal)\b/.test(t)) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return fmtDate(d);
  }
  for (const [re, day] of DAY_MAP) {
    if (re.test(t)) return fmtDate(nextWeekday(day));
  }
  // dd/mm, dd-mm, dd.mm, yyyy-mm-dd
  const m =
    t.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/) ||
    t.match(/\b(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?\b/);
  if (m) {
    let d: Date;
    if (m[3] && m[1].length === 4) {
      d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    } else {
      const year = m[3]
        ? Number(m[3].length === 2 ? "20" + m[3] : m[3])
        : new Date().getFullYear();
      d = new Date(year, Number(m[2]) - 1, Number(m[1]));
    }
    if (!isNaN(d.getTime())) return fmtDate(d);
  }
  return undefined;
}

function to12h(h24: number, min: number): string {
  const ap = h24 >= 12 ? "PM" : "AM";
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:${String(min).padStart(2, "0")} ${ap}`;
}

function extractTime(text: string): string | undefined {
  const t = text.toLowerCase();
  let m = t.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  if (m) {
    let h = Number(m[1]) % 12;
    if (m[3] === "pm") h += 12;
    return to12h(h, Number(m[2] || 0));
  }
  m = t.match(/\b(subah|morning)\s*(\d{1,2})\b/) || t.match(/\b(\d{1,2})\s*(subah|morning)\b/);
  if (m) {
    const h = Number(m[2] || m[1]) % 12;
    return to12h(h, 0);
  }
  m = t.match(/\b(sham|evening|raat)\s*(\d{1,2})\b/) || t.match(/\b(\d{1,2})\s*(sham|evening|baje sham)\b/);
  if (m) {
    const h = (Number(m[2] || m[1]) % 12) + 12;
    return to12h(h, 0);
  }
  m = t.match(/\b(\d{1,2})\s*baje\b/);
  if (m) {
    const n = Number(m[1]);
    // Demo heuristic: clinic hours lean — small numbers are evening, 8-11 morning
    const h24 = n >= 8 && n <= 11 ? n : (n % 12) + 12;
    return to12h(h24, 0);
  }
  return undefined;
}

function extractPhone(text: string): string | undefined {
  const m = text.replace(/[\s-]/g, "").match(/(?:\+?92|0)?(3\d{9})/);
  if (m) return "0" + m[1];
  return undefined;
}

function extractName(text: string): string | undefined {
  const patterns = [
    /my name is ([a-zA-Z ]{2,40})/i,
    /mera naam ([a-zA-Z ]{2,40})/i,
    /\bi am ([a-zA-Z ]{2,40})/i,
    /name is ([a-zA-Z ]{2,40})/i,
    /this is ([a-zA-Z ]{2,40})/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      return m[1]
        .trim()
        .replace(/\b(hai|hoon|hun|ji)\b/gi, "")
        .trim()
        .replace(/\s+/g, " ");
    }
  }
  return undefined;
}

/** A bare "Ali Raza" with no "my name is" prefix — accept it when the bot is
 *  collecting a name, but never steal dates, phones, greetings or commands. */
function looksLikeBareName(text: string): boolean {
  const t = text.trim();
  if (t.length < 2 || t.length > 40) return false;
  if (!/^[a-zA-Z .'-]+$/.test(t)) return false;
  if (/\d/.test(t)) return false;
  const words = t.split(/\s+/);
  if (words.length < 1 || words.length > 4) return false;
  const low = t.toLowerCase();
  if (
    /^(salam|assalam|salaam|aoa|hello|hi|hey|hey there|shukriya|thanks|thank you|meherbani|please|ji)\b/.test(
      low
    )
  )
    return false;
  if (/^(yes|no|haan|nahi|naheen|jee|ok|okay|theek|sahi|cancel|book|appointment)\b/.test(low))
    return false;
  return true;
}

/** Only treat a message as choosing a doctor when it actually mentions one —
 *  otherwise "my name is Ali Raza" would match Dr. Ayesha *Raza*. */
function mentionsDoctor(text: string): boolean {
  const t = text.toLowerCase();
  if (/\b(dr\.?|doctor|specialist|doc)\b/.test(t)) return true;
  return /\b(skin|jild|pimple|acne|baal|hair|heart|dil|cardiac|blood pressure|child|bacha|bachon|baby|kids|pediatric|teeth|dant|daant|dental|tooth|bone|haddi|jor|joint|kamar|orthopedic|general|fever|bukhar|flu|cold|nazla|sugar|diabetes|dermatologist|cardiologist|dentist)\b/.test(
    t
  );
}

function doctorById(id?: string): Doctor | undefined {
  return DOCTORS.find((d) => d.id === id);
}

// ---------------------------------------------------------------------------
// Lab test booking (bilingual, conversational)
// ---------------------------------------------------------------------------

/** Roman Urdu / English aliases for matching lab tests from free text. */
const LAB_ALIASES: Record<string, string[]> = {
  CBC: ["cbc", "blood test", "khoon ka test", "khoon test", "cbc test", "blood"],
  ESR: ["esr"],
  LIPID: ["lipid", "cholesterol", "lipid profile"],
  LFT: ["lft", "liver", "jigar", "liver test"],
  RFT: ["rft", "kidney", "gurde", "kidney test", "creatinine"],
  HBA1C: ["hba1c", "sugar", "diabetes", "shugar", "sugar test"],
  FBS: ["fasting", "fbs", "fasting sugar"],
  CRP: ["crp"],
  VITD: ["vitamin d"],
  B12: ["vitamin b12", "b12"],
  FERR: ["ferritin", "iron"],
  TFT: ["thyroid", "tft", "thyroid test"],
  URINE: ["urine", "peshab", "urine test"],
  HBSAG: ["hepatitis b", "kala yarqan"],
  HCV: ["hepatitis c"],
  DENGUE: ["dengue", "ns1", "dengue test"],
  BHCG: ["pregnancy", "hamal", "bhcg", "pregnancy test"],
  MP: ["malaria"],
};

function getLabTests(): LabTest[] {
  try {
    seedIfEmpty();
    return loadDb().tests.filter((t) => t.active);
  } catch {
    return [];
  }
}

function labTestById(id?: string): LabTest | undefined {
  return getLabTests().find((t) => t.id === id);
}

/** Match lab tests mentioned in free text (English + Roman Urdu). */
function matchLabTests(text: string): LabTest[] {
  const t = text.toLowerCase();
  const hits: LabTest[] = [];
  for (const test of getLabTests()) {
    const aliases = LAB_ALIASES[test.code] || [];
    const needles = [
      test.code.toLowerCase(),
      test.name.toLowerCase(),
      ...aliases,
    ];
    if (needles.some((n) => n.length >= 2 && t.includes(n))) hits.push(test);
  }
  return hits;
}

function labTestsSummary(lang: Lang): string {
  const byCat = new Map<string, LabTest[]>();
  for (const t of getLabTests()) {
    const arr = byCat.get(t.category) || [];
    arr.push(t);
    byCat.set(t.category, arr);
  }
  const lines: string[] = [];
  for (const [cat, arr] of Array.from(byCat.entries())) {
    lines.push(`- ${cat}:`);
    for (const t of arr) lines.push(`  ${t.code} — ${t.name} (Rs. ${t.price})`);
  }
  const head =
    lang === "ur"
      ? "Ye hamare lab tests hain:"
      : "Here are our lab tests:";
  return `${head}\n${lines.join("\n")}`;
}

function askLabFor(
  field: "labTests" | "name" | "phone" | "labDate",
  lang: Lang
): string {
  if (field === "labTests") {
    const intro =
      lang === "ur"
        ? "Kaunsa test karwana hai? Naam likh dein (masalan: CBC, sugar, thyroid)."
        : "Which test would you like? Type the name (e.g. CBC, sugar, thyroid).";
    return `${intro}\n${labTestsSummary(lang)}`;
  }
  if (field === "labDate")
    return lang === "ur"
      ? "Sample kis din dena chahenge? (masalan: kal, ya 05-10)"
      : "Which day will you give the sample? (e.g. tomorrow or 05-10)";
  return askFor(field, lang);
}

function labConfirmSummary(slots: BookingSlots, lang: Lang): string {
  const tests = (slots.labTests || [])
    .map(labTestById)
    .filter((t): t is LabTest => !!t);
  const total = tests.reduce((s, t) => s + t.price, 0);
  const rows = [
    ...tests.map((t) => `- ${t.name} (Rs. ${t.price})`),
    `${lang === "ur" ? "Kul" : "Total"}: Rs. ${total}`,
    `${lang === "ur" ? "Sample ki tareekh" : "Sample date"}: ${slots.labDate}`,
    `${lang === "ur" ? "Naam" : "Name"}: ${slots.name}`,
    `${lang === "ur" ? "Mobile" : "Phone"}: ${slots.phone}`,
  ];
  return lang === "ur"
    ? `Apna lab order confirm karein:\n${rows.join("\n")}\n\nConfirm ke liye YES likhein, ya CANCEL likh kar dobara shuru karein.`
    : `Please confirm your lab order:\n${rows.join("\n")}\n\nReply YES to confirm, or CANCEL to start over.`;
}

function labReply(
  text: string,
  slots: BookingSlots,
  lang: Lang,
  matched: LabTest[]
): ChatResult {
  const t = text.toLowerCase().trim();
  const next: BookingSlots = { ...slots };

  if (matched.length > 0) {
    next.labTests = Array.from(
      new Set([...(next.labTests || []), ...matched.map((m) => m.id)])
    );
  }
  const dt = extractDate(text);
  if (dt) next.labDate = dt;
  const ph = extractPhone(text);
  if (ph) next.phone = ph;
  const nm = extractName(text);
  if (nm) next.name = nm;
  // Bare-name fallback: only when we're actually collecting the name and the
  // message isn't a date, phone, or something else extractable.
  else if (!next.name && !dt && !ph && looksLikeBareName(text))
    next.name = cleanText(text, 60);

  const order: Array<"labTests" | "name" | "phone" | "labDate"> = [
    "labTests",
    "name",
    "phone",
    "labDate",
  ];
  const missing = order.find(
    (f) =>
      !next[f] || (Array.isArray(next[f]) && (next[f] as string[]).length === 0)
  );
  if (!missing) {
    return {
      reply: labConfirmSummary(next, lang),
      slots: next,
      bookingReady: true,
    };
  }
  return {
    reply: askLabFor(missing, lang),
    slots: next,
    bookingReady: false,
  };
}

function askFor(
  field: "doctor" | "date" | "time" | "name" | "phone",
  lang: Lang,
  doctor?: Doctor
): string {
  const list = doctorsSummary(lang);
  switch (field) {
    case "doctor":
      return lang === "ur"
        ? `Kis doctor se milna chahenge?\n${list}`
        : `Which doctor would you like to see?\n${list}`;
    case "date":
      return lang === "ur"
        ? `Kis din aana chahenge? (masalan: kal, jumma, ya 05-10)\n${doctor ? `${doctor.name} ke din: ${doctor.days}` : ""}`
        : `Which day works for you? (e.g. tomorrow, Friday, or 05-10)\n${doctor ? `${doctor.name} is available: ${doctor.days}` : ""}`;
    case "time":
      return lang === "ur"
        ? `Kis waqt aana chahenge? (masalan: 11am ya sham 5)\n${doctor ? `${doctor.name} ki timing: ${doctor.timings}` : ""}`
        : `What time suits you? (e.g. 11am or 5pm)\n${doctor ? `${doctor.name}'s hours: ${doctor.timings}` : ""}`;
    case "name":
      return lang === "ur"
        ? "Apna naam bata dein please?"
        : "May I have your name, please?";
    case "phone":
      return lang === "ur"
        ? "Apna mobile number bata dein (masalan 03001234567)."
        : "Please share your mobile number (e.g. 03001234567).";
  }
}

function confirmSummary(slots: BookingSlots, lang: Lang): string {
  const d = doctorById(slots.doctor);
  const rows = [
    `${lang === "ur" ? "Doctor" : "Doctor"}: ${d ? d.name : slots.doctor} (${d ? d.specialty : ""})`,
    `${lang === "ur" ? "Fees" : "Fee"}: Rs. ${d ? d.fee : "-"}`,
    `${lang === "ur" ? "Din" : "Date"}: ${slots.date}`,
    `${lang === "ur" ? "Waqt" : "Time"}: ${slots.time}`,
    `${lang === "ur" ? "Naam" : "Name"}: ${slots.name}`,
    `${lang === "ur" ? "Mobile" : "Phone"}: ${slots.phone}`,
  ];
  return lang === "ur"
    ? `Apni appointment confirm karein:\n${rows.join("\n")}\n\nConfirm ke liye YES likhein, ya CANCEL likh kar dobara shuru karein.`
    : `Please confirm your appointment:\n${rows.join("\n")}\n\nReply YES to confirm, or CANCEL to start over.`;
}

/** Rule-based bilingual engine — zero config, works offline. */
function mockReply(text: string, slots: BookingSlots): ChatResult {
  const lang = detectLang(text);
  const t = text.toLowerCase().trim();
  const next: BookingSlots = { ...slots };

  // Cancel anytime
  if (/\b(cancel|mansookh|khatam)\b/.test(t)) {
    return {
      reply:
        lang === "ur"
          ? "Theek hai, booking cancel kar di. Kuch aur chahiye to batayein."
          : "Okay, I've cancelled the booking. Let me know if you need anything else.",
      slots: {},
      bookingReady: false,
    };
  }

  // --- Lab test booking flow (English + Roman Urdu) ---
  const inLabFlow = !!slots.labTests && slots.labTests.length > 0;
  const matchedLab = matchLabTests(text);
  const labTrigger =
    /\b(lab( test)?s?|tests? karwana|tests? karwane|khoon ka test|blood test)\b/.test(
      t
    );
  if (inLabFlow || matchedLab.length > 0 || (labTrigger && !mentionsDoctor(text))) {
    return labReply(text, slots, lang, matchedLab);
  }

  // Extract whatever the user gave us
  const doc = mentionsDoctor(text) ? findDoctor(text) : undefined;
  if (doc) next.doctor = doc.id;
  const dt = extractDate(text);
  if (dt) next.date = dt;
  const tm = extractTime(text);
  if (tm) next.time = tm;
  const ph = extractPhone(text);
  if (ph) next.phone = ph;
  const nm = extractName(text);
  if (nm) next.name = nm;
  else if (
    !next.name &&
    !doc &&
    !dt &&
    !tm &&
    !ph &&
    looksLikeBareName(text)
  )
    next.name = cleanText(text, 60);

  const wantsBooking =
    /\b(book|appointment|token|milaqaat|milna|number)\b/.test(t) ||
    Object.keys(next).length > 0;

  if (wantsBooking) {
    const order: Array<"doctor" | "date" | "time" | "name" | "phone"> = ["doctor", "date", "time", "name", "phone"];
    const missing = order.find((f) => !next[f]);
    if (!missing) {
      return { reply: confirmSummary(next, lang), slots: next, bookingReady: true };
    }
    return {
      reply: askFor(missing, lang, doctorById(next.doctor)),
      slots: next,
      bookingReady: false,
    };
  }

  // Info intents
  if (/\b(hi|hello|salam|assalam|aoa|hey)\b/.test(t) && t.length < 30) {
    return {
      reply:
        lang === "ur"
          ? `Assalam-o-Alaikum! ${CLINIC.name} me khush aamdeed. Main aapki appointment book kar sakta hun, doctors, fees ya timings bata sakta hun. Kya madad chahiye?`
          : `Hello! Welcome to ${CLINIC.name}. I can book appointments and share doctor, fee, or timing info. How can I help?`,
      slots: next,
      bookingReady: false,
    };
  }
  if (/\b(doctor|specialist|dr\b)/.test(t)) {
    return { reply: doctorsSummary(lang), slots: next, bookingReady: false };
  }
  if (/\b(fee|fees|charges|pese|paisa|kitne|price|cost)\b/.test(t)) {
    const d = findDoctor(text);
    if (d) {
      return {
        reply:
          lang === "ur"
            ? `${d.name} (${d.specialtyUrdu}) ki fees Rs. ${d.fee} hai.`
            : `${d.name} (${d.specialty}) charges Rs. ${d.fee}.`,
        slots: next,
        bookingReady: false,
      };
    }
    return { reply: feesSummary(lang), slots: next, bookingReady: false };
  }
  if (/\b(timing|time|waqt|kab|khula|open|close|hours|baje)\b/.test(t)) {
    return { reply: timingsSummary(lang), slots: next, bookingReady: false };
  }
  if (/\b(address|location|kahan|pata|kahaan|map)\b/.test(t)) {
    return {
      reply:
        lang === "ur"
          ? `Hamara pata: ${CLINIC.address}. Phone: ${CLINIC.phone}.`
          : `We are at ${CLINIC.address}. Phone: ${CLINIC.phone}.`,
      slots: next,
      bookingReady: false,
    };
  }
  if (/\b(thank|shukriya|meherbani)\b/.test(t)) {
    return {
      reply:
        lang === "ur"
          ? "Khush aamdeed! Sehat ka khayal rakhein."
          : "You're welcome! Take care of your health.",
      slots: next,
      bookingReady: false,
    };
  }

  // Fallback
  return {
    reply:
      lang === "ur"
        ? "Maaf kijiye, samajh nahi aaya. Main appointment book kar sakta hun, ya doctors / fees / timings bata sakta hun. Kya karna chahenge?"
        : "Sorry, I didn't quite get that. I can book an appointment, or share doctor, fee, or timing info. What would you like to do?",
    slots: next,
    bookingReady: false,
  };
}

/** Real-LLM engine via Groq (llama-3.3-70b-versatile). */
async function groqReply(
  messages: ChatMessage[],
  slots: BookingSlots
): Promise<ChatResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return {
      reply:
        "AI_MODE=groq is set but GROQ_API_KEY is missing. Add it to .env.local, or switch AI_MODE=mock.",
      slots,
      bookingReady: false,
    };
  }

  const doctorList = DOCTORS.map(
    (d) =>
      `${d.id}: ${d.name}, ${d.specialty}, Rs.${d.fee}, ${d.timings}, ${d.days}`
  ).join("\n");

  const labList = getLabTests()
    .map((t) => `${t.id}: ${t.code} — ${t.name}, Rs.${t.price}`)
    .join("\n");

  const system = `You are the friendly bilingual (English + Roman Urdu) AI receptionist of ${CLINIC.name}, Peshawar.
Clinic hours: ${CLINIC.hours}. Address: ${CLINIC.address}. Phone: ${CLINIC.phone}.
Doctors:
${doctorList}

Lab tests (users can also book these conversationally):
${labList}

Your job: answer questions about doctors, fees, timings, and lab tests; book doctor appointments
(collect: doctor, date, time, name, phone) OR lab test orders (collect: labTests as array of test ids,
labDate as sample date, name, phone).
Match the user's language (English or Roman Urdu). Keep replies short (under 60 words).

RULES:
- Always respond with ONLY a JSON object: {"reply": "...", "slots": {"name": "...", "phone": "...", "doctor": "doctor-id", "date": "...", "time": "...", "labTests": ["test-id"], "labDate": "..."}, "booking_ready": false}
- Copy already-known slots forward; only fill new info the user gave. Use doctor ids and test ids from the lists above.
- A doctor booking and a lab booking are separate flows — never mix doctor/date/time with labTests/labDate.
- Use YYYY-MM-DD format for date and labDate (e.g. 2026-10-02).
- For a doctor booking set booking_ready=true ONLY when doctor, date, time, name, AND phone are all known, with a confirmation summary asking the user to say YES.
- For a lab booking set booking_ready=true ONLY when labTests (non-empty), labDate, name, AND phone are all known, with a confirmation summary (test names, prices, total, sample date) asking the user to say YES.
- Never invent doctors, fees, timings, or tests not listed above.`;

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: `Known slots so far: ${JSON.stringify(slots)}`,
          },
          ...messages.slice(-8),
        ],
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Groq ${res.status}: ${errText.slice(0, 120)}`);
    }
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(raw);
    const merged: BookingSlots = { ...slots };
    for (const k of ["name", "phone", "doctor", "date", "time", "labDate"] as const) {
      const v = parsed.slots?.[k];
      if (typeof v === "string" && v.trim()) merged[k] = v.trim();
    }
    const labIds = parsed.slots?.labTests;
    if (Array.isArray(labIds)) {
      const valid = labIds.filter(
        (x): x is string => typeof x === "string" && !!labTestById(x)
      );
      if (valid.length > 0)
        merged.labTests = Array.from(new Set([...(merged.labTests || []), ...valid]));
    }
    // Validate doctor id
    if (merged.doctor && !doctorById(merged.doctor)) {
      const d = findDoctor(merged.doctor);
      merged.doctor = d ? d.id : undefined;
    }
    return {
      reply: String(parsed.reply || "Sorry, I had trouble responding. Please try again."),
      slots: merged,
      bookingReady: parsed.booking_ready === true,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return {
      reply: `The AI service had an issue (${msg}). Falling back — you can still ask about doctors, fees, or timings.`,
      slots,
      bookingReady: false,
    };
  }
}

export async function getReply(
  messages: ChatMessage[],
  slots: BookingSlots
): Promise<ChatResult> {
  const mode = (process.env.AI_MODE || "mock").toLowerCase();
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (mode === "groq") return groqReply(messages, slots);
  return mockReply(lastUser?.content || "", slots);
}

export function currentMode(): "mock" | "groq" {
  return (process.env.AI_MODE || "mock").toLowerCase() === "groq"
    ? "groq"
    : "mock";
}
