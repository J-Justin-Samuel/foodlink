/** "₹1,250.00" from paise. Currency defaults to the rupee. */
export function formatMoney(minor: number, currency = "inr"): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(minor / 100);
}
