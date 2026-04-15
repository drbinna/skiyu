-- ============================================================
-- /skiyu — Updated Categories (replaces original 8-category seed)
-- Run this AFTER the main migration, or replace the INSERT block
-- ============================================================

-- Clear existing seed if re-running
DELETE FROM categories;

INSERT INTO categories (name, slug, description, icon, display_order) VALUES
    -- Development (split from original "Development & code")
    ('Backend development',      'backend',        'Server-side code, APIs, frameworks, auth, middleware, GraphQL, gRPC',                            '⚙',  1),
    ('Frontend & UI',            'frontend',       'Client-side components, styling, design systems, React, Vue, Svelte, Tailwind',                  '🖥',  2),
    ('Mobile development',       'mobile',         'Native and cross-platform mobile apps — React Native, Expo, Flutter, Swift, Kotlin',             '📱',  3),
    ('Database & storage',       'database',       'Schema design, queries, ORMs, migrations, caching — DuckDB, Drizzle, Prisma, PostgreSQL, Redis', '🗄',  4),
    ('Testing & QA',             'testing',        'Unit testing, E2E, TDD, fuzzing, code review, linting — Playwright, Jest, Vitest',               '🧪',  5),

    -- Infrastructure & security (kept)
    ('DevOps & infrastructure',  'devops',         'CI/CD, containers, IaC, cloud, deployment, monitoring — Docker, Kubernetes, Terraform, GitHub Actions', '🚀', 6),
    ('Security & compliance',    'security',       'Auditing, pen testing, vulnerability scanning, encryption, OWASP — Shannon, CodeQL, Semgrep',    '🔒',  7),

    -- Data & AI (kept)
    ('Data & analytics',         'data',           'Data processing, visualization, ETL, analysis pipelines — pandas, SQL, Recharts, D3, dashboards', '📊', 8),
    ('AI & machine learning',    'ai-ml',          'Model training, inference, embeddings, RAG, fine-tuning — HuggingFace, TRL, Claude API',          '🤖', 9),

    -- Automation (new)
    ('Browser & automation',     'browser',        'Web scraping, browser control, form filling, UI testing — Playwright, Puppeteer, Apify',          '🌐', 10),

    -- Content (split from original "Content & creative")
    ('Documents & office',       'documents',      'Creating, editing, and processing office files — DOCX, PDF, PPTX, XLSX, form filling, markdown',  '📄', 11),
    ('Media & creative',         'media',          'Image, audio, video generation and manipulation — Remotion, FFmpeg, ElevenLabs, SVG art, music',  '🎨', 12),

    -- Marketing (new)
    ('Marketing & SEO',          'marketing',      'Content marketing, SEO analysis, social media, email campaigns, ASO, copywriting',                '📈', 13),

    -- Enterprise (kept)
    ('Enterprise & workflow',    'enterprise',     'Project management, comms, CRM, productivity — Jira, Slack, HubSpot, Google Workspace, Notion',   '🏢', 14),

    -- Meta / agent (new)
    ('Agent & orchestration',    'agents',         'Multi-agent coordination, skill creation, MCP servers, subagents — Superpowers, mcp-builder',     '🔗', 15),
    ('Research & knowledge',     'research',       'Web research, memory, documentation lookup, RAG pipelines — Valyu, Context7, Skill Seekers',      '🔍', 16);

-- ============================================================
-- Updated categorization keywords (for the scraper's auto-classifier)
-- Map these in your categorizer service config
-- ============================================================

-- This is a reference for the scraper's Stage 4 keyword matching.
-- Store this in a config file or env, not in the DB.

/*
CATEGORY KEYWORD MAP:

backend:     nestjs, fastapi, express, django, flask, rails, spring, graphql, grpc, rest, api, 
             middleware, auth, jwt, oauth, passport, prisma-backend, server, endpoint, route, 
             controller, service, microservice, websocket, trpc

frontend:    react, vue, svelte, angular, next, nuxt, tailwind, css, shadcn, component, layout, 
             responsive, accessibility, a11y, design-system, landing-page, ui, ux, html, 
             framer-motion, animation, vite, webpack, storybook

mobile:      react-native, expo, flutter, swift, kotlin, ios, android, mobile, capacitor, 
             ionic, nativescript, app-store, play-store, deep-link, push-notification

database:    sql, postgresql, mysql, sqlite, mongodb, redis, duckdb, drizzle, prisma, 
             typeorm, sequelize, knex, migration, schema, query, orm, d1, supabase-db, 
             firestore, dynamodb, vector-db, pgvector, index, table

testing:     test, jest, vitest, playwright, cypress, mocha, pytest, unittest, tdd, bdd, 
             coverage, e2e, integration-test, code-review, lint, eslint, prettier, 
             simplify, review, fuzzing, property-based

devops:      docker, kubernetes, terraform, ansible, ci, cd, github-actions, gitlab-ci, 
             cloudflare, workers, deploy, nginx, helm, argo, pulumi, aws-cdk, serverless, 
             monitoring, datadog, prometheus, grafana, sentry

security:    audit, vulnerability, cve, owasp, encryption, pentest, security, compliance, 
             gdpr, hipaa, soc2, code-scan, semgrep, codeql, snyk, trivy, sbom, 
             secret-scanning, iam, rbac, zero-trust

data:        data, pandas, numpy, spark, etl, pipeline, visualization, chart, dashboard, 
             analytics, csv, parquet, arrow, dbt, airflow, dagster, excel-analysis, 
             statistics, regression, forecast, bi, tableau, metabase

ai-ml:       model, training, inference, embedding, rag, fine-tune, llm, transformer, 
             langchain, llamaindex, huggingface, openai, anthropic, claude-api, 
             vector-search, prompt, agent-sdk, tokenizer, lora, rlhf

browser:     browser, playwright-automation, puppeteer, scrape, scraping, crawl, 
             headless, selenium, web-automation, form-fill, screenshot, apify, 
             cheerio, dom, xpath, css-selector

documents:   docx, pdf, pptx, xlsx, spreadsheet, presentation, word-doc, document, 
             report, template, form-fill, pandoc, markdown-doc, latex, resume, 
             invoice, contract, letter

media:       image, video, audio, music, remotion, ffmpeg, elevenlabs, tts, 
             speech, podcast, art, generative, p5js, svg, canvas, illustration, 
             dall-e, stable-diffusion, midjourney, suno, lottie, gif, sticker

marketing:   seo, aso, marketing, social-media, twitter, x-twitter, linkedin, 
             email-marketing, newsletter, copywriting, content-strategy, 
             growth, analytics-marketing, campaign, advertising, brand

enterprise:  jira, slack, notion, google-drive, google-workspace, hubspot, 
             salesforce, asana, linear, project-management, crm, email, 
             calendar, meeting, internal-comms, report, onboarding, hr

agents:      multi-agent, subagent, orchestration, skill-creator, mcp-builder, 
             mcp-server, agent-framework, workflow-engine, supervisor, 
             delegation, tool-use, function-calling, plugin, composability

research:    research, web-search, memory, rag-pipeline, documentation, 
             context, knowledge-base, citation, arxiv, paper, academic, 
             fact-check, web-fetch, scrape-docs, translate
*/
