export interface Doctor {
  id: string;
  name: string;
  specialty: string;
  specialtyUrdu: string;
  fee: number; // PKR
  timings: string;
  days: string;
  room: string;
}

export const CLINIC = {
  name: "Sehat Clinic",
  tagline: "Walk in healthy. Walk out healthier.",
  address: "Main University Road, Peshawar",
  phone: "091-5701234",
  whatsapp: "0300-1234567",
  hours: "Mon–Sat, 9:00 AM – 9:00 PM",
  closedNote: "Closed on Sundays",
};

export const DOCTORS: Doctor[] = [
  {
    id: "ahmed",
    name: "Dr. Ahmed Khan",
    specialty: "General Physician",
    specialtyUrdu: "General Doctor",
    fee: 1000,
    timings: "10:00 AM – 2:00 PM",
    days: "Mon – Sat",
    room: "Room 1",
  },
  {
    id: "sara",
    name: "Dr. Sara Malik",
    specialty: "Pediatrician",
    specialtyUrdu: "Bachon ki Doctor",
    fee: 1500,
    timings: "4:00 PM – 8:00 PM",
    days: "Mon – Sat",
    room: "Room 2",
  },
  {
    id: "bilal",
    name: "Dr. Bilal Hussain",
    specialty: "Dermatologist",
    specialtyUrdu: "Jild (Skin) Specialist",
    fee: 2000,
    timings: "5:00 PM – 9:00 PM",
    days: "Mon, Wed, Fri",
    room: "Room 3",
  },
  {
    id: "ayesha",
    name: "Dr. Ayesha Raza",
    specialty: "Cardiologist",
    specialtyUrdu: "Dil (Heart) Specialist",
    fee: 2500,
    timings: "11:00 AM – 3:00 PM",
    days: "Tue, Thu, Sat",
    room: "Room 4",
  },
  {
    id: "usman",
    name: "Dr. Usman Tariq",
    specialty: "Dentist",
    specialtyUrdu: "Danton ka Doctor",
    fee: 1500,
    timings: "10:00 AM – 6:00 PM",
    days: "Mon – Sat",
    room: "Room 5",
  },
  {
    id: "fatima",
    name: "Dr. Fatima Noor",
    specialty: "Orthopedic",
    specialtyUrdu: "Haddi Jor Specialist",
    fee: 2000,
    timings: "3:00 PM – 7:00 PM",
    days: "Mon, Tue, Thu, Sat",
    room: "Room 6",
  },
];

export function findDoctor(query: string): Doctor | undefined {
  const q = query.toLowerCase();
  // Match by name (first or last)
  const byName = DOCTORS.find((d) => {
    const parts = d.name.toLowerCase().replace("dr.", "").trim().split(/\s+/);
    return (
      d.name.toLowerCase().includes(q) ||
      parts.some((p) => p.length > 2 && q.includes(p))
    );
  });
  if (byName) return byName;

  // Match by specialty keywords (English + Roman Urdu)
  const specialtyMap: Array<[RegExp, string]> = [
    [/\b(skin|jild|pimple|acne|baal|hair)\b/, "Dermatologist"],
    [/\b(heart|dil|cardiac|blood pressure|bp)\b/, "Cardiologist"],
    [/\b(child|bacha|bachon|baby|kids|pediatric)\b/, "Pediatrician"],
    [/\b(teeth|dant|daant|dental|tooth)\b/, "Dentist"],
    [/\b(bone|haddi|jor|joint|kamar|back pain|orthopedic)\b/, "Orthopedic"],
    [/\b(general|fever|bukhar|flu|cold|nazla|sugar|diabetes)\b/, "General Physician"],
  ];
  for (const [re, specialty] of specialtyMap) {
    if (re.test(q)) return DOCTORS.find((d) => d.specialty === specialty);
  }
  return undefined;
}

export function doctorsSummary(lang: "en" | "ur"): string {
  const lines = DOCTORS.map(
    (d) => `- ${d.name} — ${lang === "ur" ? d.specialtyUrdu : d.specialty} (Rs. ${d.fee})`
  );
  return lang === "ur"
    ? `Hamare doctors:\n${lines.join("\n")}\n\nKis doctor se milna chahenge?`
    : `Our doctors:\n${lines.join("\n")}\n\nWhich doctor would you like to see?`;
}

export function feesSummary(lang: "en" | "ur"): string {
  const lines = DOCTORS.map((d) => `- ${d.name}: Rs. ${d.fee}`);
  return lang === "ur"
    ? `Fees:\n${lines.join("\n")}`
    : `Consultation fees:\n${lines.join("\n")}`;
}

export function timingsSummary(lang: "en" | "ur"): string {
  const lines = DOCTORS.map((d) => `- ${d.name}: ${d.timings} (${d.days})`);
  const head =
    lang === "ur"
      ? `Clinic timings: ${CLINIC.hours}. ${CLINIC.closedNote} (Itwar band).`
      : `Clinic timings: ${CLINIC.hours}. ${CLINIC.closedNote}.`;
  return `${head}\n\n${lines.join("\n")}`;
}
