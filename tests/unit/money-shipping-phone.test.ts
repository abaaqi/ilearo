import { describe, expect, it } from "vitest";
import { formatNaira } from "@/lib/money";
import {
  DELIVERY_ZONES,
  FREE_DELIVERY_FROM_KOBO,
  NIGERIAN_STATES,
  deliveryQuote,
  isNigerianState,
  zoneForState,
} from "@/lib/shipping";
import { formatNigerianPhone, normalizeNigerianPhone } from "@/lib/phone";
import { generateOrderReference, isOrderReference } from "@/lib/reference";

describe("formatNaira", () => {
  it.each([
    [2_400_000, "₦24,000"],
    [0, "₦0"],
    [150, "₦1.50"],
    [5, "₦0.05"],
    [123_456_789, "₦1,234,567.89"],
    [-250_000, "-₦2,500"],
  ])("formats %i kobo as %s", (kobo, expected) => {
    expect(formatNaira(kobo)).toBe(expected);
  });
});

describe("delivery", () => {
  it("lists the 36 states and the FCT, in order", () => {
    expect(NIGERIAN_STATES).toHaveLength(37);
    expect([...NIGERIAN_STATES].sort((a, b) => a.localeCompare(b))).toEqual([...NIGERIAN_STATES]);
    expect(isNigerianState("Lagos")).toBe(true);
    expect(isNigerianState("lagos")).toBe(false);
    expect(isNigerianState("Wakanda")).toBe(false);
  });

  it("puts states in the right zone", () => {
    expect(zoneForState("Lagos")).toBe("lagos");
    for (const state of ["Ogun", "Oyo", "Osun", "Ondo", "Ekiti"] as const) expect(zoneForState(state)).toBe("south-west");
    for (const state of ["Kano", "Rivers", "FCT (Abuja)", "Kwara"] as const) expect(zoneForState(state)).toBe("rest-of-nigeria");
  });

  it("charges the zone fee below the free-delivery threshold", () => {
    expect(deliveryQuote("Lagos", 5_000_000)).toEqual({
      zone: "lagos",
      feeKobo: DELIVERY_ZONES.lagos.feeKobo,
      days: DELIVERY_ZONES.lagos.days,
      free: false,
    });
    expect(deliveryQuote("Kano", FREE_DELIVERY_FROM_KOBO - 1).feeKobo).toBe(5_000_00);
  });

  it("is free from the threshold upwards", () => {
    expect(deliveryQuote("Kano", FREE_DELIVERY_FROM_KOBO)).toMatchObject({ feeKobo: 0, free: true });
  });
});

describe("Nigerian phone numbers", () => {
  it.each([
    ["0803 123 4567", "+2348031234567"],
    ["08031234567", "+2348031234567"],
    ["+234 803 123 4567", "+2348031234567"],
    ["234-803-123-4567", "+2348031234567"],
    ["(0803) 123-4567", "+2348031234567"],
    ["0703 000 0000", "+2347030000000"],
    ["0913 555 1212", "+2349135551212"],
  ])("accepts %s", (input, expected) => {
    expect(normalizeNigerianPhone(input)).toBe(expected);
  });

  it.each(["", "12345", "0603 123 4567", "+1 415 555 0100", "080312345678", "0803123456", "phone"])("rejects %j", (input) => {
    expect(normalizeNigerianPhone(input)).toBeNull();
  });

  it("formats numbers the local way", () => {
    expect(formatNigerianPhone("+2348031234567")).toBe("0803 123 4567");
    expect(formatNigerianPhone("+447700900123")).toBe("+447700900123");
  });
});

describe("order references", () => {
  it("are short, readable and well formed", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 2000; i++) {
      const reference = generateOrderReference();
      expect(isOrderReference(reference)).toBe(true);
      expect(reference.slice(3)).not.toMatch(/[ILOU]/);
      seen.add(reference);
    }
    expect(seen.size).toBeGreaterThan(1990);
  });

  it("rejects anything else", () => {
    for (const value of ["IA-ABC", "IA-ABCDEFG", "ia-7k3m9q", "IA-7K3M9O", "XX-7K3M9Q", "IA-7K3M9Q; drop table", 42]) {
      expect(isOrderReference(value)).toBe(false);
    }
  });
});
