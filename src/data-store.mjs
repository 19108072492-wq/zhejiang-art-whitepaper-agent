import { normalizeArtCategory } from "./categories.mjs";

const STORAGE_KEY = "zhejiangArtWhitepaperPrograms";
const RANK_STORAGE_KEY = "zhejiangArtWhitepaperRankTable";
const DEFAULT_DATA_API_PATH = "/api/data";
const memoryPayloads = new Map();
let remoteLoadPromise = null;
let remoteDataLoaded = false;
let remoteDataError = "";

function canUseStorage() {
  try {
    if (typeof window === "undefined" || !window.localStorage) return false;
    const testKey = "__zhejiang_art_whitepaper_storage_test__";
    window.localStorage.setItem(testKey, "1");
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

function cleanMeta(meta = {}) {
  return {
    ...meta,
    fileName: meta.fileName || "",
    importedAt: meta.importedAt || new Date().toISOString(),
    totalRows: meta.totalRows || 0,
    skippedRows: meta.skippedRows || 0
  };
}

function normalizePayload(records, meta = {}) {
  return {
    records: Array.isArray(records) ? records : [],
    meta: cleanMeta(meta)
  };
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function cleanText(value, maxLength = 120) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function cleanRecordObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function compactProgram(program) {
  if (!program || typeof program !== "object") return null;
  return {
    school: cleanText(program.school, 80),
    program: cleanText(program.program, 100),
    province: cleanText(program.province, 30),
    city: cleanText(program.city, 30),
    schoolLevel: cleanText(program.schoolLevel, 80),
    minScore: toNumber(program.minScore),
    minRank: toNumber(program.minRank),
    diff: toNumber(program.diff)
  };
}

function compactList(items, mapper, limit = 6) {
  return (Array.isArray(items) ? items : [])
    .map(mapper)
    .filter(Boolean)
    .slice(0, limit);
}

function compactInsight(item) {
  if (!item || typeof item !== "object") return null;
  return {
    title: cleanText(item.title || item.label, 40),
    body: cleanText(item.body || item.detail, 140),
    value: cleanText(item.value, 40)
  };
}

function compactSamples(samples = {}) {
  return {
    chong: compactProgram(samples.chong),
    wen: compactProgram(samples.wen),
    bao: compactProgram(samples.bao)
  };
}

function cachePayload(storageKey, records, meta = {}) {
  const payload = normalizePayload(records, meta);
  memoryPayloads.set(storageKey, payload);
  if (!canUseStorage()) return false;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

function savePayload(storageKey, records, meta = {}) {
  return cachePayload(storageKey, records, meta);
}

function loadPayload(storageKey) {
  if (memoryPayloads.has(storageKey)) {
    const payload = memoryPayloads.get(storageKey);
    return {
      records: Array.isArray(payload.records) ? payload.records : [],
      meta: payload.meta || null
    };
  }
  if (!canUseStorage()) {
    return {
      records: [],
      meta: null
    };
  }
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return {
        records: [],
        meta: null
      };
    }
    const payload = JSON.parse(raw);
    const normalized = {
      records: Array.isArray(payload.records) ? payload.records : [],
      meta: payload.meta || null
    };
    memoryPayloads.set(storageKey, normalized);
    return normalized;
  } catch {
    return {
      records: [],
      meta: null
    };
  }
}

function clearPayload(storageKey) {
  memoryPayloads.delete(storageKey);
  if (!canUseStorage()) return false;
  window.localStorage.removeItem(storageKey);
  return true;
}

function browserFetch() {
  if (typeof fetch === "function") return fetch;
  if (typeof window !== "undefined" && typeof window.fetch === "function") return window.fetch.bind(window);
  return null;
}

function hostname() {
  return typeof window !== "undefined" ? window.location?.hostname || "" : "";
}

function dataApiConfigValue() {
  return typeof window !== "undefined" ? String(window.WHITEPAPER_DATA_API_URL ?? "").trim() : "";
}

export function getDataApiUrl() {
  const configuredUrl = dataApiConfigValue();
  if (configuredUrl) return configuredUrl;
  const host = hostname();
  const protocol = typeof window !== "undefined" ? window.location?.protocol || "" : "";
  if (!host || host.endsWith("github.io") || protocol === "file:") return "";
  return DEFAULT_DATA_API_PATH;
}

export function buildRemoteSavePayload(action, payload = {}) {
  return {
    action,
    ...payload
  };
}

async function requestDataApi(action, payload = {}) {
  const apiUrl = getDataApiUrl();
  const fetcher = browserFetch();
  if (!apiUrl) throw new Error("未配置数据接口，请先在 config.js 设置 WHITEPAPER_DATA_API_URL。");
  if (!fetcher) throw new Error("当前环境不支持网络请求。");

  let response;
  try {
    response = await fetcher(apiUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(buildRemoteSavePayload(action, payload))
    });
  } catch {
    throw new Error("网络请求失败，请检查 Supabase 数据接口是否可访问。");
  }

  let result = null;
  try {
    result = await response.json();
  } catch {
    result = null;
  }

  if (!response.ok || result?.ok === false) {
    throw new Error(result?.error || `Supabase 数据接口返回 ${response.status}`);
  }
  return result || { ok: true };
}

function cacheDatasets(result) {
  const programs = result?.programs;
  const rank = result?.rank;
  if (programs && Array.isArray(programs.records)) {
    cacheProgramPayload(programs.records, programs.meta || {});
  }
  if (rank && Array.isArray(rank.records)) {
    cacheRankPayload(rank.records, rank.meta || {});
  }
}

export async function hydrateRemoteData(options = {}) {
  const force = Boolean(options.force);
  if (remoteDataLoaded && !force) {
    return {
      ok: true,
      programs: loadProgramPayload(),
      rank: loadRankPayload(),
      error: remoteDataError
    };
  }
  if (remoteLoadPromise && !force) return remoteLoadPromise;

  remoteLoadPromise = requestDataApi("getDatasets")
    .then((result) => {
      cacheDatasets(result);
      remoteDataLoaded = true;
      remoteDataError = "";
      return {
        ok: true,
        programs: loadProgramPayload(),
        rank: loadRankPayload(),
        error: ""
      };
    })
    .catch((error) => {
      remoteDataLoaded = false;
      remoteDataError = error instanceof Error ? error.message : "数据接口读取失败。";
      return {
        ok: false,
        programs: loadProgramPayload(),
        rank: loadRankPayload(),
        error: remoteDataError
      };
    })
    .finally(() => {
      remoteLoadPromise = null;
    });

  return remoteLoadPromise;
}

export function getRemoteDataState() {
  return {
    loaded: remoteDataLoaded,
    error: remoteDataError
  };
}

export async function validateAdminSecretRemote(adminSecret) {
  return requestDataApi("adminLogin", { adminSecret });
}

export async function saveProgramCategoryRemote({ category, records, meta = {}, adminSecret }) {
  const result = await requestDataApi("saveProgramCategory", {
    category,
    records,
    meta,
    adminSecret
  });
  cacheDatasets(result);
  remoteDataLoaded = true;
  return result;
}

export async function saveRankTableRemote({ records, meta = {}, adminSecret }) {
  const result = await requestDataApi("saveRankTable", {
    records,
    meta,
    adminSecret
  });
  cacheDatasets(result);
  remoteDataLoaded = true;
  return result;
}

export async function clearProgramCategoryRemote({ category, adminSecret }) {
  const result = await requestDataApi("clearProgramCategory", {
    category,
    adminSecret
  });
  cacheDatasets(result);
  remoteDataLoaded = true;
  return result;
}

export async function clearRankTableRemote({ adminSecret }) {
  const result = await requestDataApi("clearRankTable", { adminSecret });
  cacheDatasets(result);
  remoteDataLoaded = true;
  return result;
}

export function buildReportRecordPayload({
  input = {},
  report = {},
  narratives = {},
  sourceLabel = "",
  dataContext = {}
} = {}) {
  const scoreProfile = cleanRecordObject(report.scoreProfile);
  const rankEstimate = cleanRecordObject(report.rankEstimate);
  const reportContext = cleanRecordObject(report.context);
  const normalizedCategory = normalizeArtCategory(input.artCategory || report.artCategory);

  return {
    studentName: cleanText(input.studentName, 40),
    mode: "simple",
    artCategory: normalizedCategory,
    input: {
      artCategory: normalizedCategory,
      cultureTotal: toNumber(input.cultureTotal),
      professionalScore: toNumber(input.professionalScore),
      studentStage: cleanText(input.studentStage || reportContext.studentStage, 30),
      scoreSource: cleanText(input.scoreSource || reportContext.scoreSource, 30),
      planningGoal: cleanText(input.planningGoal || reportContext.planningGoal, 40),
      familyBoundary: cleanText(input.familyBoundary || reportContext.familyBoundary, 40)
    },
    scoreProfile: {
      cultureTotal: toNumber(scoreProfile.cultureTotal),
      professionalScore: toNumber(scoreProfile.professionalScore),
      currentCompositeScore: toNumber(scoreProfile.currentCompositeScore),
      targetCompositeScore: toNumber(scoreProfile.targetCompositeScore),
      compositeGap: toNumber(scoreProfile.compositeGap),
      cultureLiftNeeded: toNumber(scoreProfile.cultureLiftNeeded)
    },
    rankEstimate: {
      score: toNumber(rankEstimate.score),
      matchedScore: toNumber(rankEstimate.matchedScore),
      rank: toNumber(rankEstimate.rank)
    },
    narratives: {
      headline: cleanText(narratives.headline, 40),
      stageGoalInsight: cleanText(narratives.stageGoalInsight, 90),
      scoreInsight: cleanText(narratives.scoreInsight, 90),
      gapReason: cleanText(narratives.gapReason, 90),
      schoolTierInsight: cleanText(narratives.schoolTierInsight, 90),
      nextStep: cleanText(narratives.nextStep, 80)
    },
    report: {
      currentSamples: compactSamples(report.currentSamples),
      unlockedPrograms: compactList(report.unlockedPrograms, compactProgram, 2),
      keyTakeaways: compactList(report.keyTakeaways, compactInsight, 3),
      studentInterpretation: {
        title: cleanText(report.studentInterpretation?.title, 60),
        body: cleanText(report.studentInterpretation?.body, 180),
        points: compactList(report.studentInterpretation?.points, compactInsight, 3)
      },
      scoreStructure: compactList(report.scoreStructure, compactInsight, 4),
      nextCheckpoints: compactList(report.nextCheckpoints, compactInsight, 3),
      consultChecklist: (Array.isArray(report.consultChecklist) ? report.consultChecklist : [])
        .map((item) => cleanText(item, 30))
        .filter(Boolean)
        .slice(0, 8)
    },
    meta: {
      sourceLabel: cleanText(sourceLabel, 20),
      dataContext: cleanRecordObject(dataContext)
    }
  };
}

export async function saveReportRecordRemote(record) {
  return requestDataApi("saveReportRecord", { record });
}

export async function loadReportRecordsRemote({ adminSecret, limit = 80 } = {}) {
  const result = await requestDataApi("getReportRecords", {
    adminSecret,
    limit
  });
  return Array.isArray(result.records) ? result.records : [];
}

export function cacheProgramPayload(records, meta = {}) {
  cachePayload(STORAGE_KEY, records, meta);
}

export function cacheRankPayload(records, meta = {}) {
  cachePayload(RANK_STORAGE_KEY, records, meta);
}

export function savePrograms(records, meta = {}) {
  return savePayload(STORAGE_KEY, records, meta);
}

export function loadProgramPayload() {
  return loadPayload(STORAGE_KEY);
}

export function loadPrograms() {
  return loadProgramPayload().records;
}

export function clearPrograms() {
  return clearPayload(STORAGE_KEY);
}

export function saveRankTable(records, meta = {}) {
  return savePayload(RANK_STORAGE_KEY, records, meta);
}

export function loadRankPayload() {
  return loadPayload(RANK_STORAGE_KEY);
}

export function loadRankTable() {
  return loadRankPayload().records;
}

export function clearRankTable() {
  return clearPayload(RANK_STORAGE_KEY);
}

export function buildDataContext({
  sourceLabel = "参考数据",
  artCategory = "",
  programPayload = loadProgramPayload(),
  rankPayload = loadRankPayload(),
  rankEstimate = null
} = {}) {
  const category = normalizeArtCategory(artCategory);
  const programRecords = Array.isArray(programPayload?.records) ? programPayload.records : [];
  const rankRecords = Array.isArray(rankPayload?.records) ? rankPayload.records : [];
  const categoryProgramCount = programRecords.filter((record) =>
    normalizeArtCategory(record.artCategory) === category
  ).length;
  const categoryRankCount = rankRecords.filter((record) =>
    normalizeArtCategory(record.artCategory) === category
  ).length;

  return {
    dataSource: sourceLabel,
    usesUploadedPrograms: sourceLabel === "正式数据" && categoryProgramCount > 0,
    usesUploadedRankTable: categoryRankCount > 0,
    programRecordCount: programRecords.length,
    rankRecordCount: rankRecords.length,
    categoryProgramCount,
    categoryRankCount,
    rankMatchedScore: rankEstimate?.matchedScore ?? 0,
    estimatedRank: rankEstimate?.rank ?? 0
  };
}
