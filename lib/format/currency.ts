const euroCurrencyFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const signedEuroCurrencyFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: "always",
});

export function formatEuroCurrency(value: number) {
  return euroCurrencyFormatter.format(value);
}

export function formatSignedEuroCurrency(value: number) {
  return signedEuroCurrencyFormatter.format(value);
}
