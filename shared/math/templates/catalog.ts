import { EXPONENT_CATALOG } from "./exponents";
import { PASCAL_TEMPLATES } from "./pascal";

export const MATH_CATALOG = [
  ...EXPONENT_CATALOG.map(item => ({ ...item, family: "exponent" as const })),
  ...PASCAL_TEMPLATES.map(item => ({
    family: "pascal" as const, rule: item.id, name: item.title, timeLimit: item.timeLimit,
    description: item.description, keywords: "Pascal’s triangle binomial coefficients " + item.keywords,
  })),
];
export type MathCatalogEntry = typeof MATH_CATALOG[number];
export type MathCatalogRule = MathCatalogEntry["rule"];

const searchable = (value: string) => value.toLowerCase().replace(/['’]/g, "");
export function findMathSkills(search: string, rule: MathCatalogRule | "") {
  const words = searchable(search).trim().split(/\s+/);
  return MATH_CATALOG.filter(item => {
    const text = searchable(`${item.name} ${item.description} ${item.keywords}`);
    return (!rule || item.rule === rule) && words.every(word => text.includes(word));
  });
}
