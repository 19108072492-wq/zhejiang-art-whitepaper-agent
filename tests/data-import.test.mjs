import test from "node:test";
import assert from "node:assert/strict";
import {
  detectHeaders,
  detectRankHeaders,
  estimateRankFromScore,
  mergeRecordsByDetectedCategories,
  normalizeImportedRows,
  normalizeRankRows
} from "../src/data-import.mjs";

const excelRows = [
  {
    "院校代码": "10355",
    "院校名称": "中国美术学院",
    "院校层次": "双一流",
    "省份": "浙江",
    "城市": "杭州",
    "专业名称": "视觉传达设计",
    "科类方向名称": "美术与设计",
    "综合分": "610.5",
    "位次号": "760名",
    "培养方向": "视觉传达、品牌设计、数字媒体方向"
  },
  {
    "院校代名称": "温州肯恩大学",
    "学校层次": "中外合作",
    "省": "浙江",
    "所在地": "温州",
    "专业": "视觉传达设计(中外合作)",
    "类别": "美术类",
    "最低分": "530",
    "位次": "3000",
    "专业方向": "中外合作设计方向"
  },
  {
    "院校名称": "",
    "专业名称": "",
    "录取最低分": ""
  }
];

test("detects common Chinese Excel headers", () => {
  const headers = detectHeaders(excelRows[0]);

  assert.equal(headers.school, "院校名称");
  assert.equal(headers.program, "专业名称");
  assert.equal(headers.schoolLevel, "院校层次");
  assert.equal(headers.province, "省份");
  assert.equal(headers.city, "城市");
  assert.equal(headers.minScore, "综合分");
  assert.equal(headers.minRank, "位次号");
  assert.equal(headers.direction, "培养方向");
});

test("normalizes Excel rows into school program records", () => {
  const result = normalizeImportedRows(excelRows);

  assert.equal(result.records.length, 2);
  assert.equal(result.skippedRows, 1);
  assert.equal(result.records[0].schoolCode, "10355");
  assert.equal(result.records[0].school, "中国美术学院");
  assert.equal(result.records[0].schoolLevel, "双一流");
  assert.equal(result.records[0].province, "浙江");
  assert.equal(result.records[0].city, "杭州");
  assert.equal(result.records[0].program, "视觉传达设计");
  assert.equal(result.records[0].artCategory, "美术与设计");
  assert.equal(result.records[0].minScore, 610.5);
  assert.equal(result.records[0].minRank, 760);
  assert.equal(result.records[0].direction, "视觉传达、品牌设计、数字媒体方向");
  assert.equal(result.records[0].isSinoForeign, false);

  assert.equal(result.records[1].school, "温州肯恩大学");
  assert.equal(result.records[1].schoolLevel, "中外合作");
  assert.equal(result.records[1].artCategory, "美术与设计");
  assert.equal(result.records[1].minScore, 530);
  assert.equal(result.records[1].isSinoForeign, true);
});

test("uses sheet name as category hint when program rows omit category", () => {
  const result = normalizeImportedRows([
    {
      "院校名称": "浙江传媒学院",
      "专业名称": "播音与主持艺术",
      "综合分": "560",
      "位次号": "1280"
    }
  ], {
    categoryHint: "播音"
  });

  assert.equal(result.records[0].artCategory, "播音");
});

test("normalizes music art category for program and rank data", () => {
  const programResult = normalizeImportedRows([
    {
      "院校名称": "浙江音乐学院",
      "专业名称": "音乐表演",
      "综合分": "560",
      "位次号": "900",
      "科类方向名称": "音乐类"
    }
  ]);
  const rankResult = normalizeRankRows([
    {
      "科类或方向名称": "音乐类",
      "综合分成绩": "560",
      "人数累计": "900"
    }
  ]);

  assert.equal(programResult.records[0].artCategory, "音乐");
  assert.equal(rankResult.records[0].artCategory, "音乐");
});

test("maps official rank direction names to broad art categories", () => {
  const result = normalizeRankRows([
    { "科类或方向名称": "美术与设计", "综合分成绩": "560", "人数累计": "100" },
    { "科类或方向名称": "播音与主持类", "综合分成绩": "560", "人数累计": "200" },
    { "科类或方向名称": "舞蹈类", "综合分成绩": "560", "人数累计": "300" },
    { "科类或方向名称": "书法类", "综合分成绩": "560", "人数累计": "400" },
    { "科类或方向名称": "戏剧影视表演", "综合分成绩": "560", "人数累计": "500" },
    { "科类或方向名称": "服装表演", "综合分成绩": "560", "人数累计": "600" },
    { "科类或方向名称": "戏剧影视导演", "综合分成绩": "560", "人数累计": "700" },
    { "科类或方向名称": "音乐教育器乐主项", "综合分成绩": "560", "人数累计": "800" },
    { "科类或方向名称": "音乐教育声乐主项", "综合分成绩": "560", "人数累计": "900" },
    { "科类或方向名称": "音乐表演器乐方向", "综合分成绩": "560", "人数累计": "1000" },
    { "科类或方向名称": "音乐表演声乐方向", "综合分成绩": "560", "人数累计": "1100" }
  ]);

  assert.deepEqual(
    result.records.map((record) => record.artCategory),
    [
      "美术与设计",
      "播音",
      "舞蹈",
      "书法",
      "表导",
      "表导",
      "表导",
      "音乐",
      "音乐",
      "音乐",
      "音乐"
    ]
  );
});

test("normalizes one-score-one-rank rows and estimates professional rank", () => {
  const rankRows = [
    { "艺考类别": "美术与设计", "专业分": "290分", "位次号": "120名" },
    { "艺考类别": "美术与设计", "专业分": "275", "位次号": "680" },
    { "艺考类别": "美术与设计", "专业分": "260", "位次号": "1580" },
    { "艺考类别": "舞蹈", "专业分": "275", "位次号": "310" },
    { "艺考类别": "", "专业分": "", "累计位次": "" }
  ];
  const headers = detectRankHeaders(rankRows[0]);

  assert.equal(headers.artCategory, "艺考类别");
  assert.equal(headers.score, "专业分");
  assert.equal(headers.rank, "位次号");

  const result = normalizeRankRows(rankRows);
  assert.equal(result.records.length, 4);
  assert.equal(result.skippedRows, 1);
  assert.deepEqual(result.records[0], {
    artCategory: "美术与设计",
    score: 290,
    rank: 120,
    scoreType: "professional"
  });

  assert.deepEqual(
    estimateRankFromScore(result.records, "美术与设计", 276),
    {
      rank: 680,
      matchedScore: 275,
      exact: false,
      scoreType: "professional"
    }
  );
  assert.deepEqual(
    estimateRankFromScore(result.records, "舞蹈", 275),
    {
      rank: 310,
      matchedScore: 275,
      exact: true,
      scoreType: "professional"
    }
  );
});

test("keeps category marks from a combined all-direction rank table", () => {
  const rankRows = [
    { "专业": "美术与设计类", "成绩": "276", "累计人数": "680" },
    { "专业": "舞蹈类", "成绩": "276", "累计人数": "310" },
    { "专业": "播音主持类", "成绩": "276", "累计人数": "450" }
  ];

  const headers = detectRankHeaders(rankRows[0]);

  assert.equal(headers.artCategory, "专业");
  assert.equal(headers.score, "成绩");
  assert.equal(headers.rank, "累计人数");

  const result = normalizeRankRows(rankRows, {
    forceCategory: "美术与设计"
  });

  assert.deepEqual(
    result.records.map((record) => record.artCategory),
    ["美术与设计", "舞蹈", "播音"]
  );
  assert.deepEqual(
    estimateRankFromScore(result.records, "舞蹈", 276),
    {
      rank: 310,
      matchedScore: 276,
      exact: true,
      scoreType: "professional"
    }
  );
});

test("detects official combined comprehensive score rank headers", () => {
  const rankRows = [
    { "科类或方向名称": "美术与设计类", "综合分成绩": "543", "人数小计": "12", "人数累计": "680" },
    { "科类或方向名称": "舞蹈类", "综合分成绩": "543", "人数小计": "8", "人数累计": "310" }
  ];
  const headers = detectRankHeaders(rankRows[0]);

  assert.equal(headers.artCategory, "科类或方向名称");
  assert.equal(headers.score, "综合分成绩");
  assert.equal(headers.rank, "人数累计");

  const result = normalizeRankRows(rankRows);

  assert.deepEqual(result.records[0], {
    artCategory: "美术与设计",
    score: 543,
    rank: 680,
    scoreType: "composite"
  });
  assert.deepEqual(
    estimateRankFromScore(result.records, "美术与设计", 543, { scoreType: "composite" }),
    {
      rank: 680,
      matchedScore: 543,
      exact: true,
      scoreType: "composite"
    }
  );
});

test("uses rank fallback category when sheet name is not a known art category", () => {
  const result = normalizeRankRows([
    { "专业分": "276", "位次号": "680" }
  ], {
    categoryHint: "Sheet1",
    fallbackCategory: "美术与设计"
  });

  assert.equal(result.records[0].artCategory, "美术与设计");
});

test("merges combined rank imports by detected categories", () => {
  const existingRecords = [
    { artCategory: "美术与设计", score: 250, rank: 1000 },
    { artCategory: "舞蹈", score: 250, rank: 500 },
    { artCategory: "书法", score: 250, rank: 300 }
  ];
  const nextRecords = [
    { artCategory: "美术与设计", score: 276, rank: 680 },
    { artCategory: "舞蹈", score: 276, rank: 310 }
  ];

  const merged = mergeRecordsByDetectedCategories(existingRecords, nextRecords, "美术与设计");

  assert.deepEqual(
    merged.map((record) => `${record.artCategory}:${record.score}:${record.rank}`),
    [
      "书法:250:300",
      "美术与设计:276:680",
      "舞蹈:276:310"
    ]
  );
});
