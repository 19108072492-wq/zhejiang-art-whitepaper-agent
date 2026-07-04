import test from "node:test";
import assert from "node:assert/strict";
import {
  buildParentNarrativeFallback,
  buildParentNarrativePayload,
  normalizeParentNarratives
} from "../src/parent-narrative.mjs";
import { generateWhitepaper } from "../src/analysis.mjs";

const input = {
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
  compositeRank: 1200,
  compositeRankEstimate: {
    matchedScore: 543,
    rank: 1200
  },
  targetSchools: ["中国美术学院", "浙江理工大学"],
  preferredCities: ["杭州", "上海"],
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
    schoolLevel: "省重点",
    minScore: 520,
    minRank: 3500,
    tags: ["城市机会"]
  },
  {
    school: "浙江理工大学",
    program: "视觉传达设计",
    city: "杭州",
    province: "浙江",
    artCategory: "美术与设计类",
    schoolLevel: "省重点",
    minScore: 548,
    minRank: 2100,
    tags: ["专业强"]
  },
  {
    school: "南京艺术学院",
    program: "环境设计",
    city: "南京",
    province: "江苏",
    artCategory: "美术与设计类",
    schoolLevel: "艺术强校",
    minScore: 572,
    minRank: 1500,
    tags: ["省外机会"]
  },
  {
    school: "中国美术学院",
    program: "视觉传达设计",
    city: "杭州",
    province: "浙江",
    artCategory: "美术与设计类",
    schoolLevel: "双一流",
    minScore: 610,
    minRank: 760,
    tags: ["目标院校"]
  }
];

const narrativeKeys = [
  "parentSummary",
  "studentTypeInsight",
  "targetSchoolInsight",
  "subjectPriorityInsight",
  "nextStepAdvice"
];

const forbiddenReportWords = [
  "顾问",
  "销售",
  "成交",
  "邀约",
  "到访",
  "加微信",
  "话术",
  "面谈",
  "客户意向",
  "转化"
];

test("builds a compact parent narrative payload from rule results only", () => {
  const whitepaper = generateWhitepaper(input, programs);
  const dataContext = {
    dataSource: "正式数据",
    usesUploadedPrograms: true,
    usesUploadedRankTable: true,
    programRecordCount: 4,
    rankRecordCount: 300,
    categoryProgramCount: 4,
    categoryRankCount: 60,
    rankMatchedScore: 543,
    estimatedRank: 1200
  };
  const payload = buildParentNarrativePayload(input, whitepaper, dataContext);

  assert.deepEqual(Object.keys(payload).sort(), [
    "comparisonSummary",
    "dataContext",
    "lineInsight",
    "preferences",
    "student",
    "subjects",
    "targets"
  ]);
  assert.equal(payload.student.currentCompositeScore, 543);
  assert.deepEqual(payload.dataContext, dataContext);
  assert.equal(payload.student.targetCompositeScore, 550);
  assert.equal(payload.student.compositeGap, 7);
  assert.equal(payload.student.estimatedCompositeRank, 1200);
  assert.equal(payload.student.estimatedProfessionalRank, undefined);
  assert.deepEqual(payload.targets.selectedSchools, ["中国美术学院", "浙江理工大学"]);
  assert.equal(payload.targets.currentMatchesSummary.chong[0].school, "南京艺术学院");
  assert.equal(payload.subjects.topPrioritySubjects[0].name, "数学");
  assert.equal(payload.studyPlan, undefined);
  assert.equal(payload.scoreProfile, undefined);
  assert.equal(payload.currentMatches, undefined);
  assert.equal("programs" in payload, false);
  assert.equal("rankRecords" in payload, false);
});

test("normalizes agent narratives to five parent-facing fields with fallback fill", () => {
  const whitepaper = generateWhitepaper(input, programs);
  const payload = buildParentNarrativePayload(input, whitepaper);
  const fallback = buildParentNarrativeFallback(payload);
  const normalized = normalizeParentNarratives(
    {
      parentSummary: "孩子当前综合分和目标分之间存在差距，但差距主要集中在文化课部分。后续需要优先处理数学和英语的稳定提分，同时保持专业成绩优势，逐步把当前可关注院校和目标院校之间的距离缩小。",
      studentTypeInsight: "",
      targetSchoolInsight: null
    },
    fallback
  );

  for (const key of narrativeKeys) {
    assert.equal(typeof normalized[key], "string");
    assert.notEqual(normalized[key].trim(), "");
  }
  const combined = narrativeKeys.map((key) => normalized[key]).join("\n");
  for (const word of forbiddenReportWords) {
    assert.equal(combined.includes(word), false);
  }
});
