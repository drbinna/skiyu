# /skiyu — Supabase Setup Guide

## Database Status

The database is **already live** on your Supabase project (`mkqiqkqgnywosbneibqx`).

**Applied migrations:**
1. `create_enums_and_extensions` — 11 custom enums + uuid/pgcrypto
2. `create_core_tables` — categories, tags, authors, users, dedup_groups
3. `create_skills_table` — 40+ column skills table with GIN full-text search
4. `create_supporting_tables` — 12 supporting tables (security_scans, scrape_runs, etc.)
5. `create_triggers_and_views` — auto-update triggers, v_skill_catalog view
6. `seed_categories_and_sources` — 16 categories, 9 scrape sources
7. `seed_sample_skills` — 22 skills, 20 authors
8. `enable_rls_policies` — row-level security for public read access
9. `auth_user_sync_and_claiming` — GitHub OAuth user sync, auto-claim functions

**Seeded data:**
- 16 categories (expanded from original 8)
- 22 sample skills across all categories
- 20 authors
- 9 GitHub scrape sources (Anthropic, Microsoft, VoltAgent, etc.)

---

## Enable GitHub OAuth (Required)

The code is wired up but GitHub OAuth needs to be enabled in Supabase:

### Step 1: Create a GitHub OAuth App

1. Go to https://github.com/settings/developers
2. Click **New OAuth App**
3. Fill in:
   - **Application name:** skiyu
   - **Homepage URL:** `http://localhost:5173` (or your deployed URL)
   - **Authorization callback URL:** `https://mkqiqkqgnywosbneibqx.supabase.co/auth/v1/callback`
4. Click **Register application**
5. Copy the **Client ID**
6. Click **Generate a new client secret** and copy it

### Step 2: Configure Supabase

1. Go to https://supabase.com/dashboard/project/mkqiqkqgnywosbneibqx/auth/providers
2. Find **GitHub** in the provider list
3. Toggle it **ON**
4. Paste your **Client ID** and **Client Secret**
5. Click **Save**

### Step 3: Set Redirect URLs

1. Go to https://supabase.com/dashboard/project/mkqiqkqgnywosbneibqx/auth/url-configuration
2. Add your site URL: `http://localhost:5173`
3. Add redirect URLs:
   - `http://localhost:5173`
   - `http://localhost:5173/**`
   - Your production URL when deployed

---

## How Auth Works

### Sign-in flow:
1. User clicks **Sign in** → redirected to GitHub OAuth
2. GitHub authorizes → redirected back to /skiyu
3. Supabase creates an auth user → `handle_new_user()` trigger fires
4. Trigger inserts/updates a row in `public.users` with GitHub username, avatar, display name
5. Frontend `AuthProvider` detects the session, fetches profile, checks for claimable skills

### Claiming flow:
1. On login, the app queries `v_skill_catalog` for skills where `author_username` matches the user's GitHub username and `is_claimed = false`
2. If matches exist, a cyan banner appears on the Publish dashboard
3. User clicks **Claim all** → calls `auto_claim_skills()` RPC function
4. Function updates all matching skills: sets `claimed_by = user.id`, `source = 'claimed'`
5. Creates `claim_requests` records with `status = 'auto_verified'`
6. Banner updates to show success, user now sees skills in their dashboard

### What claiming unlocks:
| Feature | Before claim | After claim |
|---------|-------------|-------------|
| Listed in catalog | Yes | Yes |
| Edit title/description | No | Yes |
| Set pricing | No | Yes |
| View install analytics | No | Yes |
| Respond to reviews | No | Yes |
| Push updates | No | Yes |
| Verified badge | No | Yes |

---

## Project Structure (new files)

```
src/
├── lib/
│   ├── supabase.ts      # Supabase client init (URL + anon key)
│   ├── types.ts          # TypeScript interfaces for DB tables
│   ├── hooks.ts          # React hooks: useSkills, useCategories, etc.
│   └── auth.tsx          # AuthProvider context with GitHub OAuth + claiming
├── app/
│   ├── App.tsx           # Wrapped with <AuthProvider>
│   ├── components/
│   │   ├── nav-auth.tsx  # Auth button/dropdown for navigation
│   │   ├── home.tsx      # Uses useFeaturedSkills() from Supabase
│   │   ├── explore.tsx   # Uses useSkills() + useCategories() from Supabase
│   │   ├── publish.tsx   # Auth-gated dashboard with claim banner
│   │   └── docs.tsx      # NavAuth in nav
supabase/
├── schema.sql            # Full database schema (reference)
└── categories.sql        # 16 categories + keyword map (reference)
```

---

## Running locally

```bash
# Install dependencies (including @supabase/supabase-js)
pnpm install

# Start dev server
pnpm dev
```

The app connects to your live Supabase instance immediately — no local DB setup needed.

---

## Environment variables (optional)

The Supabase URL and anon key are currently hardcoded in `src/lib/supabase.ts`.
For production, move them to environment variables:

```ts
// src/lib/supabase.ts
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
```

```env
# .env
VITE_SUPABASE_URL=https://mkqiqkqgnywosbneibqx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
```
