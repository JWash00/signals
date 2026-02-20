// ── Pass Rules ─────────────────────────────────────────────────
// Plain-English keyword filters that decide whether an approved
// New Find contains a real signal worth turning into a Big Idea.
// If NO rule matches → the signal is blocked from moving forward.

export type PassRule = {
  id: string;
  title: string;
  description: string;
  examples: string[];
  patterns: RegExp[];
};

export const PASS_RULES: PassRule[] = [
  {
    id: "tool_ask",
    title: "Asks for a tool/app",
    description: "They are asking for a tool, app, software, or service.",
    examples: [
      "Is there an app that…",
      "Does anyone have a tool for…",
      "What software do you use for…",
    ],
    patterns: [
      /\bis there (an|a) (app|tool|software|service)\b/i,
      /\bdoes anyone (have|use) (an|a) (app|tool|software|service)\b/i,
      /\bwhat (app|tool|software|service) do you use\b/i,
      /\brecommend (an|a) (app|tool|software)\b/i,
    ],
  },
  {
    id: "wish_exists",
    title: "Wishes something existed",
    description: "They say they wish something existed to solve it.",
    examples: ["I wish there was something that…", "Someone should build…"],
    patterns: [
      /\bi wish there was\b/i,
      /\bsomeone should build\b/i,
      /\bneed (an|a) (app|tool|software)\b/i,
    ],
  },
  {
    id: "willing_to_pay",
    title: "Mentions paying / pricing",
    description:
      "They mention paying money, pricing, subscriptions, or budget.",
    examples: [
      "I'd pay for this",
      "What's the pricing?",
      "Subscription is fine",
    ],
    patterns: [
      /\bi('?d| would) pay\b/i,
      /\bworth it\b/i,
      /\bsubscription\b/i,
      /\bpricing\b/i,
      /\bprice\b/i,
      /\bbudget\b/i,
      /\bcost\b/i,
    ],
  },
  {
    id: "workflow_pain",
    title: "Complains about a repeating workflow",
    description: "They describe a repeated annoying process (time sink).",
    examples: [
      "Every time I…",
      "I keep having to…",
      "This takes forever",
    ],
    patterns: [
      /\bevery time i\b/i,
      /\bi keep having to\b/i,
      /\btakes forever\b/i,
      /\bso time consuming\b/i,
      /\bmanual(ly)?\b/i,
    ],
  },
  {
    id: "comparison_switch",
    title: "Compares tools or switching",
    description: "They compare options, switching, or alternatives.",
    examples: [
      "Better than X",
      "Switched from X to Y",
      "Instead of doing X…",
    ],
    patterns: [
      /\bbetter than\b/i,
      /\bswitched from\b/i,
      /\binstead of\b/i,
      /\balternative to\b/i,
    ],
  },
];

export function evaluatePassRules(input: {
  title?: string | null;
  content?: string | null;
}): {
  passed: boolean;
  matchedRuleIds: string[];
  matchedTitles: string[];
  why: string;
} {
  const text = [input.title ?? "", input.content ?? ""].join(" ").trim();

  if (!text) {
    return {
      passed: false,
      matchedRuleIds: [],
      matchedTitles: [],
      why: "No text to check",
    };
  }

  const matchedRuleIds: string[] = [];
  const matchedTitles: string[] = [];

  for (const rule of PASS_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(text)) {
        matchedRuleIds.push(rule.id);
        matchedTitles.push(rule.title);
        break; // one match per rule is enough
      }
    }
  }

  const passed = matchedRuleIds.length > 0;

  return {
    passed,
    matchedRuleIds,
    matchedTitles,
    why: passed
      ? matchedTitles.join(" + ")
      : "Did not match any pass rule",
  };
}
