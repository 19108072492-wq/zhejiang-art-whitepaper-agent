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
  ["AI解读", "分析报告"],
  ["AI分析", "分析"],
  ["AI", ""],
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

const SIMPLE_NARRATIVE_FIELDS = ["headline", "stageGoalInsight", "scoreInsight", "gapReason", "schoolTierInsight", "nextStep"];
const SIMPLE_NARRATIVE_LIMITS = {
  headline: 30,
  stageGoalInsight: 64,
  scoreInsight: 58,
  gapReason: 58,
  schoolTierInsight: 58,
  nextStep: 48
};

const SIMPLE_NARRATIVE_SYSTEM_PROMPT = [
  "你是一名浙江艺考升学快测助手。",
  "你的任务是基于系统已计算好的数据，为家长生成短而有重点的快测分析报告。",
  "严格要求：",
  "1. 必须优先使用 simplePayload.dataContext 这份后台上传数据摘要，以及系统已经计算好的院校、分数、位次、差距和样本。",
  "2. 只能解释输入数据，不得编造院校、专业、分数线、位次号、计划数。",
  "3. 输出必须是严格 JSON，不要 Markdown，不要解释过程。",
  "4. 必须结合首页家长选择：studentStage、planningGoal、familyBoundary、scoreSource。不能只按分数泛泛分析。",
  "5. 只输出 headline、stageGoalInsight、scoreInsight、gapReason、schoolTierInsight、nextStep 六个字段。",
  "6. headline 控制在30字以内；stageGoalInsight 控制在64字以内；scoreInsight、gapReason、schoolTierInsight 控制在58字以内；nextStep 控制在48字以内。",
  "7. stageGoalInsight 必须同时体现学生阶段和升学目标，例如高二提前规划、复读再规划、冲公办本科、先保本科等。",
  "8. 如果 familyBoundary 是省内优先，不要泛泛写“省内外机会”，应写省内样本或是否需要看省外增量。",
  "9. 不要写完整学习规划，不要给长篇建议，不要承诺录取结果。",
  "10. 不要出现 AI、顾问、话术、邀约、成交、客户、转化等内部服务词。",
  "11. 每个字段必须引用至少一个具体数据、位次、差距、院校样本、差距原因、首页选择或下一步动作。"
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
  const context = simplePayload.context && typeof simplePayload.context === "object" ? simplePayload.context : {};
  const contextAnalysis = simplePayload.contextAnalysis && typeof simplePayload.contextAnalysis === "object" ? simplePayload.contextAnalysis : {};
  const studentStage = context.studentStage || "高三下学期";
  const planningGoal = context.planningGoal || "先保本科";
  const familyBoundary = context.familyBoundary || "暂不确定";
  const unlockedSchools = Array.isArray(simplePayload.unlockedSchools) ? simplePayload.unlockedSchools : [];
  const cultureTotal = simplePayload.cultureTotal || 0;
  const professionalScore = simplePayload.professionalScore || 0;
  const gapReason = professionalScore >= 250 && cultureTotal < 470
    ? "专业分有支撑，主要看文化总分能否稳定拉动。"
    : professionalScore < 230 && cultureTotal >= 500
      ? "文化基础相对更稳，专业分会影响综合分效率。"
      : "需要同时看文化波动和专业小分线，避免只看单次总分。";
  return {
    headline: cleanSimpleText(`当前综合分 ${current}，先看层次`, SIMPLE_NARRATIVE_LIMITS.headline),
    stageGoalInsight: cleanSimpleText(contextAnalysis.stageGoalInsight || `${studentStage}，${planningGoal}；${familyBoundary}。先按当前分数校准路径。`, SIMPLE_NARRATIVE_LIMITS.stageGoalInsight),
    scoreInsight: cleanSimpleText(rank ? `估算位次约 ${rank} 名，距目标还差 ${gap} 分。` : `当前距目标还差 ${gap} 分，位次待校准。`, SIMPLE_NARRATIVE_LIMITS.scoreInsight),
    gapReason: cleanSimpleText(gapReason, SIMPLE_NARRATIVE_LIMITS.gapReason),
    schoolTierInsight: cleanSimpleText(unlockedSchools[0] ? `提分后可新增关注 ${unlockedSchools[0]} 等样本，重点看层次变化。` : "先确认当前冲稳保层次，再看专业方向和最低样本线。", SIMPLE_NARRATIVE_LIMITS.schoolTierInsight),
    nextStep: cleanSimpleText(`补充近三次文化成绩，判断 ${Math.ceil(gap / 0.5)} 分提升空间。`, SIMPLE_NARRATIVE_LIMITS.nextStep)
  };
}

function normalizeSimpleNarratives(value, fallback) {
  const source = value && typeof value === "object" ? value : {};
  return SIMPLE_NARRATIVE_FIELDS.reduce((result, field) => {
    const maxLength = SIMPLE_NARRATIVE_LIMITS[field] || 48;
    const legacySchoolField = `school${"Opportunity"}`;
    const legacyValue = field === "scoreInsight"
      ? source.advisorHook
      : field === "schoolTierInsight"
        ? source[legacySchoolField]
        : "";
    result[field] = cleanSimpleText(source[field], maxLength) || cleanSimpleText(legacyValue, maxLength) || fallback[field];
    return result;
  }, {});
}

function buildSimpleNarrativePrompt(simplePayload, sourceLabel) {
  return [
    "请根据以下结构化数据，生成浙江艺考升学快测中的分析报告。",
    "",
    "输出 JSON 字段：",
    "- headline：一句核心判断，30字以内，必须包含当前综合分或差距",
    "- stageGoalInsight：阶段目标分析，64字以内，必须结合 studentStage、planningGoal、familyBoundary，不能泛泛写",
    "- scoreInsight：定位判断，58字以内，必须包含综合分、位次或目标差距",
    "- gapReason：差距原因，58字以内，必须说明文化、专业或稳定性中的一个重点",
    "- schoolTierInsight：院校层次判断，58字以内，必须结合当前冲稳保样本、提分后样本或最低样本线，用家长能读懂的分析语言",
    "- nextStep：下一步动作，48字以内，必须包含一个具体动作",
    "",
    "注意：必须结合首页家长选择，不要只看分数；不要输出完整学习规划，不要长篇叙述，不要录取承诺，不要出现 AI 或内部服务词。优先使用 simplePayload.dataContext 这份后台上传数据摘要，以及 simplePayload 中的 context、contextAnalysis、keyTakeaways、studentInterpretation、currentSamples、lowestSample、unlockedSchools 和 nextCheckpoints。",
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
