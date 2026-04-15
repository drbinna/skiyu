-- ============================================================
-- /skiyu — GitHub Skill Scraper Database Schema
-- PostgreSQL 16+ migration
-- Version: 1.0.0
-- Date: April 2026
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE quality_tier AS ENUM ('featured', 'standard', 'basic', 'excluded');
CREATE TYPE skill_source AS ENUM ('scraped', 'claimed', 'published');
CREATE TYPE sync_status AS ENUM ('active', 'stale', 'removed', 'error');
CREATE TYPE risk_tier AS ENUM ('clean', 'low', 'medium', 'high');
CREATE TYPE scrape_source_type AS ENUM ('registry', 'awesome_list', 'topic_search', 'graph_walk');
CREATE TYPE scrape_run_type AS ENUM ('full_discovery', 'incremental_sync', 'stale_check', 'quality_rescore', 'manual');
CREATE TYPE scrape_run_status AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled');
CREATE TYPE processing_status AS ENUM ('discovered', 'fetching', 'extracting', 'validating', 'scoring', 'scanning', 'categorizing', 'deduplicating', 'imported', 'skipped', 'quarantined', 'failed');
CREATE TYPE claim_status AS ENUM ('pending', 'approved', 'rejected', 'auto_verified');
CREATE TYPE install_method AS ENUM ('cli', 'web', 'mcp', 'api');
CREATE TYPE agent_type AS ENUM ('claude_code', 'codex_cli', 'cursor', 'windsurf', 'aider', 'gemini_cli', 'other');

-- ============================================================
-- CORE TABLES
-- ============================================================

-- Categories (seeded on init)
CREATE TABLE categories (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            TEXT NOT NULL UNIQUE,
    slug            TEXT NOT NULL UNIQUE,
    description     TEXT,
    icon            TEXT,                          -- emoji or icon name for UI
    display_order   INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_categories_slug ON categories (slug);

-- Tags (auto-populated from GitHub topics + SKILL.md)
CREATE TABLE tags (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            TEXT NOT NULL UNIQUE,
    slug            TEXT NOT NULL UNIQUE,
    usage_count     INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tags_slug ON tags (slug);
CREATE INDEX idx_tags_usage ON tags (usage_count DESC);

-- Authors (GitHub identities, pre-claim)
CREATE TABLE authors (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    github_username     TEXT NOT NULL UNIQUE,
    github_id           TEXT UNIQUE,               -- GitHub numeric user ID
    display_name        TEXT,
    avatar_url          TEXT,
    github_profile_url  TEXT,
    bio                 TEXT,
    company             TEXT,
    location            TEXT,
    public_repos        INT,
    followers           INT,
    metadata_cache      JSONB DEFAULT '{}',        -- full GitHub user API response
    first_seen_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_fetched_at     TIMESTAMPTZ
);

CREATE INDEX idx_authors_github ON authors (github_username);

-- Users (/skiyu registered users)
CREATE TABLE users (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email               TEXT UNIQUE,
    github_username     TEXT UNIQUE,
    github_id           TEXT UNIQUE,
    display_name        TEXT,
    avatar_url          TEXT,
    is_publisher        BOOLEAN NOT NULL DEFAULT FALSE,
    is_verified         BOOLEAN NOT NULL DEFAULT FALSE,
    is_admin            BOOLEAN NOT NULL DEFAULT FALSE,
    stripe_account_id   TEXT,                      -- for payouts
    stripe_customer_id  TEXT,                      -- for purchases
    onboarded_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_github ON users (github_username);

-- Dedup groups (clusters of near-duplicate skills)
CREATE TABLE dedup_groups (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    canonical_skill_id  UUID,                      -- FK added after skills table
    match_type          TEXT NOT NULL,              -- 'exact_hash', 'near_duplicate', 'fork'
    similarity_score    FLOAT,                     -- 0.0 - 1.0
    member_count        INT NOT NULL DEFAULT 1,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SKILLS (core entity)
-- ============================================================

CREATE TABLE skills (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Identity
    name                TEXT NOT NULL,
    slug                TEXT NOT NULL UNIQUE,
    description         TEXT NOT NULL,
    
    -- Classification
    category_id         UUID REFERENCES categories(id),
    quality_score       INT CHECK (quality_score >= 0 AND quality_score <= 100),
    quality_tier        quality_tier NOT NULL DEFAULT 'basic',
    compatibility       JSONB DEFAULT '["claude_code"]',  -- array of compatible agents
    
    -- GitHub provenance
    github_repo         TEXT,                      -- 'owner/repo'
    github_url          TEXT,                      -- full URL
    github_stars        INT DEFAULT 0,
    github_forks        INT DEFAULT 0,
    github_license      TEXT,                      -- SPDX identifier
    github_language     TEXT,                      -- primary language
    github_last_commit  TIMESTAMPTZ,
    github_commit_sha   TEXT,                      -- SHA of scraped commit
    github_topics       JSONB DEFAULT '[]',        -- repo topics array
    skill_path_in_repo  TEXT,                      -- path to SKILL.md within repo
    
    -- Content
    skill_md_content    TEXT,                      -- full SKILL.md body
    skill_md_hash       TEXT,                      -- SHA-256 for dedup
    readme_content      TEXT,                      -- README from skill dir or repo root
    frontmatter         JSONB DEFAULT '{}',        -- parsed YAML frontmatter
    supporting_files    JSONB DEFAULT '[]',        -- [{path, type, size}]
    instruction_word_count INT DEFAULT 0,
    
    -- Ownership
    author_id           UUID REFERENCES authors(id),
    claimed_by          UUID REFERENCES users(id),
    source              skill_source NOT NULL DEFAULT 'scraped',
    
    -- Sync state
    sync_status         sync_status NOT NULL DEFAULT 'active',
    sync_error          TEXT,
    
    -- Deduplication
    dedup_group_id      UUID REFERENCES dedup_groups(id),
    is_canonical        BOOLEAN NOT NULL DEFAULT TRUE,  -- is this the "best" in its dedup group?
    
    -- Pricing (unlocked on claim)
    price_cents         INT,                       -- null = free
    price_type          TEXT DEFAULT 'free',        -- 'free', 'one_time', 'per_run'
    
    -- Stats (denormalized for perf)
    install_count       INT NOT NULL DEFAULT 0,
    review_count        INT NOT NULL DEFAULT 0,
    avg_rating          FLOAT,
    
    -- Timestamps
    first_scraped_at    TIMESTAMPTZ,
    last_synced_at      TIMESTAMPTZ,
    published_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add FK back to dedup_groups
ALTER TABLE dedup_groups
    ADD CONSTRAINT fk_dedup_canonical
    FOREIGN KEY (canonical_skill_id) REFERENCES skills(id);

-- Core indexes
CREATE INDEX idx_skills_slug ON skills (slug);
CREATE INDEX idx_skills_category ON skills (category_id);
CREATE INDEX idx_skills_author ON skills (author_id);
CREATE INDEX idx_skills_claimed ON skills (claimed_by) WHERE claimed_by IS NOT NULL;
CREATE INDEX idx_skills_source ON skills (source);
CREATE INDEX idx_skills_sync ON skills (sync_status);
CREATE INDEX idx_skills_quality ON skills (quality_tier, quality_score DESC);
CREATE INDEX idx_skills_stars ON skills (github_stars DESC NULLS LAST);
CREATE INDEX idx_skills_installs ON skills (install_count DESC);
CREATE INDEX idx_skills_hash ON skills (skill_md_hash);
CREATE INDEX idx_skills_repo ON skills (github_repo);
CREATE INDEX idx_skills_dedup ON skills (dedup_group_id) WHERE dedup_group_id IS NOT NULL;

-- Full-text search index
CREATE INDEX idx_skills_search ON skills USING GIN (
    to_tsvector('english', COALESCE(name, '') || ' ' || COALESCE(description, ''))
);

-- ============================================================
-- SKILL SUPPORTING TABLES
-- ============================================================

-- Skill files (scripts, references, templates bundled with a skill)
CREATE TABLE skill_files (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    skill_id        UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    file_path       TEXT NOT NULL,                 -- relative path within skill dir
    file_type       TEXT,                          -- 'script', 'reference', 'template', 'asset'
    file_extension  TEXT,                          -- '.py', '.sh', '.md', '.json'
    file_size_bytes INT,
    content_hash    TEXT,                          -- SHA-256
    content_preview TEXT,                          -- first 500 chars (for display)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE (skill_id, file_path)
);

CREATE INDEX idx_skill_files_skill ON skill_files (skill_id);

-- Skill-tag junction
CREATE TABLE skill_tags (
    skill_id    UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    tag_id      UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (skill_id, tag_id)
);

CREATE INDEX idx_skill_tags_tag ON skill_tags (tag_id);

-- ============================================================
-- SECURITY SCANNING
-- ============================================================

CREATE TABLE security_scans (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    skill_id            UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    
    -- Results
    risk_tier           risk_tier NOT NULL DEFAULT 'clean',
    flags_raised        JSONB DEFAULT '[]',        -- [{type, severity, file, line, detail}]
    flagged_files       JSONB DEFAULT '[]',        -- list of files with issues
    total_flags         INT NOT NULL DEFAULT 0,
    
    -- Network analysis
    outbound_domains    JSONB DEFAULT '[]',        -- domains found in scripts
    env_vars_accessed   JSONB DEFAULT '[]',        -- env vars referenced
    
    -- Dependency audit
    dependencies_found  JSONB DEFAULT '[]',        -- [{name, version, source}]
    known_vulns         JSONB DEFAULT '[]',        -- [{cve, severity, package}]
    
    -- Review
    scan_version        TEXT NOT NULL DEFAULT '1.0',
    manually_reviewed   BOOLEAN NOT NULL DEFAULT FALSE,
    reviewed_by         UUID REFERENCES users(id),
    review_notes        TEXT,
    
    -- Timestamps
    scanned_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at         TIMESTAMPTZ
);

CREATE INDEX idx_security_skill ON security_scans (skill_id);
CREATE INDEX idx_security_risk ON security_scans (risk_tier) WHERE risk_tier IN ('medium', 'high');
CREATE INDEX idx_security_review ON security_scans (manually_reviewed) WHERE manually_reviewed = FALSE AND risk_tier IN ('medium', 'high');

-- ============================================================
-- SCRAPER ENGINE
-- ============================================================

-- Known sources to crawl
CREATE TABLE scrape_sources (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            TEXT NOT NULL,
    github_url      TEXT NOT NULL,
    source_type     scrape_source_type NOT NULL,
    description     TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    priority        INT NOT NULL DEFAULT 50,        -- higher = crawl first
    
    -- Stats
    total_skills_found  INT NOT NULL DEFAULT 0,
    last_crawled_at     TIMESTAMPTZ,
    last_skill_count    INT,
    
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Individual scraper runs
CREATE TABLE scrape_runs (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id           UUID REFERENCES scrape_sources(id),    -- null for full discovery
    
    -- Config
    run_type            scrape_run_type NOT NULL,
    triggered_by        TEXT DEFAULT 'scheduler',              -- 'scheduler', 'admin', 'api'
    
    -- Status
    status              scrape_run_status NOT NULL DEFAULT 'pending',
    
    -- Counters
    repos_discovered    INT NOT NULL DEFAULT 0,
    repos_processed     INT NOT NULL DEFAULT 0,
    skills_imported     INT NOT NULL DEFAULT 0,
    skills_updated      INT NOT NULL DEFAULT 0,
    skills_quarantined  INT NOT NULL DEFAULT 0,
    skills_skipped      INT NOT NULL DEFAULT 0,
    errors              INT NOT NULL DEFAULT 0,
    
    -- Rate limit tracking
    api_calls_used      INT NOT NULL DEFAULT 0,
    rate_limit_hits     INT NOT NULL DEFAULT 0,
    
    -- Error details
    error_log           JSONB DEFAULT '[]',
    
    -- Timestamps
    started_at          TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_runs_status ON scrape_runs (status) WHERE status IN ('pending', 'running');
CREATE INDEX idx_runs_source ON scrape_runs (source_id);
CREATE INDEX idx_runs_type ON scrape_runs (run_type, created_at DESC);

-- Individual repo discoveries within a run
CREATE TABLE scrape_discoveries (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id              UUID NOT NULL REFERENCES scrape_runs(id) ON DELETE CASCADE,
    skill_id            UUID REFERENCES skills(id),            -- set after import
    
    -- Discovered repo info
    github_repo         TEXT NOT NULL,                         -- 'owner/repo'
    github_url          TEXT NOT NULL,
    skill_path          TEXT,                                  -- path to SKILL.md in repo
    
    -- Processing state
    processing_status   processing_status NOT NULL DEFAULT 'discovered',
    error_message       TEXT,
    retry_count         INT NOT NULL DEFAULT 0,
    
    -- Repo metadata snapshot at discovery
    repo_stars          INT,
    repo_forks          INT,
    repo_license        TEXT,
    repo_last_push      TIMESTAMPTZ,
    repo_archived       BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    discovered_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at        TIMESTAMPTZ
);

CREATE INDEX idx_disc_run ON scrape_discoveries (run_id);
CREATE INDEX idx_disc_status ON scrape_discoveries (processing_status) WHERE processing_status NOT IN ('imported', 'skipped');
CREATE INDEX idx_disc_repo ON scrape_discoveries (github_repo);

-- ============================================================
-- QUALITY SCORING BREAKDOWN
-- ============================================================

CREATE TABLE quality_scores (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    skill_id                UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    
    -- Individual signal scores (0-100 each, weighted to final)
    frontmatter_score       INT,          -- 20% weight
    description_score       INT,          -- 15% weight
    instruction_depth_score INT,          -- 20% weight
    repo_health_score       INT,          -- 15% weight
    file_structure_score    INT,          -- 10% weight
    security_score          INT,          -- 10% weight
    license_score           INT,          -- 10% weight
    
    -- Computed
    final_score             INT NOT NULL,
    score_version           TEXT NOT NULL DEFAULT '1.0',
    
    -- Detail
    scoring_details         JSONB DEFAULT '{}',    -- per-signal breakdown
    
    scored_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE (skill_id, score_version)
);

CREATE INDEX idx_quality_skill ON quality_scores (skill_id);

-- ============================================================
-- AUTHOR CLAIMING
-- ============================================================

CREATE TABLE claim_requests (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id                 UUID NOT NULL REFERENCES users(id),
    skill_id                UUID NOT NULL REFERENCES skills(id),
    
    status                  claim_status NOT NULL DEFAULT 'pending',
    verification_method     TEXT NOT NULL DEFAULT 'github_oauth',  -- 'github_oauth', 'repo_file', 'manual'
    
    -- Audit
    github_username_match   BOOLEAN,
    repo_owner_match        BOOLEAN,
    admin_notes             TEXT,
    resolved_by             UUID REFERENCES users(id),
    
    requested_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at             TIMESTAMPTZ,
    
    UNIQUE (user_id, skill_id)
);

CREATE INDEX idx_claims_status ON claim_requests (status) WHERE status = 'pending';
CREATE INDEX idx_claims_user ON claim_requests (user_id);
CREATE INDEX idx_claims_skill ON claim_requests (skill_id);

-- ============================================================
-- ENGAGEMENT
-- ============================================================

-- Installs (anonymous tracking with hashed client ID)
CREATE TABLE installs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    skill_id        UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    
    client_hash     TEXT,                          -- hashed IP or anonymous client ID
    install_method  install_method NOT NULL DEFAULT 'web',
    agent_type      agent_type,
    referrer        TEXT,                          -- where they found the skill
    
    installed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_installs_skill ON installs (skill_id);
CREATE INDEX idx_installs_date ON installs (installed_at DESC);
-- For analytics: installs per skill per day
CREATE INDEX idx_installs_daily ON installs (skill_id, (installed_at::DATE));

-- Reviews
CREATE TABLE reviews (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    skill_id            UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES users(id),
    
    rating              INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    title               TEXT,
    body                TEXT,
    
    -- Publisher response
    publisher_response  TEXT,
    responded_at        TIMESTAMPTZ,
    
    -- Moderation
    is_flagged          BOOLEAN NOT NULL DEFAULT FALSE,
    is_hidden           BOOLEAN NOT NULL DEFAULT FALSE,
    
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE (skill_id, user_id)                    -- one review per user per skill
);

CREATE INDEX idx_reviews_skill ON reviews (skill_id);
CREATE INDEX idx_reviews_user ON reviews (user_id);
CREATE INDEX idx_reviews_rating ON reviews (skill_id, rating);

-- ============================================================
-- SEED DATA — Categories
-- ============================================================

INSERT INTO categories (name, slug, description, icon, display_order) VALUES
    ('Backend development',      'backend',        'Server-side code, APIs, frameworks, auth, middleware, GraphQL, gRPC',                            '⚙',  1),
    ('Frontend & UI',            'frontend',       'Client-side components, styling, design systems, React, Vue, Svelte, Tailwind',                  '🖥',  2),
    ('Mobile development',       'mobile',         'Native and cross-platform mobile apps — React Native, Expo, Flutter, Swift, Kotlin',             '📱',  3),
    ('Database & storage',       'database',       'Schema design, queries, ORMs, migrations, caching — DuckDB, Drizzle, Prisma, PostgreSQL, Redis', '🗄',  4),
    ('Testing & QA',             'testing',        'Unit testing, E2E, TDD, fuzzing, code review, linting — Playwright, Jest, Vitest',               '🧪',  5),
    ('DevOps & infrastructure',  'devops',         'CI/CD, containers, IaC, cloud, deployment, monitoring — Docker, Kubernetes, Terraform',           '🚀',  6),
    ('Security & compliance',    'security',       'Auditing, pen testing, vulnerability scanning, encryption, OWASP — Shannon, CodeQL, Semgrep',    '🔒',  7),
    ('Data & analytics',         'data',           'Data processing, visualization, ETL, analysis pipelines — pandas, SQL, Recharts, D3',             '📊',  8),
    ('AI & machine learning',    'ai-ml',          'Model training, inference, embeddings, RAG, fine-tuning — HuggingFace, TRL, Claude API',          '🤖',  9),
    ('Browser & automation',     'browser',        'Web scraping, browser control, form filling, UI testing — Playwright, Puppeteer, Apify',          '🌐', 10),
    ('Documents & office',       'documents',      'Creating, editing, and processing office files — DOCX, PDF, PPTX, XLSX, form filling',           '📄', 11),
    ('Media & creative',         'media',          'Image, audio, video generation and manipulation — Remotion, FFmpeg, ElevenLabs, SVG art',         '🎨', 12),
    ('Marketing & SEO',          'marketing',      'Content marketing, SEO analysis, social media, email campaigns, ASO, copywriting',                '📈', 13),
    ('Enterprise & workflow',    'enterprise',     'Project management, comms, CRM, productivity — Jira, Slack, HubSpot, Google Workspace, Notion',   '🏢', 14),
    ('Agent & orchestration',    'agents',         'Multi-agent coordination, skill creation, MCP servers, subagents — Superpowers, mcp-builder',     '🔗', 15),
    ('Research & knowledge',     'research',       'Web research, memory, documentation lookup, RAG pipelines — Valyu, Context7, Skill Seekers',      '🔍', 16);

-- ============================================================
-- SEED DATA — Scrape Sources (known registries)
-- ============================================================

INSERT INTO scrape_sources (name, github_url, source_type, priority, description) VALUES
    ('Anthropic Official',       'https://github.com/anthropics/skills',             'registry',     100, 'Official Anthropic skills repository'),
    ('Microsoft Skills',         'https://github.com/microsoft/skills',              'registry',      95, 'Microsoft agent skills for Azure and AI Foundry'),
    ('VoltAgent Awesome List',   'https://github.com/VoltAgent/awesome-agent-skills','awesome_list',  90, 'Curated list of 1000+ agent skills'),
    ('Awesome Claude Skills',    'https://github.com/travisvn/awesome-claude-skills','awesome_list',  85, 'Community curated Claude skills'),
    ('Trail of Bits',            'https://github.com/trailofbits/skills',            'registry',      80, 'Security research and audit skills'),
    ('OK Skills',                'https://github.com/mxyhi/ok-skills',               'registry',      75, 'Curated skills for multiple agents'),
    ('Apify Agent Skills',       'https://github.com/apify/agent-skills',            'registry',      70, 'Web scraping and automation skills'),
    ('Awesome Agent Skills 2',   'https://github.com/heilcheng/awesome-agent-skills','awesome_list',  65, 'Tutorials, guides, and directories'),
    ('Awesome Claude Skills 2',  'https://github.com/BehiSecc/awesome-claude-skills','awesome_list',  60, 'Additional curated Claude skills list');

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_skills_updated
    BEFORE UPDATE ON skills
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_users_updated
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_reviews_updated
    BEFORE UPDATE ON reviews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Update denormalized install count
CREATE OR REPLACE FUNCTION update_install_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE skills SET install_count = install_count + 1 WHERE id = NEW.skill_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_installs_count
    AFTER INSERT ON installs
    FOR EACH ROW EXECUTE FUNCTION update_install_count();

-- Update denormalized review stats
CREATE OR REPLACE FUNCTION update_review_stats()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE skills SET
        review_count = (SELECT COUNT(*) FROM reviews WHERE skill_id = NEW.skill_id AND NOT is_hidden),
        avg_rating = (SELECT AVG(rating)::NUMERIC(2,1) FROM reviews WHERE skill_id = NEW.skill_id AND NOT is_hidden)
    WHERE id = NEW.skill_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_reviews_stats
    AFTER INSERT OR UPDATE OR DELETE ON reviews
    FOR EACH ROW EXECUTE FUNCTION update_review_stats();

-- Update tag usage count
CREATE OR REPLACE FUNCTION update_tag_usage()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE tags SET usage_count = usage_count + 1 WHERE id = NEW.tag_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE tags SET usage_count = usage_count - 1 WHERE id = OLD.tag_id;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tag_usage
    AFTER INSERT OR DELETE ON skill_tags
    FOR EACH ROW EXECUTE FUNCTION update_tag_usage();

-- ============================================================
-- VIEWS
-- ============================================================

-- Publisher dashboard: skills with stats
CREATE VIEW v_skill_catalog AS
SELECT
    s.id,
    s.name,
    s.slug,
    s.description,
    c.name AS category_name,
    c.slug AS category_slug,
    s.quality_score,
    s.quality_tier,
    s.github_repo,
    s.github_stars,
    s.github_license,
    s.source,
    s.sync_status,
    s.install_count,
    s.review_count,
    s.avg_rating,
    s.price_cents,
    s.price_type,
    a.github_username AS author_username,
    a.display_name AS author_display_name,
    a.avatar_url AS author_avatar,
    s.claimed_by IS NOT NULL AS is_claimed,
    s.compatibility,
    s.created_at,
    s.last_synced_at
FROM skills s
LEFT JOIN categories c ON s.category_id = c.id
LEFT JOIN authors a ON s.author_id = a.id
WHERE s.sync_status != 'removed'
  AND s.is_canonical = TRUE;

-- Scraper health dashboard
CREATE VIEW v_scraper_health AS
SELECT
    sr.id AS run_id,
    ss.name AS source_name,
    sr.run_type,
    sr.status,
    sr.repos_discovered,
    sr.skills_imported,
    sr.skills_updated,
    sr.skills_quarantined,
    sr.errors,
    sr.api_calls_used,
    sr.started_at,
    sr.completed_at,
    EXTRACT(EPOCH FROM (sr.completed_at - sr.started_at)) AS duration_seconds
FROM scrape_runs sr
LEFT JOIN scrape_sources ss ON sr.source_id = ss.id
ORDER BY sr.created_at DESC;

-- Security quarantine queue
CREATE VIEW v_quarantine_queue AS
SELECT
    s.id AS skill_id,
    s.name,
    s.github_repo,
    s.github_url,
    sc.risk_tier,
    sc.total_flags,
    sc.flags_raised,
    sc.outbound_domains,
    sc.env_vars_accessed,
    sc.manually_reviewed,
    sc.scanned_at,
    a.github_username AS author
FROM skills s
JOIN security_scans sc ON sc.skill_id = s.id
LEFT JOIN authors a ON s.author_id = a.id
WHERE sc.risk_tier IN ('medium', 'high')
  AND sc.manually_reviewed = FALSE
ORDER BY sc.risk_tier DESC, sc.scanned_at ASC;

-- ============================================================
-- END OF MIGRATION
-- ============================================================
