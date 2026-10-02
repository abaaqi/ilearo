/** Dates are shown in the shop's own time zone, whatever server they render on. */
const SHOP_TIME_ZONE = "Africa/Lagos";

const longDate = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: SHOP_TIME_ZONE });
const dateTime = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: SHOP_TIME_ZONE,
});

/** 1 October 2026 */
export function formatDate(date: Date): string {
  return longDate.format(date);
}

/** 1 October 2026 at 14:05 */
export function formatDateTime(date: Date): string {
  return dateTime.format(date);
}
