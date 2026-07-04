import { matchPrograms } from "./analysis.mjs";
import { estimateRankFromScore } from "./data-import.mjs";
import { normalizeArtCategory } from "./categories.mjs";

const DEFAULT_SIMPLE_TARGET_COMPOSITE_SCORE = 550;
const ABOVE_TARGET_SIMPLE_LIFT = 8;
const CULTURE_WEIGHT = 0.5;
const PROFESSIONAL_CONVERSION_RATE = 2.5;
const PROFESSIONAL_WEIGHT = 0.5;
const SIMPLE_FIELDS = ["headline", "advisorHook", "nextStep"];
const SIMPLE_FIELD_LIMITS = {
  headline: 24,
  advisorHook: 32,
  nextStep: 36
};
const SIMPLE_WORD_REPLACEMENTS = [
  ["顾问视角", "家长阅读建议"],
  ["现场确认", "后续建议补充确认"],
  ["现场", "后续"],
  ["顾问", "报告"],
  ["销售", "服务"],
  ["转化", "形成"],
  ["邀约", "后续沟通"],
  ["到访", "后续沟通"],
  ["成交", "结果"],
  ["客户意向", "家长关注点"],
  ["客户", "家庭"],
  ["加微信", "补充联系方式"],
  ["留资", "补充信息"],
  ["话术", "说明"]
];
const DEFAULT_SIMPLE_CONTEXT = {
  studentStage: "高三下学期",
  scoreSource: "最近一次模考",
  planningGoal: "先保本科",
  familyBoundary: "暂不确定"
};

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, toNumber(value)));
}

function roundScore(value) {
  return Math.round(toNumber(value) * 100) / 100;
}

function programKey(program) {
  return `${program?.school ?? ""}::${program?.program ?? ""}`;
}

function flattenMatches(matches) {
  return [
    ...(matches?.bao ?? []),
    ...(matches?.wen ?? []),
    ...(matches?.chong ?? [])
  ];
}

function topByReferenceScore(programs) {
  return [...programs].sort((a, b) => toNumber(b.minScore) - toNumber(a.minScore))[0] ?? null;
}

function firstOrNull(items) {
  return Array.isArray(items) && items.length ? items[0] : null;
}

function formatScore(value) {
  const number = roundScore(value);
  return Number.isInteger(number) ? String(number) : String(number);
}

function compactText(value, maxLength = 36) {
  let text = String(value ?? "").replace(/\s+/g, " ").trim();
  for (const [pattern, replacement] of SIMPLE_WORD_REPLACEMENTS) {
    text = text.replaceAll(pattern, replacement);
  }
  return text.slice(0, maxLength);
}

function categoryPrograms(programs, artCategory) {
  const category = normalizeArtCategory(artCategory);
  return (Array.isArray(programs) ? programs : [])
    .filter((program) => normalizeArtCategory(program.artCategory) === category)
    .filter((program) => toNumber(program.minScore) > 0);
}

function findLowestProgram(programs, artCategory) {
  return categoryPrograms(programs, artCategory)
    .sort((a, b) => toNumber(a.minScore) - toNumber(b.minScore))[0] ?? null;
}

function positionLabel(score) {
  if (score >= 590) return "高位冲刺型";
  if (score >= 550) return "一段稳进型";
  if (score >= 520) return "本科窗口型";
  if (score >= 500) return "边界提升型";
  return "补线追赶型";
}

function professionalLabel(score) {
  if (score >= 270) return "专业优势明显";
  if (score >= 250) return "专业有支撑";
  if (score >= 230) return "专业需稳住";
  return "专业仍要补强";
}

function buildSimpleScoreStructure(profile) {
  return [
    {
      label: "文化总分",
      value: formatScore(profile.cultureTotal),
      detail: "按 50% 计入综合分"
    },
    {
      label: "专业成绩",
      value: formatScore(profile.professionalScore),
      detail: "满分 300，先看统考基础"
    },
    {
      label: "专业折算",
      value: formatScore(profile.professionalConvertedScore),
      detail: "专业分 × 2.5 后参与计算"
    },
    {
      label: "目标综合分",
      value: formatScore(profile.targetCompositeScore),
      detail: profile.compositeGap > 0 ? `还差 ${formatScore(profile.compositeGap)} 分` : "当前已超过默认目标"
    }
  ];
}

function buildSimplePositionSignals(report) {
  const profile = report.scoreProfile;
  const lowestProgram = report.lowestProgram;
  const signals = [
    {
      title: positionLabel(profile.currentCompositeScore),
      body: `当前综合分 ${formatScore(profile.currentCompositeScore)}，先按${report.artCategory}类别做层次初筛。`
    },
    {
      title: "位次校准",
      body: report.rankEstimate?.rank
        ? `一分一段估算约 ${report.rankEstimate.rank} 名，需要结合当年计划数复核。`
        : "暂无位次匹配结果，上传一分一段表后可自动校准。"
    }
  ];

  if (lowestProgram) {
    const gap = roundScore(profile.currentCompositeScore - toNumber(lowestProgram.minScore));
    signals.push({
      title: gap >= 0 ? "已进入样本区间" : "距离最低样本线",
      body: gap >= 0
        ? `已高出 ${lowestProgram.school} 等最低样本线 ${formatScore(gap)} 分。`
        : `距离 ${lowestProgram.school} 等最低样本线还差 ${formatScore(Math.abs(gap))} 分。`
    });
  } else {
    signals.push({
      title: "数据待补齐",
      body: "当前类别院校样本不足，后台补表后报告会更具体。"
    });
  }

  return signals;
}

function buildSimpleLiftLevers(report) {
  const profile = report.scoreProfile;
  const cultureText = profile.compositeGap > 0
    ? `文化等效约需提升 ${profile.cultureLiftNeeded} 分，先判断近三次成绩波动。`
    : "当前已过默认目标，重点看是否能继续冲更高层次。";
  return [
    {
      title: "文化提分空间",
      body: cultureText
    },
    {
      title: "专业成绩作用",
      body: `${professionalLabel(profile.professionalScore)}，后续要看小分线、方向限制和校考要求。`
    },
    {
      title: "志愿策略口径",
      body: report.unlockedPrograms.length
        ? "提分后先讲新增样本，再倒推文化分目标。"
        : "先把当前冲稳保边界讲清，再判断是否需要扩大省外。"
    }
  ];
}

function buildSimpleConsultChecklist() {
  return [
    "近三次文化总分",
    "专业方向限制",
    "小分线与身体条件",
    "省内省外边界",
    "学费与中外合作",
    "城市和就业路径"
  ];
}

function buildSimpleKeyTakeaways(report) {
  const profile = report.scoreProfile;
  const rankText = report.rankEstimate?.rank
    ? `估算位次约 ${report.rankEstimate.rank} 名`
    : "位次待后台一分一段表校准";
  const lowestProgram = report.lowestProgram;
  const lowestGap = lowestProgram
    ? roundScore(profile.currentCompositeScore - toNumber(lowestProgram.minScore))
    : 0;
  const unlockedProgram = report.unlockedPrograms[0];
  const sampleText = unlockedProgram
    ? `提到 ${formatScore(profile.targetCompositeScore)} 后，可新增关注 ${unlockedProgram.school}`
    : lowestProgram && lowestGap < 0
      ? `距离 ${lowestProgram.school} 等最低样本线还差 ${formatScore(Math.abs(lowestGap))} 分`
      : "先用当前冲稳保样本确认基本层次";

  return [
    {
      title: "分数差距",
      body: profile.compositeGap > 0
        ? `当前综合分 ${formatScore(profile.currentCompositeScore)}，距目标 ${formatScore(profile.compositeGap)} 分。`
        : `当前综合分 ${formatScore(profile.currentCompositeScore)}，已超过默认目标线。`
    },
    {
      title: "位次校准",
      body: rankText
    },
    {
      title: "院校窗口",
      body: sampleText
    }
  ];
}

function buildSimpleNextCheckpoints(report) {
  const profile = report.scoreProfile;
  const points = [
    profile.compositeGap > 0
      ? `先判断文化总分是否具备 ${formatScore(profile.cultureLiftNeeded)} 分提升空间。`
      : "先判断当前分数能否稳定保持，再看更高层次样本。",
    `${professionalLabel(profile.professionalScore)}，需复核小分线、方向限制和校考要求。`,
    report.rankEstimate?.rank
      ? `用估算位次 ${report.rankEstimate.rank} 名，对照近年计划数变化。`
      : "补齐一分一段表后，再做位次和院校梯度复核。"
  ];

  return points.map((body, index) => ({
    title: ["提分判断", "专业复核", "位次复核"][index],
    body
  }));
}

function buildSimpleStudentInterpretation(report) {
  const profile = report.scoreProfile;
  const gapText = profile.compositeGap > 0
    ? `距离目标综合分还差 ${formatScore(profile.compositeGap)} 分`
    : "当前已超过默认目标综合分";
  const rankText = report.rankEstimate?.rank ? `，估算位次约 ${report.rankEstimate.rank} 名` : "";

  if (profile.currentCompositeScore >= 550) {
    return {
      title: "已进入较稳窗口",
      body: `孩子当前综合分 ${formatScore(profile.currentCompositeScore)}${rankText}，${gapText}。这类情况重点不是盲目加码，而是确认成绩稳定性，再看能否打开更高层次样本。`
    };
  }
  if (profile.professionalScore >= 250 && profile.cultureTotal < 470) {
    return {
      title: "专业有支撑，文化决定上限",
      body: `孩子专业成绩 ${formatScore(profile.professionalScore)} 分，对综合分有一定支撑；当前综合分 ${formatScore(profile.currentCompositeScore)}，${gapText}。下一步要优先看文化总分能否稳定拉动。`
    };
  }
  if (profile.professionalScore < 230 && profile.cultureTotal >= 500) {
    return {
      title: "文化有基础，专业需要稳住",
      body: `孩子文化总分 ${formatScore(profile.cultureTotal)} 分具备一定基础，但专业成绩 ${formatScore(profile.professionalScore)} 分会影响综合分效率。后续要同时复核专业小分线和当前院校梯度。`
    };
  }
  if (profile.compositeGap >= 35) {
    return {
      title: "处在追赶窗口",
      body: `孩子当前综合分 ${formatScore(profile.currentCompositeScore)}，${gapText}。这类情况不适合平均用力，先确认近三次文化成绩波动，再判断最现实的提分空间。`
    };
  }
  return {
    title: "专业文化相对均衡",
    body: `孩子当前综合分 ${formatScore(profile.currentCompositeScore)}${rankText}，专业和文化都有参考价值。现在更适合先做院校梯度初筛，再结合目标院校和单科成绩细化判断。`
  };
}

function normalizeSimpleContext(input) {
  return {
    studentStage: String(input.studentStage || DEFAULT_SIMPLE_CONTEXT.studentStage),
    scoreSource: String(input.scoreSource || DEFAULT_SIMPLE_CONTEXT.scoreSource),
    planningGoal: String(input.planningGoal || DEFAULT_SIMPLE_CONTEXT.planningGoal),
    familyBoundary: String(input.familyBoundary || DEFAULT_SIMPLE_CONTEXT.familyBoundary)
  };
}

function stageHint(stage) {
  if (stage.includes("高二")) return "时间更充足，适合先定方向再定节奏。";
  if (stage.includes("上学期")) return "仍有调整窗口，适合先看提分曲线。";
  if (stage.includes("估分")) return "重点转向位次校准与志愿梯度。";
  if (stage.includes("复读")) return "要先复盘去年失分和志愿风险。";
  return "时间窗口较紧，适合先锁定可执行目标。";
}

function sourceHint(source) {
  if (source.includes("正式")) return "可信度较高，可直接进入院校梯度复核。";
  if (source.includes("估分") || source.includes("预估")) return "需预留波动区间，避免单点判断。";
  if (source.includes("月考")) return "参考性有限，建议结合模考再校准。";
  return "适合做初筛，后续用近三次成绩复核。";
}

function goalHint(goal) {
  if (goal.includes("省重点") || goal.includes("强专业")) return "优先观察提分后能否打开更高层次。";
  if (goal.includes("公办")) return "重点看分差、专业方向与省内外机会。";
  if (goal.includes("暂无")) return "先用冲稳保样本帮助家庭形成目标。";
  return "先保证本科窗口，再讨论冲刺空间。";
}

function boundaryHint(boundary) {
  if (boundary.includes("省内")) return "样本会偏向省内，后续可再讨论省外增量。";
  if (boundary.includes("省外")) return "可扩大样本池，重点看城市和专业匹配。";
  if (boundary.includes("公办")) return "筛选会避开中外合作与高学费方向。";
  if (boundary.includes("中外")) return "可把中外合作作为机会样本单独比较。";
  return "边界未定，先保留更多可讨论样本。";
}

function buildSimpleContextCards(input) {
  const context = normalizeSimpleContext(input);
  return [
    {
      title: context.studentStage,
      body: stageHint(context.studentStage)
    },
    {
      title: context.scoreSource,
      body: sourceHint(context.scoreSource)
    },
    {
      title: context.planningGoal,
      body: goalHint(context.planningGoal)
    },
    {
      title: context.familyBoundary,
      body: boundaryHint(context.familyBoundary)
    }
  ];
}

function buildTierFallback(tier, report) {
  const lowestProgram = report.lowestProgram;
  if (!lowestProgram) return "当前类别样本不足，后台补表后可显示典型院校。";
  const gap = roundScore(report.scoreProfile.currentCompositeScore - toNumber(lowestProgram.minScore));
  if (gap < 0) {
    return `暂无典型样本，距离 ${lowestProgram.school} 等最低样本线还差 ${formatScore(Math.abs(gap))} 分。`;
  }
  const tierNames = {
    chong: "冲刺",
    wen: "稳妥",
    bao: "保底"
  };
  return `暂无${tierNames[tier]}典型样本，建议结合完整院校表重新校准梯度。`;
}

function buildTierFallbacks(report) {
  return {
    chong: buildTierFallback("chong", report),
    wen: buildTierFallback("wen", report),
    bao: buildTierFallback("bao", report)
  };
}

export function calculateSimpleScoreProfile(input) {
  const cultureTotal = clamp(input.cultureTotal, 0, 750);
  const professionalScore = clamp(input.professionalScore, 0, 300);
  const professionalConvertedScore = roundScore(professionalScore * PROFESSIONAL_CONVERSION_RATE);
  const currentCompositeScore = roundScore(
    cultureTotal * CULTURE_WEIGHT + professionalConvertedScore * PROFESSIONAL_WEIGHT
  );
  const targetCompositeScore = currentCompositeScore >= DEFAULT_SIMPLE_TARGET_COMPOSITE_SCORE
    ? roundScore(currentCompositeScore + ABOVE_TARGET_SIMPLE_LIFT)
    : DEFAULT_SIMPLE_TARGET_COMPOSITE_SCORE;
  const compositeGap = roundScore(Math.max(0, targetCompositeScore - currentCompositeScore));
  const cultureLiftNeeded = Math.ceil(compositeGap / CULTURE_WEIGHT);

  return {
    cultureTotal,
    professionalScore,
    professionalConvertedScore,
    currentCompositeScore,
    targetCompositeScore,
    compositeGap,
    cultureLiftNeeded
  };
}

export function buildSimpleMatchInput(input) {
  const boundary = String(input.familyBoundary || DEFAULT_SIMPLE_CONTEXT.familyBoundary);
  return {
    artCategory: input.artCategory,
    targetSchools: [],
    preferredCities: [],
    acceptOutsideZhejiang: boundary !== "省内优先",
    acceptSinoForeign: boundary !== "公办优先",
    acceptHighTuition: boundary !== "公办优先"
  };
}

export function pickSimpleTierSamples(matches) {
  return {
    chong: firstOrNull(matches?.chong),
    wen: firstOrNull(matches?.wen),
    bao: firstOrNull(matches?.bao)
  };
}

export function buildSimpleAdvisorPoints(report) {
  const profile = report.scoreProfile;
  const rankText = report.rankEstimate?.rank ? `当前位次约 ${report.rankEstimate.rank} 名` : "当前位次需等一分一段表补齐";
  const gapText = profile.compositeGap > 0
    ? `距目标综合分还差 ${profile.compositeGap} 分`
    : "当前分数已超过默认目标线";
  const schoolText = report.unlockedPrograms.length
    ? `提分后可重点看 ${report.unlockedPrograms[0].school} 等样本`
    : "先把当前可关注层次确认清楚";

  return [
    `${rankText}，适合先判断大致层次。`,
    `${gapText}，主要看文化总分是否能继续拉动。`,
    `${schoolText}，后续还需结合专业方向和家庭边界复核。`
  ];
}

export function buildSimpleReport(input, programs = [], rankRecords = []) {
  const scoreProfile = calculateSimpleScoreProfile(input);
  const matchInput = buildSimpleMatchInput(input);
  const lowestProgram = findLowestProgram(programs, input.artCategory);
  const rankEstimate = estimateRankFromScore(rankRecords, input.artCategory, scoreProfile.currentCompositeScore, {
    scoreType: "composite",
    requireScoreType: true
  });
  const currentRawMatches = matchPrograms(matchInput, programs, scoreProfile.currentCompositeScore);
  const improvedRawMatches = matchPrograms(matchInput, programs, scoreProfile.targetCompositeScore);
  const currentMatches = {
    bao: currentRawMatches.bao.slice(0, 1),
    wen: currentRawMatches.wen.slice(0, 1),
    chong: currentRawMatches.chong.slice(0, 1)
  };
  const improvedMatches = {
    bao: improvedRawMatches.bao.slice(0, 1),
    wen: improvedRawMatches.wen.slice(0, 1),
    chong: improvedRawMatches.chong.slice(0, 1)
  };
  const currentKeys = new Set(flattenMatches(currentMatches).map(programKey));
  const unlockedPrograms = flattenMatches(improvedRawMatches)
    .filter((program) => !currentKeys.has(programKey(program)))
    .sort((a, b) => toNumber(b.minScore) - toNumber(a.minScore))
    .slice(0, 2);
  const report = {
    artCategory: input.artCategory,
    context: normalizeSimpleContext(input),
    scoreProfile,
    rankEstimate,
    currentMatches,
    improvedMatches,
    currentSamples: pickSimpleTierSamples(currentMatches),
    improvedTop: topByReferenceScore(flattenMatches(improvedRawMatches)),
    unlockedPrograms,
    lowestProgram
  };

  return {
    ...report,
    tierFallbacks: buildTierFallbacks(report),
    scoreStructure: buildSimpleScoreStructure(scoreProfile),
    contextCards: buildSimpleContextCards(input),
    studentInterpretation: buildSimpleStudentInterpretation(report),
    keyTakeaways: buildSimpleKeyTakeaways(report),
    positionSignals: buildSimplePositionSignals(report),
    liftLevers: buildSimpleLiftLevers(report),
    nextCheckpoints: buildSimpleNextCheckpoints(report),
    consultChecklist: buildSimpleConsultChecklist(),
    advisorPoints: buildSimpleAdvisorPoints(report)
  };
}

export function buildSimpleNarrativeFallback(report) {
  const profile = report.scoreProfile;
  const unlockedSchool = report.unlockedPrograms[0]?.school;
  return {
    headline: compactText(`当前综合分 ${profile.currentCompositeScore}，先看层次`, SIMPLE_FIELD_LIMITS.headline),
    advisorHook: unlockedSchool
      ? compactText(`提分后新增关注 ${unlockedSchool}`, SIMPLE_FIELD_LIMITS.advisorHook)
      : compactText("先确认当前冲稳保层次，再看专业方向", SIMPLE_FIELD_LIMITS.advisorHook),
    nextStep: compactText(`补充近三次文化成绩，判断 ${profile.cultureLiftNeeded} 分空间`, SIMPLE_FIELD_LIMITS.nextStep)
  };
}

export function normalizeSimpleNarratives(narratives, fallback) {
  return SIMPLE_FIELDS.reduce((result, field) => {
    const value = compactText(narratives?.[field], SIMPLE_FIELD_LIMITS[field] || 36);
    result[field] = value || compactText(fallback[field], SIMPLE_FIELD_LIMITS[field] || 36);
    return result;
  }, {});
}

export function buildSimpleAgentRequest(report, sourceLabel = "参考数据") {
  return {
    mode: "simple",
    sourceLabel,
    expectedFields: SIMPLE_FIELDS,
    simplePayload: {
      artCategory: report.artCategory,
      currentCompositeScore: report.scoreProfile.currentCompositeScore,
      targetCompositeScore: report.scoreProfile.targetCompositeScore,
      compositeGap: report.scoreProfile.compositeGap,
      cultureTotal: report.scoreProfile.cultureTotal,
      professionalScore: report.scoreProfile.professionalScore,
      estimatedRank: report.rankEstimate?.rank ?? 0,
      context: report.context,
      keyTakeaways: report.keyTakeaways,
      positionSignals: report.positionSignals,
      liftLevers: report.liftLevers,
      nextCheckpoints: report.nextCheckpoints,
      currentSamples: Object.fromEntries(
        Object.entries(report.currentSamples).map(([tier, program]) => [
          tier,
          program ? {
            school: program.school,
            program: program.program,
            minScore: program.minScore,
            diff: program.diff,
            schoolLevel: program.schoolLevel || ""
          } : null
        ])
      ),
      unlockedSchools: report.unlockedPrograms.map((program) => program.school),
      advisorPoints: report.advisorPoints
    }
  };
}
