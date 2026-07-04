import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSimpleAgentRequest,
  buildSimpleMatchInput,
  buildSimpleNarrativeFallback,
  buildSimpleReport,
  calculateSimpleScoreProfile,
  normalizeSimpleNarratives
} from "../src/simple-core.mjs";

const programs = [
  {
    school: "保底学院",
    program: "视觉传达设计",
    city: "杭州",
    province: "浙江",
    artCategory: "美术与设计",
    minScore: 500,
    minRank: 4200,
    schoolLevel: "普通本科"
  },
  {
    school: "稳妥大学",
    program: "数字媒体艺术",
    city: "宁波",
    province: "浙江",
    artCategory: "美术与设计",
    minScore: 523,
    minRank: 2600,
    schoolLevel: "省重点"
  },
  {
    school: "冲刺大学",
    program: "环境设计",
    city: "上海",
    province: "上海",
    artCategory: "美术与设计",
    minScore: 552,
    minRank: 1500,
    schoolLevel: "双一流"
  },
  {
    school: "提分后大学",
    program: "产品设计",
    city: "南京",
    province: "江苏",
    artCategory: "美术与设计",
    minScore: 570,
    minRank: 1600,
    schoolLevel: "省重点"
  }
];

const rankRecords = [
  { artCategory: "美术与设计", score: 525, rank: 2100, scoreType: "composite" },
  { artCategory: "美术与设计", score: 520, rank: 2450, scoreType: "composite" }
];

test("calculates simple composite score from culture total and professional score", () => {
  const profile = calculateSimpleScoreProfile({
    cultureTotal: 450,
    professionalScore: 240
  });

  assert.equal(profile.currentCompositeScore, 525);
  assert.equal(profile.targetCompositeScore, 550);
  assert.equal(profile.compositeGap, 25);
});

test("uses current score plus 8 when simple score already passes default target", () => {
  const profile = calculateSimpleScoreProfile({
    cultureTotal: 500,
    professionalScore: 260
  });

  assert.equal(profile.currentCompositeScore, 575);
  assert.equal(profile.targetCompositeScore, 583);
  assert.equal(profile.compositeGap, 8);
});

test("builds a concise report with one sample per current tier", () => {
  const report = buildSimpleReport(
    {
      artCategory: "美术与设计",
      cultureTotal: 450,
      professionalScore: 240
    },
    programs,
    rankRecords
  );

  assert.equal(report.rankEstimate.rank, 2100);
  assert.equal(report.currentSamples.bao.school, "保底学院");
  assert.equal(report.currentSamples.wen.school, "稳妥大学");
  assert.equal(report.currentSamples.chong.school, "冲刺大学");
  assert.equal(report.currentMatches.bao.length, 1);
  assert.equal(report.currentMatches.wen.length, 1);
  assert.equal(report.currentMatches.chong.length, 1);
  assert.ok(report.unlockedPrograms.length <= 2);
});

test("simple report includes compact parent-facing briefing blocks", () => {
  const report = buildSimpleReport(
    {
      artCategory: "美术与设计",
      cultureTotal: 450,
      professionalScore: 240
    },
    programs,
    rankRecords
  );

  assert.equal(report.scoreStructure.length, 4);
  assert.equal(report.contextCards.length, 4);
  assert.equal(typeof report.studentInterpretation.title, "string");
  assert.match(report.studentInterpretation.body, /孩子|当前综合分|专业|文化/);
  assert.equal(report.keyTakeaways.length, 3);
  assert.ok(report.positionSignals.length >= 3);
  assert.equal(report.liftLevers.length, 3);
  assert.equal(report.nextCheckpoints.length, 3);
  assert.equal(report.consultChecklist.length, 6);
  assert.equal(report.lowestProgram.school, "保底学院");
});

test("simple boundary fields adjust match assumptions without adding long inputs", () => {
  const provinceFirst = buildSimpleMatchInput({
    artCategory: "美术与设计",
    familyBoundary: "省内优先"
  });
  const publicFirst = buildSimpleMatchInput({
    artCategory: "美术与设计",
    familyBoundary: "公办优先"
  });

  assert.equal(provinceFirst.acceptOutsideZhejiang, false);
  assert.equal(publicFirst.acceptSinoForeign, false);
  assert.equal(publicFirst.acceptHighTuition, false);
});

test("simple tier fallback explains distance to the lowest available sample", () => {
  const report = buildSimpleReport(
    {
      artCategory: "美术与设计",
      cultureTotal: 300,
      professionalScore: 180
    },
    programs,
    []
  );

  assert.equal(report.currentSamples.bao, null);
  assert.match(report.tierFallbacks.bao, /距离 保底学院 等最低样本线还差 125 分/);
});

test("builds simple AI request with only three short narrative fields", () => {
  const report = buildSimpleReport(
    {
      artCategory: "美术与设计",
      cultureTotal: 450,
      professionalScore: 240
    },
    programs,
    rankRecords
  );
  const request = buildSimpleAgentRequest(report, "参考数据");

  assert.equal(request.mode, "simple");
  assert.equal(request.sourceLabel, "参考数据");
  assert.deepEqual(request.expectedFields, ["headline", "advisorHook", "nextStep"]);
  assert.equal(request.simplePayload.context.studentStage, "高三下学期");
  assert.equal(request.simplePayload.keyTakeaways.length, 3);
  assert.equal(request.simplePayload.nextCheckpoints.length, 3);
  assert.equal("parentSummary" in request.simplePayload, false);
  assert.equal("studyPlan" in request.simplePayload, false);
});

test("simple narratives stay short and remove internal wording", () => {
  const report = buildSimpleReport(
    {
      artCategory: "美术与设计",
      cultureTotal: 450,
      professionalScore: 240
    },
    programs,
    rankRecords
  );
  const fallback = buildSimpleNarrativeFallback(report);
  const narratives = normalizeSimpleNarratives({
    headline: "当前综合分525分，顾问现场可继续展开很多内容",
    advisorHook: "顾问建议现场重点讲位次约2100名和冲稳保院校梯度",
    nextStep: "邀约客户补充近三次成绩并加微信继续沟通"
  }, fallback);

  assert.ok(narratives.headline.length <= 24);
  assert.ok(narratives.advisorHook.length <= 32);
  assert.ok(narratives.nextStep.length <= 36);
  assert.equal(/顾问|现场|邀约|客户|加微信|话术/.test(Object.values(narratives).join("")), false);
});
