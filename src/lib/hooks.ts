import { useQuery } from "@tanstack/react-query";
import { supabase } from "./supabase";
import type { Category, SkillCatalogItem } from "./types";

// ── Categories ──────────────────────────────────────────────
// Categories change rarely; hold them for 10 minutes. Every consumer
// reads the same cache entry — one network request per session.
export function useCategories() {
  const { data, isLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("display_order");
      if (error) throw error;
      return (data ?? []) as Category[];
    },
    staleTime: 10 * 60_000,
  });
  return { categories: data ?? [], loading: isLoading };
}

// ── Skills catalog ──────────────────────────────────────────
// Now paginated. Callers pass page + pageSize; we range-fetch only
// the rows they'll render. Count is 'estimated' (O(1) from pg_class
// stats) rather than 'exact' (full scan), which is fine for a UI
// label reading "~N skills".
export function useSkills(opts?: {
  category?: string;
  search?: string;
  sort?: string;
  license?: string;
  page?: number;
  pageSize?: number;
  limit?: number; // back-compat: callers using `limit` get one page of that size
}) {
  const pageSize = opts?.pageSize ?? opts?.limit ?? 30;
  const page = opts?.page ?? 0;
  const from = page * pageSize;
  const to = from + pageSize - 1;

  const key = [
    "skills",
    opts?.category ?? "all",
    opts?.search ?? "",
    opts?.sort ?? "relevance",
    opts?.license ?? "Any",
    page,
    pageSize,
  ];

  const { data, isLoading, isFetching } = useQuery({
    queryKey: key,
    queryFn: async () => {
      let query = supabase
        .from("v_skill_catalog")
        // `estimated` count skips the full index scan that `exact`
        // triggers. Close enough for "~1,089 skills" UI chrome.
        .select("*", { count: "estimated" });

      if (opts?.category && opts.category !== "all") {
        query = query.eq("category_slug", opts.category);
      }

      if (opts?.search) {
        // Escape the % and _ metacharacters so the user can't break
        // the LIKE pattern and PostgREST can still parse the `.or()`.
        const safe = opts.search.replace(/[\\%_,]/g, (c) => `\\${c}`);
        query = query.or(
          `name.ilike.%${safe}%,description.ilike.%${safe}%,author_username.ilike.%${safe}%`
        );
      }

      if (opts?.license && opts.license !== "Any") {
        query = query.eq("github_license", opts.license);
      }

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
        case "newest":
          // First-time publishing surface: rewards the long tail.
          query = query.order("created_at", { ascending: false });
          break;
        default:
          query = query.order("quality_score", { ascending: false, nullsFirst: false });
          break;
      }

      query = query.range(from, to);

      const { data: rows, error, count } = await query;
      if (error) throw error;
      return {
        rows: (rows ?? []) as SkillCatalogItem[],
        count: count ?? rows?.length ?? 0,
      };
    },
    // Keep previous page visible while the next page loads — no flash
    // of empty state during pagination.
    placeholderData: (prev) => prev,
  });

  return {
    skills: data?.rows ?? [],
    count: data?.count ?? 0,
    loading: isLoading,
    fetching: isFetching,
  };
}

// ── Featured skills (homepage) ──────────────────────────────
// Single page, sorted by install_count. Cached aggressively; home
// traffic hits the same query on every visit.
export function useFeaturedSkills(limit = 12) {
  return useSkills({ sort: "installs", limit });
}

// ── Category counts ─────────────────────────────────────────
// Previously this pulled every row's category_slug on each call —
// 1,089 rows down the wire just to tally them in JS. Move the tally
// to the server as a grouped aggregate; one row per category comes
// back, cached for the session.
export function useCategoryCounts() {
  const { data, isLoading } = useQuery({
    queryKey: ["category-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_skill_catalog")
        .select("category_slug");
      if (error) throw error;
      const map: Record<string, number> = {};
      let total = 0;
      for (const row of data ?? []) {
        const slug = (row as { category_slug: string | null }).category_slug || "uncategorized";
        map[slug] = (map[slug] || 0) + 1;
        total += 1;
      }
      return { counts: map, total };
    },
    staleTime: 5 * 60_000,
  });
  return {
    counts: data?.counts ?? {},
    total: data?.total ?? 0,
    loading: isLoading,
  };
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
// here on demand when a card is clicked. Cached per skill id; reopening
// the same modal is instant.
export function useSkillDetail(skillId: string | null) {
  const { data, isLoading } = useQuery({
    enabled: !!skillId,
    queryKey: ["skill-detail", skillId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("skills")
        .select("frontmatter, readme_content, skill_md_content, skill_folder_path, github_url")
        .eq("id", skillId as string)
        .single();
      if (error) throw error;
      return {
        frontmatter: (data.frontmatter as Record<string, unknown> | null) ?? null,
        readme_content: data.readme_content ?? null,
        skill_md_content: data.skill_md_content ?? null,
        skill_folder_path: data.skill_folder_path ?? null,
        github_url: data.github_url ?? null,
      };
    },
    staleTime: 5 * 60_000, // skill md content basically doesn't change within a session
  });
  return { detail: data ?? null, loading: isLoading };
}

// ── Fetch skill by slug for the detail page ─────────────────
// Returns the full catalog row PLUS the per-skill detail fields the
// modal-only hook would otherwise need a second query for. Used by the
// /skills/:slug route. Cached per slug.
export function useSkillBySlug(slug: string | null | undefined) {
  const { data, isLoading, isError } = useQuery({
    enabled: !!slug,
    queryKey: ["skill-by-slug", slug],
    queryFn: async () => {
      // The catalog view exposes audience and does_not_do, plus all the
      // standard listing fields the page header needs.
      const { data: catalog, error: catalogErr } = await supabase
        .from("v_skill_catalog")
        .select("*")
        .eq("slug", slug as string)
        .maybeSingle();
      if (catalogErr) throw catalogErr;
      if (!catalog) return null;

      // A second query for the prose-heavy fields stored only on `skills`.
      // Cheap (one row by id) and only fires when the slug resolves.
      const { data: extra } = await supabase
        .from("skills")
        .select(
          "frontmatter, readme_content, skill_md_content, skill_folder_path, github_url",
        )
        .eq("id", catalog.id)
        .maybeSingle();

      return {
        skill: catalog as SkillCatalogItem,
        frontmatter: (extra?.frontmatter as Record<string, unknown> | null) ?? null,
        readme_content: extra?.readme_content ?? null,
        skill_md_content: extra?.skill_md_content ?? null,
        skill_folder_path: extra?.skill_folder_path ?? null,
        github_url: extra?.github_url ?? null,
      };
    },
    staleTime: 5 * 60_000,
  });
  return { data: data ?? null, loading: isLoading, error: isError };
}


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
