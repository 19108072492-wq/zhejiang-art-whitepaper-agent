export const PARENT_NARRATIVE_FIELDS = [
  "parentSummary",
  "studentTypeInsight",
  "targetSchoolInsight",
  "subjectPriorityInsight",
  "nextStepAdvice"
];

const FIELD_FALLBACK = {
  parentSummary: "从当前成绩结构看，孩子目前已经具备一定升学基础。后续需要重点关注文化课总分与目标院校参考线之间的差距，尤其是优先级较高的学科是否能形成稳定提分。",
  studentTypeInsight: "孩子当前更接近“文化课决定院校上限”的类型。接下来不建议所有学科平均用力，而应优先选择差距较明显、提分回报较高的科目作为突破口。",
  targetSchoolInsight: "当前目标院校需要结合往年录取参考、专业方向和孩子现有成绩综合判断。若暂未形成明确目标，建议先根据当前成绩区间确定合理院校层次。",
  subjectPriorityInsight: "从学科结构看，建议优先关注差距较大的科目，并结合错题类型和阶段测试结果判断是否具备短期拉动空间。",
  nextStepAdvice: "建议接下来以 30 天为一个观察周期，围绕核心短板建立学习任务，并通过阶段测试及时调整目标院校梯度和复习重点。"
};

const INTERNAL_WORD_REPLACEMENTS = [
  ["顾问视角", "家长阅读建议"],
  ["面谈结论", "当前分析结论"],
  ["现场确认", "后续建议补充确认"],
  ["重点讲", "建议重点关注"],
  ["带家长核对", "建议家长补充核对"],
  ["顾问", "报告"],
  ["销售", "规划"],
  ["转化", "形成"],
  ["邀约", "后续沟通"],
  ["到访", "后续沟通"],
  ["成交", "结果"],
  ["客户意向", "家长关注点"],
  ["高意向", "关注度较高"],
  ["低意向", "仍需观察"],
  ["面谈", "沟通"],
  ["逼单", "确认"],
  ["话术", "说明"],
  ["加微信", "补充沟通"],
  ["谈单", "沟通"],
  ["承接", "衔接"],
  ["留资", "补充信息"]
];

function toArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(/[,，、\s]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function roundScore(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Number.isInteger(number) ? number : Number(number.toFixed(2));
}

function pickProgram(program) {
  if (!program || typeof program !== "object") return null;
  return {
    school: program.school || "",
    program: program.program || "",
    province: program.province || "",
    city: program.city || "",
    schoolLevel: program.schoolLevel || "",
    minScore: program.minScore ?? null,
    minRank: program.minRank ?? null,
    diff: program.diff ?? null,
    reason: program.reason || ""
  };
}

function pickPrograms(programs, limit = 2) {
  return (Array.isArray(programs) ? programs : [])
    .slice(0, limit)
    .map(pickProgram)
    .filter(Boolean);
}

function summarizeTierMatches(matches) {
  const source = matches && typeof matches === "object" ? matches : {};
  return {
    bao: pickPrograms(source.bao),
    wen: pickPrograms(source.wen),
    chong: pickPrograms(source.chong)
  };
}

function allTierPrograms(matches) {
  const source = matches && typeof matches === "object" ? matches : {};
  return ["bao", "wen", "chong"].flatMap((tier) => Array.isArray(source[tier]) ? source[tier] : []);
}

function summarizeTargetMatches(whitepaper, selectedSchools) {
  if (!selectedSchools.length) return [];
  const selected = new Set(selectedSchools);
  return [
    ...allTierPrograms(whitepaper.currentMatches),
    ...allTierPrograms(whitepaper.improvedMatches)
  ]
    .filter((program, index, list) =>
      selected.has(program.school) &&
      list.findIndex((item) => item.school === program.school && item.program === program.program) === index
    )
    .slice(0, 5)
    .map(pickProgram)
    .filter(Boolean);
}

function summarizeSubjects(scoreProfile) {
  const subjects = Array.isArray(scoreProfile.subjects) ? scoreProfile.subjects : [];
  const priorities = Array.isArray(scoreProfile.priorities) ? scoreProfile.priorities : subjects;
  const subjectGaps = subjects.map((subject) => ({
    name: subject.name,
    current: subject.current,
    target: subject.target,
    gap: subject.gap,
    scoreBand: subject.scoreBand
  }));
  return {
    subjectGaps,
    topPrioritySubjects: priorities.slice(0, 3).map((subject) => ({
      name: subject.name,
      current: subject.current,
      target: subject.target,
      gap: subject.gap,
      scoreBand: subject.scoreBand
    })),
    strongestSubjects: [...subjects]
      .sort((a, b) => (a.gap ?? 0) - (b.gap ?? 0))
      .slice(0, 2)
      .map((subject) => ({ name: subject.name, current: subject.current, gap: subject.gap })),
    weakestSubjects: priorities
      .slice(0, 2)
      .map((subject) => ({ name: subject.name, current: subject.current, gap: subject.gap }))
  };
}

export function buildParentNarrativePayload(input, whitepaper) {
  const scoreProfile = whitepaper.scoreProfile || {};
  const selectedSchools = toArray(input.targetSchools).slice(0, 3);
  const preferredCities = toArray(input.preferredCities).slice(0, 2);
  const comparison = whitepaper.comparison || {};

  return {
    student: {
      category: input.artCategory || "",
      professionalScore: input.professionalScore ?? 0,
      estimatedProfessionalRank: input.professionalRankEstimate?.rank ?? input.professionalRank ?? 0,
      cultureTotal: scoreProfile.currentTotal ?? 0,
      currentCompositeScore: scoreProfile.currentCompositeScore ?? 0,
      targetCompositeScore: scoreProfile.targetCompositeScore ?? 0,
      compositeGap: scoreProfile.compositeGap ?? 0
    },
    targets: {
      selectedSchools,
      targetMatches: summarizeTargetMatches(whitepaper, selectedSchools),
      currentMatchesSummary: summarizeTierMatches(whitepaper.currentMatches),
      improvedMatchesSummary: summarizeTierMatches(whitepaper.improvedMatches)
    },
    subjects: summarizeSubjects(scoreProfile),
    preferences: {
      preferredCities,
      acceptOutProvince: Boolean(input.acceptOutsideZhejiang),
      acceptHighTuition: Boolean(input.acceptHighTuition),
      acceptCooperation: Boolean(input.acceptSinoForeign)
    },
    lineInsight: whitepaper.lineInsight || null,
    comparisonSummary: {
      currentTop: pickProgram(comparison.currentTop),
      improvedTop: pickProgram(comparison.improvedTop),
      scoreLift: roundScore(comparison.scoreLift),
      unlockedPrograms: pickPrograms(comparison.unlockedPrograms || [], 3)
    }
  };
}

function subjectNames(subjects) {
  const names = (subjects || [])
    .filter((subject) => Number(subject.gap) > 0)
    .map((subject) => subject.name)
    .filter(Boolean);
  return names.length ? names.join("、") : "现有优势科目";
}

function describeStudentType(payload) {
  const cultureTotal = Number(payload.student?.cultureTotal || 0);
  const professionalScore = Number(payload.student?.professionalScore || 0);
  const compositeGap = Number(payload.student?.compositeGap || 0);
  if (compositeGap >= 35) return "本科边缘，需要抢时间提分型";
  if (professionalScore >= 245 && cultureTotal < 480) return "专业有基础，文化课决定上限型";
  if (professionalScore >= 255 && cultureTotal < 470) return "专业优势明显，文化课待突破型";
  if (professionalScore < 230 && cultureTotal >= 500) return "文化课有基础，专业成绩需巩固型";
  return "专业文化相对均衡型";
}

export function buildParentNarrativeFallback(payload) {
  if (!payload || typeof payload !== "object") return { ...FIELD_FALLBACK };
  const student = payload.student || {};
  const targets = payload.targets || {};
  const subjects = payload.subjects || {};
  const topSubjects = subjects.topPrioritySubjects || [];
  const priorityText = subjectNames(topSubjects);
  const selectedSchools = targets.selectedSchools || [];
  const type = describeStudentType(payload);
  const targetText = selectedSchools.length
    ? `当前关注的目标院校包括 ${selectedSchools.join("、")}，需要结合综合分差距、院校层次和往年参考位次综合判断。`
    : "当前目标院校尚未明确，建议先根据成绩区间确定合理目标层次，再进一步筛选具体院校和专业。";
  const lineText = payload.lineInsight?.message ? ` ${payload.lineInsight.message}。` : "";
  const liftText = payload.comparisonSummary?.scoreLift > 0
    ? `提分后参考样本层次约提升 ${payload.comparisonSummary.scoreLift} 分，院校选择空间会更清晰。`
    : "提分后的主要价值在于让当前可关注院校更稳，并继续观察更高层次机会。";

  return normalizeParentNarratives({
    parentSummary: `从当前成绩结构看，孩子当前综合分为 ${student.currentCompositeScore || 0} 分，距离目标综合分 ${student.targetCompositeScore || 0} 分还有 ${student.compositeGap || 0} 分差距。主要机会在于文化课仍有可拉动空间，尤其需要优先关注 ${priorityText}。${liftText}`,
    studentTypeInsight: `孩子当前更接近“${type}”。这类学生不适合所有学科平均用力，更需要先找到最容易拉动综合分的科目，并通过阶段测试判断提分是否稳定。`,
    targetSchoolInsight: `${targetText}${lineText}孩子并非不能继续向上规划，但需要把目标院校放进冲刺、稳妥、保底三个梯度中动态观察，避免只看院校名称。`,
    subjectPriorityInsight: `当前建议优先关注 ${priorityText}。这些科目与目标分之间的差距更明显，也更适合通过基础题型、错题归类和阶段测试来观察短期拉动效果。其他科目以稳定输出为主。`,
    nextStepAdvice: "后续建议以 30 天为一个观察周期，围绕核心短板建立学习任务，并用阶段测试检验是否具备稳定提升空间。目标院校梯度也应随成绩变化及时调整。"
  }, FIELD_FALLBACK);
}

export function cleanNarrativeText(text) {
  let cleaned = String(text ?? "").replace(/\s+/g, " ").trim();
  for (const [pattern, replacement] of INTERNAL_WORD_REPLACEMENTS) {
    cleaned = cleaned.replaceAll(pattern, replacement);
  }
  return cleaned;
}

export function normalizeParentNarratives(value, fallback = FIELD_FALLBACK) {
  const source = value && typeof value === "object" ? value : {};
  const fallbackSource = fallback && typeof fallback === "object" ? fallback : FIELD_FALLBACK;
  return PARENT_NARRATIVE_FIELDS.reduce((result, field) => {
    const cleaned = cleanNarrativeText(source[field]);
    result[field] = cleaned || cleanNarrativeText(fallbackSource[field]) || FIELD_FALLBACK[field];
    return result;
  }, {});
}
