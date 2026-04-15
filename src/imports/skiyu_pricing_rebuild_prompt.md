# Figma Make Prompt — /skiyu Pricing Page Rebuild

Rewrite the pricing page (`src/app/components/pricing.tsx`) with a new pricing model. Replace the current credit package cards (Day Pass, Weekly, Monthly, Yearly) with a 30-day free trial + pay-as-you-go wallet system. Keep the same visual design language — black background, white text at varying opacities, Erode (F) and Fragment Mono (M) fonts, monochrome aesthetic, no color.

---

## Overall page structure (top to bottom):

1. Nav (keep as-is)
2. Hero
3. Three roles section (Consumers, Publishers, Creators)
4. 30-day free trial block
5. PAYG rate table
6. Wallet & top-up section
7. 0% commission callout
8. Enterprise callout
9. FAQ
10. Bottom CTA
11. Footer

---

## 1. Hero

Title: "Try free for 30 days. Then pay as you go."

Subtitle: "No subscriptions. No packages. No credits expiring. Build skills with AI-powered tools during your trial, then pay only for what you use — starting at $5."

---

## 2. Three roles section

Keep the same 3-column grid layout with icons. Update the creator card only:

- Consumers: icon "↓", price "Free to explore", desc "Browse, search, and try free skills at no cost. Pay only for premium skills you choose — one-time, yours forever."
- Publishers: icon "↑", price "Free to list", desc "List and sell skills with zero commission. Keep 100% of your revenue. No take rate."
- Creators: icon "/", price "30 days free, then PAYG", desc "Full access to Skill Studio, AI tools, and sandboxes for 30 days. After that, pay per action — starting at $0.05."

---

## 3. 30-day free trial block

This replaces the old package cards. Make it a single prominent block, centered, with a border and subtle background (rgba(255,255,255,0.015)), similar to the old 0% commission callout style.

Top label (Fragment Mono, uppercase, 11px, low opacity): "YOUR FIRST 30 DAYS"

Title (large, bold): "Build up to 4 skills. Free."

Subtitle (14px, low opacity): "Full access to every creation tool. No credit card required."

Below the subtitle, show the free trial allowance as a clean list of rows (like the credit cost tables in the current page). Each row has the action name on the left and the free amount on the right in Fragment Mono:

- Skill Studio generations → 5 free
- AI script generations → 5 free
- Sandbox test runs → 15 free
- Auto-evolve cycles → 3 free
- Quality score checks → 10 free
- Validation & publish → Unlimited (always free)

Below the table, a small Fragment Mono note: "No credit card needed to start. Trial begins when you first use a creation tool."

A primary CTA button below: "Start free trial"

---

## 4. PAYG rate table

Section label (Fragment Mono, uppercase): "AFTER YOUR TRIAL"

Heading: "Pay only for what you use"

Subtitle: "Every action has a fixed price. No minimums, no commitments, no expiring balances."

Table with two columns — Action and Price. Same styling as the old credit cost table (border, rounded corners, header row with Fragment Mono uppercase labels, alternating subtle backgrounds):

- Skill Studio generation → $0.50
- AI script generation → $0.40
- Sandbox test run → $0.15
- Auto-evolve cycle → $0.25
- Quality score check → $0.10
- Validation & publish → Free (always)

Below the table, a Fragment Mono note: "Full skill build (studio + scripts + 3 tests + quality + publish) ≈ $1.50"

---

## 5. Wallet & top-up section

Section label: "HOW BILLING WORKS"

Heading: "Load your wallet, build when you want"

Show this as a simple three-step horizontal layout (similar to the old "How It Works" section on the landing page). Three items side by side, each with a large step number (01, 02, 03) ghosted in the background:

Step 01 — "Add funds"
"Load your wallet starting at $5. Card, Apple Pay, or Google Pay via Stripe. Choose from quick amounts ($5, $15, $30, $50) or enter a custom amount."

Step 02 — "Build skills"
"Each action deducts from your balance at the rates above. Your balance never expires. See real-time usage in your Publish dashboard."

Step 03 — "Auto-refill (optional)"
"Set it and forget it. Choose an amount to auto-add when your balance drops below a threshold. Cancel anytime."

Below the three steps, show key details as a compact row list:

- Minimum top-up → $5.00
- Balance expiry → Never
- Auto-refill → Optional (e.g. add $15 when below $2)
- Low balance alert → Email + dashboard banner at $1.00
- Payment methods → Card, Apple Pay, Google Pay

---

## 6. 0% commission callout

Keep exactly as it currently is — the big "0%" with "Commission on skill sales" label and the explanation that publishers keep everything minus Stripe processing fees. No changes.

---

## 7. Enterprise callout

Keep as-is. Update the description slightly:

"Private skill catalogs, SSO, team wallets, volume pricing, and dedicated support for organizations with 10+ creators."

(Changed "team credit pools" to "team wallets" to match the new model.)

---

## 8. FAQ

Replace the entire FAQ array with these questions and answers:

Q: "What's included in the 30-day free trial?"
A: "Full access to Skill Studio, AI script generation, sandbox testing, auto-evolve, and quality scoring. You get a fixed free allowance (5 Studio generations, 5 script generations, 15 sandbox tests, 3 auto-evolve cycles, 10 quality checks). Validation and publishing are always free and unlimited. No credit card required to start."

Q: "What happens when the trial ends?"
A: "Creation tools pause until you add funds to your wallet. Everything else keeps working — browsing, installing skills, managing published skills, receiving purchases, and withdrawing revenue. You're never locked out, just limited to the AI-powered tools."

Q: "Do I need to pay to publish a skill?"
A: "No. Validation and publishing are always free, even after the trial. If you write your SKILL.md manually without Skill Studio, you can publish unlimited skills at zero cost forever. The wallet is only for AI-powered creation tools."

Q: "Does my wallet balance expire?"
A: "Never. Add $5 today, use $2 this month, use the remaining $3 six months later. Your balance stays until you spend it."

Q: "Do consumers pay anything?"
A: "Browsing and searching are free. When you buy a skill, you pay the one-time price set by the creator. No platform surcharge, no account fees, no subscriptions."

Q: "Do publishers pay a commission?"
A: "No. Zero commission on sales. Publishers keep 100% of revenue minus standard Stripe processing (~2.9% + $0.30 per transaction)."

Q: "Can I set up auto-refill?"
A: "Yes. Choose an amount to auto-add (e.g. $15) and a threshold (e.g. when balance drops below $2). You'll never run out mid-build. Cancel auto-refill anytime."

Q: "What's the minimum top-up?"
A: "$5. That's enough for about 3 complete skill builds. Quick-add buttons are available for $5, $15, $30, and $50, or you can enter any custom amount up to $500."

---

## 9. Bottom CTA

Title: "Start building for free"
Subtitle: "30 days of full access. No credit card needed."
Two buttons: "Start Free Trial" (primary, white) and "Explore Skills" (outline)

---

## 10. Do NOT change:
- The nav bar structure or routing
- The footer
- The font aliases (F for Erode, M for Fragment Mono)
- The overall black/white monochrome aesthetic
- CSS class names for hover states and transitions (cta-w, cta-o, faq-item, etc.)
- Any imports or component structure beyond the content and layout changes described above
