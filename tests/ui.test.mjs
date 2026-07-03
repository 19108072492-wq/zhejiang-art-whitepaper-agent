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

test("report includes consultant-friendly interview section", async () => {
  const appScript = await readFile(resolve(root, "src/app.mjs"), "utf8");
  const styles = await readFile(resolve(root, "styles.css"), "utf8");

  assert.equal(appScript.includes("面谈结论与下一步"), true);
  assert.equal(appScript.includes("presentation-brief"), true);
  assert.equal(styles.includes(".presentation-brief"), true);
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
