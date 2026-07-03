import { normalizeArtCategory } from "./categories.mjs";

const SUBJECT_TARGETS = {
  "语文": 105,
  "数学": 95,
  foreignLanguage: 105,
  defaultElective: 85
};
const PROFESSIONAL_FULL_SCORE = 300;
const PROFESSIONAL_CONVERSION_RATE = 2.5;
const COMPOSITE_WEIGHT = 0.5;
const DEFAULT_TARGET_COMPOSITE_SCORE = 550;
const ABOVE_TARGET_COMPOSITE_LIFT = 5;
const CORE_SUBJECT_FULL_SCORE = 150;
const ELECTIVE_FULL_SCORE = 100;

export const FOREIGN_LANGUAGE_OPTIONS = ["英语", "日语"];
export const ZHEJIANG_ELECTIVE_SUBJECTS = ["技术", "地理", "政治", "物理", "化学", "生物", "历史"];
export const MAJOR_OPTIONS = [
  "视觉传达设计",
  "数字媒体艺术",
  "环境设计",
  "美术学(师范)",
  "播音与主持艺术",
  "舞蹈表演",
  "舞蹈学",
  "书法学",
  "表演",
  "戏剧影视导演"
];
export const CITY_OPTIONS = ["杭州", "宁波", "温州", "金华", "上海", "南京", "北京", "苏州", "广州", "深圳"];

const HIGH_TUITION_LIMIT = 50000;
const MAX_ITEMS_PER_TIER = 3;
const NO_PREFERENCE_VALUES = ["暂无", "暂无偏好", "无", "无偏好", "不限", "不确定"];
const SCORE_BANDS = {
  low: "基础补漏段",
  foundation: "基础巩固段",
  middle: "中档突破段",
  high: "高分稳定段"
};
const SUBJECT_ADVICE = {
  "语文": {
    low: {
      boostPoint: "先把默写、文言基础和现代文定位题做稳，减少空题和答非所问。",
      knowledgeAdvice: "古诗文默写、文言实词虚词、现代文信息筛选、作文审题立意。"
    },
    foundation: {
      boostPoint: "从阅读规范作答和作文结构入手，把会读但拿不全分的问题降下来。",
      knowledgeAdvice: "论述类文本结构、文学类答题角度、古诗鉴赏术语、作文分论点。"
    },
    middle: {
      boostPoint: "重点提升材料整合、语言表达和作文论证深度，冲击稳定高分题。",
      knowledgeAdvice: "信息概括、语言文字运用、古诗文比较阅读、作文素材转化。"
    },
    high: {
      boostPoint: "保持卷面节奏和表达质量，复盘高阶题的失分细节。",
      knowledgeAdvice: "文本深层主旨、复杂材料辨析、作文思辨结构、限时表达。"
    }
  },
  "数学": {
    low: {
      boostPoint: "先保基础题，减少公式不会用、步骤断档和计算失误。",
      knowledgeAdvice: "函数基础、三角恒等变换、数列通项与求和、立体几何基础。"
    },
    foundation: {
      boostPoint: "把基础题和中档题稳定住，先补函数、数列、几何这些高频模块。",
      knowledgeAdvice: "函数性质与图像、数列递推、解析几何直线圆锥曲线、概率统计。"
    },
    middle: {
      boostPoint: "训练中档题联动思路，减少卡在第二问和压轴前半段。",
      knowledgeAdvice: "导数应用、圆锥曲线设参、立体几何证明、概率分布与统计决策。"
    },
    high: {
      boostPoint: "以压轴题拆解和限时复盘为主，稳住选择填空压轴与大题后两问。",
      knowledgeAdvice: "导数综合、解析几何综合、数列不等式、函数零点与极值。"
    }
  },
  foreignLanguage: {
    low: {
      boostPoint: "先补词汇、语法和阅读定位，保证基础阅读题和作文基本句不失控。",
      knowledgeAdvice: "高频词汇、长难句主干、完形语境、应用文基本句型。"
    },
    foundation: {
      boostPoint: "提高阅读速度和准确率，把完形、七选五和作文结构固定下来。",
      knowledgeAdvice: "阅读主旨细节、代词指代、完形逻辑词、应用文与续写框架。"
    },
    middle: {
      boostPoint: "处理细节推断和写作表达升级，让阅读与写作同时提分。",
      knowledgeAdvice: "推断题、观点态度题、语法填空、续写情节推进与句式变化。"
    },
    high: {
      boostPoint: "压缩阅读用时，打磨作文高级表达和卷面稳定性。",
      knowledgeAdvice: "篇章结构、熟词生义、写作连贯衔接、复杂句准确表达。"
    }
  },
  "历史": {
    low: {
      boostPoint: "先建时间轴和基础史实框架，减少材料读懂但不会定位的问题。",
      knowledgeAdvice: "中国古代史主线、近现代史阶段特征、世界史时序、基本史观。"
    },
    foundation: {
      boostPoint: "用时间轴串联材料题，把背景、原因、影响这些常见问法做熟。",
      knowledgeAdvice: "朝代更替、制度演变、近代化进程、材料关键词提取。"
    },
    middle: {
      boostPoint: "强化材料分层和观点论证，提升主观题的有效得分点密度。",
      knowledgeAdvice: "时间轴定位、阶段特征比较、材料概括、史论结合表达。"
    },
    high: {
      boostPoint: "训练开放题立论和多角度比较，避免观点浅、论据散。",
      knowledgeAdvice: "历史解释、史料实证、横向比较、开放性论证结构。"
    }
  },
  "政治": {
    low: {
      boostPoint: "先背准核心概念和主干框架，减少术语错用和答题无关键词。",
      knowledgeAdvice: "经济生活基本概念、政治制度、哲学原理、法治与社会热点。"
    },
    foundation: {
      boostPoint: "把模块框架和材料关键词对应起来，提升主观题踩点能力。",
      knowledgeAdvice: "经济逻辑链、政治主体职责、哲学方法论、文化与法治术语。"
    },
    middle: {
      boostPoint: "训练材料分层和规范术语组合，减少答得多但踩点少。",
      knowledgeAdvice: "设问类型、主体分析、原因措施意义类模板、时政材料转化。"
    },
    high: {
      boostPoint: "提高综合设问拆解和热点迁移能力，让答案更有层次。",
      knowledgeAdvice: "跨模块综合、政策逻辑、哲学辨析、开放题论证。"
    }
  },
  "地理": {
    low: {
      boostPoint: "先补地图、区域和自然地理基础，减少读图读表错误。",
      knowledgeAdvice: "经纬网、等值线、气候类型、水循环、地貌基础。"
    },
    foundation: {
      boostPoint: "把图表判读和区域定位做稳，建立自然到人文的答题链条。",
      knowledgeAdvice: "气候判读、河流特征、农业区位、工业区位、城市空间结构。"
    },
    middle: {
      boostPoint: "训练综合题因果链，提升从图表提取条件并组织答案的能力。",
      knowledgeAdvice: "区域差异、地理过程、区位评价、生态环境问题、材料图表分析。"
    },
    high: {
      boostPoint: "强化开放评价和区域综合，避免答案只罗列不判断。",
      knowledgeAdvice: "区域可持续发展、尺度转换、综合评价、措施类答案结构。"
    }
  },
  "物理": {
    low: {
      boostPoint: "先补力电主干概念和基本模型，减少公式乱套。",
      knowledgeAdvice: "受力分析、牛顿运动定律、功和能、电路基础、图像物理意义。"
    },
    foundation: {
      boostPoint: "稳定模型识别和过程分析，把常规计算题拿到手。",
      knowledgeAdvice: "运动学、力学模型、能量守恒、带电粒子、电磁感应基础。"
    },
    middle: {
      boostPoint: "训练多过程衔接和实验题表达，突破中档综合题。",
      knowledgeAdvice: "动量能量综合、电磁场过程、实验误差分析、图像建模。"
    },
    high: {
      boostPoint: "用压轴题拆段训练，提高复杂情境建模和临界条件判断。",
      knowledgeAdvice: "临界极值、复合场、综合实验、模型迁移。"
    }
  },
  "化学": {
    low: {
      boostPoint: "先补元素化合物和基本反应，减少方程式与概念性失分。",
      knowledgeAdvice: "离子反应、氧化还原、元素周期律、有机基础、实验安全。"
    },
    foundation: {
      boostPoint: "把反应原理和实验流程做熟，稳定选择题和基础大题。",
      knowledgeAdvice: "化学平衡、电化学、物质结构、实验流程、有机官能团。"
    },
    middle: {
      boostPoint: "训练工艺流程和计算推断，提升信息提取与方程书写准确度。",
      knowledgeAdvice: "平衡移动、滴定计算、工业流程、结构性质、有机合成路线。"
    },
    high: {
      boostPoint: "强化陌生情境下的信息迁移，降低综合推断题波动。",
      knowledgeAdvice: "复杂平衡、综合实验设计、晶体结构、有机推断。"
    }
  },
  "生物": {
    low: {
      boostPoint: "先补教材概念和图示过程，减少记忆混淆。",
      knowledgeAdvice: "细胞结构、代谢过程、遗传基本规律、稳态调节、生态基础。"
    },
    foundation: {
      boostPoint: "把概念辨析和实验变量做稳，提升选择题正确率。",
      knowledgeAdvice: "光合呼吸、遗传图解、神经体液调节、实验设计变量。"
    },
    middle: {
      boostPoint: "强化实验分析和遗传综合，减少主观题表达不完整。",
      knowledgeAdvice: "遗传概率、实验设计、信息传递、生态系统能量流动。"
    },
    high: {
      boostPoint: "训练新情境材料和实验评价，提升综合表达层次。",
      knowledgeAdvice: "实验评价、遗传变异综合、生命活动调节、模型建构。"
    }
  },
  "技术": {
    low: {
      boostPoint: "先补通用技术和信息技术基础概念，减少读题和流程错误。",
      knowledgeAdvice: "设计流程、结构与流程、算法基础、数据表示、系统思想。"
    },
    foundation: {
      boostPoint: "把流程分析、算法读写和系统评价做稳，提升基础题得分。",
      knowledgeAdvice: "控制系统、流程优化、算法结构、数据处理、方案评价。"
    },
    middle: {
      boostPoint: "训练综合设计题和程序逻辑，提升方案比较与表达。",
      knowledgeAdvice: "结构设计、控制逻辑、算法综合、数据分析、技术试验。"
    },
    high: {
      boostPoint: "强化开放设计和复杂算法情境，稳定高分题表达。",
      knowledgeAdvice: "系统优化、方案迭代、算法建模、复杂流程评价。"
    }
  }
};

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function clamp(number, min, max) {
  return Math.min(max, Math.max(min, number));
}

function roundScore(value) {
  return Number.parseFloat(Number(value).toFixed(2));
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function isNoPreference(value) {
  return NO_PREFERENCE_VALUES.includes(normalizeText(value));
}

export function normalizeMajorName(value) {
  const text = normalizeText(value)
    .replace(/[（）]/g, (char) => (char === "（" ? "(" : ")"))
    .replace(/\s+/g, "");
  if (!text || isNoPreference(text)) return "";

  const withoutNotes = text.replace(/[(（][^()（）]*[)）]/g, "");
  const aliasMap = [
    [/^(视传|视觉传达)$/, "视觉传达设计"],
    [/^数字媒体$/, "数字媒体艺术"],
    [/^数媒$/, "数字媒体艺术"],
    [/^环境艺术设计$/, "环境设计"],
    [/^播音主持$/, "播音与主持艺术"],
    [/^播音与主持$/, "播音与主持艺术"],
    [/^书法$/, "书法学"],
    [/^表导$/, "戏剧影视导演"],
    [/^表演导演$/, "戏剧影视导演"]
  ];

  for (const [pattern, normalized] of aliasMap) {
    if (pattern.test(withoutNotes)) return normalized;
  }

  return withoutNotes;
}

function splitPreference(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeText(item)).filter((item) => item && !isNoPreference(item));
  }
  return normalizeText(value)
    .split(/[,，、\s]+/)
    .map((item) => item.trim())
    .filter((item) => item && !isNoPreference(item));
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

export function normalizePreferenceInput(input) {
  return {
    targetSchools: unique(splitPreference(input.targetSchools)).slice(0, 3),
    preferredMajors: unique(splitPreference(input.preferredMajors).map(normalizeMajorName).filter(Boolean)),
    preferredCities: unique(splitPreference(input.preferredCities)).slice(0, 2)
  };
}

export function validatePreferences(preferences, options = {}) {
  const normalized = normalizePreferenceInput(preferences);
  const rawTargetSchools = splitPreference(preferences.targetSchools);
  const rawCities = splitPreference(preferences.preferredCities);
  const duplicateCities = rawCities.filter((city, index) => rawCities.indexOf(city) !== index);
  const allowedMajors = unique(splitPreference(options.allowedMajors).map(normalizeMajorName).filter(Boolean));
  const majorOptions = allowedMajors.length ? allowedMajors : MAJOR_OPTIONS;
  const invalidMajors = normalized.preferredMajors.filter((major) => !majorOptions.includes(major));
  const invalidCities = normalized.preferredCities.filter((city) => !CITY_OPTIONS.includes(city));
  const errors = [];

  if (rawTargetSchools.length > 3) {
    errors.push("目标院校最多选择 3 个。");
  }
  if (invalidMajors.length > 0) {
    errors.push(allowedMajors.length ? "喜欢专业必须从当前艺考类别下的专业选项中选择。" : "喜欢专业必须从系统选项中选择。");
  }
  if (
    rawCities.length > 2 ||
    duplicateCities.length > 0
  ) {
    errors.push("喜欢城市最多选择 2 个，且不能重复。");
  }
  if (invalidCities.length > 0) {
    errors.push(`城市选项不在当前范围内：${invalidCities.join("、")}。`);
  }

  return {
    valid: errors.length === 0,
    errors,
    normalized
  };
}

export function validateElectiveSubjects(electives) {
  const names = (Array.isArray(electives) ? electives : [])
    .map((elective) => normalizeText(elective.name))
    .filter(Boolean);
  const duplicateNames = names.filter((name, index) => names.indexOf(name) !== index);
  const invalid = names.filter((name) => !ZHEJIANG_ELECTIVE_SUBJECTS.includes(name));

  return {
    valid: names.length === 3 && duplicateNames.length === 0 && invalid.length === 0,
    duplicates: unique(duplicateNames),
    invalid: unique(invalid)
  };
}

function buildSubject(name, current, target, maxScore) {
  const score = toNumber(current);
  const targetScore = toNumber(target);
  return {
    name,
    current: score,
    target: targetScore,
    gap: Math.max(0, targetScore - score),
    maxScore
  };
}

function subjectAdviceKey(name) {
  if (FOREIGN_LANGUAGE_OPTIONS.includes(name) || name === "外语") return "foreignLanguage";
  if (name === "思想政治") return "政治";
  return name;
}

function scoreBandKey(current, maxScore) {
  if (maxScore === ELECTIVE_FULL_SCORE) {
    if (current < 50) return "low";
    if (current < 70) return "foundation";
    if (current < 85) return "middle";
    return "high";
  }
  if (current < 60) return "low";
  if (current < 90) return "foundation";
  if (current < 120) return "middle";
  return "high";
}

function enrichSubjectAnalysis(subject) {
  const bandKey = scoreBandKey(subject.current, subject.maxScore);
  const advice = SUBJECT_ADVICE[subjectAdviceKey(subject.name)]?.[bandKey] ?? {
    boostPoint: "先补必备知识和常见题型，再用专题训练稳定中档题得分。",
    knowledgeAdvice: "基础概念、核心模型、材料分析、规范表达。"
  };

  return {
    ...subject,
    scoreBand: SCORE_BANDS[bandKey],
    scoreStatus: `当前处于${SCORE_BANDS[bandKey]}，建议先处理最容易转化为分数的确定性失分。`,
    boostPoint: advice.boostPoint,
    knowledgeAdvice: advice.knowledgeAdvice
  };
}

function allocateGap(subjects, requestedGap) {
  const maxReachableGap = subjects.reduce((sum, subject) => sum + Math.max(0, subject.maxScore - subject.current), 0);
  const normalizedGap = Math.round(clamp(requestedGap, 0, maxReachableGap));
  if (normalizedGap <= 0) {
    return subjects.map((subject) => ({
      ...subject,
      target: subject.current,
      gap: 0
    }));
  }

  const defaultGaps = subjects.map((subject) => Math.max(0, subject.target - subject.current));
  const capacities = subjects.map((subject) => Math.max(0, subject.maxScore - subject.current));
  const defaultGapTotal = defaultGaps.reduce((sum, gap) => sum + gap, 0);
  const weights = defaultGapTotal > 0 ? defaultGaps : capacities;
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  if (weightTotal <= 0) return subjects;

  const allocations = subjects.map((subject, index) => {
    const raw = normalizedGap * weights[index] / weightTotal;
    const allocation = Math.min(capacities[index], Math.floor(raw));
    return {
      index,
      allocation,
      capacity: capacities[index],
      remainder: raw - allocation
    };
  });
  let remaining = normalizedGap - allocations.reduce((sum, item) => sum + item.allocation, 0);

  while (remaining > 0) {
    const candidates = allocations
      .filter((item) => item.allocation < item.capacity)
      .sort((a, b) => b.remainder - a.remainder || (b.capacity - b.allocation) - (a.capacity - a.allocation) || a.index - b.index);
    if (candidates.length === 0) break;

    let progressed = false;
    for (const item of candidates) {
      if (remaining <= 0) break;
      item.allocation += 1;
      item.remainder = 0;
      remaining -= 1;
      progressed = true;
    }
    if (!progressed) break;
  }

  return subjects.map((subject, index) => {
    const target = subject.current + (allocations[index]?.allocation ?? 0);
    return {
      ...subject,
      target,
      gap: Math.max(0, target - subject.current)
    };
  });
}

function resolveTargetCompositeScore(currentCompositeScore) {
  if (currentCompositeScore >= DEFAULT_TARGET_COMPOSITE_SCORE) {
    return roundScore(currentCompositeScore + ABOVE_TARGET_COMPOSITE_LIFT);
  }
  return DEFAULT_TARGET_COMPOSITE_SCORE;
}

export function calculateScoreProfile(input) {
  const electives = Array.isArray(input.electives) ? input.electives : [];
  const professionalScore = clamp(toNumber(input.professionalScore), 0, PROFESSIONAL_FULL_SCORE);
  const foreignLanguage = FOREIGN_LANGUAGE_OPTIONS.includes(normalizeText(input.foreignLanguage))
    ? normalizeText(input.foreignLanguage)
    : "外语";
  const baseSubjects = [
    buildSubject("语文", input.chinese, input.chineseTarget ?? SUBJECT_TARGETS["语文"], CORE_SUBJECT_FULL_SCORE),
    buildSubject("数学", input.math, input.mathTarget ?? SUBJECT_TARGETS["数学"], CORE_SUBJECT_FULL_SCORE),
    buildSubject(foreignLanguage, input.english, input.englishTarget ?? SUBJECT_TARGETS.foreignLanguage, CORE_SUBJECT_FULL_SCORE),
    ...electives.map((elective) =>
      buildSubject(
        normalizeText(elective.name) || "选考",
        elective.score,
        elective.target ?? SUBJECT_TARGETS.defaultElective,
        ELECTIVE_FULL_SCORE
      )
    )
  ];

  const currentTotal = baseSubjects.reduce((sum, subject) => sum + subject.current, 0);
  const professionalConvertedScore = roundScore(professionalScore * PROFESSIONAL_CONVERSION_RATE);
  const currentCompositeScore = roundScore(
    currentTotal * COMPOSITE_WEIGHT + professionalConvertedScore * COMPOSITE_WEIGHT
  );
  const targetCompositeGoal = resolveTargetCompositeScore(currentCompositeScore);
  const requestedTargetTotal = Math.max(
    currentTotal,
    Math.round(targetCompositeGoal / COMPOSITE_WEIGHT - professionalConvertedScore)
  );
  const subjects = allocateGap(baseSubjects, requestedTargetTotal - currentTotal);
  const enrichedSubjects = subjects.map(enrichSubjectAnalysis);
  const targetTotal = enrichedSubjects.reduce((sum, subject) => sum + subject.target, 0);
  const totalGap = Math.max(0, targetTotal - currentTotal);
  const targetCompositeScore = roundScore(
    targetTotal * COMPOSITE_WEIGHT + professionalConvertedScore * COMPOSITE_WEIGHT
  );
  const compositeGap = roundScore(Math.max(0, targetCompositeScore - currentCompositeScore));
  const priorities = [...enrichedSubjects].sort((a, b) => b.gap - a.gap || a.name.localeCompare(b.name, "zh-Hans-CN"));

  return {
    currentTotal,
    targetTotal,
    totalGap,
    professionalScore,
    professionalConvertedScore,
    currentCompositeScore,
    targetCompositeScore,
    compositeGap,
    subjects: enrichedSubjects,
    priorities
  };
}

function focusForSubject(subject) {
  if (subject.name === "数学") {
    return "先稳基础题和中档题，减少会做但丢分的题，再补函数、数列、几何等高频模块。";
  }
  if (subject.name === "语文") {
    return "先稳作文结构、现代文答题模板和古诗文基础分，减少表达不完整造成的失分。";
  }
  if (subject.name === "外语" || FOREIGN_LANGUAGE_OPTIONS.includes(subject.name)) {
    return "先稳词汇、阅读定位和作文句型，优先处理阅读慢、完形错、写作空的问题。";
  }
  return "先补选考基础概念和高频题型，再用专题训练提升中档题稳定性。";
}

export function buildStudyPlan(scoreProfile) {
  return scoreProfile.priorities.map((subject) => ({
    subject: subject.name,
    current: subject.current,
    target: subject.target,
    gap: subject.gap,
    level: subject.gap >= 25 ? "优先突破" : subject.gap >= 12 ? "重点提升" : "保持巩固",
    focus: focusForSubject(subject),
    days30: "整理错题和薄弱模块，每周完成一次小测，先把确定性失分降下来。",
    days60: "进入专题强化和限时训练，把基础题正确率和中档题完成率稳定住。",
    days90: "按考试节奏做整卷复盘，形成固定答题顺序和考前复习清单。"
  }));
}

function isProgramAllowed(input, program) {
  if (normalizeArtCategory(program.artCategory) !== normalizeArtCategory(input.artCategory)) {
    return false;
  }
  if (!input.acceptOutsideZhejiang && normalizeText(program.province) !== "浙江") {
    return false;
  }
  if (!input.acceptSinoForeign && Boolean(program.isSinoForeign)) {
    return false;
  }
  if (!input.acceptHighTuition && toNumber(program.tuition) > HIGH_TUITION_LIMIT) {
    return false;
  }
  return true;
}

function getTier(diff) {
  if (diff >= 20) return "bao";
  if (diff >= -8) return "wen";
  if (diff >= -35) return "chong";
  return null;
}

function preferenceScore(input, program) {
  const cities = splitPreference(input.preferredCities);
  const majors = splitPreference(input.preferredMajors);
  const schools = splitPreference(input.targetSchools);
  const programMajor = normalizeMajorName(program.program);
  let score = 0;

  if (cities.some((city) => normalizeText(program.city).includes(city))) score += 8;
  if (majors.some((major) => {
    const normalizedMajor = normalizeMajorName(major);
    return normalizedMajor && programMajor && (
      programMajor.includes(normalizedMajor) || normalizedMajor.includes(programMajor)
    );
  })) score += 10;
  if (schools.some((school) => normalizeText(program.school).includes(school))) score += 12;
  if (Array.isArray(program.tags) && program.tags.includes("目标院校")) score += 6;

  return score;
}

function decorateProgram(input, program, totalScore) {
  const minScore = toNumber(program.minScore);
  const diff = roundScore(totalScore - minScore);
  const tier = getTier(diff);

  if (!tier) return null;

  return {
    ...program,
    diff,
    tier,
    preferenceScore: preferenceScore(input, program),
    reason:
      tier === "bao"
        ? "分数余量相对更足，可作为保底观察样本。"
        : tier === "wen"
          ? "分数接近参考线，适合作为稳妥观察样本。"
          : "需要文化课继续提升或依靠专业优势，适合作为冲刺观察样本。"
  };
}

function sortTierItems(tier, items) {
  return [...items].sort((a, b) => {
    if (b.preferenceScore !== a.preferenceScore) return b.preferenceScore - a.preferenceScore;
    if (tier === "bao") return Math.abs(a.diff - 25) - Math.abs(b.diff - 25);
    if (tier === "wen") return Math.abs(a.diff) - Math.abs(b.diff);
    return Math.abs(a.diff + 18) - Math.abs(b.diff + 18);
  });
}

export function matchPrograms(input, programs, totalScore) {
  const buckets = {
    bao: [],
    wen: [],
    chong: []
  };

  for (const program of programs) {
    if (!isProgramAllowed(input, program)) continue;
    const decorated = decorateProgram(input, program, totalScore);
    if (!decorated) continue;
    buckets[decorated.tier].push(decorated);
  }

  return {
    bao: sortTierItems("bao", buckets.bao).slice(0, MAX_ITEMS_PER_TIER),
    wen: sortTierItems("wen", buckets.wen).slice(0, MAX_ITEMS_PER_TIER),
    chong: sortTierItems("chong", buckets.chong).slice(0, MAX_ITEMS_PER_TIER)
  };
}

function collectOpportunityTags(matches) {
  const ordered = [
    ...matches.bao,
    ...matches.wen,
    ...matches.chong
  ];
  return unique(ordered.flatMap((item) => Array.isArray(item.tags) ? item.tags : []));
}

function flattenMatches(matches) {
  return [
    ...matches.bao,
    ...matches.wen,
    ...matches.chong
  ];
}

function programKey(program) {
  return `${program.school}::${program.program}`;
}

function topByReferenceScore(programs) {
  return [...programs].sort((a, b) => toNumber(b.minScore) - toNumber(a.minScore))[0] ?? null;
}

function buildComparison(currentMatches, improvedMatches) {
  const currentPrograms = flattenMatches(currentMatches);
  const improvedPrograms = flattenMatches(improvedMatches);
  const currentTop = topByReferenceScore(currentPrograms);
  const improvedTop = topByReferenceScore(improvedPrograms);
  const currentKeys = new Set(currentPrograms.map(programKey));
  const unlockedPrograms = improvedPrograms
    .filter((program) => !currentKeys.has(programKey(program)))
    .sort((a, b) => toNumber(b.minScore) - toNumber(a.minScore))
    .slice(0, 4);

  return {
    currentTop,
    improvedTop,
    scoreLift: currentTop && improvedTop
      ? roundScore(Math.max(0, toNumber(improvedTop.minScore) - toNumber(currentTop.minScore)))
      : 0,
    unlockedPrograms
  };
}

function buildSummary(scoreProfile, comparison) {
  const mainGap = scoreProfile.priorities[0];
  const unlockedSchool = comparison.unlockedPrograms[0]?.school;
  const liftText = unlockedSchool
    ? `提分后可把 ${unlockedSchool} 等更高层次院校纳入关注。`
    : "先把当前可达院校稳定住，再观察更高层次机会。";

  return `当前综合分 ${scoreProfile.currentCompositeScore} 分，目标综合分 ${scoreProfile.targetCompositeScore} 分，文化总分差距 ${scoreProfile.totalGap} 分。优先突破 ${mainGap.name} 后，${liftText}`;
}

function buildPresentationBrief(input, scoreProfile, comparison) {
  const prioritySubjects = scoreProfile.priorities
    .filter((subject) => subject.gap > 0)
    .slice(0, 2)
    .map((subject) => subject.name);
  const subjectText = prioritySubjects.length ? prioritySubjects.join("、") : "现有优势科目稳定";
  const targetSchools = splitPreference(input.targetSchools).slice(0, 3);
  const cities = splitPreference(input.preferredCities).slice(0, 2);
  const targetText = targetSchools.length ? `目标院校关注 ${targetSchools.join("、")}。` : "目标院校暂未锁定。";
  const cityText = cities.length ? `城市偏好为 ${cities.join("、")}。` : "城市边界可在面谈中继续确认。";
  const currentSchool = comparison.currentTop?.school ?? "当前稳保冲样本";
  const improvedSchool = comparison.unlockedPrograms[0]?.school ?? comparison.improvedTop?.school;
  const compareTitle = comparison.scoreLift > 0 && improvedSchool
    ? `提分后可新增关注 ${improvedSchool}`
    : "先稳住当前可达院校";
  const compareDetail = comparison.scoreLift > 0
    ? `最高参考样本提升约 ${comparison.scoreLift} 分，适合现场展示提分带来的院校变化。`
    : "当前目标综合分先用于稳定可达层次，后续用正式数据继续细筛冲刺机会。";

  return {
    cards: [
      {
        label: "家长先看",
        title: `当前综合分 ${scoreProfile.currentCompositeScore}`,
        detail: `当前可重点讲 ${currentSchool} 这一档，${targetText}${cityText}`
      },
      {
        label: "提分抓手",
        title: `文化课差 ${scoreProfile.totalGap} 分`,
        detail: `面谈时先抓 ${subjectText}，用各科失分点和 30 天任务解释为什么能提。`
      },
      {
        label: "院校对比",
        title: compareTitle,
        detail: compareDetail
      },
      {
        label: "下一步",
        title: "7 天内完成一次资料复盘",
        detail: "补齐近三次文化成绩、专业小分或一分一段、学费与城市边界，再做第二版院校清单。"
      }
    ],
    actions: [
      "带家长核对近三次文化成绩和专业成绩波动。",
      `现场确认 30 天主攻科目：${subjectText}。`,
      "补齐目标院校、城市、学费接受度后，生成第二版稳保冲清单。"
    ]
  };
}

export function generateWhitepaper(input, programs) {
  const scoreProfile = calculateScoreProfile(input);
  const studyPlan = buildStudyPlan(scoreProfile);
  const currentMatches = matchPrograms(input, programs, scoreProfile.currentCompositeScore);
  const improvedMatches = matchPrograms(input, programs, scoreProfile.targetCompositeScore);
  const comparison = buildComparison(currentMatches, improvedMatches);
  const opportunityTags = unique([
    ...collectOpportunityTags(currentMatches),
    ...collectOpportunityTags(improvedMatches)
  ]);

  return {
    scoreProfile,
    studyPlan,
    currentMatches,
    improvedMatches,
    comparison,
    opportunityTags,
    presentationBrief: buildPresentationBrief(input, scoreProfile, comparison),
    summary: buildSummary(scoreProfile, comparison)
  };
}
