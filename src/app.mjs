import {
  ZHEJIANG_ELECTIVE_SUBJECTS,
  calculateScoreProfile,
  generateWhitepaper,
  normalizePreferenceInput,
  validatePreferences,
  validateElectiveSubjects
} from "./analysis.mjs";
import { estimateRankFromScore } from "./data-import.mjs";
import {
  buildDataContext,
  hydrateRemoteData,
  loadProgramPayload,
  loadRankPayload
} from "./data-store.mjs";
import { samplePrograms } from "./sample-data.mjs";
import { normalizeArtCategory } from "./categories.mjs";
import {
  PARENT_NARRATIVE_FIELDS,
  buildParentNarrativeFallback,
  buildParentNarrativePayload,
  normalizeParentNarratives
} from "./parent-narrative.mjs";

const form = document.querySelector("#student-form");
const workspace = document.querySelector(".workspace");
const reportRoot = document.querySelector("#report");
const formError = document.querySelector("#form-error");
const rankEstimateNode = document.querySelector("#rank-estimate");
const submitButton = form.querySelector('button[type="submit"]');
const generationStatus = document.querySelector("#generation-status");
const generationCountdown = document.querySelector("#generation-countdown");
const generationProgressBar = document.querySelector("#generation-progress-bar");
const DEFAULT_AGENT_API_PATH = "/api/analyze";
const NARRATIVE_LOADING_TEXT = "正在生成个性化解读……";
const GENERATION_COUNTDOWN_SECONDS = 30;
let generationCountdownTimer = 0;
let isGenerating = false;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function numberValue(formData, name) {
  const value = Number(formData.get(name));
  return Number.isFinite(value) ? value : 0;
}

function formatScore(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "0";
  return Number.isInteger(number) ? String(number) : number.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function getAgentApiUrl() {
  const configuredUrl = String(window.WHITEPAPER_AGENT_API_URL ?? "").trim();
  if (configuredUrl) return configuredUrl;
  if (window.location.hostname.endsWith("github.io")) return "";
  return DEFAULT_AGENT_API_PATH;
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function namedSelectValues(names) {
  return names.map((name) => String(form.elements.namedItem(name)?.value ?? ""));
}

function getSchoolOptionsForCategory(artCategory, programs) {
  const category = normalizeArtCategory(artCategory);
  return unique(
    (Array.isArray(programs) ? programs : [])
      .filter((program) => !category || normalizeArtCategory(program.artCategory) === category)
      .map((program) => String(program.school ?? "").trim())
      .filter(Boolean)
  );
}

function programsForCategory(programs, artCategory) {
  const category = normalizeArtCategory(artCategory);
  return (Array.isArray(programs) ? programs : [])
    .filter((program) => !category || normalizeArtCategory(program.artCategory) === category);
}

function formatLocation(program) {
  return [program.province, program.city].filter(Boolean).join(" / ") || "待补充";
}

function getRankEstimate(artCategory, compositeScore) {
  const rankPayload = loadRankPayload();
  return estimateRankFromScore(rankPayload.records, artCategory, compositeScore, {
    scoreType: "composite",
    requireScoreType: true
  });
}

function readInput() {
  const formData = new FormData(form);
  const artCategory = String(formData.get("artCategory"));
  const professionalScore = numberValue(formData, "professionalScore");
  const preferences = normalizePreferenceInput({
    targetSchools: [
      formData.get("targetSchool1"),
      formData.get("targetSchool2"),
      formData.get("targetSchool3")
    ],
    preferredCities: [
      formData.get("city1"),
      formData.get("city2")
    ]
  });
  const input = {
    artCategory,
    foreignLanguage: String(formData.get("foreignLanguage")),
    chinese: numberValue(formData, "chinese"),
    math: numberValue(formData, "math"),
    english: numberValue(formData, "english"),
    electives: [
      {
        name: String(formData.get("elective1Name")),
        score: numberValue(formData, "elective1Score")
      },
      {
        name: String(formData.get("elective2Name")),
        score: numberValue(formData, "elective2Score")
      },
      {
        name: String(formData.get("elective3Name")),
        score: numberValue(formData, "elective3Score")
      }
    ],
    professionalScore,
    targetSchools: preferences.targetSchools,
    preferredCities: preferences.preferredCities,
    acceptOutsideZhejiang: formData.has("acceptOutsideZhejiang"),
    acceptSinoForeign: formData.has("acceptSinoForeign"),
    acceptHighTuition: formData.has("acceptHighTuition")
  };
  const scoreProfile = calculateScoreProfile(input);
  const rankEstimate = getRankEstimate(artCategory, scoreProfile.currentCompositeScore);
  return {
    ...input,
    compositeRank: rankEstimate?.rank ?? 0,
    compositeRankEstimate: rankEstimate
  };
}

function tierTitle(key) {
  return {
    bao: "保底观察",
    wen: "稳妥观察",
    chong: "冲刺观察"
  }[key];
}

function tierClass(key) {
  return {
    bao: "tier-bao",
    wen: "tier-wen",
    chong: "tier-chong"
  }[key];
}

function renderProgram(program) {
  return `
    <article class="program-card">
      <div>
        <strong>${escapeHtml(program.school)}</strong>
        <span>${escapeHtml(program.program)}</span>
      </div>
      <dl>
        <div><dt>地区</dt><dd>${escapeHtml(formatLocation(program))}</dd></div>
        <div><dt>院校层次</dt><dd>${escapeHtml(program.schoolLevel || "待补充")}</dd></div>
        <div><dt>参考综合分</dt><dd>${escapeHtml(formatScore(program.minScore))}</dd></div>
        <div><dt>位次号</dt><dd>${escapeHtml(program.minRank || "待补充")}</dd></div>
      </dl>
      <p>${escapeHtml(program.direction || program.reason)}</p>
      <div class="tag-row">
        <span>${program.diff >= 0 ? "+" : ""}${escapeHtml(formatScore(program.diff))}</span>
        ${(program.tags ?? []).slice(0, 2).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}
      </div>
    </article>
  `;
}

function renderCompactProgram(program) {
  return `
    <article class="compact-program">
      <strong>${escapeHtml(program.school)}</strong>
      <span>${escapeHtml(program.program)}</span>
      <small>${escapeHtml(formatLocation(program))} · ${escapeHtml(program.schoolLevel || "层次待补")} · 综合 ${escapeHtml(formatScore(program.minScore))} · ${program.diff >= 0 ? "+" : ""}${escapeHtml(formatScore(program.diff))}</small>
    </article>
  `;
}

function renderProgramPlaceholder(text) {
  return `<div class="empty-tier">${escapeHtml(text)}</div>`;
}

function currentTierFallback(tier, lineInsight) {
  if (!lineInsight) return "暂无典型样本";
  if (lineInsight.status === "below") {
    return `暂无可${tierTitle(tier).replace("观察", "")}样本，${lineInsight.message}。最低参考：${lineInsight.floorSchool} ${lineInsight.floorProgram}，综合分 ${formatScore(lineInsight.floorScore)}。`;
  }
  if (tier === "bao") {
    return `暂无可保样本，${lineInsight.message}。建议先把保底余量拉到 20 分以上。`;
  }
  return `当前该档暂无典型样本，${lineInsight.message}。`;
}

function getProgramSource(artCategory = form.elements.namedItem("artCategory")?.value ?? "") {
  const payload = loadProgramPayload();
  if (payload.records.length > 0 && programsForCategory(payload.records, artCategory).length > 0) {
    return {
      programs: payload.records,
      label: "正式数据",
      note: "本报告结合当前成绩、志愿偏好与录取参考数据测算，适合作为阶段性规划参考。"
    };
  }
  return {
    programs: samplePrograms,
    label: "参考数据",
    note: "本报告结合当前成绩、志愿偏好与录取参考数据测算，适合作为阶段性规划参考。"
  };
}

function renderTargetSchoolOptions(selectedValues = namedSelectValues(["targetSchool1", "targetSchool2", "targetSchool3"])) {
  const artCategory = form.elements.namedItem("artCategory").value;
  const source = getProgramSource(artCategory);
  const schools = getSchoolOptionsForCategory(artCategory, source.programs);
  const selects = [
    form.elements.namedItem("targetSchool1"),
    form.elements.namedItem("targetSchool2"),
    form.elements.namedItem("targetSchool3")
  ];

  selects.forEach((select, index) => {
    const currentValue = selectedValues[index] || "";
    const options = unique([...schools, currentValue].filter(Boolean));
    select.innerHTML = [
      `<option value="" ${currentValue ? "" : "selected"}>暂无</option>`,
      ...options.map((school) => `<option value="${escapeHtml(school)}" ${school === currentValue ? "selected" : ""}>${escapeHtml(school)}</option>`)
    ].join("");
  });
  updateTargetSchoolOptions();
}

function updateRankEstimate() {
  if (!rankEstimateNode) return;
  const professionalScore = Number(form.elements.namedItem("professionalScore").value);

  if (!professionalScore) {
    rankEstimateNode.textContent = "专业成绩满分 300 分。填写文化课和专业成绩后，系统将根据一分一段表估算位次。";
    rankEstimateNode.classList.add("muted");
    return;
  }

  const input = readInput();
  const estimate = input.compositeRankEstimate;
  if (!estimate) {
    rankEstimateNode.textContent = "已记录成绩；暂无可匹配的一分一段位次数据。";
    rankEstimateNode.classList.add("muted");
    return;
  }

  rankEstimateNode.textContent = `按一分一段表 ${estimate.matchedScore} 综合分分档估算，位次约 ${estimate.rank} 名。`;
  rankEstimateNode.classList.remove("muted");
}

function renderTierComparison(currentMatches, improvedMatches, lineInsight) {
  const tiers = ["bao", "wen", "chong"];
  return `
    <section class="panel result-section comparison-section">
      <div class="section-heading">
        <p>提分前后稳保冲对比</p>
      </div>
      <div class="comparison-table">
        ${tiers.map((tier) => `
          <div class="comparison-row ${tierClass(tier)}">
            <h3>${tierTitle(tier)}</h3>
            <div class="comparison-column">
              <span>提分前</span>
              ${currentMatches[tier].length
                ? currentMatches[tier].slice(0, 2).map(renderCompactProgram).join("")
                : renderProgramPlaceholder(currentTierFallback(tier, lineInsight))}
            </div>
            <div class="comparison-column improved">
              <span>提分后</span>
              ${improvedMatches[tier].length
                ? improvedMatches[tier].slice(0, 2).map(renderCompactProgram).join("")
                : renderProgramPlaceholder("该档位暂无新增样本")}
            </div>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function renderLiftProgram(program, fallback) {
  if (!program) {
    return `<div class="lift-card muted-card">${escapeHtml(fallback)}</div>`;
  }
  return `
    <article class="lift-card">
      <span>${escapeHtml(formatLocation(program))} · ${escapeHtml(program.schoolLevel || "层次待补")}</span>
      <strong>${escapeHtml(program.school)}</strong>
      <p>${escapeHtml(program.program)}</p>
      <b>参考综合分 ${escapeHtml(formatScore(program.minScore))}</b>
    </article>
  `;
}

function renderComparisonHero(comparison) {
  return `
    <section class="panel lift-section">
      <div class="lift-heading">
        <div>
          <p>提分价值对比</p>
          <h3>同样是稳保冲，提分后看到的学校层次不一样。</h3>
        </div>
        <strong>+${formatScore(comparison.scoreLift)} 分</strong>
      </div>
      <div class="lift-grid">
        <div>
          <span class="column-label">提分前最高可关注样本</span>
          ${renderLiftProgram(comparison.currentTop, "暂无当前样本")}
        </div>
        <div>
          <span class="column-label">提分后新增高层次样本</span>
          ${renderLiftProgram(comparison.improvedTop, "暂无提分后样本")}
        </div>
      </div>
      <div class="unlocked-strip">
        <span>新增打开</span>
        ${comparison.unlockedPrograms.length
          ? comparison.unlockedPrograms.map((program) => `<b>${escapeHtml(program.school)}</b>`).join("")
          : "<b>暂无明显新增院校</b>"}
      </div>
    </section>
  `;
}

function renderScoreCards(profile) {
  return `
    <section class="score-summary">
      <article class="metric-card">
        <span>当前综合分</span>
        <strong>${formatScore(profile.currentCompositeScore)}</strong>
        <small>文化 ${profile.currentTotal} · 专业 ${formatScore(profile.professionalScore)} / 300</small>
      </article>
      <article class="metric-card accent">
        <span>目标综合分</span>
        <strong>${formatScore(profile.targetCompositeScore)}</strong>
        <small>文化目标 ${profile.targetTotal} · 专业按当前分</small>
      </article>
      <article class="metric-card warning">
        <span>综合分差距</span>
        <strong>${formatScore(profile.compositeGap)}</strong>
        <small>文化课还差 ${profile.totalGap} 分</small>
      </article>
    </section>
  `;
}

function renderPresentationBrief(brief) {
  return `
    <section class="panel result-section presentation-brief">
      <div class="section-heading">
        <p>当前分析结论</p>
      </div>
      <div class="presentation-grid">
        ${brief.cards.map((card) => `
          <article class="presentation-card">
            <span>${escapeHtml(card.label)}</span>
            <strong>${escapeHtml(card.title)}</strong>
            <p>${escapeHtml(card.detail)}</p>
          </article>
        `).join("")}
      </div>
      <div class="action-strip">
        ${brief.actions.map((action) => `<span>${escapeHtml(action)}</span>`).join("")}
      </div>
    </section>
  `;
}

function renderProfessionalPosition(input, profile) {
  if (!input.professionalScore) return "";
  const estimate = input.compositeRankEstimate;
  return `
    <section class="panel result-section professional-section">
      <div class="section-heading">
        <p>综合分位次定位</p>
      </div>
      <div class="professional-position">
        <article>
          <span>专业成绩 / 300</span>
          <strong>${escapeHtml(formatScore(input.professionalScore))}</strong>
        </article>
        <article>
          <span>当前综合分</span>
          <strong>${escapeHtml(formatScore(profile.currentCompositeScore))}</strong>
        </article>
        <article>
          <span>估算综合分位次</span>
          <strong>${estimate ? escapeHtml(estimate.rank) : "待匹配"}</strong>
        </article>
        <p>综合分 = 文化总分 × 50% + 专业成绩 × 2.5 × 50%。${estimate ? `按一分一段表 ${estimate.matchedScore} 综合分分档估算位次。` : "暂未匹配到一分一段位次，报告先按综合分与志愿偏好分析。"}</p>
      </div>
    </section>
  `;
}

function renderSubjectTable(profile, narratives) {
  return `
    <section class="panel result-section">
      <div class="section-heading">
        <p>文化课各科差距</p>
      </div>
      <div class="subject-list">
        ${profile.subjects.map((subject) => `
          <div class="subject-row">
            <span>${escapeHtml(subject.name)}</span>
            <strong>${subject.current}</strong>
            <span>目标 ${subject.target}</span>
            <b>差 ${subject.gap}</b>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function renderPlan(plan) {
  return `
    <section class="panel result-section">
      <div class="section-heading">
        <p>优先提分科目 TOP3</p>
      </div>
      <div class="plan-grid">
        ${plan.slice(0, 3).map((item, index) => `
          <article class="plan-card">
            <div>
              <span>TOP ${index + 1}</span>
              <strong>${escapeHtml(item.subject)}：差 ${item.gap} 分</strong>
            </div>
            <dl class="plan-brief">
              <div><dt>问题</dt><dd>${escapeHtml(item.problem)}</dd></div>
              <div><dt>提分动作</dt><dd>${escapeHtml(item.action)}</dd></div>
              <div><dt>目标分数</dt><dd>${formatScore(item.targetScore)} 分</dd></div>
            </dl>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function renderParentNarrativePlaceholders() {
  return PARENT_NARRATIVE_FIELDS.reduce((result, field) => {
    result[field] = NARRATIVE_LOADING_TEXT;
    return result;
  }, {});
}

function renderNarrativeBlock(title, field, narratives, options = {}) {
  const isLoading = narratives[field] === NARRATIVE_LOADING_TEXT;
  const tag = options.tag || "article";
  return `
    <${tag} class="parent-narrative ${isLoading ? "is-loading" : ""}" data-narrative-field="${escapeHtml(field)}">
      <span>${escapeHtml(title)}</span>
      <p>${escapeHtml(narratives[field] || NARRATIVE_LOADING_TEXT)}</p>
    </${tag}>
  `;
}

function updateParentNarratives(narratives) {
  for (const field of PARENT_NARRATIVE_FIELDS) {
    const node = reportRoot.querySelector(`[data-narrative-field="${field}"]`);
    if (!node) continue;
    const paragraph = node.querySelector("p");
    if (paragraph) paragraph.textContent = narratives[field] || "";
    node.classList.remove("is-loading");
  }
}

function collectTargetPrograms(whitepaper, targetSchools) {
  const selected = new Set(targetSchools);
  if (!selected.size) return [];
  const tiers = ["bao", "wen", "chong"];
  return [
    ...tiers.flatMap((tier) => whitepaper.currentMatches[tier] || []),
    ...tiers.flatMap((tier) => whitepaper.improvedMatches[tier] || [])
  ]
    .filter((program, index, list) =>
      selected.has(program.school) &&
      list.findIndex((item) => item.school === program.school && item.program === program.program) === index
    )
    .slice(0, 4);
}

function renderTargetGapSection(whitepaper, input, narratives) {
  const targetSchools = Array.isArray(input.targetSchools) ? input.targetSchools : [];
  const targetPrograms = collectTargetPrograms(whitepaper, targetSchools);
  return `
    <section class="panel result-section target-gap-section">
      <div class="section-heading">
        <p>目标院校差距</p>
      </div>
      <div class="target-gap-grid">
        <div class="target-gap-list">
          ${targetSchools.length
            ? targetSchools.map((school) => `<span>${escapeHtml(school)}</span>`).join("")
            : "<span>暂未填写明确目标院校</span>"}
        </div>
        <div class="target-program-list">
          ${targetPrograms.length
            ? targetPrograms.map(renderCompactProgram).join("")
            : renderProgramPlaceholder("暂无可匹配的目标院校样本，建议先按当前成绩区间确定合理目标层次。")}
        </div>
      </div>
      ${renderNarrativeBlock("目标院校差距解读", "targetSchoolInsight", narratives)}
    </section>
  `;
}

function renderReport(whitepaper, source, input, narratives = renderParentNarrativePlaceholders()) {
  form.hidden = true;
  reportRoot.hidden = false;
  workspace.classList.add("has-report", "report-only");
  reportRoot.innerHTML = `
    <div class="report-actions">
      <button type="button" class="ghost-button compact-button" data-action="edit-input">修改信息</button>
    </div>
    <section class="panel hero-report report-cover">
      <div class="report-brand-row">
        <img src="./assets/feifan-logo.jpg" alt="非凡教育标志">
        <div>
          <strong>非凡教育</strong>
          <span>浙江艺考生升学规划白皮书</span>
        </div>
      </div>
      <div class="report-hero-grid">
        <div class="report-hero-copy">
          <p class="kicker">生成报告</p>
          <h2>${escapeHtml(whitepaper.summary)}</h2>
          <p class="data-source-note">${escapeHtml(source.note)}</p>
        </div>
        <div class="report-score-board" aria-label="核心分数">
          <article>
            <span>当前综合分</span>
            <strong>${formatScore(whitepaper.scoreProfile.currentCompositeScore)}</strong>
          </article>
          <article>
            <span>目标综合分</span>
            <strong>${formatScore(whitepaper.scoreProfile.targetCompositeScore)}</strong>
          </article>
          <article class="gap">
            <span>差距</span>
            <strong>${formatScore(whitepaper.scoreProfile.compositeGap)}</strong>
          </article>
        </div>
      </div>
      ${renderNarrativeBlock("家长版核心解读", "parentSummary", narratives)}
    </section>
    <section class="panel result-section">
      <div class="section-heading">
        <p>学生类型诊断</p>
      </div>
      ${renderNarrativeBlock("学生类型诊断", "studentTypeInsight", narratives, { tag: "div" })}
    </section>
    ${renderScoreCards(whitepaper.scoreProfile)}
    ${renderPresentationBrief(whitepaper.presentationBrief)}
    ${renderProfessionalPosition(input, whitepaper.scoreProfile)}
    ${renderTargetGapSection(whitepaper, input, narratives)}
    ${renderComparisonHero(whitepaper.comparison)}
    ${renderTierComparison(whitepaper.currentMatches, whitepaper.improvedMatches, whitepaper.lineInsight)}
    ${renderSubjectTable(whitepaper.scoreProfile, narratives)}
    ${renderPlan(whitepaper.studyPlan)}
    <section class="panel result-section">
      <div class="section-heading">
        <p>后续规划建议</p>
      </div>
      ${renderNarrativeBlock("后续规划建议", "nextStepAdvice", narratives, { tag: "div" })}
    </section>
  `;
}

function renderEmpty() {
  form.hidden = false;
  reportRoot.hidden = true;
  reportRoot.replaceChildren();
  workspace.classList.remove("has-report", "report-only");
}

function setFormError(message) {
  formError.textContent = message;
  formError.hidden = !message;
}

function updateGenerationCountdown(secondsLeft) {
  const safeSeconds = Math.max(0, secondsLeft);
  if (generationCountdown) {
    generationCountdown.textContent = safeSeconds > 0
      ? `预计还需 ${safeSeconds} 秒`
      : "正在整理报告内容，请稍候";
  }
  if (generationProgressBar) {
    const progress = ((GENERATION_COUNTDOWN_SECONDS - safeSeconds) / GENERATION_COUNTDOWN_SECONDS) * 100;
    generationProgressBar.style.width = `${Math.max(0, Math.min(100, progress))}%`;
  }
  if (submitButton?.disabled) {
    submitButton.textContent = safeSeconds > 0
      ? `生成中，约 ${safeSeconds} 秒`
      : "正在整理报告...";
  }
}

function stopGenerationCountdown() {
  if (generationCountdownTimer) {
    window.clearInterval(generationCountdownTimer);
    generationCountdownTimer = 0;
  }
  if (generationStatus) generationStatus.hidden = true;
  if (generationProgressBar) generationProgressBar.style.width = "0%";
}

function startGenerationCountdown() {
  stopGenerationCountdown();
  if (generationStatus) generationStatus.hidden = false;
  let secondsLeft = GENERATION_COUNTDOWN_SECONDS;
  updateGenerationCountdown(secondsLeft);
  window.requestAnimationFrame(() => {
    generationStatus?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
  generationCountdownTimer = window.setInterval(() => {
    secondsLeft -= 1;
    updateGenerationCountdown(secondsLeft);
  }, 1000);
}

function setSubmitLoading(isLoading) {
  if (!submitButton) return;
  submitButton.disabled = isLoading;
  if (isLoading) {
    startGenerationCountdown();
  } else {
    stopGenerationCountdown();
    submitButton.textContent = "生成规划白皮书";
  }
}

async function requestParentNarratives(narrativePayload, source) {
  const agentApiUrl = getAgentApiUrl();
  if (!agentApiUrl) return null;

  const response = await fetch(agentApiUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      sourceLabel: source.label,
      narrativePayload
    })
  });
  if (!response.ok) throw new Error("agent unavailable");
  const payload = await response.json();
  if (!payload.ok || !payload.narratives) throw new Error(payload.error || "agent failed");
  return payload.narratives;
}

function updateElectiveOptions() {
  const selects = [
    form.elements.namedItem("elective1Name"),
    form.elements.namedItem("elective2Name"),
    form.elements.namedItem("elective3Name")
  ];
  const selected = selects.map((select) => select.value);

  for (const select of selects) {
    for (const option of select.options) {
      option.disabled = selected.includes(option.value) && option.value !== select.value;
    }
  }
}

function updateCityOptions() {
  const selects = [
    form.elements.namedItem("city1"),
    form.elements.namedItem("city2")
  ];
  const selected = selects.map((select) => select.value).filter(Boolean);

  for (const select of selects) {
    for (const option of select.options) {
      option.disabled = Boolean(option.value) && selected.includes(option.value) && option.value !== select.value;
    }
  }
}

function updateTargetSchoolOptions() {
  const selects = [
    form.elements.namedItem("targetSchool1"),
    form.elements.namedItem("targetSchool2"),
    form.elements.namedItem("targetSchool3")
  ];
  const selected = selects.map((select) => select.value).filter(Boolean);

  for (const select of selects) {
    for (const option of select.options) {
      option.disabled = Boolean(option.value) && selected.includes(option.value) && option.value !== select.value;
    }
  }
}

function validateFormInput(input) {
  if (input.professionalScore <= 0 || input.professionalScore > 300) {
    return "请填写专业成绩，满分 300 分。";
  }
  const validation = validateElectiveSubjects(input.electives);
  if (!validation.valid) {
    const duplicateMessage = validation.duplicates.length ? `重复选择：${validation.duplicates.join("、")}` : "";
    const invalidMessage = validation.invalid.length ? `不符合浙江选考：${validation.invalid.join("、")}` : "";
    return [`三门选考必须从${ZHEJIANG_ELECTIVE_SUBJECTS.join("、")}中选择，且不能重复。`, duplicateMessage, invalidMessage]
      .filter(Boolean)
      .join(" ");
  }
  const preferenceValidation = validatePreferences({
    targetSchools: input.targetSchools,
    preferredCities: input.preferredCities
  });
  if (!preferenceValidation.valid) {
    return preferenceValidation.errors.join(" ");
  }
  return "";
}

for (const name of ["elective1Name", "elective2Name", "elective3Name"]) {
  form.elements.namedItem(name).addEventListener("change", () => {
    updateElectiveOptions();
    setFormError("");
  });
}

for (const name of ["city1", "city2"]) {
  form.elements.namedItem(name).addEventListener("change", () => {
    updateCityOptions();
    setFormError("");
  });
}

for (const name of ["targetSchool1", "targetSchool2", "targetSchool3"]) {
  form.elements.namedItem(name).addEventListener("change", () => {
    updateTargetSchoolOptions();
    setFormError("");
  });
}

form.elements.namedItem("artCategory").addEventListener("change", () => {
  renderTargetSchoolOptions([]);
  updateRankEstimate();
  setFormError("");
});

for (const name of ["professionalScore", "chinese", "math", "english", "elective1Score", "elective2Score", "elective3Score"]) {
  form.elements.namedItem(name).addEventListener("input", () => {
    updateRankEstimate();
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (isGenerating) return;
  const preliminaryInput = readInput();
  const validationMessage = validateFormInput(preliminaryInput);
  if (validationMessage) {
    setFormError(validationMessage);
    return;
  }
  setFormError("");
  isGenerating = true;
  setSubmitLoading(true);
  try {
    await hydrateRemoteData();
    const input = readInput();
    const source = getProgramSource(input.artCategory);
    const whitepaper = generateWhitepaper(input, source.programs);
    const dataContext = buildDataContext({
      sourceLabel: source.label,
      artCategory: input.artCategory,
      programPayload: loadProgramPayload(),
      rankPayload: loadRankPayload(),
      rankEstimate: input.compositeRankEstimate
    });
    const narrativePayload = buildParentNarrativePayload(input, whitepaper, dataContext);
    const fallbackNarratives = buildParentNarrativeFallback(narrativePayload);
    let normalizedNarratives = fallbackNarratives;
    try {
      const agentNarratives = await requestParentNarratives(narrativePayload, source);
      normalizedNarratives = normalizeParentNarratives(agentNarratives, fallbackNarratives);
    } catch {
      normalizedNarratives = fallbackNarratives;
    }

    renderReport(whitepaper, source, input, normalizedNarratives);
    reportRoot.scrollIntoView({ behavior: "smooth", block: "start" });
  } finally {
    isGenerating = false;
    setSubmitLoading(false);
  }
});

reportRoot.addEventListener("click", (event) => {
  if (!event.target.closest("[data-action='edit-input']")) return;
  renderEmpty();
  form.scrollIntoView({ behavior: "smooth", block: "start" });
});

updateCityOptions();
updateElectiveOptions();
renderTargetSchoolOptions([]);
updateRankEstimate();
renderEmpty();

hydrateRemoteData().then(() => {
  renderTargetSchoolOptions();
  updateRankEstimate();
});
