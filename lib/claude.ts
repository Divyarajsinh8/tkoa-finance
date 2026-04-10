import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function processInvoice(
  fileBuffer: Buffer,
  mimeType: string
): Promise<Record<string, unknown>> {
  const validMimeTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];

  if (!validMimeTypes.includes(mimeType)) {
    throw new Error(`Unsupported image type: ${mimeType}. PDF processing requires conversion first.`);
  }

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
              data: fileBuffer.toString("base64"),
            },
          },
          {
            type: "text",
            text: `Extract all financial details from this invoice. Return ONLY valid JSON with no markdown:
{
  "vendor_name": "",
  "vendor_gstin": "",
  "invoice_number": "",
  "invoice_date": "YYYY-MM-DD",
  "due_date": "YYYY-MM-DD or null",
  "line_items": [{"description": "", "quantity": 0, "rate": 0, "amount": 0}],
  "subtotal": 0,
  "gst_rate": 0,
  "gst_amount": 0,
  "total_amount": 0,
  "currency": "INR",
  "payment_terms": "",
  "suggested_category": ""
}`,
          },
        ],
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  return JSON.parse(text);
}

export async function askAIAdvisor(
  question: string,
  financialContext: Record<string, unknown>
): Promise<string> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1500,
    system: `You are the AI CFO for TKOA Private Limited, an e-commerce company selling digital products (n8n automation templates) via Shopify. You have access to their real financial data. Be specific with numbers. Give actionable advice. Always reference actual data points. Format currency in INR (₹). Use Indian number system (lakhs, crores). Current financial year: ${getCurrentFY()}.`,
    messages: [
      {
        role: "user",
        content: `Here is the current financial data for TKOA Pvt Ltd:\n${JSON.stringify(financialContext, null, 2)}\n\nQuestion: ${question}`,
      },
    ],
  });

  return response.content[0].type === "text" ? response.content[0].text : "";
}

export async function generateInsights(
  financialContext: Record<string, unknown>
): Promise<string[]> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    system: `You are the AI CFO for TKOA Private Limited. Generate 4-5 concise, actionable financial insights based on the data provided. Return ONLY a JSON array of strings, no markdown.`,
    messages: [
      {
        role: "user",
        content: `Financial data: ${JSON.stringify(financialContext, null, 2)}\n\nGenerate 4-5 key insights as a JSON array of strings.`,
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "[]";
  try {
    return JSON.parse(text);
  } catch {
    return ["Unable to generate insights at this time."];
  }
}

function getCurrentFY(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  if (month >= 3) return `FY ${year}-${(year + 1).toString().slice(2)}`;
  return `FY ${year - 1}-${year.toString().slice(2)}`;
}
