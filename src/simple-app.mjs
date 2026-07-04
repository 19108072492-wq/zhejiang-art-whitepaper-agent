import {
  buildSimpleAgentRequest,
  buildSimpleNarrativeFallback,
  buildSimpleReport,
  normalizeSimpleNarratives
} from "./simple-core.mjs";
import { loadProgramPayload, loadRankPayload } from "./data-store.mjs";
import { samplePrograms } from "./sample-data.mjs";
import { normalizeArtCategory } from "./categories.mjs";

const form = document.querySelector("#simple-form");
const reportRoot = document.querySelector("#simple-report");
const errorNode = document.querySelector("#simple-error");
const submitButton = form.querySelector('button[type="submit"]');
const generationNode = document.querySelector("#simple-generation");
const countdownNode = document.querySelector("#simple-countdown");
const progressNode = document.querySelector("#simple-progress");
const DEFAULT_AGENT_API_PATH = "/api/analyze";
const SIMPLE_COUNTDOWN_SECONDS = 30;
let countdownTimer = 0;
let isGenerating = false;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatScore(value) {
  const number = toNumber(value);
  return Number.isInteger(number) ? String(number) : number.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function getAgentApiUrl() {
  const configuredUrl = String(window.WHITEPAPER_AGENT_API_URL ?? "").trim();
  if (configuredUrl) return configuredUrl;
  if (window.location.hostname.endsWith("github.io")) return "";
  return DEFAULT_AGENT_API_PATH;
}

function getProgramSource(artCategory) {
  const payload = loadProgramPayload();
  const category = normalizeArtCategory(artCategory);
  const categoryPrograms = payload.records.filter((program) => normalizeArtCategory(program.artCategory) === category);
  if (payload.records.length > 0 && categoryPrograms.length > 0) {
    return {
      programs: payload.records,
      label: "正式数据"
    };
  }
  return {
    programs: samplePrograms,
    label: "参考数据"
  };
}

function readInput() {
  const data = new FormData(form);
  return {
    artCategory: String(data.get("artCategory") || "美术与设计"),
    cultureTotal: toNumber(data.get("cultureTotal")),
    professionalScore: toNumber(data.get("professionalScore"))
  };
}

function validateInput(input) {
  if (input.cultureTotal <= 0 || input.cultureTotal > 750) {
    return "请填写文化总分，范围 0-750 分。";
  }
  if (input.professionalScore <= 0 || input.professionalScore > 300) {
    return "请填写专业成绩，满分 300 分。";
  }
  return "";
}

function setError(message) {
  errorNode.textContent = message;
  errorNode.hidden = !message;
}

function updateCountdown(secondsLeft) {
  const safeSeconds = Math.max(0, secondsLeft);
  if (countdownNode) {
    countdownNode.textContent = safeSeconds > 0 ? `预计还需 ${safeSeconds} 秒` : "正在整理报告内容";
  }
  if (progressNode) {
    const progress = ((SIMPLE_COUNTDOWN_SECONDS - safeSeconds) / SIMPLE_COUNTDOWN_SECONDS) * 100;
    progressNode.style.width = `${Math.max(0, Math.min(100, progress))}%`;
  }
  submitButton.textContent = safeSeconds > 0 ? `生成中，约 ${safeSeconds} 秒` : "正在整理报告...";
}

function stopCountdown() {
  if (countdownTimer) {
    window.clearInterval(countdownTimer);
    countdownTimer = 0;
  }
  generationNode.hidden = true;
  if (progressNode) progressNode.style.width = "0%";
}

function startCountdown() {
  stopCountdown();
  generationNode.hidden = false;
  let secondsLeft = SIMPLE_COUNTDOWN_SECONDS;
  updateCountdown(secondsLeft);
  window.requestAnimationFrame(() => {
    generationNode.scrollIntoView({ behavior: "smooth", block: "center" });
  });
  countdownTimer = window.setInterval(() => {
    secondsLeft -= 1;
    updateCountdown(secondsLeft);
  }, 1000);
}

function setLoading(isLoading) {
  submitButton.disabled = isLoading;
  if (isLoading) {
    startCountdown();
  } else {
    stopCountdown();
    submitButton.textContent = "生成快测报告";
  }
}

function formatLocation(program) {
  return [program?.province, program?.city].filter(Boolean).join(" / ") || "地区待补";
}

function renderProgram(program, fallback) {
  if (!program) return `<div class="simple-empty">${escapeHtml(fallback)}</div>`;
  return `
    <article class="simple-school-card">
      <strong>${escapeHtml(program.school)}</strong>
      <span>${escapeHtml(program.program)}</span>
      <small>${escapeHtml(formatLocation(program))} · ${escapeHtml(program.schoolLevel || "层次待补")} · 综合 ${escapeHtml(formatScore(program.minScore))}</small>
    </article>
  `;
}

function renderUnlocked(programs) {
  if (!programs.length) {
    return `<div class="simple-empty">暂无明显新增样本，建议先把当前层次讲清楚。</div>`;
  }
  return programs.map((program) => `
    <article class="simple-unlocked-card">
      <strong>${escapeHtml(program.school)}</strong>
      <span>${escapeHtml(program.program)}</span>
      <small>参考综合分 ${escapeHtml(formatScore(program.minScore))}</small>
    </article>
  `).join("");
}

function renderReport(report, narratives, source) {
  const profile = report.scoreProfile;
  form.hidden = true;
  reportRoot.hidden = false;
  reportRoot.innerHTML = `
    <div class="simple-report-actions">
      <button type="button" class="simple-secondary" data-action="edit-simple">重新填写</button>
    </div>
    <section class="simple-card simple-result-hero">
      <div class="simple-report-brand">
        <img src="./assets/feifan-logo.jpg" alt="非凡教育标志">
        <span>${escapeHtml(source.label)} · 快测报告</span>
      </div>
      <h2>${escapeHtml(narratives.headline)}</h2>
      <div class="simple-metrics">
        <article>
          <span>当前综合分</span>
          <strong>${formatScore(profile.currentCompositeScore)}</strong>
        </article>
        <article>
          <span>估算位次</span>
          <strong>${report.rankEstimate?.rank ? escapeHtml(report.rankEstimate.rank) : "待匹配"}</strong>
        </article>
        <article>
          <span>距目标差距</span>
          <strong>${formatScore(profile.compositeGap)}</strong>
        </article>
      </div>
    </section>

    <section class="simple-card simple-schools">
      <div class="simple-section-title">
        <span>当前可关注</span>
        <strong>冲 / 稳 / 保快照</strong>
      </div>
      <div class="simple-tier-grid">
        <div><b>冲</b>${renderProgram(report.currentSamples.chong, "暂无冲刺样本")}</div>
        <div><b>稳</b>${renderProgram(report.currentSamples.wen, "暂无稳妥样本")}</div>
        <div><b>保</b>${renderProgram(report.currentSamples.bao, "暂无保底样本")}</div>
      </div>
    </section>

    <section class="simple-card simple-lift">
      <div class="simple-section-title">
        <span>提分后可能打开</span>
        <strong>代表样本</strong>
      </div>
      <div class="simple-unlocked-grid">
        ${renderUnlocked(report.unlockedPrograms)}
      </div>
    </section>

    <section class="simple-card simple-advisor">
      <div class="simple-section-title">
        <span>顾问讲解点</span>
        <strong>现场继续展开</strong>
      </div>
      <ul>
        ${report.advisorPoints.map((point) => `<li>${escapeHtml(point)}</li>`).join("")}
      </ul>
      <div class="simple-ai-note">
        <p>${escapeHtml(narratives.advisorHook)}</p>
        <p>${escapeHtml(narratives.nextStep)}</p>
      </div>
    </section>
  `;
  reportRoot.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function requestSimpleNarratives(report, source) {
  const fallback = buildSimpleNarrativeFallback(report);
  const agentApiUrl = getAgentApiUrl();
  if (!agentApiUrl) return fallback;
  const requestBody = {
    ...buildSimpleAgentRequest(report, source.label),
    mode: "simple"
  };

  const response = await fetch(agentApiUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(requestBody)
  });
  if (!response.ok) return fallback;
  const payload = await response.json();
  return normalizeSimpleNarratives(payload.narratives, fallback);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (isGenerating) return;
  const input = readInput();
  const error = validateInput(input);
  if (error) {
    setError(error);
    return;
  }

  setError("");
  isGenerating = true;
  setLoading(true);
  try {
    const source = getProgramSource(input.artCategory);
    const rankPayload = loadRankPayload();
    const report = buildSimpleReport(input, source.programs, rankPayload.records);
    const narratives = await requestSimpleNarratives(report, source);
    renderReport(report, narratives, source);
  } finally {
    isGenerating = false;
    setLoading(false);
  }
});

reportRoot.addEventListener("click", (event) => {
  if (!event.target.closest("[data-action='edit-simple']")) return;
  form.hidden = false;
  reportRoot.hidden = true;
  reportRoot.replaceChildren();
  form.scrollIntoView({ behavior: "smooth", block: "start" });
});
