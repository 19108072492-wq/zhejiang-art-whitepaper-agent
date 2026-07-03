import test from "node:test";
import assert from "node:assert/strict";
import {
  CITY_OPTIONS,
  MAJOR_OPTIONS,
  ZHEJIANG_ELECTIVE_SUBJECTS,
  calculateScoreProfile,
  buildStudyPlan,
  matchPrograms,
  normalizeMajorName,
  normalizePreferenceInput,
  validatePreferences,
  validateElectiveSubjects,
  generateWhitepaper
} from "../src/analysis.mjs";

const studentInput = {
  artCategory: "美术与设计类",
  foreignLanguage: "英语",
  chinese: 88,
  math: 62,
  english: 90,
  electives: [
    { name: "历史", score: 74 },
    { name: "政治", score: 81 },
    { name: "地理", score: 76 }
  ],
  professionalScore: 246,
  professionalRank: 1200,
  targetSchools: "中国美术学院, 浙江理工大学",
  preferredMajors: "视觉传达设计, 数字媒体艺术",
  preferredCities: "杭州, 上海",
  acceptOutsideZhejiang: true,
  acceptSinoForeign: false,
  acceptHighTuition: false
};

const programs = [
  {
    school: "浙江传媒学院",
    program: "数字媒体艺术",
    city: "杭州",
    province: "浙江",
    artCategory: "美术与设计类",
    batch: "艺术类一段",
    minScore: 520,
    minRank: 3500,
    planCount: 28,
    tuition: 10300,
    tags: ["城市机会", "低关注高适配"]
  },
  {
    school: "浙江理工大学",
    program: "视觉传达设计",
    city: "杭州",
    province: "浙江",
    artCategory: "美术与设计类",
    batch: "艺术类一段",
    minScore: 548,
    minRank: 2100,
    planCount: 18,
    tuition: 10350,
    tags: ["专业强", "城市机会"]
  },
  {
    school: "南京艺术学院",
    program: "环境设计",
    city: "南京",
    province: "江苏",
    artCategory: "美术与设计类",
    batch: "艺术类一段",
    minScore: 572,
    minRank: 1500,
    planCount: 16,
    tuition: 11000,
    tags: ["省外机会", "专业强"]
  },
  {
    school: "中国美术学院",
    program: "视觉传达设计",
    city: "杭州",
    province: "浙江",
    artCategory: "美术与设计类",
    batch: "艺术类一段",
    minScore: 610,
    minRank: 760,
    planCount: 12,
    tuition: 15000,
    tags: ["目标院校", "顶尖专业"]
  },
  {
    school: "温州肯恩大学",
    program: "视觉传达设计(中外合作)",
    city: "温州",
    province: "浙江",
    artCategory: "美术与设计类",
    batch: "艺术类一段",
    minScore: 530,
    minRank: 3000,
    planCount: 20,
    tuition: 68000,
    isSinoForeign: true,
    tags: ["中外合作"]
  }
];

test("calculates current total, target total, and subject gaps", () => {
  const profile = calculateScoreProfile(studentInput);

  assert.equal(profile.currentTotal, 471);
  assert.equal(profile.targetTotal, 485);
  assert.equal(profile.totalGap, 14);
  assert.equal(profile.professionalConvertedScore, 615);
  assert.equal(profile.currentCompositeScore, 543);
  assert.equal(profile.targetCompositeScore, 550);
  assert.equal(profile.compositeGap, 7);
  assert.deepEqual(
    profile.subjects.map((subject) => ({
      name: subject.name,
      current: subject.current,
      target: subject.target,
      gap: subject.gap
    })),
    [
      { name: "语文", current: 88, target: 91, gap: 3 },
      { name: "数学", current: 62, target: 67, gap: 5 },
      { name: "英语", current: 90, target: 92, gap: 2 },
      { name: "历史", current: 74, target: 76, gap: 2 },
      { name: "政治", current: 81, target: 82, gap: 1 },
      { name: "地理", current: 76, target: 77, gap: 1 }
    ]
  );
});

test("prioritizes the largest gaps in the study plan", () => {
  const profile = calculateScoreProfile(studentInput);
  const plan = buildStudyPlan(profile);

  assert.equal(plan[0].subject, "数学");
  assert.equal(plan[0].gap, 5);
  assert.match(plan[0].focus, /基础题|中档题/);
  assert.match(plan[0].days30, /错题/);
  assert.equal(plan.at(-1).gap, 1);
});

test("adds score-band subject analysis and knowledge advice", () => {
  const profile = calculateScoreProfile(studentInput);
  const math = profile.subjects.find((subject) => subject.name === "数学");
  const history = profile.subjects.find((subject) => subject.name === "历史");

  assert.equal(math.scoreBand, "基础巩固段");
  assert.match(math.boostPoint, /基础题|中档题/);
  assert.match(math.knowledgeAdvice, /函数|数列|几何/);
  assert.equal(history.scoreBand, "中档突破段");
  assert.match(history.knowledgeAdvice, /时间轴|材料/);
});

test("matches current programs into typical bao-wen-chong tiers", () => {
  const profile = calculateScoreProfile(studentInput);
  const matches = matchPrograms(studentInput, programs, profile.currentCompositeScore);

  assert.equal(matches.bao[0].school, "浙江传媒学院");
  assert.equal(matches.wen[0].school, "浙江理工大学");
  assert.equal(matches.chong[0].school, "南京艺术学院");
  assert.equal(
    matches.bao.some((item) => item.school === "温州肯恩大学"),
    false
  );
});

test("generates current and improved whitepaper comparison", () => {
  const whitepaper = generateWhitepaper(studentInput, programs);

  assert.equal(whitepaper.scoreProfile.currentTotal, 471);
  assert.equal(whitepaper.scoreProfile.targetTotal, 485);
  assert.equal(whitepaper.scoreProfile.currentCompositeScore, 543);
  assert.equal(whitepaper.scoreProfile.targetCompositeScore, 550);
  assert.equal(whitepaper.currentMatches.chong[0].school, "南京艺术学院");
  assert.equal(whitepaper.improvedMatches.chong[0].school, "南京艺术学院");
  assert.equal(whitepaper.comparison.currentTop.school, "南京艺术学院");
  assert.equal(whitepaper.comparison.improvedTop.school, "南京艺术学院");
  assert.equal(whitepaper.comparison.scoreLift, 0);
  assert.deepEqual(
    whitepaper.comparison.unlockedPrograms.map((item) => item.school),
    []
  );
  assert.deepEqual(
    whitepaper.opportunityTags.slice(0, 3),
    ["城市机会", "低关注高适配", "专业强"]
  );
  assert.match(whitepaper.summary, /当前综合分/);
  assert.match(whitepaper.summary, /先把当前可达院校稳定住/);
  assert.equal(whitepaper.presentationBrief.cards.length, 4);
  assert.deepEqual(
    whitepaper.presentationBrief.cards.map((card) => card.label),
    ["家长先看", "提分抓手", "院校对比", "下一步"]
  );
  assert.match(whitepaper.presentationBrief.cards[1].detail, /数学/);
  assert.match(whitepaper.presentationBrief.actions.join(" "), /近三次文化成绩/);
});

test("keeps a current reference sample when score is below normal tier windows", () => {
  const lowScoreInput = {
    ...studentInput,
    chinese: 70,
    math: 45,
    english: 70,
    electives: [
      { name: "历史", score: 55 },
      { name: "政治", score: 55 },
      { name: "地理", score: 55 }
    ],
    professionalScore: 220,
    targetSchools: "",
    preferredCities: ""
  };

  const whitepaper = generateWhitepaper(lowScoreInput, programs);

  assert.equal(whitepaper.scoreProfile.currentCompositeScore, 450);
  assert.equal(whitepaper.currentMatches.chong[0].school, "浙江传媒学院");
  assert.equal(whitepaper.comparison.currentTop.school, "浙江传媒学院");
  assert.equal(whitepaper.comparison.currentTop.diff, -70);
  assert.match(whitepaper.comparison.currentTop.reason, /参照样本/);
  assert.deepEqual(whitepaper.lineInsight, {
    floorSchool: "浙江传媒学院",
    floorProgram: "数字媒体艺术",
    floorScore: 520,
    gap: 70,
    margin: 0,
    status: "below",
    message: "距离最低上线还差 70 分"
  });
});

test("validates Zhejiang elective subjects and rejects duplicate selections", () => {
  assert.deepEqual(ZHEJIANG_ELECTIVE_SUBJECTS, ["技术", "地理", "政治", "物理", "化学", "生物", "历史"]);

  const valid = validateElectiveSubjects([
    { name: "技术", score: 80 },
    { name: "地理", score: 78 },
    { name: "历史", score: 82 }
  ]);

  assert.equal(valid.valid, true);
  assert.deepEqual(valid.duplicates, []);
  assert.deepEqual(valid.invalid, []);

  const invalid = validateElectiveSubjects([
    { name: "地理", score: 80 },
    { name: "地理", score: 78 },
    { name: "美术", score: 82 }
  ]);

  assert.equal(invalid.valid, false);
  assert.deepEqual(invalid.duplicates, ["地理"]);
  assert.deepEqual(invalid.invalid, ["美术"]);
});

test("normalizes and validates target schools, major options, and city choices", () => {
  assert.equal(MAJOR_OPTIONS.includes("视觉传达设计"), true);
  assert.equal(CITY_OPTIONS.includes("杭州"), true);

  const preferences = normalizePreferenceInput({
    targetSchools: ["中国美术学院", "浙江理工大学", "", "中国美术学院"],
    preferredMajors: ["视觉传达设计", "数字媒体艺术"],
    preferredCities: ["杭州", "", "上海"]
  });

  assert.deepEqual(preferences.targetSchools, ["中国美术学院", "浙江理工大学"]);
  assert.deepEqual(preferences.preferredMajors, ["视觉传达设计", "数字媒体艺术"]);
  assert.deepEqual(preferences.preferredCities, ["杭州", "上海"]);
  assert.deepEqual(validatePreferences(preferences).errors, []);

  const invalid = validatePreferences({
    targetSchools: [],
    preferredMajors: ["不存在的专业"],
    preferredCities: ["杭州", "杭州", "火星"]
  });

  assert.equal(invalid.valid, false);
  assert.deepEqual(invalid.errors, [
    "喜欢专业必须从系统选项中选择。",
    "喜欢城市最多选择 2 个，且不能重复。",
    "城市选项不在当前范围内：火星。"
  ]);

  assert.deepEqual(
    validatePreferences({
      targetSchools: ["A", "B", "C", "D"],
      preferredMajors: ["视觉传达设计"],
      preferredCities: ["杭州"]
    }).errors,
    ["目标院校最多选择 3 个。"]
  );

  const dynamicMajorValidation = validatePreferences(
    {
      targetSchools: ["中国美术学院"],
      preferredMajors: ["音乐教育"],
      preferredCities: ["杭州"]
    },
    {
      allowedMajors: ["视觉传达设计", "数字媒体艺术"]
    }
  );

  assert.equal(dynamicMajorValidation.valid, false);
  assert.deepEqual(dynamicMajorValidation.errors, ["喜欢专业必须从当前艺考类别下的专业选项中选择。"]);

  const noPreferenceValidation = validatePreferences({
    targetSchools: ["暂无"],
    preferredMajors: ["暂无偏好"],
    preferredCities: ["暂无"]
  });

  assert.equal(noPreferenceValidation.valid, true);
  assert.deepEqual(noPreferenceValidation.normalized, {
    targetSchools: [],
    preferredMajors: [],
    preferredCities: []
  });
});

test("normalizes common major names for preference dropdowns", () => {
  assert.equal(normalizeMajorName("视觉传达设计（中外合作）"), "视觉传达设计");
  assert.equal(normalizeMajorName("视传"), "视觉传达设计");
  assert.equal(normalizeMajorName("数媒"), "数字媒体艺术");
  assert.equal(normalizeMajorName("播音主持"), "播音与主持艺术");
  assert.equal(normalizeMajorName("暂无偏好"), "");
});
