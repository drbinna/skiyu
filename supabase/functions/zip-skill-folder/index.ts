// Supabase Edge Function: zip-skill-folder
//
// POST { repo: "owner/repo", branch?: "main", skill_folder_path: "path/to/skill" }
// → application/zip stream containing only the files under skill_folder_path
//
// Why this exists: from the browser, api.github.com is CORS-friendly but
// rate-limited to 60 requests/hour per client IP. Users on shared NATs
// hit that ceiling fast. This function proxies the GitHub API using a
// server-side GITHUB_TOKEN (5000 req/hour shared across all users) and
// streams a ready-made zip back to the browser.
//
// The client still prefers the CORS-direct path; this function is the
// fallback used when a client-side fetch hits 403 or is explicitly
// invoked.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import JSZip from "https://esm.sh/jszip@3.10.1";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "authorization, content-type, apikey, x-client-info",
};

interface Body {
  repo?: string;
  branch?: string;
  skill_folder_path?: string;
  filename?: string;
}

interface TreeEntry {
  path: string;
  type: string;
  sha: string;
  size?: number;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...CORS },
  });
}

async function fetchTree(repo: string, branch: string, token: string | null) {
  const url = `https://api.github.com/repos/${repo}/git/trees/${branch}?recursive=1`;
  const headers: Record<string, string> = {
    accept: "application/vnd.github+json",
    "user-agent": "skiyu-edge/1.0",
  };
  if (token) headers.authorization = `Bearer ${token}`;
  return fetch(url, { headers });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (req.method !== "POST") {
    return json(405, { error: "Use POST" });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const repo = (body.repo || "").trim();
  const branchInput = (body.branch || "main").trim();
  const folderPath = (body.skill_folder_path || "").replace(/^\/+|\/+$/g, "");

  // Tight validation — repo must look like "owner/name", no query or path.
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) {
    return json(400, { error: "Invalid repo (expected owner/name)" });
  }
  if (!/^[A-Za-z0-9._\/-]+$/.test(folderPath)) {
    return json(400, { error: "Invalid skill_folder_path" });
  }
  if (!/^[A-Za-z0-9._\/-]+$/.test(branchInput)) {
    return json(400, { error: "Invalid branch" });
  }

  const token = Deno.env.get("GITHUB_TOKEN") ?? null;
  console.log(JSON.stringify({ stage: "start", repo, folderPath, token_present: token !== null }));

  // 1) Fetch the tree. Retry on master if main is missing.
  let treeRes = await fetchTree(repo, branchInput, token);
  let branch = branchInput;
  if (treeRes.status === 404 && branchInput === "main") {
    treeRes = await fetchTree(repo, "master", token);
    branch = "master";
  }

  console.log(JSON.stringify({
    stage: "tree_fetched",
    status: treeRes.status,
    rate_limit: treeRes.headers.get("x-ratelimit-limit"),
    rate_remaining: treeRes.headers.get("x-ratelimit-remaining"),
    rate_used: treeRes.headers.get("x-ratelimit-used"),
  }));

  if (treeRes.status === 403) {
    return json(429, {
      error: "GitHub rate limit. The edge function is running without a token or the token is exhausted.",
    });
  }
  if (!treeRes.ok) {
    return json(treeRes.status, {
      error: `GitHub tree fetch failed (${treeRes.status})`,
    });
  }

  const tree = (await treeRes.json()) as { tree?: TreeEntry[] };
  if (!tree.tree) return json(502, { error: "Empty tree response" });

  const prefix = folderPath ? folderPath + "/" : "";
  const files = tree.tree.filter(
    (e) => e.type === "blob" && (folderPath === "" || e.path === folderPath || e.path.startsWith(prefix))
  );

  if (files.length === 0) {
    return json(404, { error: `No files found under ${folderPath || "(repo root)"}` });
  }

  // Hard cap to avoid accidentally zipping a giant repo.
  const MAX_FILES = 500;
  const MAX_TOTAL_BYTES = 50 * 1024 * 1024;
  if (files.length > MAX_FILES) {
    return json(413, { error: `Too many files (${files.length} > ${MAX_FILES})` });
  }
  const totalBytes = files.reduce((a, f) => a + (f.size ?? 0), 0);
  if (totalBytes > MAX_TOTAL_BYTES) {
    return json(413, {
      error: `Subfolder too large (${(totalBytes / 1e6).toFixed(1)} MB > 50 MB)`,
    });
  }

  // 2) Fetch files from the raw CDN in parallel, cap concurrency.
  const zip = new JSZip();
  const CONCURRENCY = 8;
  const queue = files.slice();
  let hadError: string | null = null;

  async function worker(): Promise<void> {
    while (true) {
      const item = queue.shift();
      if (!item || hadError) return;
      const rawUrl = `https://raw.githubusercontent.com/${repo}/${branch}/${item.path}`;
      const r = await fetch(rawUrl);
      if (!r.ok) {
        hadError = `Fetch failed for ${item.path} (${r.status})`;
        return;
      }
      const bytes = new Uint8Array(await r.arrayBuffer());
      const relative =
        folderPath === ""
          ? item.path
          : item.path === folderPath
            ? item.path.split("/").pop() || item.path
            : item.path.slice(prefix.length);
      zip.file(relative, bytes);
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
  if (hadError) return json(502, { error: hadError });

  const blob = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  console.log(JSON.stringify({ stage: "done", files: files.length, bytes: blob.length }));

  const downloadName =
    (body.filename || "").replace(/[^a-zA-Z0-9_.-]/g, "") ||
    (folderPath.split("/").pop() || repo.split("/").pop() || "skill") + ".zip";

  return new Response(blob, {
    status: 200,
    headers: {
      ...CORS,
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${downloadName.endsWith(".zip") ? downloadName : downloadName + ".zip"}"`,
      "cache-control": "public, max-age=3600",
    },
  });
});
