import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import type { Category, SkillCatalogItem } from "./types";

// ── Categories ──────────────────────────────────────────────
export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("categories")
      .select("*")
      .order("display_order")
      .then(({ data, error }) => {
        if (!error && data) setCategories(data);
        setLoading(false);
      });
  }, []);

  return { categories, loading };
}

// ── Skills catalog (with joins via the view) ────────────────
export function useSkills(opts?: {
  category?: string;
  search?: string;
  sort?: string;
  license?: string;
  limit?: number;
}) {
  const [skills, setSkills] = useState<SkillCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [count, setCount] = useState(0);

  useEffect(() => {
    setLoading(true);

    let query = supabase
      .from("v_skill_catalog")
      .select("*", { count: "exact" });

    if (opts?.category && opts.category !== "all") {
      query = query.eq("category_slug", opts.category);
    }

    if (opts?.search) {
      query = query.or(
        `name.ilike.%${opts.search}%,description.ilike.%${opts.search}%,author_username.ilike.%${opts.search}%`
      );
    }

    if (opts?.license && opts.license !== "Any") {
      query = query.eq("github_license", opts.license);
    }

    // Sorting
    switch (opts?.sort) {
      case "installs":
        query = query.order("install_count", { ascending: false });
        break;
      case "rating":
        query = query.order("avg_rating", { ascending: false, nullsFirst: false });
        break;
      case "stars":
        query = query.order("github_stars", { ascending: false });
        break;
      case "name":
        query = query.order("name");
        break;
      case "updated":
        query = query.order("updated_at", { ascending: false });
        break;
      default:
        query = query.order("quality_score", { ascending: false, nullsFirst: false });
        break;
    }

    if (opts?.limit) {
      query = query.limit(opts.limit);
    }

    query.then(({ data, error, count: c }) => {
      if (!error && data) {
        setSkills(data);
        setCount(c ?? data.length);
      }
      setLoading(false);
    });
  }, [opts?.category, opts?.search, opts?.sort, opts?.license, opts?.limit]);

  return { skills, loading, count };
}

// ── Featured skills (for homepage) ──────────────────────────
export function useFeaturedSkills(limit = 6) {
  return useSkills({ sort: "installs", limit });
}

// ── Category counts ─────────────────────────────────────────
export function useCategoryCounts() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("v_skill_catalog")
      .select("category_slug")
      .then(({ data, error }) => {
        if (!error && data) {
          const map: Record<string, number> = {};
          data.forEach((row) => {
            const slug = row.category_slug || "uncategorized";
            map[slug] = (map[slug] || 0) + 1;
          });
          setCounts(map);
          setTotal(data.length);
        }
        setLoading(false);
      });
  }, []);

  return { counts, total, loading };
}

// ── Record an install ───────────────────────────────────────
export async function recordInstall(skillId: string, method: string = "web") {
  return supabase.from("installs").insert({
    skill_id: skillId,
    install_method: method,
  });
}

// ── Download a skill ────────────────────────────────────────
// The download flow must stay fully inside /skiyu. We never use window.open,
// never navigate to a third-party page, and never land on
// download-directory.github.io. The user stays on the current page.
//
// Two sources, in priority order:
//   1. Supabase Storage (when a publisher uploaded a packaged zip).
//      We trust these URLs and stream them as blobs.
//   2. The zip-skill-folder Supabase Edge Function, which server-side
//      zips just the skill's subfolder from its GitHub repo using a
//      GITHUB_TOKEN (5000 req/hour shared — bypasses the 60/hour
//      unauthenticated per-IP limit that bites users on shared NATs).
//      Returns application/zip with Content-Disposition, ready to save.
//
// GitHub archive URLs (codeload.github.com, /archive/refs/heads/...) are
// NOT used because their CORS header is scoped to
// render.githubusercontent.com and the browser cannot read the blob body
// from our origin. Any legacy download-directory.github.io URL in the DB
// returns HTML which macOS Archive Utility rejects, so we ignore those too.

interface DownloadableSkill {
  github_repo: string | null;
  github_url: string | null;
  skill_folder_path: string | null;
  download_url: string | null;
  download_method: string | null;
}

function parseBranchFromGithubUrl(url: string | null): string {
  if (!url) return "main";
  const match = url.match(/\/tree\/([^/]+)\//);
  return match ? match[1] : "main";
}

function isSupabaseStorageUrl(url: string | null): boolean {
  if (!url) return false;
  return /supabase\.co\/storage\/v1\/object\/public\//.test(url);
}

function triggerBrowserDownload(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
}

async function invokeZipFunction(params: {
  repo: string;
  branch: string;
  skill_folder_path: string;
  filename: string;
}): Promise<Blob> {
  // supabase-js functions.invoke doesn't expose binary responses cleanly,
  // so we POST directly and attach the auth headers the Supabase gateway
  // expects. The function is deployed with verify_jwt: true so anon JWT
  // is required.
  const base = (supabase as unknown as { supabaseUrl: string }).supabaseUrl;
  const anon = (supabase as unknown as { supabaseKey: string }).supabaseKey;
  const url = `${base}/functions/v1/zip-skill-folder`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: anon,
      authorization: `Bearer ${anon}`,
    },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    let message = `Edge function failed (${res.status})`;
    try {
      const j = await res.json();
      if (j?.error) message = j.error;
    } catch {
      // Response wasn't JSON; keep the default message.
    }
    throw new Error(message);
  }

  return res.blob();
}

export async function downloadSkill(
  skillId: string,
  skillName: string,
  userId?: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase
      .from("skills")
      .select(
        "github_repo, github_url, skill_folder_path, download_url, download_method"
      )
      .eq("id", skillId)
      .single<DownloadableSkill>();

    if (error || !data) {
      return { success: false, error: "No download available for this skill" };
    }

    const slug = skillName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const filename = `${slug}.zip`;

    const logDownload = (resolvedMethod: string, fileSize: number | null) => {
      supabase
        .from("downloads")
        .insert({
          skill_id: skillId,
          user_id: userId || null,
          download_method: resolvedMethod,
          file_size_bytes: fileSize,
          user_agent: navigator.userAgent,
          referrer: document.referrer || null,
        })
        .then(() => {});
    };

    // Path 1: publisher-uploaded zip in Supabase Storage.
    if (isSupabaseStorageUrl(data.download_url) && data.download_method === "storage") {
      const res = await fetch(data.download_url as string, { credentials: "omit" });
      if (!res.ok) {
        return {
          success: false,
          error: `Download failed (${res.status}). The package may have been moved.`,
        };
      }
      const blob = await res.blob();
      triggerBrowserDownload(blob, filename);
      logDownload("storage", blob.size);
      return { success: true };
    }

    // Path 2: server-side subfolder zip via edge function.
    if (data.github_repo && data.skill_folder_path) {
      const branch = parseBranchFromGithubUrl(data.github_url);
      const blob = await invokeZipFunction({
        repo: data.github_repo,
        branch,
        skill_folder_path: data.skill_folder_path,
        filename: slug,
      });
      triggerBrowserDownload(blob, filename);
      logDownload("edge_zip", blob.size);
      return { success: true };
    }

    return {
      success: false,
      error: "This skill has no valid download source configured",
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Download failed — please try again",
    };
  }
}

// ── Fetch extra skill detail for the modal ──────────────────
// The catalog view is intentionally slim. The modal needs readme_content,
// frontmatter, skill_md_content, and skill_folder_path — we pull those
// here on demand when a card is clicked.
export function useSkillDetail(skillId: string | null) {
  const [detail, setDetail] = useState<{
    frontmatter: Record<string, unknown> | null;
    readme_content: string | null;
    skill_md_content: string | null;
    skill_folder_path: string | null;
    github_url: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!skillId) {
      setDetail(null);
      return;
    }
    setLoading(true);
    supabase
      .from("skills")
      .select("frontmatter, readme_content, skill_md_content, skill_folder_path, github_url")
      .eq("id", skillId)
      .single()
      .then(({ data, error }) => {
        if (!error && data) {
          setDetail({
            frontmatter: (data.frontmatter as Record<string, unknown> | null) ?? null,
            readme_content: data.readme_content ?? null,
            skill_md_content: data.skill_md_content ?? null,
            skill_folder_path: data.skill_folder_path ?? null,
            github_url: data.github_url ?? null,
          });
        }
        setLoading(false);
      });
  }, [skillId]);

  return { detail, loading };
}

// ── Upload a zip package (for publishers) ───────────────────
export async function uploadSkillPackage(
  skillId: string,
  userId: string,
  file: File,
  version: string = "1.0.0"
): Promise<{ success: boolean; packageId?: string; error?: string }> {
  try {
    // Build storage path: {userId}/{skillId}/{version}.zip
    const storagePath = `${userId}/${skillId}/${version}.zip`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("skill-packages")
      .upload(storagePath, file, {
        contentType: "application/zip",
        upsert: true,
      });

    if (uploadError) return { success: false, error: uploadError.message };

    // Get the public URL
    const { data: urlData } = supabase.storage
      .from("skill-packages")
      .getPublicUrl(storagePath);

    // Compute a simple content hash (first + size + last byte)
    const contentHash = `${file.name}-${file.size}-${file.lastModified}`;

    // Create the skill_packages row
    const { data: pkgData, error: pkgError } = await supabase
      .from("skill_packages")
      .insert({
        skill_id: skillId,
        storage_bucket: "skill-packages",
        storage_path: storagePath,
        storage_url: urlData.publicUrl,
        file_size_bytes: file.size,
        content_hash: contentHash,
        version,
        packaged_by: "publisher",
        is_active: true,
      })
      .select()
      .single();

    if (pkgError) return { success: false, error: pkgError.message };

    // Update the skill to point to the storage URL
    await supabase
      .from("skills")
      .update({
        download_url: urlData.publicUrl,
        download_method: "storage",
        package_size_bytes: file.size,
      })
      .eq("id", skillId);

    return { success: true, packageId: pkgData.id };
  } catch (err: any) {
    return { success: false, error: err.message || "Upload failed" };
  }
}

// ── Format file size ────────────────────────────────────────
export function formatFileSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
