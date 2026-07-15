import { mkdir, writeFile } from "node:fs/promises";

const projectRef = "muadzpawrxcivogtxwto";
const token = (process.env.SUPABASE_ACCESS_TOKEN ?? "")
  .trim()
  .replace(/^Bearer\s+/i, "")
  .replace(/^['\"]|['\"]$/g, "")
  .trim();
const end = new Date();
const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
const outputPath = "outputs/supabase-errors-latest.json";

if (!token) {
  throw new Error("SUPABASE_ACCESS_TOKEN non impostato");
}

if (token.startsWith("sb_publishable_") || token.startsWith("sb_secret_")) {
  throw new Error(
    "Serve un Personal Access Token Supabase, non una API key del progetto",
  );
}

const queries = [
  {
    source: "api",
    sql: `select cast(edge_logs.timestamp as datetime) as timestamp, event_message, response.status_code, request.path
from edge_logs
cross join unnest(metadata) as metadata
cross join unnest(metadata.response) as response
cross join unnest(metadata.request) as request
where response.status_code >= 400
  and not regexp_contains(event_message, '@supabase-infra/mgmt-api')
order by timestamp desc
limit 250`,
  },
  {
    source: "edge-functions",
    sql: `select cast(timestamp as datetime) as timestamp, event_message, metadata
from function_logs
where regexp_contains(event_message, '(?i)error|exception|failed|panic|non-2xx')
order by timestamp desc
limit 250`,
  },
  {
    source: "postgres",
    sql: `select cast(postgres_logs.timestamp as datetime) as timestamp, event_message, parsed.error_severity, parsed.user_name
from postgres_logs
cross join unnest(metadata) as metadata
cross join unnest(metadata.parsed) as parsed
where regexp_contains(parsed.error_severity, 'ERROR|FATAL|PANIC')
order by timestamp desc
limit 250`,
  },
  {
    source: "auth",
    sql: `select cast(timestamp as datetime) as timestamp, event_message, metadata
from auth_logs
where regexp_contains(event_message, '(?i)error|failed|rate limit|429|invalid')
order by timestamp desc
limit 250`,
  },
];

async function fetchLogs({ source, sql }) {
  const url = new URL(
    `https://api.supabase.com/v1/projects/${projectRef}/analytics/endpoints/logs.all`,
  );
  url.searchParams.set("iso_timestamp_start", start.toISOString());
  url.searchParams.set("iso_timestamp_end", end.toISOString());
  url.searchParams.set("sql", sql);

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    return {
      source,
      error: body?.message ?? body?.error ?? `HTTP ${response.status}`,
      rows: [],
    };
  }

  return {
    source,
    error: body?.error || null,
    rows: Array.isArray(body?.result) ? body.result : [],
  };
}

async function fetchClientErrors() {
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query/read-only`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `select created_at, severity, source, message, context, app_version, platform, device_model, os_version
from public.client_error_events
where created_at >= now() - interval '24 hours'
order by created_at desc
limit 250`,
      }),
    },
  );
  const body = await response.json().catch(() => ({}));
  const rows = Array.isArray(body)
    ? body
    : Array.isArray(body?.result)
      ? body.result
      : Array.isArray(body?.data)
        ? body.data
        : [];

  return {
    source: "client-errors",
    error: response.ok
      ? null
      : body?.message ?? body?.error ?? `HTTP ${response.status}`,
    rows,
  };
}

const sections = [];
for (const query of queries) {
  sections.push(await fetchLogs(query));
}
sections.push(await fetchClientErrors());

const report = {
  projectRef,
  generatedAt: end.toISOString(),
  range: { start: start.toISOString(), end: end.toISOString() },
  sections,
};

await mkdir("outputs", { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

const errorCount = sections.reduce((sum, section) => sum + section.rows.length, 0);
console.log(`Log salvati in ${outputPath} (${errorCount} eventi).`);

for (const section of sections.filter((item) => item.error)) {
  console.warn(`${section.source}: ${section.error}`);
}
