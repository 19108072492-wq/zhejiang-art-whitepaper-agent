type JsonObject = Record<string, unknown>;

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
  "cache-control": "no-store"
};

const parentNarrativeFields = [
  "parentSummary",
  "studentTypeInsight",
  "targetSchoolInsight",
  "subjectPriorityInsight",
  "nextStepAdvice"
];

const simpleNarrativeFields = ["headline", "advisorHook", "nextStep"];

const fieldFallback: Record<string, string> = {
  parentSummary: "从当前成绩结构看，孩子目前已经具备一定升学基础。后续需要重点关注文化课总分与目标院校参考线之间的差距，尤其是优先级较高的学科是否能形成稳定提分。",
  studentTypeInsight: "孩子当前更接近“文化课决定院校上限”的类型。接下来不建议所有学科平均用力，而应优先选择差距较明显、提分回报较高的科目作为突破口。",
  targetSchoolInsight: "当前目标院校需要结合往年录取参考、专业方向和孩子现有成绩综合判断。若暂未形成明确目标，建议先根据当前成绩区间确定合理院校层次。",
  subjectPriorityInsight: "从学科结构看，建议优先关注差距较大的科目，并结合错题类型和阶段测试结果判断是否具备短期拉动空间。",
  nextStepAdvice: "建议接下来以 30 天为一个观察周期，围绕核心短板建立学习任务，并通过阶段测试及时调整目标院校梯度和复习重点。"
};

const internalWordReplacements: [string, string][] = [
  ["顾问视角", "家长阅读建议"],
  ["面谈结论", "当前分析结论"],
  ["现场确认", "后续建议补充确认"],
  ["重点讲", "建议重点关注"],
  ["带家长核对", "建议家长补充核对"],
  ["顾问", "报告"],
  ["销售", "规划"],
  ["转化", "形成"],
  ["邀约", "后续沟通"],
  ["到访", "后续沟通"],
  ["成交", "结果"],
  ["客户意向", "家长关注点"],
  ["高意向", "关注度较高"],
  ["低意向", "仍需观察"],
  ["面谈", "沟通"],
  ["逼单", "确认"],
  ["话术", "说明"],
  ["加微信", "补充沟通"],
  ["谈单", "沟通"],
  ["承接", "衔接"],
  ["留资", "补充信息"]
];

const parentNarrativeSystemPrompt = [
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

const simpleNarrativeSystemPrompt = [
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

function jsonResponse(status: number, payload: JsonObject) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "content-type": "application/json; charset=utf-8"
    }
  });
}

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}

function asArray(value: unknown): JsonObject[] {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === "object") as JsonObject[] : [];
}

function subjectNames(subjects: JsonObject[]) {
  const names = subjects
    .filter((subject) => Number(subject.gap) > 0)
    .map((subject) => String(subject.name || ""))
    .filter(Boolean);
  return names.length ? names.join("、") : "现有优势科目";
}

function describeStudentType(payload: JsonObject) {
  const student = asObject(payload.student);
  const cultureTotal = Number(student.cultureTotal || 0);
  const professionalScore = Number(student.professionalScore || 0);
  const compositeGap = Number(student.compositeGap || 0);
  if (compositeGap >= 35) return "本科边缘，需要抢时间提分型";
  if (professionalScore >= 245 && cultureTotal < 480) return "专业有基础，文化课决定上限型";
  if (professionalScore >= 255 && cultureTotal < 470) return "专业优势明显，文化课待突破型";
  if (professionalScore < 230 && cultureTotal >= 500) return "文化课有基础，专业成绩需巩固型";
  return "专业文化相对均衡型";
}

function cleanNarrativeText(text: unknown) {
  let cleaned = String(text ?? "").replace(/\s+/g, " ").trim();
  for (const [pattern, replacement] of internalWordReplacements) {
    cleaned = cleaned.replaceAll(pattern, replacement);
  }
  return cleaned;
}

function normalizeParentNarratives(value: unknown, fallback: JsonObject) {
  const source = asObject(value);
  return parentNarrativeFields.reduce((result, field) => {
    const cleaned = cleanNarrativeText(source[field]);
    result[field] = cleaned || cleanNarrativeText(fallback[field]) || fieldFallback[field];
    return result;
  }, {} as Record<string, string>);
}

function cleanSimpleText(value: unknown, maxLength: number) {
  let cleaned = String(value ?? "").replace(/\s+/g, " ").trim();
  for (const [pattern, replacement] of internalWordReplacements) {
    cleaned = cleaned.replaceAll(pattern, replacement);
  }
  return cleaned.slice(0, maxLength);
}

function buildSimpleNarrativeFallback(simplePayload: JsonObject) {
  const current = Number(simplePayload.currentCompositeScore || 0);
  const gap = Number(simplePayload.compositeGap || 0);
  const rank = Number(simplePayload.estimatedRank || 0);
  const unlockedSchools = Array.isArray(simplePayload.unlockedSchools)
    ? simplePayload.unlockedSchools.map(String).filter(Boolean)
    : [];
  return {
    headline: cleanSimpleText(`当前综合分 ${current}，先看层次`, 24),
    advisorHook: cleanSimpleText(rank ? `位次约 ${rank} 名，核对院校梯度` : "位次待匹配，先看综合分层次", 32),
    nextStep: cleanSimpleText(unlockedSchools[0] ? `提分后新增关注 ${unlockedSchools[0]}` : `先确认 ${gap} 分差距能否拉动`, 36)
  };
}

function normalizeSimpleNarratives(value: unknown, fallback: Record<string, string>) {
  const source = asObject(value);
  return simpleNarrativeFields.reduce((result, field) => {
    const maxLength = field === "headline" ? 24 : field === "advisorHook" ? 32 : 36;
    result[field] = cleanSimpleText(source[field], maxLength) || fallback[field];
    return result;
  }, {} as Record<string, string>);
}

function buildSimpleNarrativePrompt(simplePayload: JsonObject, sourceLabel: string) {
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

function buildParentNarrativeFallback(payload: JsonObject) {
  const student = asObject(payload.student);
  const targets = asObject(payload.targets);
  const subjects = asObject(payload.subjects);
  const lineInsight = asObject(payload.lineInsight);
  const comparisonSummary = asObject(payload.comparisonSummary);
  const topSubjects = asArray(subjects.topPrioritySubjects);
  const priorityText = subjectNames(topSubjects);
  const selectedSchools = Array.isArray(targets.selectedSchools) ? targets.selectedSchools.map(String).filter(Boolean) : [];
  const type = describeStudentType(payload);
  const targetText = selectedSchools.length
    ? `当前关注的目标院校包括 ${selectedSchools.join("、")}，需要结合综合分差距、院校层次和往年参考位次综合判断。`
    : "当前目标院校尚未明确，建议先根据成绩区间确定合理目标层次，再进一步筛选具体院校和专业。";
  const lineText = lineInsight.message ? ` ${lineInsight.message}。` : "";
  const liftText = Number(comparisonSummary.scoreLift || 0) > 0
    ? `提分后参考样本层次约提升 ${comparisonSummary.scoreLift} 分，院校选择空间会更清晰。`
    : "提分后的主要价值在于让当前可关注院校更稳，并继续观察更高层次机会。";

  return normalizeParentNarratives({
    parentSummary: `从当前成绩结构看，孩子当前综合分为 ${student.currentCompositeScore || 0} 分，距离目标综合分 ${student.targetCompositeScore || 0} 分还有 ${student.compositeGap || 0} 分差距。主要机会在于文化课仍有可拉动空间，尤其需要优先关注 ${priorityText}。${liftText}`,
    studentTypeInsight: `孩子当前更接近“${type}”。这类学生不适合所有学科平均用力，更需要先找到最容易拉动综合分的科目，并通过阶段测试判断提分是否稳定。`,
    targetSchoolInsight: `${targetText}${lineText}孩子并非不能继续向上规划，但需要把目标院校放进冲刺、稳妥、保底三个梯度中动态观察，避免只看院校名称。`,
    subjectPriorityInsight: `当前建议优先关注 ${priorityText}。这些科目与目标分之间的差距更明显，也更适合通过基础题型、错题归类和阶段测试来观察短期拉动效果。其他科目以稳定输出为主。`,
    nextStepAdvice: "后续建议以 30 天为一个观察周期，围绕核心短板建立学习任务，并用阶段测试检验是否具备稳定提升空间。目标院校梯度也应随成绩变化及时调整。"
  }, fieldFallback);
}

function buildParentNarrativePrompt(narrativePayload: JsonObject, sourceLabel: string) {
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

function safeParseAgentJson(text: string) {
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

async function callSimpleAiAgent(simplePayload: JsonObject, sourceLabel: string) {
  const apiKey = Deno.env.get("AI_API_KEY");
  const model = Deno.env.get("AI_MODEL");
  const baseUrl = (Deno.env.get("AI_BASE_URL") || "https://api.deepseek.com").replace(/\/$/, "");
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
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: simpleNarrativeSystemPrompt
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

async function callAiAgent(narrativePayload: JsonObject, sourceLabel: string) {
  const apiKey = Deno.env.get("AI_API_KEY");
  const model = Deno.env.get("AI_MODEL");
  const baseUrl = (Deno.env.get("AI_BASE_URL") || "https://api.deepseek.com").replace(/\/$/, "");
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
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: parentNarrativeSystemPrompt
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

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse(405, { ok: false, error: "Only POST is supported" });
  }

  try {
    const body = await request.json();
    const sourceLabel = String(body.sourceLabel || "正式数据");

    if (body.mode === "simple") {
      const simplePayload = asObject(body.simplePayload);
      if (!Object.keys(simplePayload).length) {
        return jsonResponse(400, { ok: false, error: "缺少简化版快测数据" });
      }
      const result = await callSimpleAiAgent(simplePayload, sourceLabel);
      return jsonResponse(200, {
        ok: true,
        narratives: result.narratives,
        agentMeta: result.agentMeta
      });
    }

    const narrativePayload = asObject(body.narrativePayload);

    if (!Object.keys(narrativePayload).length) {
      return jsonResponse(400, { ok: false, error: "缺少解读摘要数据" });
    }

    const result = await callAiAgent(narrativePayload, sourceLabel);
    return jsonResponse(200, {
      ok: true,
      narratives: result.narratives,
      agentMeta: result.agentMeta
    });
  } catch (error) {
    return jsonResponse(500, {
      ok: false,
      error: error instanceof Error ? error.message : "分析失败"
    });
  }
});
