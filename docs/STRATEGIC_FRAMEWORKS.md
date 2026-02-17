# SignalForge — Strategic Evaluation Frameworks

## Philosophy

A high pain score means nothing if you can't defend the business. SignalForge evaluates every opportunity through three lenses:

1. **Can I win?** (Competitive Guidelines)
2. **Can I keep winning?** (Moat Analysis)
3. **Does the business compound?** (Feedback Loops)

---

## The 3 Moats

Every opportunity must have at least ONE defensible moat before you invest time building.

### Moat 1: Counter-Positioning

Attack the competitor's core business model, not their features. If the incumbent copies you, it should hurt their existing business.

**Example:** Netflix vs Blockbuster. Blockbuster couldn't match Netflix's subscription model without destroying their late-fee revenue.

**Detection signals in data:**
- Competitor complaints about pricing ("too expensive", "per-seat is ridiculous")
- Legacy architecture complaints ("no API", "outdated interface")
- Business model conflicts (competitor profits from the inefficiency you're solving)

### Moat 2: Sticky Habits / High Switching Cost

Make leaving your product painful. After 90 days of use, users should have stored data, built workflows, and formed habits that are expensive to recreate elsewhere.

**Example:** Google, ChatGPT, Notion — the more you use them, the more you lose by leaving.

**Detection signals in data:**
- Product stores user data (records, history, configurations)
- Product integrates into existing workflows
- Product is used daily (habit formation)
- Product involves team adoption (social switching cost)

### Moat 3: Proprietary Data & Learning Loops

Every user interaction should make the product smarter. This creates a compounding advantage that competitors can never catch up to.

**Example:** Cursor tracks user keystrokes and ships improvements based on real coding behavior. Tesla uses driving data to improve autopilot. Amazon uses purchase data to improve recommendations.

**Key question:** Is there ANY proprietary data I can access? Through partnerships? Through user behavior? Through exclusive integrations?

**Detection signals in data:**
- Product can learn from usage patterns
- Product enables benchmarking against aggregated data
- Network effects possible (more users = better for everyone)
- Partnership opportunities for exclusive data access

---

## The 4 Feedback Loops

### Loop 1: Balance Loop

Your asymmetric advantage must align with acute customer pain. If you don't have an edge, someone smarter will outexecute you.

**Questions to ask:**
- What do I know about this problem that others don't?
- Is the pain urgent, frequent, and intense enough that people will pay?
- Am I chasing pain without an advantage (commodity) or advantage without pain (clever but useless)?

### Loop 2: Speed to Revenue Loop

The faster you ship, the faster you learn, the faster you compound. Target: MVP in <30 days, first paying customer in <60 days.

**Questions to ask:**
- What is the smallest version users will actually pay for?
- Can I ship a "manual behind the scenes" version while I build automation?
- Am I over-engineering the MVP?

### Loop 3: Signal to Innovation Loop

User behavior is your R&D lab. Build tracking and feedback mechanisms into the product from Day 1. YouTube won because of signal loops. Quibi died because they ignored them.

**Questions to ask:**
- Where are my signals coming from?
- How often do I review them?
- Does my product get smarter the more it's used?

### Loop 4: Sweat Equity Loop

No framework can replace founder obsession. If you wouldn't use this product yourself, if you can't see yourself grinding on it for 18 months, kill the idea regardless of the score.

---

## The 3 Competitive Guidelines

### Guideline 1: Proven Model Required

Pick an idea that has been done before. At least one competitor must be generating revenue. We don't pioneer markets — we improve them.

### Guideline 2: Max 4 Competitors

If there are 5+ established competitors, the market is saturated. Find a niche within the market or move on entirely.

### Guideline 3: MVP from Competitor Intelligence

Your MVP feature set comes from what competitor users complain about most. Build THEIR users' wish list, not your own feature fantasies.

---

## How These Integrate into Scoring

After the base 5-dimension score (Pain, Velocity, WTP, Competition, Feasibility), every Tier A/B opportunity runs through the strategic evaluation:

```
Base Score (0-100)
    ↓
+ Moat modifier (-3 to +7)
+ Loop modifier (-3 to +7)
+ Guideline modifier (0 or -10)
    ↓
= Adjusted Score
```

An opportunity scoring 85/100 on pain but with zero moats and 6 competitors gets adjusted down to ~65 and reclassified as "INVESTIGATE" instead of "GO."

---

## Strategic Verdicts

| Verdict | Adjusted Score | Moats | Guidelines | Action |
|---------|---------------|-------|------------|--------|
| **GO** | ≥75 | ≥1 | Pass | Begin validation immediately |
| **INVESTIGATE** | ≥60 | Any | Pass | Promising, but needs work on moats |
| **WATCH** | ≥50 | Any | Any | Monitor for signal changes |
| **KILL** | <50 | 0 | Fail | Archive and move on |

---

## Using the Frameworks

### In the Scorer Agent

```javascript
import { evaluateOpportunity } from '../lib/frameworks.js';

const result = evaluateOpportunity(opportunity, {
  advantages: ['10 years in agency billing', 'Built 3 Harvest integrations']
});

console.log(result.strategic_verdict);
// "INVESTIGATE — Promising but needs stronger moats..."

console.log(result.action_items);
// ["Cut scope to 30-day MVP", "Engineer data collection from Day 1", ...]
```

### In the Dossier Agent

Include the strategic evaluation in the opportunity dossier:

```markdown
## Strategic Assessment

**Verdict:** INVESTIGATE

### Moat Analysis
- Counter-Positioning: 6/10 — InvoiceX locked into legacy architecture
- Sticky Habits: 7/10 — Data storage + workflow integration
- Proprietary Data: 4/10 — Limited, but benchmarking potential

### Competitive Guidelines
- ✓ Proven Model — $80K-$160K MRR across 2 competitors
- ✓ Max Competitors — 2 real competitors
- ✓ MVP from Complaints — Clear feature list from G2 reviews

### Action Items
1. Reduce MVP scope to 30 days
2. Add usage analytics from Day 1
3. Define founder advantage for this space
```

---

## Red Flags to Kill Immediately

1. **Zero moats** — If you can't identify any defensibility, kill it
2. **5+ established competitors** — Market is saturated
3. **No revenue-generating competitor** — Unproven market, too risky
4. **MVP >90 days** — Too slow, you'll be outpaced
5. **WTP ratio <5%** — Nobody wants to pay for this
6. **Sweat equity fail** — You wouldn't use it yourself

---

## Philosophy: Why These Frameworks Matter

Most indie hackers fail not because they picked the wrong problem, but because they built something that was:

1. **Easy to copy** (no moats)
2. **Easy to leave** (no switching cost)
3. **Static** (no learning loops)

SignalForge exists to catch these failure modes BEFORE you invest 6 months building something that will become a commodity.

The pain score gets you excited. The strategic evaluation keeps you from wasting your life on the wrong opportunity.
