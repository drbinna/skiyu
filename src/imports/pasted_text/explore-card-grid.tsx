# Figma Make Prompt — /skiyu Explore Page: Card Grid Layout with Category Colors

Rebuild the skill display on the explore page (`src/app/components/explore.tsx`) from a dense table layout to a card grid layout. Keep the same nav, sidebar, search bar, category filters, and overall page structure. Only change how skills are rendered in the results area.

---

## 1. Category color map

Add a color mapping object that maps each category ID to a hex color. Use this consistently for card top stripes and category filter pills:

```
documents  → #f59e0b  (amber)
code       → #6366f1  (indigo)
data       → #10b981  (emerald)
devops     → #8b5cf6  (violet)
research   → #a8a29e  (stone)
creative   → #fb923c  (orange)
legal      → #ec4899  (pink)
finance    → #f43f5e  (rose)
testing    → #22d3ee  (cyan)
api        → #0ea5e9  (sky)
docs       → #f59e0b  (amber, same as documents)
```

---

## 2. Replace the table layout with a card grid

Remove the column headers row (the grid with "Skill", "Installs", "Rating", "Price", "Size", "Updated" labels). Remove the table-style row rendering for each skill.

Replace with a responsive card grid:

```
display: grid
grid-template-columns: repeat(3, 1fr)
gap: 12px (or 1px with rgba(255,255,255,0.06) background for the hairline-grid look — match whichever fits the current aesthetic better)
padding: 16px 24px
```

---

## 3. Card design

Each skill renders as a card with this structure:

```
┌─ 2px top border in category color ──────────────┐
│                                                   │
│  Skill Name                          Price badge  │
│  @author · v2.4.1                                 │
│                                                   │
│  One-line description text that can wrap to       │
│  two lines maximum with overflow ellipsis...      │
│                                                   │
│  ─────────────────────────────────────────────    │
│  ★ 4.9 · ↓ 12.4K          category tag    updated│
│                                                   │
└───────────────────────────────────────────────────┘
```

Specific styling:

**Card container:**
- background: #000 (or rgba(255,255,255,0.02) for subtle lift)
- border: 1px solid rgba(255,255,255,0.06)
- border-top: 2px solid {category color}
- border-radius: 10px
- padding: 20px
- cursor: pointer
- transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1)
- on hover: translateY(-3px), background rgba(255,255,255,0.04), border-color rgba(255,255,255,0.12), box-shadow 0 8px 32px rgba(0,0,0,0.3)
- overflow: hidden
- min-height: ~160px, use flexbox column with space-between so footer stays at bottom

**Top section:**
- Skill name: fontSize 15px, fontWeight 700, fontFamily F (Erode), color #fff, letterSpacing "-0.01em"
- Price badge: positioned top-right of the card, fontSize 11px, fontFamily M (Fragment Mono), fontWeight 600, padding "3px 10px", borderRadius 100
  - If Free: border 1px solid rgba(255,255,255,0.08), color rgba(255,255,255,0.3), no background
  - If paid: border 1px solid rgba(255,255,255,0.15), color #fff, no background
- Use flexbox row with space-between for name + price alignment

**Author + version line:**
- fontSize 11px, fontFamily M, color rgba(255,255,255,0.2)
- Format: "@author · v2.4.1"
- marginTop: 4px

**Description:**
- fontSize 13px, fontFamily F, color rgba(255,255,255,0.35), lineHeight 1.5
- marginTop: 12px
- overflow: hidden, display: -webkit-box, -webkit-line-clamp: 2, -webkit-box-orient: vertical (truncate to 2 lines)

**Footer (bottom of card):**
- borderTop: 1px solid rgba(255,255,255,0.04)
- paddingTop: 12px, marginTop: 16px (or use flex spacer to push to bottom)
- display: flex, justify-content: space-between, align-items: center
- Left side: "★ {rating} · ↓ {installs}" in fontSize 12px, fontFamily M, color rgba(255,255,255,0.25)
- Right side: category tag pill
  - fontSize 10px, fontFamily M, letterSpacing "0.04em", textTransform uppercase
  - padding "2px 8px", borderRadius 4px
  - background: {category color} at 12% opacity (e.g. rgba(99,102,241,0.12) for code)
  - color: {category color} at full or ~70% brightness
  - Optionally also show "updated" time if space allows, in rgba(255,255,255,0.12)

---

## 4. Update sidebar category filter pills to use colors

In the sidebar where category filter buttons are listed, add a small 6px colored dot before each category label (except "All"). The dot color matches the category color map. This creates visual consistency between the filter and the card stripes.

```
● Documents     (amber dot)
● Code          (indigo dot)
● Data          (emerald dot)
```

The "All" filter has no dot.

When a category is active/selected, the filter button's border should use the category color at ~40% opacity instead of white. The text stays white when active.

---

## 5. Empty state

When no skills match filters/search, show the same empty state as before (the "/" slash with "No skills match your filters" message). No changes needed.

---

## 6. Responsiveness

The grid should be:
- 3 columns at full width (>800px content area)
- 2 columns at medium width (500–800px)
- 1 column at narrow width (<500px)

Use CSS grid with minmax or media queries, whichever fits the current component pattern.

---

## 7. Keep the hover interaction from the current design

The current table rows have a subtle hover effect. Cards should have a more pronounced hover:
- translateY(-3px)
- border-color brightens to rgba(255,255,255,0.12)
- the top color stripe stays at full opacity
- subtle box-shadow appears: 0 8px 32px rgba(0,0,0,0.3)
- transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1)

Add a CSS class for the card (e.g. `.skill-card-grid`) and define the hover in the `<style>` block.

---

## 8. Do NOT change:
- The nav bar (should now show Explore, Publish, Docs — no Pricing)
- The sidebar structure (categories, price filters, license filters, collapse toggle)
- The search bar and sort dropdown
- The active filter chips below the search bar
- The result count display
- The "Browse All Skills →" button at the bottom
- The footer
- The font aliases (F for Erode, M for Fragment Mono)
- The SKILLS_DB data array — keep all existing skill objects, just render them differently
- Any imports or state management logic

Only change the rendering of skill results from table rows to card grid, add the category color map, and update sidebar filter pills with colored dots.