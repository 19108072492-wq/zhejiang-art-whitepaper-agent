import test from "node:test";
import assert from "node:assert/strict";
import {
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
