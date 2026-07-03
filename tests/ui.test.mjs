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

test("report includes subject knowledge advice section", async () => {
  const appScript = await readFile(resolve(root, "src/app.mjs"), "utf8");

  assert.equal(appScript.includes("科目知识补强建议"), true);
  assert.equal(appScript.includes("提分点"), true);
});

test("study plan renders diagnosis, tasks, checkpoints, and parent follow-up", async () => {
  const appScript = await readFile(resolve(root, "src/app.mjs"), "utf8");

  assert.equal(appScript.includes("现状诊断"), true);
  assert.equal(appScript.includes("关键任务"), true);
  assert.equal(appScript.includes("验收指标"), true);
  assert.equal(appScript.includes("家长跟进"), true);
  assert.equal(appScript.includes("plan.slice(0, 4)"), false);
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
  assert.equal(styles.includes("@media (max-width: 1180px)"), true);
  assert.equal(styles.includes(".intro-panel {\n    display: none;"), true);
  assert.equal(styles.includes(".poster-ribbon"), true);
  assert.equal(styles.includes(".report-cover"), true);
  assert.equal(styles.includes(".report-score-board"), true);
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

test("front end keeps AI secrets out of browser files", async () => {
  const indexHtml = await readFile(resolve(root, "index.html"), "utf8");
  const appScript = await readFile(resolve(root, "src/app.mjs"), "utf8");
  const configScript = await readFile(resolve(root, "config.js"), "utf8");
  const browserFiles = [indexHtml, appScript, configScript].join("\n");

  assert.equal(indexHtml.includes("./config.js"), true);
  assert.equal(browserFiles.includes("AI_API_KEY"), false);
  assert.equal(/sk-[A-Za-z0-9_-]{20,}/.test(browserFiles), false);
});

test("admin page supports secret link auto-login without keeping secret in URL", async () => {
  const adminScript = await readFile(resolve(root, "src/admin.mjs"), "utf8");

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

test("report does not render opportunity section", async () => {
  const appScript = await readFile(resolve(root, "src/app.mjs"), "utf8");
  const styles = await readFile(resolve(root, "styles.css"), "utf8");

  assert.equal(appScript.includes("志愿机会"), false);
  assert.equal(appScript.includes("renderOpportunityTags"), false);
  assert.equal(appScript.includes("opportunity-word-cloud"), false);
  assert.equal(styles.includes(".opportunity-word-cloud"), false);
  assert.equal(styles.includes(".opportunity-section"), false);
});
