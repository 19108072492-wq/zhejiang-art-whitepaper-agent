import { createClient } from "npm:@supabase/supabase-js@2";

type JsonRecord = Record<string, unknown>;
type DatasetKey = "programs" | "rank";

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
  "cache-control": "no-store"
};

const categoryAliases: Record<string, string[]> = {
  "美术与设计": ["美术与设计类", "美术与设计", "美术设计", "美设", "美术类", "美术"],
  "播音": ["播音与主持类", "播音与主持", "播音主持", "播音"],
  "舞蹈": ["舞蹈类", "舞蹈"],
  "书法": ["书法类", "书法"],
  "表导": [
    "表(导)演类",
    "表（导）演类",
    "表导",
    "表导演",
    "表演导演",
    "表演(导演)",
    "表演（导演）",
    "戏剧影视表演",
    "服装表演",
    "戏剧影视导演"
  ],
  "音乐": [
    "音乐类",
    "音乐",
    "音乐表演",
    "音乐教育",
    "音乐学",
    "音乐教育器乐主项",
    "音乐教育声乐主项",
    "音乐表演器乐方向",
    "音乐表演声乐方向"
  ]
};

function jsonResponse(status: number, payload: JsonRecord) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "content-type": "application/json; charset=utf-8"
    }
  });
}

function compact(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/[（）]/g, (char) => (char === "（" ? "(" : ")"));
}

function normalizeArtCategory(value: unknown) {
  const text = compact(value);
  if (!text) return "";

  for (const [category, aliases] of Object.entries(categoryAliases)) {
    if (aliases.some((alias) => text.includes(compact(alias)))) return category;
  }
  return String(value ?? "").trim();
}

function asRecords(value: unknown): JsonRecord[] {
  return Array.isArray(value)
    ? value.filter((item): item is JsonRecord => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    : [];
}

function asMeta(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function safeError(error: unknown, fallback = "数据接口处理失败") {
  return error instanceof Error ? error.message : fallback;
}

function getSupabaseClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase 数据服务未配置 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY。");
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function readAdminSecretHash() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("whitepaper_settings")
    .select("setting_value")
    .eq("setting_key", "admin_secret_sha256")
    .maybeSingle();
  if (error) throw new Error(`读取后台密钥配置失败：${error.message}`);
  return typeof data?.setting_value === "string" ? data.setting_value : "";
}

async function requireAdminSecret(body: JsonRecord) {
  const adminSecret = Deno.env.get("ADMIN_SECRET");
  const inputSecret = String(body.adminSecret ?? "");
  const isMatchedBySecret = adminSecret ? inputSecret === adminSecret : false;
  const storedHash = adminSecret ? "" : await readAdminSecretHash();
  const isMatchedByHash = storedHash ? await sha256Hex(inputSecret) === storedHash : false;
  if (!isMatchedBySecret && !isMatchedByHash) {
    const error = new Error("后台密钥不正确，请重新输入。");
    error.name = "Unauthorized";
    throw error;
  }
}

async function readDataset(datasetKey: DatasetKey) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("whitepaper_datasets")
    .select("records, meta, updated_at")
    .eq("dataset_key", datasetKey)
    .maybeSingle();

  if (error) throw new Error(`读取 ${datasetKey} 数据失败：${error.message}`);
  return {
    records: asRecords(data?.records),
    meta: data?.meta || null,
    updatedAt: data?.updated_at || ""
  };
}

async function writeDataset(datasetKey: DatasetKey, records: JsonRecord[], meta: JsonRecord) {
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("whitepaper_datasets")
    .upsert({
      dataset_key: datasetKey,
      records,
      meta: {
        ...meta,
        updatedAt: now
      },
      updated_at: now
    }, {
      onConflict: "dataset_key"
    });

  if (error) throw new Error(`保存 ${datasetKey} 数据失败：${error.message}`);
}

async function getDatasets() {
  const [programs, rank] = await Promise.all([
    readDataset("programs"),
    readDataset("rank")
  ]);
  return {
    ok: true,
    programs,
    rank
  };
}

function mergeProgramCategory(existingRecords: JsonRecord[], nextRecords: JsonRecord[], category: string) {
  const normalizedCategory = normalizeArtCategory(category);
  if (!normalizedCategory) throw new Error("缺少院校专业表分类。");
  const keptRecords = existingRecords.filter((record) =>
    normalizeArtCategory(record.artCategory) !== normalizedCategory
  );
  const scopedNextRecords = nextRecords.map((record) => ({
    ...record,
    artCategory: normalizedCategory
  }));
  return [...keptRecords, ...scopedNextRecords];
}

function mergeRankTable(existingRecords: JsonRecord[], nextRecords: JsonRecord[]) {
  const normalizedNextRecords = nextRecords
    .map((record) => ({
      ...record,
      artCategory: normalizeArtCategory(record.artCategory)
    }))
    .filter((record) => normalizeArtCategory(record.artCategory));
  const replaceCategories = new Set(
    normalizedNextRecords.map((record) => normalizeArtCategory(record.artCategory))
  );
  if (!replaceCategories.size) throw new Error("一分一段表未识别到可保存的艺考类别。");
  const keptRecords = existingRecords.filter((record) =>
    !replaceCategories.has(normalizeArtCategory(record.artCategory))
  );
  return [...keptRecords, ...normalizedNextRecords];
}

async function saveProgramCategory(body: JsonRecord) {
  await requireAdminSecret(body);
  const current = await readDataset("programs");
  const records = mergeProgramCategory(current.records, asRecords(body.records), String(body.category || ""));
  await writeDataset("programs", records, {
    ...asMeta(body.meta),
    category: normalizeArtCategory(body.category),
    totalRecords: records.length
  });
  return getDatasets();
}

async function saveRankTable(body: JsonRecord) {
  await requireAdminSecret(body);
  const current = await readDataset("rank");
  const records = mergeRankTable(current.records, asRecords(body.records));
  await writeDataset("rank", records, {
    ...asMeta(body.meta),
    totalRecords: records.length
  });
  return getDatasets();
}

async function clearProgramCategory(body: JsonRecord) {
  await requireAdminSecret(body);
  const category = normalizeArtCategory(body.category);
  if (!category) throw new Error("缺少要清空的院校专业分类。");
  const current = await readDataset("programs");
  const records = current.records.filter((record) => normalizeArtCategory(record.artCategory) !== category);
  await writeDataset("programs", records, {
    ...asMeta(current.meta),
    clearedCategory: category,
    totalRecords: records.length
  });
  return getDatasets();
}

async function clearRankTable(body: JsonRecord) {
  await requireAdminSecret(body);
  await writeDataset("rank", [], {
    clearedAt: new Date().toISOString(),
    totalRecords: 0
  });
  return getDatasets();
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return jsonResponse(405, { ok: false, error: "只支持 POST 请求。" });
  }

  try {
    const body = await request.json().catch(() => ({})) as JsonRecord;
    const action = String(body.action || "");

    if (action === "getDatasets") {
      return jsonResponse(200, await getDatasets());
    }
    if (action === "adminLogin") {
      await requireAdminSecret(body);
      return jsonResponse(200, { ok: true });
    }
    if (action === "saveProgramCategory") {
      return jsonResponse(200, await saveProgramCategory(body));
    }
    if (action === "saveRankTable") {
      return jsonResponse(200, await saveRankTable(body));
    }
    if (action === "clearProgramCategory") {
      return jsonResponse(200, await clearProgramCategory(body));
    }
    if (action === "clearRankTable") {
      return jsonResponse(200, await clearRankTable(body));
    }

    return jsonResponse(400, { ok: false, error: "未知数据操作。" });
  } catch (error) {
    const status = error instanceof Error && error.name === "Unauthorized" ? 401 : 500;
    return jsonResponse(status, {
      ok: false,
      error: safeError(error)
    });
  }
});
