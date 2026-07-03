const STORAGE_KEY = "zhejiangArtWhitepaperPrograms";
const RANK_STORAGE_KEY = "zhejiangArtWhitepaperRankTable";

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

export function savePrograms(records, meta = {}) {
  if (!canUseStorage()) return false;
  const payload = {
    records: Array.isArray(records) ? records : [],
    meta: {
      fileName: meta.fileName || "",
      importedAt: meta.importedAt || new Date().toISOString(),
      totalRows: meta.totalRows || 0,
      skippedRows: meta.skippedRows || 0
    }
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

function savePayload(storageKey, records, meta = {}) {
  if (!canUseStorage()) return false;
  const payload = {
    records: Array.isArray(records) ? records : [],
    meta: {
      fileName: meta.fileName || "",
      importedAt: meta.importedAt || new Date().toISOString(),
      totalRows: meta.totalRows || 0,
      skippedRows: meta.skippedRows || 0
    }
  };
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

function loadPayload(storageKey) {
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
    return {
      records: Array.isArray(payload.records) ? payload.records : [],
      meta: payload.meta || null
    };
  } catch {
    return {
      records: [],
      meta: null
    };
  }
}

export function loadProgramPayload() {
  return loadPayload(STORAGE_KEY);
}

export function loadPrograms() {
  return loadProgramPayload().records;
}

export function clearPrograms() {
  if (!canUseStorage()) return false;
  window.localStorage.removeItem(STORAGE_KEY);
  return true;
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
  if (!canUseStorage()) return false;
  window.localStorage.removeItem(RANK_STORAGE_KEY);
  return true;
}
