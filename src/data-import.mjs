import { ART_CATEGORIES, normalizeArtCategory } from "./categories.mjs";

const FIELD_ALIASES = {
  schoolCode: ["院校代码", "学校代码", "院校代号", "学校代号"],
  school: ["院校代名称", "院校代码名称", "院校代码及名称", "院校名称", "学校", "院校", "学校名称", "大学"],
  schoolLevel: ["院校层次", "学校层次", "办学层次", "院校标签", "公办/民办，省重点，985，211，双一流", "公办民办省重点985211双一流"],
  province: ["省份", "省", "所在省份"],
  city: ["城市", "所在地", "所在城市", "地区"],
  program: ["专业名称", "专业", "招生专业"],
  artCategory: ["艺考类别", "类别", "专业类别", "艺术类别", "科类方向名称", "科类方向"],
  minScore: ["综合分", "录取综合分", "最低综合分", "投档分", "录取最低分", "最低分", "录取分"],
  minRank: ["位次号", "最低位次号", "位次", "最低位次", "录取位次", "最低排名"],
  direction: ["培养方向", "专业方向", "专业导向", "专业导向/课程设置", "培养人才目标", "课程设置"]
};

const RANK_FIELD_ALIASES = {
  artCategory: ["艺考类别", "类别", "专业类别", "专业类", "专业", "艺术类别", "统考类别", "统考专业", "科类或方向名称", "科类方向名称", "科类方向"],
  score: ["综合分成绩", "综合分", "专业分", "专业成绩", "统考分", "分数", "成绩"],
  rank: ["人数累计", "累计人数", "位次号", "累计位次", "专业位次", "位次", "排名", "本段累计"]
};

function cleanText(value) {
  return String(value ?? "").trim();
}

function compactHeader(value) {
  return cleanText(value).replace(/\s+/g, "");
}

function toNumber(value) {
  const text = cleanText(value).replace(/,/g, "");
  const match = text.match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

function recognizedArtCategory(value) {
  const category = normalizeArtCategory(value);
  return ART_CATEGORIES.some((item) => item.value === category) ? category : "";
}

function rankScoreType(header) {
  return /综合/.test(cleanText(header)) ? "composite" : "professional";
}

function detectField(headers, aliases, options = {}) {
  const compactHeaders = headers.map((header) => ({
    raw: header,
    compact: compactHeader(header)
  }));
  const exactOnlyAliases = new Set((options.exactOnlyAliases || []).map(compactHeader));
  for (const alias of aliases) {
    const compactAlias = compactHeader(alias);
    const exact = compactHeaders.find((header) => header.compact === compactAlias);
    if (exact) return exact.raw;
  }
  for (const alias of aliases) {
    const compactAlias = compactHeader(alias);
    if (compactAlias.length <= 1) continue;
    if (exactOnlyAliases.has(compactAlias)) continue;
    const partial = compactHeaders.find((header) => header.compact.includes(compactAlias));
    if (partial) return partial.raw;
  }
  return "";
}

export function detectHeaders(row) {
  const headers = Object.keys(row ?? {});
  return Object.fromEntries(
    Object.entries(FIELD_ALIASES).map(([field, aliases]) => [
      field,
      detectField(headers, aliases)
    ])
  );
}

export function detectRankHeaders(row) {
  const headers = Object.keys(row ?? {});
  return Object.fromEntries(
    Object.entries(RANK_FIELD_ALIASES).map(([field, aliases]) => [
      field,
      detectField(headers, aliases, field === "artCategory" ? { exactOnlyAliases: ["专业"] } : {})
    ])
  );
}

function valueFromRow(row, headers, field) {
  const key = headers[field];
  return key ? row[key] : "";
}

function normalizeRow(row, options = {}) {
  const headers = detectHeaders(row);
  const schoolCode = cleanText(valueFromRow(row, headers, "schoolCode"));
  const school = cleanText(valueFromRow(row, headers, "school")) || schoolCode;
  const program = cleanText(valueFromRow(row, headers, "program"));
  const minScore = toNumber(valueFromRow(row, headers, "minScore"));
  const direction = cleanText(valueFromRow(row, headers, "direction"));
  const artCategory = normalizeArtCategory(options.forceCategory || valueFromRow(row, headers, "artCategory") || options.categoryHint);

  if (!school || !program || !minScore) {
    return null;
  }

  return {
    schoolCode,
    school,
    schoolLevel: cleanText(valueFromRow(row, headers, "schoolLevel")),
    province: cleanText(valueFromRow(row, headers, "province")),
    city: cleanText(valueFromRow(row, headers, "city")),
    program,
    artCategory,
    minScore,
    minRank: toNumber(valueFromRow(row, headers, "minRank")),
    direction,
    batch: "",
    planCount: 0,
    tuition: 0,
    tags: direction ? [direction] : [],
    isSinoForeign: /中外|合作/.test(`${school}${program}${direction}`)
  };
}

export function normalizeImportedRows(rows, options = {}) {
  const records = [];
  let skippedRows = 0;

  for (const row of rows ?? []) {
    const record = normalizeRow(row, options);
    if (record) {
      records.push(record);
    } else {
      skippedRows += 1;
    }
  }

  return {
    records,
    skippedRows,
    totalRows: Array.isArray(rows) ? rows.length : 0
  };
}

function normalizeRankRow(row, options = {}) {
  const headers = detectRankHeaders(row);
  const score = toNumber(valueFromRow(row, headers, "score"));
  const rank = toNumber(valueFromRow(row, headers, "rank"));
  const artCategory = recognizedArtCategory(valueFromRow(row, headers, "artCategory")) ||
    recognizedArtCategory(options.categoryHint) ||
    recognizedArtCategory(options.forceCategory) ||
    recognizedArtCategory(options.fallbackCategory);

  if (!score || !rank) {
    return null;
  }

  return {
    artCategory,
    score,
    rank,
    scoreType: rankScoreType(headers.score)
  };
}

export function mergeRecordsByDetectedCategories(existingRecords, nextRecords, fallbackCategory = "") {
  const normalizedNextRecords = (Array.isArray(nextRecords) ? nextRecords : [])
    .map((record) => ({
      ...record,
      artCategory: normalizeArtCategory(record.artCategory || fallbackCategory)
    }))
    .filter((record) => normalizeArtCategory(record.artCategory));
  const replaceCategories = new Set(normalizedNextRecords.map((record) => normalizeArtCategory(record.artCategory)));
  if (!replaceCategories.size) return Array.isArray(existingRecords) ? existingRecords : [];
  const keptRecords = (Array.isArray(existingRecords) ? existingRecords : [])
    .filter((record) => !replaceCategories.has(normalizeArtCategory(record.artCategory)));
  return [...keptRecords, ...normalizedNextRecords];
}

export function normalizeRankRows(rows, options = {}) {
  const records = [];
  let skippedRows = 0;

  for (const row of rows ?? []) {
    const record = normalizeRankRow(row, options);
    if (record) {
      records.push(record);
    } else {
      skippedRows += 1;
    }
  }

  return {
    records,
    skippedRows,
    totalRows: Array.isArray(rows) ? rows.length : 0
  };
}

export function estimateRankFromScore(records, artCategory, score, options = {}) {
  const currentScore = toNumber(score);
  if (!currentScore) return null;

  const category = normalizeArtCategory(artCategory);
  let scopedRows = (Array.isArray(records) ? records : [])
    .filter((row) => {
      const rowCategory = normalizeArtCategory(row.artCategory);
      return !rowCategory || !category || rowCategory === category;
    })
    .filter((row) => toNumber(row.score) > 0 && toNumber(row.rank) > 0)
    .sort((a, b) => toNumber(b.score) - toNumber(a.score));

  if (options.scoreType) {
    const typedRows = scopedRows.filter((row) => row.scoreType === options.scoreType);
    if (typedRows.length) {
      scopedRows = typedRows;
    } else if (options.requireScoreType) {
      return null;
    }
  }

  if (!scopedRows.length) return null;

  const matched = scopedRows.find((row) => toNumber(row.score) <= currentScore) ?? scopedRows.at(-1);

  return {
    rank: toNumber(matched.rank),
    matchedScore: toNumber(matched.score),
    exact: toNumber(matched.score) === currentScore,
    scoreType: matched.scoreType || ""
  };
}
