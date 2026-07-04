import { matchPrograms } from "./analysis.mjs";
import { estimateRankFromScore } from "./data-import.mjs";

const DEFAULT_SIMPLE_TARGET_COMPOSITE_SCORE = 550;
const ABOVE_TARGET_SIMPLE_LIFT = 8;
const CULTURE_WEIGHT = 0.5;
const PROFESSIONAL_CONVERSION_RATE = 2.5;
const PROFESSIONAL_WEIGHT = 0.5;
const SIMPLE_FIELDS = ["headline", "advisorHook", "nextStep"];

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
  return {
    artCategory: input.artCategory,
    targetSchools: [],
    preferredCities: [],
    acceptOutsideZhejiang: true,
    acceptSinoForeign: true,
    acceptHighTuition: true
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
    ? `提分后可重点讲 ${report.unlockedPrograms[0].school} 等样本`
    : "先把当前可关注层次讲清楚";

  return [
    `${rankText}，适合先判断大致层次。`,
    `${gapText}，主要看文化总分是否能继续拉动。`,
    `${schoolText}，现场再细看专业方向和家庭边界。`
  ];
}

export function buildSimpleReport(input, programs = [], rankRecords = []) {
  const scoreProfile = calculateSimpleScoreProfile(input);
  const matchInput = buildSimpleMatchInput(input);
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
    scoreProfile,
    rankEstimate,
    currentMatches,
    improvedMatches,
    currentSamples: pickSimpleTierSamples(currentMatches),
    improvedTop: topByReferenceScore(flattenMatches(improvedRawMatches)),
    unlockedPrograms
  };

  return {
    ...report,
    advisorPoints: buildSimpleAdvisorPoints(report)
  };
}

export function buildSimpleNarrativeFallback(report) {
  const profile = report.scoreProfile;
  const unlockedSchool = report.unlockedPrograms[0]?.school;
  return {
    headline: `当前综合分 ${profile.currentCompositeScore}，先看可达层次`,
    advisorHook: unlockedSchool
      ? `提分后可围绕 ${unlockedSchool} 等样本展开沟通`
      : "适合先确认当前冲稳保层次，再细看专业方向",
    nextStep: `建议补充近三次文化成绩，判断 ${profile.cultureLiftNeeded} 分提升空间`
  };
}

export function normalizeSimpleNarratives(narratives, fallback) {
  return SIMPLE_FIELDS.reduce((result, field) => {
    const value = String(narratives?.[field] ?? "").trim();
    result[field] = value || fallback[field];
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
