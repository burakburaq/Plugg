import messages from "../locales/en.json" with { type: "json" };

export function t(key, ...values) {
  const translated = globalThis.chrome?.i18n?.getMessage?.(key, values.map(String));
  return translated || (messages[key]?.message ?? key).replace(/\$(\d+)/g, (_, index) => String(values[Number(index) - 1] ?? ""));
}

export function uiLocale() {
  return "en";
}
