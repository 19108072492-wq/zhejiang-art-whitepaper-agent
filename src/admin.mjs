import { normalizeImportedRows, normalizeRankRows } from "./data-import.mjs";
import {
  clearPrograms,
  clearRankTable,
  loadProgramPayload,
  loadRankPayload,
  savePrograms,
  saveRankTable
} from "./data-store.mjs";
import { ART_CATEGORIES, normalizeArtCategory } from "./categories.mjs";

const ADMIN_SECRET = "ffjy123456";
const ADMIN_SESSION_KEY = "ffjy-admin-unlocked";
const adminLogin = document.querySelector("#admin-login");
const adminApp = document.querySelector("#admin-app");
const adminLoginForm = document.querySelector("#admin-login-form");
const adminSecretInput = document.querySelector("#admin-secret");
const adminLoginError = document.querySelector("#admin-login-error");
const adminLogoutButton = document.querySelector("#admin-logout");
const fileInput = document.querySelector("#excel-file");
const saveButton = document.querySelector("#save-import");
const clearButton = document.querySelector("#clear-import");
const statusNode = document.querySelector("#import-status");
const summaryNode = document.querySelector("#import-summary");
const previewWrap = document.querySelector("#preview-wrap");
const storedState = document.querySelector("#stored-state");
const rankFileInput = document.querySelector("#rank-file");
const saveRankButton = document.querySelector("#save-rank");
const clearRankButton = document.querySelector("#clear-rank");
const rankStatusNode = document.querySelector("#rank-status");
const rankSummaryNode = document.querySelector("#rank-summary");
const rankPreviewWrap = document.querySelector("#rank-preview-wrap");
const rankStoredState = document.querySelector("#rank-stored-state");
const programCategoryInputs = Array.from(document.querySelectorAll('input[name="programCategory"]'));
const rankCategoryInputs = Array.from(document.querySelectorAll('input[name="rankCategory"]'));

let currentImport = null;
let currentRankImport = null;

function showAdmin() {
  if (adminLogin) adminLogin.hidden = true;
  if (adminApp) adminApp.hidden = false;
}

function showLogin() {
  if (adminLogin) adminLogin.hidden = false;
  if (adminApp) adminApp.hidden = true;
  if (adminSecretInput) adminSecretInput.value = "";
}

function setLoginError(message) {
  if (!adminLoginError) return;
  adminLoginError.textContent = message;
  adminLoginError.hidden = !message;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function setStatus(message, kind = "info") {
  statusNode.textContent = message;
  statusNode.dataset.kind = kind;
  statusNode.hidden = !message;
}

function setRankStatus(message, kind = "info") {
  rankStatusNode.textContent = message;
  rankStatusNode.dataset.kind = kind;
  rankStatusNode.hidden = !message;
}

function selectedCategory(inputs) {
  return normalizeArtCategory(inputs.find((input) => input.checked)?.value || ART_CATEGORIES[0].value);
}

function categoryCounts(records) {
  const counts = new Map(ART_CATEGORIES.map((category) => [category.value, 0]));
  for (const record of records) {
    const category = normalizeArtCategory(record.artCategory);
    if (!counts.has(category)) counts.set(category, 0);
    counts.set(category, counts.get(category) + 1);
  }
  return ART_CATEGORIES.map((category) => ({
    label: category.label,
    count: counts.get(category.value) || 0
  }));
}

function renderCategoryCounts(records) {
  return `
    <div class="stored-category-list">
      ${categoryCounts(records).map((item) => `
        <span>${escapeHtml(item.label)}：<b>${escapeHtml(item.count)}</b></span>
      `).join("")}
    </div>
  `;
}

function mergeCategoryRecords(existingRecords, nextRecords, category) {
  const normalizedCategory = normalizeArtCategory(category);
  const keptRecords = (Array.isArray(existingRecords) ? existingRecords : [])
    .filter((record) => normalizeArtCategory(record.artCategory) !== normalizedCategory);
  const scopedNextRecords = (Array.isArray(nextRecords) ? nextRecords : [])
    .map((record) => ({
      ...record,
      artCategory: normalizedCategory
    }));
  return [...keptRecords, ...scopedNextRecords];
}

function renderSummary(node, result = { totalRows: 0, records: [], skippedRows: 0 }) {
  node.innerHTML = `
    <article>
      <span>总行数</span>
      <strong>${escapeHtml(result.totalRows)}</strong>
    </article>
    <article>
      <span>有效记录</span>
      <strong>${escapeHtml(result.records.length)}</strong>
    </article>
    <article>
      <span>跳过行</span>
      <strong>${escapeHtml(result.skippedRows)}</strong>
    </article>
  `;
}

function renderStoredState() {
  const payload = loadProgramPayload();
  if (!payload.records.length) {
    storedState.innerHTML = "<span>当前未保存院校专业表。</span>";
    return;
  }
  storedState.innerHTML = `
    <span>已保存：${escapeHtml(payload.meta?.fileName || "未命名 Excel")}</span>
    <strong>${escapeHtml(payload.records.length)} 条有效记录</strong>
    <span>${escapeHtml(formatTime(payload.meta?.importedAt))}</span>
    ${renderCategoryCounts(payload.records)}
  `;
}

function renderRankStoredState() {
  const payload = loadRankPayload();
  if (!payload.records.length) {
    rankStoredState.innerHTML = "<span>尚未保存一分一段表。</span>";
    return;
  }
  rankStoredState.innerHTML = `
    <span>已保存：${escapeHtml(payload.meta?.fileName || "未命名 Excel")}</span>
    <strong>${escapeHtml(payload.records.length)} 条分数位次记录</strong>
    <span>${escapeHtml(formatTime(payload.meta?.importedAt))}</span>
    ${renderCategoryCounts(payload.records)}
  `;
}

function renderPreview(records) {
  if (!records.length) {
    previewWrap.innerHTML = '<div class="empty-tier">没有识别到有效记录，请检查院校名称、专业名称、综合分字段。</div>';
    return;
  }

  const columns = [
    ["类别", "artCategory"],
    ["院校代码", "schoolCode"],
    ["院校名称", "school"],
    ["院校层次", "schoolLevel"],
    ["省份", "province"],
    ["城市", "city"],
    ["专业名称", "program"],
    ["综合分", "minScore"],
    ["位次号", "minRank"],
    ["培养方向", "direction"]
  ];

  previewWrap.innerHTML = `
    <table class="preview-table">
      <thead>
        <tr>
          ${columns.map(([label]) => `<th>${escapeHtml(label)}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        ${records.slice(0, 20).map((record) => `
          <tr>
            ${columns.map(([, key]) => {
              return `<td>${escapeHtml(record[key])}</td>`;
            }).join("")}
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderRankPreview(records) {
  if (!records.length) {
    rankPreviewWrap.innerHTML = '<div class="empty-tier">没有识别到有效记录，请检查专业分和位次字段。</div>';
    return;
  }

  const columns = [
    ["类别", "artCategory"],
    ["专业分", "score"],
    ["位次号", "rank"]
  ];

  rankPreviewWrap.innerHTML = `
    <table class="preview-table compact-preview-table">
      <thead>
        <tr>
          ${columns.map(([label]) => `<th>${escapeHtml(label)}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        ${records.slice(0, 20).map((record) => `
          <tr>
            ${columns.map(([, key]) => `<td>${escapeHtml(record[key])}</td>`).join("")}
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function normalizeWorkbookSheets(workbook, normalizer, category) {
  const totals = {
    records: [],
    skippedRows: 0,
    totalRows: 0
  };

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = window.XLSX.utils.sheet_to_json(sheet, { defval: "" });
    const result = normalizer(rows, { categoryHint: sheetName, forceCategory: category });
    totals.records.push(...result.records);
    totals.skippedRows += result.skippedRows;
    totals.totalRows += result.totalRows;
  }

  return totals;
}

async function handleFile(file) {
  const category = selectedCategory(programCategoryInputs);
  currentImport = null;
  saveButton.disabled = true;
  setStatus("");
  renderPreview([]);
  renderSummary(summaryNode);

  if (!file) return;
  if (!window.XLSX) {
    setStatus("Excel 解析库没有加载成功，请联网后刷新页面。", "error");
    return;
  }

  try {
    const buffer = await file.arrayBuffer();
    const workbook = window.XLSX.read(buffer, { type: "array" });
    if (!workbook.SheetNames.length) {
      setStatus("这个 Excel 没有可读取的工作表。", "error");
      return;
    }
    const result = normalizeWorkbookSheets(workbook, normalizeImportedRows, category);

    currentImport = {
      records: result.records,
      meta: {
        fileName: file.name,
        category,
        totalRows: result.totalRows,
        skippedRows: result.skippedRows
      }
    };
    renderSummary(summaryNode, result);
    renderPreview(result.records);
    saveButton.disabled = result.records.length === 0;
    setStatus(
      result.records.length
        ? `已按「${category}」读取 ${result.records.length} 条有效记录，可以保存到白皮书。`
        : "没有读到有效记录，请检查 Excel 表头。",
      result.records.length ? "success" : "error"
    );
  } catch (error) {
    console.error(error);
    setStatus("读取失败，请确认文件是正常的 Excel。", "error");
  }
}

async function handleRankFile(file) {
  const category = selectedCategory(rankCategoryInputs);
  currentRankImport = null;
  saveRankButton.disabled = true;
  setRankStatus("");
  renderRankPreview([]);
  renderSummary(rankSummaryNode);

  if (!file) return;
  if (!window.XLSX) {
    setRankStatus("Excel 解析库没有加载成功，请联网后刷新页面。", "error");
    return;
  }

  try {
    const buffer = await file.arrayBuffer();
    const workbook = window.XLSX.read(buffer, { type: "array" });
    if (!workbook.SheetNames.length) {
      setRankStatus("这个 Excel 没有可读取的工作表。", "error");
      return;
    }
    const result = normalizeWorkbookSheets(workbook, normalizeRankRows, category);

    currentRankImport = {
      records: result.records,
      meta: {
        fileName: file.name,
        category,
        totalRows: result.totalRows,
        skippedRows: result.skippedRows
      }
    };
    renderSummary(rankSummaryNode, result);
    renderRankPreview(result.records);
    saveRankButton.disabled = result.records.length === 0;
    setRankStatus(
      result.records.length
        ? `已按「${category}」读取 ${result.records.length} 条分数位次记录，可以保存到白皮书。`
        : "没有读到有效记录，请检查一分一段表表头。",
      result.records.length ? "success" : "error"
    );
  } catch (error) {
    console.error(error);
    setRankStatus("读取失败，请确认文件是正常的 Excel。", "error");
  }
}

fileInput.addEventListener("change", () => {
  handleFile(fileInput.files?.[0]);
});

rankFileInput.addEventListener("change", () => {
  handleRankFile(rankFileInput.files?.[0]);
});

for (const input of programCategoryInputs) {
  input.addEventListener("change", () => {
    currentImport = null;
    saveButton.disabled = true;
    fileInput.value = "";
    setStatus("");
    renderPreview([]);
    renderSummary(summaryNode);
  });
}

for (const input of rankCategoryInputs) {
  input.addEventListener("change", () => {
    currentRankImport = null;
    saveRankButton.disabled = true;
    rankFileInput.value = "";
    setRankStatus("");
    renderRankPreview([]);
    renderSummary(rankSummaryNode);
  });
}

saveButton.addEventListener("click", () => {
  if (!currentImport?.records.length) return;
  const category = currentImport.meta.category;
  const payload = loadProgramPayload();
  const mergedRecords = mergeCategoryRecords(payload.records, currentImport.records, category);
  const saved = savePrograms(mergedRecords, currentImport.meta);
  if (!saved) {
    setStatus("保存失败，请确认页面可以正常访问后再试。", "error");
    return;
  }
  setStatus(`「${category}」院校专业数据已保存。其他类别数据已保留。`, "success");
  renderStoredState();
});

clearButton.addEventListener("click", () => {
  const category = selectedCategory(programCategoryInputs);
  const payload = loadProgramPayload();
  const remainingRecords = mergeCategoryRecords(payload.records, [], category);
  if (remainingRecords.length) {
    savePrograms(remainingRecords, {
      fileName: payload.meta?.fileName || "",
      category,
      totalRows: remainingRecords.length,
      skippedRows: 0
    });
  } else {
    clearPrograms();
  }
  renderStoredState();
  setStatus(`已清空「${category}」院校专业数据。`, "success");
});

saveRankButton.addEventListener("click", () => {
  if (!currentRankImport?.records.length) return;
  const category = currentRankImport.meta.category;
  const payload = loadRankPayload();
  const mergedRecords = mergeCategoryRecords(payload.records, currentRankImport.records, category);
  const saved = saveRankTable(mergedRecords, currentRankImport.meta);
  if (!saved) {
    setRankStatus("保存失败，请确认页面可以正常访问后再试。", "error");
    return;
  }
  setRankStatus(`「${category}」一分一段数据已保存。其他类别数据已保留。`, "success");
  renderRankStoredState();
});

clearRankButton.addEventListener("click", () => {
  const category = selectedCategory(rankCategoryInputs);
  const payload = loadRankPayload();
  const remainingRecords = mergeCategoryRecords(payload.records, [], category);
  if (remainingRecords.length) {
    saveRankTable(remainingRecords, {
      fileName: payload.meta?.fileName || "",
      category,
      totalRows: remainingRecords.length,
      skippedRows: 0
    });
  } else {
    clearRankTable();
  }
  renderRankStoredState();
  setRankStatus(`已清空「${category}」一分一段数据。`, "success");
});

adminLoginForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  if (adminSecretInput.value === ADMIN_SECRET) {
    sessionStorage.setItem(ADMIN_SESSION_KEY, "true");
    setLoginError("");
    showAdmin();
    return;
  }
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
  setLoginError("密钥不正确，请重新输入。");
});

adminLogoutButton?.addEventListener("click", () => {
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
  showLogin();
});

renderSummary(summaryNode);
renderSummary(rankSummaryNode);
renderStoredState();
renderRankStoredState();

if (sessionStorage.getItem(ADMIN_SESSION_KEY) === "true") {
  showAdmin();
} else {
  showLogin();
}
