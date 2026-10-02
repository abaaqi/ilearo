/** Nigeria's 36 states and the FCT, in alphabetical order. */
export const NIGERIAN_STATES = [
  "Abia",
  "Adamawa",
  "Akwa Ibom",
  "Anambra",
  "Bauchi",
  "Bayelsa",
  "Benue",
  "Borno",
  "Cross River",
  "Delta",
  "Ebonyi",
  "Edo",
  "Ekiti",
  "Enugu",
  "FCT (Abuja)",
  "Gombe",
  "Imo",
  "Jigawa",
  "Kaduna",
  "Kano",
  "Katsina",
  "Kebbi",
  "Kogi",
  "Kwara",
  "Lagos",
  "Nasarawa",
  "Niger",
  "Ogun",
  "Ondo",
  "Osun",
  "Oyo",
  "Plateau",
  "Rivers",
  "Sokoto",
  "Taraba",
  "Yobe",
  "Zamfara",
] as const;

export type NigerianState = (typeof NIGERIAN_STATES)[number];

export function isNigerianState(value: unknown): value is NigerianState {
  return typeof value === "string" && (NIGERIAN_STATES as readonly string[]).includes(value);
}

export type DeliveryZone = "lagos" | "south-west" | "rest-of-nigeria";

export const DELIVERY_ZONES: Record<DeliveryZone, { label: string; feeKobo: number; days: string }> = {
  lagos: { label: "Lagos", feeKobo: 2_500_00, days: "1–2 working days" },
  "south-west": { label: "Rest of the South-West", feeKobo: 3_500_00, days: "2–4 working days" },
  "rest-of-nigeria": { label: "Everywhere else in Nigeria", feeKobo: 5_000_00, days: "3–6 working days" },
};

/** Orders at or above this subtotal ship free. */
export const FREE_DELIVERY_FROM_KOBO = 100_000_00;

const SOUTH_WEST: ReadonlySet<NigerianState> = new Set(["Ogun", "Oyo", "Osun", "Ondo", "Ekiti"]);

export function zoneForState(state: NigerianState): DeliveryZone {
  if (state === "Lagos") return "lagos";
  if (SOUTH_WEST.has(state)) return "south-west";
  return "rest-of-nigeria";
}

export type DeliveryQuote = {
  zone: DeliveryZone;
  feeKobo: number;
  days: string;
  free: boolean;
};

export function deliveryQuote(state: NigerianState, subtotalKobo: number): DeliveryQuote {
  const zone = zoneForState(state);
  const { feeKobo, days } = DELIVERY_ZONES[zone];
  const free = subtotalKobo >= FREE_DELIVERY_FROM_KOBO;
  return { zone, feeKobo: free ? 0 : feeKobo, days, free };
}
