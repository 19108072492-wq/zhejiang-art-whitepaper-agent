import {
  ZHEJIANG_ELECTIVE_SUBJECTS,
  generateWhitepaper,
  normalizePreferenceInput,
  validatePreferences,
  validateElectiveSubjects
} from "./analysis.mjs";
import { estimateRankFromScore } from "./data-import.mjs";
import { loadProgramPayload, loadRankPayload } from "./data-store.mjs";
import { samplePrograms } from "./sample-data.mjs";
import { normalizeArtCategory } from "./categories.mjs";

const form = document.querySelector("#student-form");
const workspace = document.querySelector(".workspace");
const reportRoot = document.querySelector("#report");
const formError = document.querySelector("#form-error");
const rankEstimateNode = document.querySelector("#rank-estimate");

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

function getRankEstimate(artCategory, professionalScore) {
  const rankPayload = loadRankPayload();
  return estimateRankFromScore(rankPayload.records, artCategory, professionalScore);
}

function readInput() {
  const formData = new FormData(form);
  const artCategory = String(formData.get("artCategory"));
  const professionalScore = numberValue(formData, "professionalScore");
  const professionalRankEstimate = getRankEstimate(artCategory, professionalScore);
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
  return {
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
    professionalRank: professionalRankEstimate?.rank ?? 0,
    professionalRankEstimate,
    targetSchools: preferences.targetSchools,
    preferredCities: preferences.preferredCities,
    acceptOutsideZhejiang: formData.has("acceptOutsideZhejiang"),
    acceptSinoForeign: formData.has("acceptSinoForeign"),
    acceptHighTuition: formData.has("acceptHighTuition")
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
  const artCategory = form.elements.namedItem("artCategory").value;
  const professionalScore = Number(form.elements.namedItem("professionalScore").value);
  const rankPayload = loadRankPayload();

  if (!professionalScore) {
    rankEstimateNode.textContent = "专业成绩满分 300 分，系统将根据一分一段表估算专业位次。";
    rankEstimateNode.classList.add("muted");
    return;
  }

  const estimate = estimateRankFromScore(rankPayload.records, artCategory, professionalScore);
  if (!estimate) {
    rankEstimateNode.textContent = "已记录专业成绩；暂无可匹配的一分一段位次数据。";
    rankEstimateNode.classList.add("muted");
    return;
  }

  rankEstimateNode.textContent = `按 ${estimate.matchedScore} 分档估算，专业位次约 ${estimate.rank} 名。`;
  rankEstimateNode.classList.remove("muted");
}

function renderTierComparison(currentMatches, improvedMatches) {
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
                : renderProgramPlaceholder("暂无典型样本")}
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
        <small>文化 ${profile.currentTotal} · 专业折算 ${formatScore(profile.professionalConvertedScore)}</small>
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
        <p>面谈结论与下一步</p>
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
  const estimate = input.professionalRankEstimate;
  return `
    <section class="panel result-section professional-section">
      <div class="section-heading">
        <p>专业成绩定位</p>
      </div>
      <div class="professional-position">
        <article>
          <span>专业成绩 / 300</span>
          <strong>${escapeHtml(formatScore(input.professionalScore))}</strong>
        </article>
        <article>
          <span>专业折算分</span>
          <strong>${escapeHtml(formatScore(profile.professionalConvertedScore))}</strong>
        </article>
        <article>
          <span>估算专业位次</span>
          <strong>${estimate ? escapeHtml(estimate.rank) : "待匹配"}</strong>
        </article>
        <p>综合分 = 文化总分 × 50% + 专业成绩 × 2.5 × 50%。${estimate ? `按一分一段表 ${estimate.matchedScore} 分档估算。` : "暂未匹配到一分一段位次，报告先按综合分与志愿偏好分析。"}</p>
      </div>
    </section>
  `;
}

function renderSubjectTable(profile) {
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
      <div class="subject-advice">
        <div class="subsection-title">科目知识补强建议</div>
        <div class="subject-advice-grid">
          ${profile.priorities.map((subject) => `
            <article class="subject-advice-card">
              <div>
                <strong>${escapeHtml(subject.name)}</strong>
                <span>${escapeHtml(subject.scoreBand)}</span>
              </div>
              <p><b>提分点</b>${escapeHtml(subject.boostPoint)}</p>
              <p><b>知识补强</b>${escapeHtml(subject.knowledgeAdvice)}</p>
            </article>
          `).join("")}
        </div>
      </div>
    </section>
  `;
}

function renderPlan(plan) {
  return `
    <section class="panel result-section">
      <div class="section-heading">
        <p>30 / 60 / 90 天学习计划</p>
      </div>
      <div class="plan-grid">
        ${plan.slice(0, 4).map((item) => `
          <article class="plan-card">
            <div>
              <span>${escapeHtml(item.level)}</span>
              <strong>${escapeHtml(item.subject)} 差 ${item.gap} 分</strong>
            </div>
            <p>${escapeHtml(item.focus)}</p>
            <ul>
              <li><b>30 天</b>${escapeHtml(item.days30)}</li>
              <li><b>60 天</b>${escapeHtml(item.days60)}</li>
              <li><b>90 天</b>${escapeHtml(item.days90)}</li>
            </ul>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function renderReport(whitepaper, source, input) {
  form.hidden = true;
  reportRoot.hidden = false;
  workspace.classList.add("has-report", "report-only");
  reportRoot.innerHTML = `
    <div class="report-actions">
      <button type="button" class="ghost-button compact-button" data-action="edit-input">修改信息</button>
    </div>
    <section class="panel hero-report">
      <p class="kicker">升学规划白皮书</p>
      <h2>${escapeHtml(whitepaper.summary)}</h2>
      <p class="data-source-note">${escapeHtml(source.note)}</p>
    </section>
    ${renderScoreCards(whitepaper.scoreProfile)}
    ${renderPresentationBrief(whitepaper.presentationBrief)}
    ${renderProfessionalPosition(input, whitepaper.scoreProfile)}
    ${renderComparisonHero(whitepaper.comparison)}
    ${renderSubjectTable(whitepaper.scoreProfile)}
    ${renderTierComparison(whitepaper.currentMatches, whitepaper.improvedMatches)}
    ${renderPlan(whitepaper.studyPlan)}
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

form.elements.namedItem("professionalScore").addEventListener("input", () => {
  updateRankEstimate();
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const input = readInput();
  const validationMessage = validateFormInput(input);
  if (validationMessage) {
    setFormError(validationMessage);
    return;
  }
  setFormError("");
  const source = getProgramSource(input.artCategory);
  const whitepaper = generateWhitepaper(input, source.programs);
  renderReport(whitepaper, source, input);
  reportRoot.scrollIntoView({ behavior: "smooth", block: "start" });
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
