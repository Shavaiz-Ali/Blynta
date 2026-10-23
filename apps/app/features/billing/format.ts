export function formatBillingPrice(
  price?: { amount: string; currencyCode: string },
  showCurrency = false,
) {
  if (!price) return undefined;
  try {
    const amount = Number(price.amount);
    if (!Number.isSafeInteger(amount) || amount < 0) return undefined;
    const base = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: price.currencyCode,
    });
    const digits = base.resolvedOptions().maximumFractionDigits ?? 2;
    const formatter = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: price.currencyCode,
      minimumFractionDigits: showCurrency ? digits : 0,
      maximumFractionDigits: digits,
    });
    const formatted = formatter.format(amount / 10 ** digits);
    return showCurrency ? `${formatted} ${price.currencyCode}` : formatted;
  } catch {
    return undefined;
  }
}
