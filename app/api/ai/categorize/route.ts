import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const CATEGORIES = [
  "Marketing & Ads",
  "Software & SaaS",
  "Infrastructure",
  "Contractor / Freelancer",
  "E-commerce Fees",
  "Payment Gateway Fees",
  "Tax & Compliance",
  "Office & Admin",
  "Travel & Entertainment",
  "Salary",
  "Shopify Sales",
  "Other Income",
  "Refund",
  "Transfer",
  "Unknown",
];

async function getCategoryRules() {
  const { data } = await supabase
    .from("ai_category_rules")
    .select("vendor_pattern, category, sub_category")
    .order("confidence", { ascending: false })
    .limit(100);
  return data || [];
}

function matchRule(description: string, rules: { vendor_pattern: string; category: string; sub_category?: string }[]) {
  const desc = description.toLowerCase();
  for (const rule of rules) {
    try {
      const pattern = new RegExp(rule.vendor_pattern, "i");
      if (pattern.test(desc)) return rule;
    } catch {
      if (desc.includes(rule.vendor_pattern.toLowerCase())) return rule;
    }
  }
  return null;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { transaction_id, description, amount, source } = body;

  // If categorizing a specific transaction
  if (transaction_id && description) {
    const rules = await getCategoryRules();
    const matched = matchRule(description, rules);

    if (matched) {
      // Update with rule-based category
      await supabase
        .from("transactions")
        .update({ category: matched.category, sub_category: matched.sub_category || null })
        .eq("id", transaction_id);

      await supabase
        .from("ai_category_rules")
        .update({ times_used: supabase.rpc("increment", { row_id: matched.vendor_pattern }), last_used: new Date().toISOString() })
        .eq("vendor_pattern", matched.vendor_pattern);

      return NextResponse.json({ category: matched.category, source: "rule", confidence: 0.95 });
    }

    // Fall back to Claude
    const prompt = `Categorize this financial transaction for an Indian e-commerce company (TKOA — sells Shopify automation templates and courses).

Description: "${description}"
Amount: ₹${(amount / 100).toFixed(2)}

Available categories: ${CATEGORIES.join(", ")}

Respond with ONLY a JSON object: {"category": "...", "sub_category": "...", "confidence": 0.0-1.0, "vendor_pattern": "regex_or_keyword_to_match_similar_transactions"}

Examples:
- "META PLATFORMS" → {"category": "Marketing & Ads", "sub_category": "Meta Ads", "confidence": 0.99, "vendor_pattern": "meta platforms|facebook"}
- "VERCEL INC" → {"category": "Infrastructure", "sub_category": "Vercel", "confidence": 0.99, "vendor_pattern": "vercel"}
- "MANAN" → {"category": "Contractor / Freelancer", "sub_category": "Developer", "confidence": 0.9, "vendor_pattern": "manan"}`;

    const response = await claude.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 150,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "{}";
    const parsed = JSON.parse(text.match(/\{[^}]+\}/)?.[0] || "{}");

    if (parsed.category) {
      await supabase
        .from("transactions")
        .update({ category: parsed.category, sub_category: parsed.sub_category || null })
        .eq("id", transaction_id);

      // Save as a new rule if high confidence
      if (parsed.confidence >= 0.85 && parsed.vendor_pattern) {
        await supabase
          .from("ai_category_rules")
          .upsert({
            vendor_pattern: parsed.vendor_pattern,
            category: parsed.category,
            sub_category: parsed.sub_category || null,
            confidence: parsed.confidence,
            times_used: 1,
            last_used: new Date().toISOString(),
          }, { onConflict: "vendor_pattern" });
      }
    }

    return NextResponse.json({ ...parsed, source: "ai" });
  }

  // Batch mode: categorize all uncategorized bank transactions
  if (source === "bank_import") {
    const { data: uncategorized } = await supabase
      .from("bank_transactions")
      .select("id, description, debit_amount, credit_amount")
      .eq("auto_category", null)
      .limit(50);

    if (!uncategorized || uncategorized.length === 0) {
      return NextResponse.json({ message: "No uncategorized transactions" });
    }

    const rules = await getCategoryRules();
    let categorized = 0;

    for (const txn of uncategorized) {
      const matched = matchRule(txn.description || "", rules);
      if (matched) {
        await supabase
          .from("bank_transactions")
          .update({ auto_category: matched.category })
          .eq("id", txn.id);
        categorized++;
      }
    }

    return NextResponse.json({ categorized, total: uncategorized.length });
  }

  return NextResponse.json({ error: "Invalid request" }, { status: 400 });
}
