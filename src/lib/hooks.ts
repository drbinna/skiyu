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
