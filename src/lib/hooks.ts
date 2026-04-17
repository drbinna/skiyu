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
export async function downloadSkill(
  skillId: string,
  skillName: string,
  userId?: string | null
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    // Resolve the right download URL (storage if available, else GitHub)
    const { data, error } = await supabase.rpc("resolve_download_url", {
      target_skill_id: skillId,
    });

    if (error || !data || data.length === 0) {
      return { success: false, error: "No download available" };
    }

    const { url, method, file_size } = data[0];
    if (!url) return { success: false, error: "No download URL" };

    // Log the download event (non-blocking)
    supabase
      .from("downloads")
      .insert({
        skill_id: skillId,
        user_id: userId || null,
        download_method: method,
        file_size_bytes: file_size,
        user_agent: navigator.userAgent,
        referrer: document.referrer || null,
      })
      .then(() => {});

    // Trigger the download
    const slug = skillName.toLowerCase().replace(/\s+/g, "-");
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug}.zip`;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    return { success: true, url };
  } catch (err: any) {
    return { success: false, error: err.message || "Download failed" };
  }
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
