import idDict from "./locales/id.json" with { type: "json" };
import enDict from "./locales/en.json" with { type: "json" };

export const locales = ["id", "en"] as const;
export type Locale = (typeof locales)[number];

export const localeLabels: Record<Locale, string> = {
  id: "Indonesia",
  en: "English",
};

export const dictionaries: Record<Locale, Record<string, string>> = {
  id: idDict,
  en: enDict,
};
