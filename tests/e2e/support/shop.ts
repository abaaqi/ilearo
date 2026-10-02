import { expect, type Page } from "@playwright/test";

/** The header's cart link, e.g. "Cart, 2 items". */
export const cartLink = (page: Page) => page.getByRole("link", { name: /^Cart, \d+ items?$/ });

export async function expectCartCount(page: Page, count: number) {
  await expect(cartLink(page)).toHaveAccessibleName(`Cart, ${count} ${count === 1 ? "item" : "items"}`);
}

export async function addToCart(page: Page, slug: string, quantity = 1) {
  await page.goto(`/products/${slug}`);
  await page.getByLabel("Quantity").selectOption(String(quantity));
  await page.getByRole("button", { name: "Add to cart" }).click();
  await expect(page.getByRole("status")).toContainText("Added");
}

export type Delivery = {
  fullName: string;
  phone: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  notes: string;
};

export const LAGOS_DELIVERY: Delivery = {
  fullName: "Amina Bello",
  phone: "0803 123 4567",
  address1: "14 Adeola Odeku Street",
  address2: "Flat 3, Glover Court",
  city: "Victoria Island",
  state: "Lagos",
  notes: "",
};

export async function fillDelivery(page: Page, delivery: Partial<Delivery> = {}) {
  const v = { ...LAGOS_DELIVERY, ...delivery };
  await page.getByLabel("Full name").fill(v.fullName);
  await page.getByLabel("Phone number").fill(v.phone);
  await page.getByLabel("Street address").fill(v.address1);
  await page.getByLabel(/Apartment, estate or landmark/).fill(v.address2);
  await page.getByLabel("Town or city").fill(v.city);
  await page.getByLabel("State", { exact: true }).selectOption(v.state);
  await page.getByLabel(/Delivery notes/).fill(v.notes);
}

export const placeOrderButton = (page: Page) => page.getByRole("button", { name: /^Place order for ₦/ });
