import test from "node:test";
import assert from "node:assert/strict";
import {
  buildReportRecordPayload,
  buildDataContext,
  buildRemoteSavePayload,
  cacheProgramPayload,
  cacheRankPayload,
  loadProgramPayload,
  loadRankPayload
} from "../src/data-store.mjs";

test("builds a compact data context without raw Excel records", () => {
  const context = buildDataContext({
    sourceLabel: "正式数据",
    artCategory: "美术与设计",
    programPayload: {
      records: [
        { artCategory: "美术与设计", school: "浙江传媒学院" },
        { artCategory: "音乐", school: "浙江音乐学院" }
      ]
    },
    rankPayload: {
      records: [
        { artCategory: "美术与设计", score: 525, rank: 2100 },
        { artCategory: "音乐", score: 530, rank: 900 }
      ]
    },
    rankEstimate: {
      matchedScore: 525,
      rank: 2100
    }
  });

  assert.deepEqual(context, {
    dataSource: "正式数据",
    usesUploadedPrograms: true,
    usesUploadedRankTable: true,
    programRecordCount: 2,
    rankRecordCount: 2,
    categoryProgramCount: 1,
    categoryRankCount: 1,
    rankMatchedScore: 525,
    estimatedRank: 2100
  });
  assert.equal("records" in context, false);
  assert.equal("programs" in context, false);
});

test("builds compact report record payload without raw dataset rows", () => {
  const record = buildReportRecordPayload({
    input: {
      studentName: "  王同学  ",
      artCategory: "美术与设计",
      cultureTotal: 450,
      professionalScore: 240,
      studentStage: "高三下学期",
      scoreSource: "最近一次模考",
      planningGoal: "冲公办本科",
      familyBoundary: "省内优先"
    },
    report: {
      artCategory: "美术与设计",
      scoreProfile: {
        cultureTotal: 450,
        professionalScore: 240,
        currentCompositeScore: 525,
        targetCompositeScore: 550,
        compositeGap: 25
      },
      rankEstimate: { score: 525, matchedScore: 525, rank: 2100 },
      currentSamples: {
        chong: { school: "冲刺大学", program: "环境设计", minScore: 552, diff: -27 },
        wen: { school: "稳妥大学", program: "数字媒体艺术", minScore: 523, diff: 2 },
        bao: { school: "保底学院", program: "视觉传达设计", minScore: 500, diff: 25 }
      },
      unlockedPrograms: [
        { school: "提分后大学", program: "产品设计", minScore: 570 }
      ],
      keyTakeaways: [{ title: "定位", body: "当前进入本科窗口。" }],
      studentInterpretation: {
        title: "孩子解读",
        body: "文化总分仍是关键。",
        points: [
          { title: "成绩结构", body: "文化和专业需要一起看。" },
          { title: "当前变量", body: "目标差距需要校准。" },
          { title: "位次校准", body: "位次需要复核。" }
        ]
      },
      scoreStructure: [{ label: "文化总分", value: "450", detail: "按 50% 计入" }],
      nextCheckpoints: [{ title: "下一步", body: "补近三次成绩。" }],
      consultChecklist: ["近三次文化总分"]
    },
    narratives: {
      headline: "当前综合分525，先看层次",
      scoreInsight: "估算位次约2100名。",
      schoolTierInsight: "当前按冲稳保层次判断。",
      nextStep: "补充近三次成绩。"
    },
    sourceLabel: "正式数据",
    dataContext: {
      dataSource: "正式数据",
      programRecordCount: 100,
      rankRecordCount: 200,
      categoryProgramCount: 80,
      categoryRankCount: 30,
      estimatedRank: 2100
    }
  });

  assert.equal(record.studentName, "王同学");
  assert.equal(record.mode, "simple");
  assert.equal(record.artCategory, "美术与设计");
  assert.equal(record.input.planningGoal, "冲公办本科");
  assert.equal(record.scoreProfile.currentCompositeScore, 525);
  assert.equal(record.rankEstimate.rank, 2100);
  assert.equal(record.narratives.headline, "当前综合分525，先看层次");
  assert.equal(record.narratives.schoolTierInsight, "当前按冲稳保层次判断。");
  assert.equal(record.report.currentSamples.wen.school, "稳妥大学");
  assert.equal(record.report.studentInterpretation.points.length, 3);
  assert.equal(record.report.unlockedPrograms.length, 1);
  assert.equal(record.meta.sourceLabel, "正式数据");
  assert.equal("programs" in record, false);
  assert.equal("rankRecords" in record, false);
});

test("remote save payload carries only action data and admin secret", () => {
  const payload = buildRemoteSavePayload("saveRankTable", {
    records: [{ artCategory: "美术与设计", score: 525, rank: 2100 }],
    meta: { fileName: "rank.xlsx" },
    adminSecret: "secret"
  });

  assert.equal(payload.action, "saveRankTable");
  assert.equal(payload.adminSecret, "secret");
  assert.equal(payload.records.length, 1);
  assert.equal(payload.meta.fileName, "rank.xlsx");
});

test("memory cache keeps large remote datasets readable when localStorage is unavailable", () => {
  globalThis.window = {
    localStorage: {
      setItem() {
        throw new Error("quota exceeded");
      },
      removeItem() {},
      getItem() {
        return "";
      }
    }
  };

  cacheProgramPayload([{ artCategory: "美术与设计", school: "缓存院校" }], { fileName: "programs.xlsx" });
  cacheRankPayload([{ artCategory: "美术与设计", score: 525, rank: 2100 }], { fileName: "rank.xlsx" });

  assert.equal(loadProgramPayload().records[0].school, "缓存院校");
  assert.equal(loadRankPayload().records[0].rank, 2100);

  delete globalThis.window;
});
