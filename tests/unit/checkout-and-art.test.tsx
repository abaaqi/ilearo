import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { checkoutSchema, readCheckoutForm } from "@/lib/checkout-schema";
import { AdireArt, MOTIFS, PATTERNS, chooseMotifs, makeRand } from "@/components/adire/art";

const valid = {
  fullName: "  Amina Bello ",
  phone: "0803 123 4567",
  address1: "14 Adeola Odeku Street",
  address2: "  ",
  city: "Victoria Island",
  state: "Lagos",
  notes: "",
  paymentMethod: "pay_on_delivery",
};

const errorsFor = (input: Record<string, string>) => {
  const result = checkoutSchema.safeParse(input);
  if (result.success) return {};
  return Object.fromEntries(result.error.issues.map((issue) => [String(issue.path[0]), issue.message]));
};

describe("checkout validation", () => {
  it("cleans up valid input", () => {
    const result = checkoutSchema.parse(valid);
    expect(result).toEqual({
      fullName: "Amina Bello",
      phone: "+2348031234567",
      address1: "14 Adeola Odeku Street",
      address2: null,
      city: "Victoria Island",
      state: "Lagos",
      notes: null,
      paymentMethod: "pay_on_delivery",
    });
  });

  it("explains how to fix each field", () => {
    expect(
      errorsFor({ fullName: "A", phone: "12", address1: "x", address2: "", city: "", state: "Atlantis", notes: "", paymentMethod: "cash" }),
    ).toEqual({
      fullName: "Enter the name of the person receiving the order.",
      phone: "Enter a Nigerian mobile number, like 0803 123 4567.",
      address1: "Enter a street address, like 12 Adeola Odeku Street.",
      city: "Enter the town or city.",
      state: "Choose the state for delivery.",
      paymentMethod: "Choose how you'd like to pay.",
    });
  });

  it("limits long text", () => {
    expect(errorsFor({ ...valid, notes: "x".repeat(501) }).notes).toBe("Keep delivery notes under 500 characters.");
  });

  it("reads only the expected form fields", () => {
    const form = new FormData();
    form.set("fullName", "Amina");
    form.set("priceKobo", "1");
    form.set("isAdmin", "true");
    const values = readCheckoutForm(form);
    expect(values.fullName).toBe("Amina");
    expect(values.phone).toBe("");
    expect(values).not.toHaveProperty("priceKobo");
    expect(values).not.toHaveProperty("isAdmin");
  });
});

describe("adire art", () => {
  it("draws every pattern, the same way every time", () => {
    for (const pattern of PATTERNS) {
      const spec = { pattern, seed: 42, tone: "mid" as const };
      const first = renderToStaticMarkup(<AdireArt spec={spec} />);
      expect(first).toContain("<svg");
      expect(first.length).toBeGreaterThan(500);
      expect(renderToStaticMarkup(<AdireArt spec={spec} />)).toBe(first);
    }
  });

  it("is decorative unless labelled", () => {
    const spec = { pattern: "moons" as const, seed: 1, tone: "deep" as const };
    expect(renderToStaticMarkup(<AdireArt spec={spec} />)).toContain('aria-hidden="true"');
    expect(renderToStaticMarkup(<AdireArt spec={spec} label="Tied moons" />)).toContain('role="img" aria-label="Tied moons"');
  });

  it("never repeats a motif next to itself", () => {
    const rand = makeRand(5);
    for (let run = 0; run < 50; run++) {
      const grid = chooseMotifs(16, 4, rand);
      grid.forEach((motif, i) => {
        expect(MOTIFS).toContain(motif);
        if (i % 4 !== 0) expect(motif).not.toBe(grid[i - 1]);
        if (i >= 4) expect(motif).not.toBe(grid[i - 4]);
      });
    }
  });
});
