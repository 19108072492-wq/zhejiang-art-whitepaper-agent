import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("parent form does not ask for preferred major", async () => {
  const indexHtml = await readFile(resolve(root, "index.html"), "utf8");
  const appScript = await readFile(resolve(root, "src/app.mjs"), "utf8");

  assert.equal(indexHtml.includes("喜欢专业"), false);
  assert.equal(indexHtml.includes("专业偏好"), false);
  assert.equal(indexHtml.includes("preferredMajor"), false);
  assert.equal(appScript.includes("preferredMajor"), false);
});

test("simple version has an independent fast-entry page", async () => {
  const indexHtml = await readFile(resolve(root, "index.html"), "utf8");
  const simpleHtml = await readFile(resolve(root, "simple.html"), "utf8");

  assert.equal(indexHtml.includes("./src/app.mjs"), true);
  assert.equal(indexHtml.includes("./src/simple-app.mjs"), false);
  assert.equal(indexHtml.includes('href="./simple.html"'), true);
  assert.equal(indexHtml.includes("简易版快测"), true);
  assert.equal(simpleHtml.includes("./src/simple-app.mjs"), true);
  assert.equal(simpleHtml.includes("./config.js"), true);
  assert.equal(simpleHtml.includes("./assets/feifan-logo.jpg"), true);
  assert.equal(simpleHtml.includes('name="studentName"'), true);
  assert.equal(simpleHtml.includes('name="artCategory"'), true);
  assert.equal(simpleHtml.includes('name="cultureTotal"'), true);
  assert.equal(simpleHtml.includes('name="professionalScore"'), true);
  assert.equal(simpleHtml.includes('name="studentStage"'), true);
  assert.equal(simpleHtml.includes('name="scoreSource"'), true);
  assert.equal(simpleHtml.includes('name="planningGoal"'), true);
  assert.equal(simpleHtml.includes('name="familyBoundary"'), true);
});

test("simple version does not ask for long-form preference fields", async () => {
  const simpleHtml = await readFile(resolve(root, "simple.html"), "utf8");

  assert.equal(simpleHtml.includes("目标院校"), false);
  assert.equal(simpleHtml.includes("喜欢城市"), false);
  assert.equal(simpleHtml.includes("选考科目"), false);
  assert.equal(simpleHtml.includes("选考一"), false);
  assert.equal(simpleHtml.includes("手机号"), false);
  assert.equal(simpleHtml.includes("语文"), false);
  assert.equal(simpleHtml.includes("数学"), false);
  assert.equal(simpleHtml.includes("外语"), false);
});

test("simple report renders compact professional briefing sections", async () => {
  const simpleScript = await readFile(resolve(root, "src/simple-app.mjs"), "utf8");
  const styles = await readFile(resolve(root, "styles.css"), "utf8");

  for (const label of ["关键判断", "孩子解读", "成绩结构", "当前院校快照", "提分后可能打开", "下一步确认"]) {
    assert.equal(simpleScript.includes(label), true);
  }
  assert.equal(simpleScript.includes("consultChecklist"), true);
  assert.equal(simpleScript.includes("simple-checklist"), true);
  assert.equal(simpleScript.includes("顾问讲解点"), false);
  assert.equal(simpleScript.includes("现场继续展开"), false);
  assert.equal(simpleScript.includes("分析报告"), true);
  assert.equal(simpleScript.includes("AI重点解读"), false);
  assert.equal(simpleScript.includes("simple-ai-panel"), true);
  assert.equal(simpleScript.includes("simple-ai-card"), true);
  assert.equal(simpleScript.includes("完整版白皮书会继续测什么"), true);
  assert.equal(simpleScript.includes("目标院校差距"), true);
  assert.equal(simpleScript.includes("单科提分优先级"), true);
  assert.equal(simpleScript.includes("提分前后冲稳保"), true);
  assert.equal(styles.includes(".simple-full-hook"), true);
  assert.equal(styles.includes(".simple-insight-grid"), true);
  assert.equal(styles.includes(".simple-focus-grid"), true);
  assert.equal(styles.includes(".simple-student-read"), true);
  assert.equal(styles.includes(".simple-ai-summary"), true);
  assert.equal(styles.includes(".simple-ai-panel"), true);
  assert.equal(styles.includes(".simple-ai-card"), true);
  assert.equal(styles.includes("@media (max-width: 520px)"), true);
  assert.equal(styles.includes(".simple-checklist"), true);
});

test("report keeps subject advice concise", async () => {
  const appScript = await readFile(resolve(root, "src/app.mjs"), "utf8");

  assert.equal(appScript.includes("优先提分科目 TOP3"), true);
  assert.equal(appScript.includes("问题"), true);
  assert.equal(appScript.includes("提分动作"), true);
  assert.equal(appScript.includes("目标分数"), true);
  assert.equal(appScript.includes("科目知识补强建议"), false);
});

test("study plan does not render long-form guidance blocks", async () => {
  const appScript = await readFile(resolve(root, "src/app.mjs"), "utf8");

  assert.equal(appScript.includes("30 / 60 / 90 天学习计划"), false);
  assert.equal(appScript.includes("现状诊断"), false);
  assert.equal(appScript.includes("关键任务"), false);
  assert.equal(appScript.includes("验收指标"), false);
  assert.equal(appScript.includes("家长跟进"), false);
  assert.equal(appScript.includes("plan.slice(0, 3)"), true);
});

test("uses Feifan poster brand styling and report layout", async () => {
  const indexHtml = await readFile(resolve(root, "index.html"), "utf8");
  const appScript = await readFile(resolve(root, "src/app.mjs"), "utf8");
  const styles = await readFile(resolve(root, "styles.css"), "utf8");
  const logo = await readFile(resolve(root, "assets/feifan-logo.jpg")).catch(() => new Uint8Array());

  assert.equal(indexHtml.includes("./assets/feifan-logo.jpg"), true);
  assert.equal(indexHtml.includes("brand-logo"), true);
  assert.equal(indexHtml.includes("非凡教育"), true);
  assert.equal(appScript.includes("非凡教育"), true);
  assert.equal(`${indexHtml}\n${appScript}`.includes("小凡择校"), false);
  assert.equal(styles.includes("--brand-yellow"), true);
  assert.equal(styles.includes("--brand-blue"), true);
  assert.equal(styles.includes("--home-title-size"), true);
  assert.equal(styles.includes("--home-hero-gap"), true);
  assert.equal(styles.includes("--home-content-width"), true);
  assert.equal(styles.includes("--mobile-title-size"), true);
  assert.equal(styles.includes("--mobile-input-height"), true);
  assert.equal(styles.includes("@media (max-width: 1180px)"), true);
  assert.equal(styles.includes(".intro-panel {\n    display: none;"), true);
  assert.equal(styles.includes("scroll-snap-type: x mandatory"), true);
  assert.equal(styles.includes(".poster-feature-row {\n    grid-template-columns: repeat(3, minmax(0, 1fr));"), true);
  assert.equal(styles.includes(".poster-ribbon"), true);
  assert.equal(styles.includes(".report-cover"), true);
  assert.equal(styles.includes(".report-score-board"), true);
  assert.equal(styles.includes(".fieldset-block legend"), true);
  assert.equal(styles.includes("float: left;"), true);
  assert.equal(appScript.includes("report-brand-row"), true);
  assert.equal(appScript.includes("report-hero-grid"), true);
  assert.ok(logo.byteLength > 1000);
});

test("front end waits for parent narratives before rendering report", async () => {
  const appScript = await readFile(resolve(root, "src/app.mjs"), "utf8");

  assert.equal(appScript.includes("/api/analyze"), true);
  assert.equal(appScript.includes("WHITEPAPER_AGENT_API_URL"), true);
  assert.equal(appScript.includes("buildParentNarrativePayload"), true);
  assert.equal(appScript.includes("requestParentNarratives"), true);
  assert.equal(appScript.includes("updateParentNarratives"), true);
  assert.equal(appScript.includes("requestAgentWhitepaper"), false);
  assert.equal(/const\s+agentNarratives\s*=\s*await\s+requestParentNarratives/.test(appScript), true);
  assert.equal(appScript.includes("renderReport(whitepaper, source, input, normalizedNarratives)"), true);
  assert.equal(appScript.includes("renderReport(whitepaper, source, input);"), false);
  assert.equal(appScript.includes(".then((agentNarratives)"), false);
});

test("generation flow shows a countdown status while waiting", async () => {
  const indexHtml = await readFile(resolve(root, "index.html"), "utf8");
  const appScript = await readFile(resolve(root, "src/app.mjs"), "utf8");
  const styles = await readFile(resolve(root, "styles.css"), "utf8");

  assert.equal(indexHtml.includes('id="generation-status"'), true);
  assert.equal(indexHtml.includes("预计还需"), true);
  assert.equal(appScript.includes("GENERATION_COUNTDOWN_SECONDS"), true);
  assert.equal(appScript.includes("startGenerationCountdown"), true);
  assert.equal(appScript.includes("stopGenerationCountdown"), true);
  assert.equal(appScript.includes("isGenerating"), true);
  assert.equal(styles.includes(".generation-status"), true);
  assert.equal(styles.includes(".generation-progress"), true);
});

test("rank display uses composite score instead of professional conversion", async () => {
  const appScript = await readFile(resolve(root, "src/app.mjs"), "utf8");

  assert.equal(appScript.includes("专业折算分"), false);
  assert.equal(appScript.includes("估算专业位次"), false);
  assert.equal(appScript.includes("估算综合分位次"), true);
  assert.equal(appScript.includes("按一分一段表"), true);
  assert.equal(appScript.includes("综合分分档估算位次"), true);
  assert.equal(appScript.includes('"chinese", "math", "english"'), true);
  assert.equal(appScript.includes('"elective1Score", "elective2Score", "elective3Score"'), true);
});

test("front end keeps AI secrets out of browser files", async () => {
  const indexHtml = await readFile(resolve(root, "index.html"), "utf8");
  const appScript = await readFile(resolve(root, "src/app.mjs"), "utf8");
  const adminScript = await readFile(resolve(root, "src/admin.mjs"), "utf8");
  const simpleScript = await readFile(resolve(root, "src/simple-app.mjs"), "utf8");
  const configScript = await readFile(resolve(root, "config.js"), "utf8");
  const browserFiles = [indexHtml, appScript, adminScript, simpleScript, configScript].join("\n");

  assert.equal(indexHtml.includes("./config.js"), true);
  assert.equal(configScript.includes("WHITEPAPER_DATA_API_URL"), true);
  assert.equal(browserFiles.includes("AI_API_KEY"), false);
  assert.equal(browserFiles.includes("SUPABASE_SERVICE_ROLE_KEY"), false);
  assert.equal(browserFiles.includes("ffjy123456"), false);
  assert.equal(/sk-[A-Za-z0-9_-]{20,}/.test(browserFiles), false);
});

test("admin page supports secret link auto-login without keeping secret in URL", async () => {
  const adminHtml = await readFile(resolve(root, "admin.html"), "utf8");
  const adminScript = await readFile(resolve(root, "src/admin.mjs"), "utf8");

  assert.equal(adminHtml.includes("./config.js"), true);
  assert.ok(adminHtml.indexOf("./config.js") < adminHtml.indexOf("./src/admin.mjs"));
  assert.equal(adminScript.includes("URLSearchParams"), true);
  assert.equal(adminScript.includes("adminSecret"), true);
  assert.equal(adminScript.includes("history.replaceState"), true);
  assert.equal(adminScript.includes("unlockAdmin"), true);
});

test("rank table admin upload is a single combined-table entry", async () => {
  const adminHtml = await readFile(resolve(root, "admin.html"), "utf8");
  const adminScript = await readFile(resolve(root, "src/admin.mjs"), "utf8");

  assert.equal(adminHtml.includes('name="rankCategory"'), false);
  assert.equal(adminHtml.includes("默认类别"), false);
  assert.equal(adminHtml.includes("保存一分一段数据"), true);
  assert.equal(adminHtml.includes("清空全部一分一段"), true);
  assert.equal(adminScript.includes("rankCategoryInputs"), false);
  assert.equal(adminScript.includes("selectedCategory(rankCategoryInputs)"), false);
});

test("art category options include music in parent form and program admin upload", async () => {
  const indexHtml = await readFile(resolve(root, "index.html"), "utf8");
  const adminHtml = await readFile(resolve(root, "admin.html"), "utf8");

  assert.equal(indexHtml.includes("<option>音乐</option>"), true);
  assert.equal(adminHtml.includes('name="programCategory" value="音乐"'), true);
  assert.equal(adminHtml.includes("戏剧影视表演/服装表演/戏剧影视导演=表导"), true);
  assert.equal(adminHtml.includes("音乐教育器乐主项/音乐教育声乐主项/音乐表演器乐方向/音乐表演声乐方向=音乐"), true);
});

test("supabase edge function reads AI key from server secrets", async () => {
  const edgeFunction = await readFile(resolve(root, "supabase/functions/analyze/index.ts"), "utf8");

  assert.equal(edgeFunction.includes('Deno.env.get("AI_API_KEY")'), true);
  assert.equal(edgeFunction.includes("chat/completions"), true);
  assert.equal(edgeFunction.includes("access-control-allow-origin"), true);
});

test("supabase data function persists whitepaper datasets with admin secret", async () => {
  const dataFunction = await readFile(resolve(root, "supabase/functions/data/index.ts"), "utf8");
  const config = await readFile(resolve(root, "supabase/config.toml"), "utf8");
  const migrations = [
    await readFile(resolve(root, "supabase/migrations/20260704000000_create_whitepaper_datasets.sql"), "utf8"),
    await readFile(resolve(root, "supabase/migrations/20260704002000_create_whitepaper_report_records.sql"), "utf8")
  ].join("\n");

  for (const token of [
    "getDatasets",
    "saveProgramCategory",
    "saveRankTable",
    "clearProgramCategory",
    "clearRankTable",
    "saveReportRecord",
    "getReportRecords",
    'Deno.env.get("ADMIN_SECRET")',
    'Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")',
    "whitepaper_datasets",
    "whitepaper_report_records"
  ]) {
    assert.equal(dataFunction.includes(token), true);
  }
  assert.equal(migrations.includes("whitepaper_report_records"), true);
  assert.equal(migrations.includes("enable row level security"), true);
  assert.equal(config.includes("[functions.data]"), true);
  assert.equal(config.includes("verify_jwt = false"), true);
});

test("simple report submits student name and generated report record", async () => {
  const simpleHtml = await readFile(resolve(root, "simple.html"), "utf8");
  const simpleScript = await readFile(resolve(root, "src/simple-app.mjs"), "utf8");
  const dataStore = await readFile(resolve(root, "src/data-store.mjs"), "utf8");

  assert.equal(simpleHtml.includes("学生姓名"), true);
  assert.equal(simpleHtml.includes('name="studentName"'), true);
  assert.equal(simpleScript.includes("studentName"), true);
  assert.equal(simpleScript.includes("saveReportRecordRemote"), true);
  assert.equal(simpleScript.includes("buildReportRecordPayload"), true);
  assert.equal(simpleScript.includes("saveSimpleReportRecord"), true);
  assert.equal(dataStore.includes("buildReportRecordPayload"), true);
  assert.equal(dataStore.includes("saveReportRecordRemote"), true);
});

test("admin page can view generated report records after secret login", async () => {
  const adminHtml = await readFile(resolve(root, "admin.html"), "utf8");
  const adminScript = await readFile(resolve(root, "src/admin.mjs"), "utf8");
  const styles = await readFile(resolve(root, "styles.css"), "utf8");

  assert.equal(adminHtml.includes("生成记录"), true);
  assert.equal(adminHtml.includes('id="report-record-list"'), true);
  assert.equal(adminHtml.includes('id="refresh-records"'), true);
  assert.equal(adminScript.includes("loadReportRecordsRemote"), true);
  assert.equal(adminScript.includes("renderReportRecords"), true);
  assert.equal(adminScript.includes("refreshReportRecords"), true);
  assert.equal(styles.includes(".report-record-list"), true);
  assert.equal(styles.includes(".report-record-card"), true);
});

test("report uses parent-facing planning sections instead of internal interview wording", async () => {
  const appScript = await readFile(resolve(root, "src/app.mjs"), "utf8");
  const styles = await readFile(resolve(root, "styles.css"), "utf8");

  assert.equal(appScript.includes("当前分析结论"), true);
  assert.equal(appScript.includes("学生类型诊断"), true);
  assert.equal(appScript.includes("目标院校差距"), true);
  assert.equal(appScript.includes("后续规划建议"), true);
  assert.equal(appScript.includes("面谈结论与下一步"), false);
  assert.equal(appScript.includes("顾问实时分析"), false);
  assert.equal(appScript.includes("现场话术"), false);
  assert.equal(appScript.includes("presentation-brief"), true);
  assert.equal(styles.includes(".presentation-brief"), true);
});

test("agent endpoints only ask for five parent narrative fields", async () => {
  const serverScript = await readFile(resolve(root, "server.mjs"), "utf8");
  const edgeFunction = await readFile(resolve(root, "supabase/functions/analyze/index.ts"), "utf8");
  const endpointCode = `${serverScript}\n${edgeFunction}`;

  for (const field of [
    "parentSummary",
    "studentTypeInsight",
    "targetSchoolInsight",
    "subjectPriorityInsight",
    "nextStepAdvice"
  ]) {
    assert.equal(endpointCode.includes(field), true);
  }
  assert.equal(endpointCode.includes("consultantTakeaway"), false);
  assert.equal(endpointCode.includes("parentTalkTrack"), false);
  assert.equal(endpointCode.includes("subjectStrategy"), false);
});

test("agent prompts constrain AI to uploaded data summary", async () => {
  const serverScript = await readFile(resolve(root, "server.mjs"), "utf8");
  const edgeFunction = await readFile(resolve(root, "supabase/functions/analyze/index.ts"), "utf8");
  const endpointCode = `${serverScript}\n${edgeFunction}`;

  assert.equal(endpointCode.includes("后台上传数据摘要"), true);
  assert.equal(endpointCode.includes("不得编造院校、专业、分数线、位次号、计划数"), true);
  assert.equal(endpointCode.includes("dataContext"), true);
});

test("agent endpoints support simple short narrative mode", async () => {
  const simpleScript = await readFile(resolve(root, "src/simple-app.mjs"), "utf8");
  const serverScript = await readFile(resolve(root, "server.mjs"), "utf8");
  const edgeFunction = await readFile(resolve(root, "supabase/functions/analyze/index.ts"), "utf8");
  const code = `${simpleScript}\n${serverScript}\n${edgeFunction}`;

  assert.equal(simpleScript.includes('mode: "simple"'), true);
  for (const field of ["headline", "stageGoalInsight", "scoreInsight", "gapReason", "schoolOpportunity", "nextStep"]) {
    assert.equal(code.includes(field), true);
  }
  for (const inputName of ["studentStage", "planningGoal", "familyBoundary", "scoreSource"]) {
    assert.equal(code.includes(inputName), true);
  }
  assert.equal(code.includes("必须结合首页家长选择"), true);
  assert.equal(code.includes("simplePayload"), true);
});

test("local server proxies data API to avoid missing /api/data during preview", async () => {
  const serverScript = await readFile(resolve(root, "server.mjs"), "utf8");

  assert.equal(serverScript.includes("DEFAULT_DATA_API_URL"), true);
  assert.equal(serverScript.includes("handleDataProxy"), true);
  assert.equal(serverScript.includes('url.pathname === "/api/data"'), true);
});

test("report does not render opportunity section", async () => {
  const appScript = await readFile(resolve(root, "src/app.mjs"), "utf8");
  const styles = await readFile(resolve(root, "styles.css"), "utf8");

  assert.equal(appScript.includes("志愿机会"), false);
  assert.equal(appScript.includes("renderOpportunityTags"), false);
  assert.equal(appScript.includes("opportunity-word-cloud"), false);
  assert.equal(styles.includes(".opportunity-word-cloud"), false);
  assert.equal(styles.includes(".opportunity-section"), false);
});
