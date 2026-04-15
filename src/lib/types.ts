export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  display_order: number;
}

export interface Author {
  id: string;
  github_username: string;
  display_name: string | null;
  avatar_url: string | null;
}

export interface Skill {
  id: string;
  name: string;
  slug: string;
  description: string;
  category_id: string | null;
  quality_score: number | null;
  quality_tier: "featured" | "standard" | "basic" | "excluded";
  github_repo: string | null;
  github_url: string | null;
  github_stars: number;
  github_forks: number;
  github_license: string | null;
  github_language: string | null;
  source: "scraped" | "claimed" | "published";
  sync_status: "active" | "stale" | "removed" | "error";
  install_count: number;
  review_count: number;
  avg_rating: number | null;
  price_cents: number | null;
  price_type: string;
  compatibility: string[];
  created_at: string;
  updated_at: string;
  last_synced_at: string | null;
}

// Joined view for catalog display
export interface SkillCatalogItem {
  id: string;
  name: string;
  slug: string;
  description: string;
  category_name: string | null;
  category_slug: string | null;
  category_icon: string | null;
  quality_score: number | null;
  quality_tier: string;
  github_repo: string | null;
  github_stars: number;
  github_license: string | null;
  github_language: string | null;
  source: string;
  install_count: number;
  review_count: number;
  avg_rating: number | null;
  price_cents: number | null;
  price_type: string;
  author_username: string | null;
  author_display_name: string | null;
  author_avatar: string | null;
  is_claimed: boolean;
  compatibility: string[];
  created_at: string;
  last_synced_at: string | null;
  updated_at: string;
}
