export const ART_CATEGORIES = [
  { value: "美术与设计", label: "美术与设计" },
  { value: "播音", label: "播音" },
  { value: "舞蹈", label: "舞蹈" },
  { value: "书法", label: "书法" },
  { value: "表导", label: "表导" }
];

const CATEGORY_ALIASES = {
  "美术与设计": ["美术与设计类", "美术与设计", "美术设计", "美设", "美术类", "美术"],
  "播音": ["播音与主持类", "播音与主持", "播音主持", "播音"],
  "舞蹈": ["舞蹈类", "舞蹈"],
  "书法": ["书法类", "书法"],
  "表导": ["表(导)演类", "表（导）演类", "表导", "表导演", "表演导演", "表演(导演)", "表演（导演）"]
};

function compact(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/[（）]/g, (char) => (char === "（" ? "(" : ")"));
}

export function normalizeArtCategory(value) {
  const text = compact(value);
  if (!text) return "";

  for (const [category, aliases] of Object.entries(CATEGORY_ALIASES)) {
    if (aliases.some((alias) => text.includes(compact(alias)))) {
      return category;
    }
  }

  return String(value ?? "").trim();
}

export function categoryLabel(value) {
  const normalized = normalizeArtCategory(value);
  return ART_CATEGORIES.find((category) => category.value === normalized)?.label ?? normalized;
}
