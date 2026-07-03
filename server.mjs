import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { generateWhitepaper } from "./src/analysis.mjs";
import {
  buildParentNarrativeFallback,
  buildParentNarrativePayload,
  normalizeParentNarratives
} from "./src/parent-narrative.mjs";

const rootDir = resolve(fileURLToPath(new URL(".", import.meta.url)));
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml"
};

loadLocalEnv();
const port = Number(process.env.PORT || 8787);

function loadLocalEnv() {
  const envPath = join(rootDir, ".env");
  if (!existsSync(envPath)) return;

  const content = readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const [key, ...valueParts] = trimmed.split("=");
    if (!key) continue;
    process.env[key] = valueParts.join("=").replace(/^["']|["']$/g, "");
  }
}

function jsonResponse(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

const PARENT_NARRATIVE_SYSTEM_PROMPT = [
  "你是一名浙江艺考生升学规划白皮书撰写助手。",
  "你的任务不是计算分数，也不是匹配院校，而是基于系统已经计算好的结构化数据，为家长生成简洁、专业、温和、可读的文字解读。",
  "严格要求：",
  "1. 只能解释输入数据，不得编造院校、专业、分数线、位次号、计划数。",
  "2. 不要使用销售话术。",
  "3. 不要出现“顾问、成交、邀约、到访、加微信、话术、转化、客户意向”等内部词。",
  "4. 所有内容必须是家长现场可以直接阅读的正式报告语言。",
  "5. 语气要专业、客观、温和，不制造焦虑，不做录取承诺。",
  "6. 不能说“保证录取”“一定能上”“肯定能提分”。",
  "7. 输出必须是严格 JSON，不要 Markdown，不要解释过程。",
  "8. 每个字段控制在要求字数内。"
].join("\n");

function buildParentNarrativePrompt(narrativePayload, sourceLabel) {
  const payload = {
    dataSource: sourceLabel,
    ...narrativePayload
  };

  return [
    "请根据以下结构化数据，生成家长版白皮书中的 5 段文字解读。",
    "",
    "输出 JSON 字段：",
    "- parentSummary：家长版核心解读，120-180字",
    "- studentTypeInsight：学生类型诊断，100-150字",
    "- targetSchoolInsight：目标院校差距解读，120-180字",
    "- subjectPriorityInsight：学科提分优先级解释，120-180字",
    "- nextStepAdvice：后续规划建议，100-150字",
    "",
    `结构化数据如下：${JSON.stringify(payload)}`
  ].join("\n");
}

function safeParseAgentJson(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

async function callAiAgent(narrativePayload, sourceLabel) {
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL;
  const baseUrl = (process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const fallback = buildParentNarrativeFallback(narrativePayload);

  if (!apiKey || !model) {
    return {
      narratives: fallback,
      agentMeta: {
        mode: "local",
        usedAi: false,
        error: "未配置 AI_API_KEY 或 AI_MODEL，已使用本地规则解读。"
      }
    };
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "authorization": `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: PARENT_NARRATIVE_SYSTEM_PROMPT
        },
        {
          role: "user",
          content: buildParentNarrativePrompt(narrativePayload, sourceLabel)
        }
      ]
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    return {
      narratives: fallback,
      agentMeta: {
        mode: "local",
        usedAi: false,
        error: `AI 接口调用失败：${response.status} ${detail.slice(0, 160)}`
      }
    };
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content || "";
  const agentResult = safeParseAgentJson(text);
  return {
    narratives: normalizeParentNarratives(agentResult, fallback),
    agentMeta: {
      mode: agentResult ? "ai" : "local",
      usedAi: Boolean(agentResult),
      error: agentResult ? "" : "AI 返回内容不是有效 JSON，已使用本地规则解读。"
    }
  };
}

async function handleAnalyze(request, response) {
  try {
    const body = await readJson(request);
    const input = body.input || {};
    const programs = Array.isArray(body.programs) ? body.programs : [];
    const sourceLabel = body.sourceLabel || "本地数据";
    const baseWhitepaper = body.baseWhitepaper && typeof body.baseWhitepaper === "object"
      ? body.baseWhitepaper
      : null;
    const narrativePayload = body.narrativePayload && typeof body.narrativePayload === "object"
      ? body.narrativePayload
      : buildParentNarrativePayload(input, baseWhitepaper || generateWhitepaper(input, programs));
    const result = await callAiAgent(narrativePayload, sourceLabel);
    jsonResponse(response, 200, {
      ok: true,
      narratives: result.narratives,
      agentMeta: result.agentMeta
    });
  } catch (error) {
    jsonResponse(response, 500, {
      ok: false,
      error: error instanceof Error ? error.message : "分析失败"
    });
  }
}

function safeStaticPath(urlPath) {
  const decodedPath = decodeURIComponent(urlPath.split("?")[0]);
  const normalizedPath = normalize(decodedPath === "/" ? "/index.html" : decodedPath);
  const filePath = resolve(join(rootDir, normalizedPath));
  if (!filePath.startsWith(rootDir)) return null;
  return filePath;
}

async function serveStatic(request, response) {
  const filePath = safeStaticPath(new URL(request.url, `http://${request.headers.host}`).pathname);
  if (!filePath) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const content = await readFile(filePath);
    response.writeHead(200, {
      "content-type": mimeTypes[extname(filePath)] || "application/octet-stream"
    });
    response.end(content);
  } catch {
    response.writeHead(404);
    response.end("Not Found");
  }
}

const server = createServer((request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  if (request.method === "POST" && url.pathname === "/api/analyze") {
    handleAnalyze(request, response);
    return;
  }
  serveStatic(request, response);
});

server.listen(port, () => {
  console.log(`Zhejiang art whitepaper agent running at http://127.0.0.1:${port}/`);
});
