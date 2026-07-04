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
const DEFAULT_DATA_API_URL = "https://eyzcleghbczxxptdwlkq.supabase.co/functions/v1/data";
const INTERNAL_WORD_REPLACEMENTS = [
  ["顾问视角", "家长阅读建议"],
  ["内部提示", "报告提示"],
  ["现场确认", "后续建议补充确认"],
  ["现场", "后续"],
  ["顾问", "报告"],
  ["销售", "服务"],
  ["转化", "形成"],
  ["邀约", "后续沟通"],
  ["到访", "后续沟通"],
  ["成交", "结果"],
  ["客户意向", "家长关注点"],
  ["客户", "家庭"],
  ["加微信", "补充联系方式"],
  ["留资", "补充信息"],
  ["话术", "说明"]
];

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
  "1. 必须优先使用 payload.dataContext 这份后台上传数据摘要，以及系统已经计算好的院校、分数、位次、差距和样本。",
  "2. 只能解释输入数据，不得编造院校、专业、分数线、位次号、计划数。",
  "3. 不要使用销售话术。",
  "4. 不要出现“顾问、成交、邀约、到访、加微信、话术、转化、客户意向”等内部词。",
  "5. 所有内容必须是家长现场可以直接阅读的正式报告语言。",
  "6. 语气要专业、客观、温和，不制造焦虑，不做录取承诺。",
  "7. 不能说“保证录取”“一定能上”“肯定能提分”。",
  "8. 输出必须是严格 JSON，不要 Markdown，不要解释过程。",
  "9. 每个字段控制在要求字数内。"
].join("\n");

const SIMPLE_NARRATIVE_FIELDS = ["headline", "advisorHook", "nextStep"];

const SIMPLE_NARRATIVE_SYSTEM_PROMPT = [
  "你是一名浙江艺考升学快测助手。",
  "你的任务是基于系统已计算好的数据，为家长生成极短、专业、可直接阅读的快测解读。",
  "严格要求：",
  "1. 必须优先使用 simplePayload.dataContext 这份后台上传数据摘要，以及系统已经计算好的院校、分数、位次、差距和样本。",
  "2. 只能解释输入数据，不得编造院校、专业、分数线、位次号、计划数。",
  "3. 输出必须是严格 JSON，不要 Markdown，不要解释过程。",
  "4. 只输出 headline、advisorHook、nextStep 三个字段。",
  "5. headline 控制在 24 字以内；advisorHook 控制在 32 字以内；nextStep 控制在 36 字以内。",
  "6. 不要写完整学习规划，不要给长篇建议，不要承诺录取结果。",
  "7. 不要出现顾问、话术、邀约、成交、客户、转化等内部服务词。",
  "8. 每个字段必须引用至少一个具体数据、位次、差距、院校样本或下一步动作。"
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
    "payload.dataContext 是后台上传数据摘要。若 dataContext.dataSource 为“参考数据”，只能按参考样本表述；若为“正式数据”，也只能引用 payload 中已经出现的院校、分数和位次摘要。",
    "",
    `结构化数据如下：${JSON.stringify(payload)}`
  ].join("\n");
}

function cleanSimpleText(value, maxLength) {
  let cleaned = String(value ?? "").replace(/\s+/g, " ").trim();
  for (const [pattern, replacement] of INTERNAL_WORD_REPLACEMENTS) {
    cleaned = cleaned.replaceAll(pattern, replacement);
  }
  return cleaned.slice(0, maxLength);
}

function buildSimpleNarrativeFallback(simplePayload) {
  const current = simplePayload.currentCompositeScore || 0;
  const gap = simplePayload.compositeGap || 0;
  const rank = simplePayload.estimatedRank || 0;
  const unlockedSchools = Array.isArray(simplePayload.unlockedSchools) ? simplePayload.unlockedSchools : [];
  return {
    headline: cleanSimpleText(`当前综合分 ${current}，先看层次`, 24),
    advisorHook: cleanSimpleText(rank ? `位次约 ${rank} 名，核对院校梯度` : "位次待匹配，先看综合分层次", 32),
    nextStep: cleanSimpleText(unlockedSchools[0] ? `提分后新增关注 ${unlockedSchools[0]}` : `先确认 ${gap} 分差距能否拉动`, 36)
  };
}

function normalizeSimpleNarratives(value, fallback) {
  const source = value && typeof value === "object" ? value : {};
  return SIMPLE_NARRATIVE_FIELDS.reduce((result, field) => {
    const maxLength = field === "headline" ? 24 : field === "advisorHook" ? 32 : 36;
    result[field] = cleanSimpleText(source[field], maxLength) || fallback[field];
    return result;
  }, {});
}

function buildSimpleNarrativePrompt(simplePayload, sourceLabel) {
  return [
    "请根据以下结构化数据，生成浙江艺考升学快测中的 3 条短解读。",
    "",
    "输出 JSON 字段：",
    "- headline：一句核心判断，24字以内，必须包含当前综合分或差距",
    "- advisorHook：家长可直接阅读的补充判断，32字以内，必须包含位次、院校样本或层次判断",
    "- nextStep：下一步建议，36字以内，必须包含一个具体动作",
    "",
    "注意：不要输出完整学习规划，不要长篇叙述，不要录取承诺，不要出现内部服务词。优先使用 simplePayload.dataContext 这份后台上传数据摘要，以及 simplePayload 中的 keyTakeaways、currentSamples、unlockedSchools 和 nextCheckpoints。",
    "",
    `数据来源：${sourceLabel}`,
    `结构化数据如下：${JSON.stringify(simplePayload)}`
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

async function callSimpleAiAgent(simplePayload, sourceLabel) {
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL;
  const baseUrl = (process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const fallback = buildSimpleNarrativeFallback(simplePayload);

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
          content: SIMPLE_NARRATIVE_SYSTEM_PROMPT
        },
        {
          role: "user",
          content: buildSimpleNarrativePrompt(simplePayload, sourceLabel)
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
    narratives: normalizeSimpleNarratives(agentResult, fallback),
    agentMeta: {
      mode: agentResult ? "ai" : "local",
      usedAi: Boolean(agentResult),
      error: agentResult ? "" : "AI 返回内容不是有效 JSON，已使用本地规则解读。"
    }
  };
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
    const sourceLabel = body.sourceLabel || "本地数据";
    if (body.mode === "simple") {
      const simplePayload = body.simplePayload && typeof body.simplePayload === "object"
        ? body.simplePayload
        : null;
      if (!simplePayload) {
        jsonResponse(response, 400, {
          ok: false,
          error: "缺少简化版快测数据"
        });
        return;
      }
      const result = await callSimpleAiAgent(simplePayload, sourceLabel);
      jsonResponse(response, 200, {
        ok: true,
        narratives: result.narratives,
        agentMeta: result.agentMeta
      });
      return;
    }

    const input = body.input || {};
    const programs = Array.isArray(body.programs) ? body.programs : [];
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

async function handleDataProxy(request, response) {
  const dataApiUrl = (process.env.WHITEPAPER_DATA_API_URL || DEFAULT_DATA_API_URL).trim();
  try {
    const body = await readJson(request);
    const upstream = await fetch(dataApiUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(body)
    });
    const text = await upstream.text();
    response.writeHead(upstream.status, {
      "content-type": upstream.headers.get("content-type") || "application/json; charset=utf-8",
      "cache-control": "no-store"
    });
    response.end(text);
  } catch (error) {
    jsonResponse(response, 502, {
      ok: false,
      error: error instanceof Error ? error.message : "数据接口转发失败"
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
  if (request.method === "POST" && url.pathname === "/api/data") {
    handleDataProxy(request, response);
    return;
  }
  serveStatic(request, response);
});

server.listen(port, () => {
  console.log(`Zhejiang art whitepaper agent running at http://127.0.0.1:${port}/`);
});
