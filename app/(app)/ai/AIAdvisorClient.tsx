"use client";

import { useState } from "react";
import { formatINR } from "@/lib/utils";
import { cn } from "@/lib/utils";

const QUICK_QUESTIONS = [
  "What's my net profit margin this month?",
  "Which subscriptions should I consider cancelling?",
  "How much runway do I have at current burn?",
  "Give me a GST filing summary for this quarter",
  "What's my top expense category and how can I reduce it?",
  "Analyze my revenue trend and give growth suggestions",
];

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  financialContext: Record<string, unknown>;
}

export function AIAdvisorClient({ financialContext }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<string[]>([]);
  const [loadingInsights, setLoadingInsights] = useState(false);

  async function sendMessage(question?: string) {
    const q = question ?? input.trim();
    if (!q || loading) return;
    setInput("");

    const newMessages: Message[] = [...messages, { role: "user", content: q }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const res = await fetch("/api/ai/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, financialContext }),
      });

      const data = await res.json();
      setMessages([...newMessages, { role: "assistant", content: data.answer }]);
    } catch {
      setMessages([...newMessages, { role: "assistant", content: "Sorry, I encountered an error. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  async function generateInsights() {
    setLoadingInsights(true);
    try {
      const res = await fetch("/api/ai/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: "insights", financialContext }),
      });
      const data = await res.json();
      if (Array.isArray(data.insights)) setInsights(data.insights);
    } catch {
      setInsights(["Unable to generate insights at this time."]);
    } finally {
      setLoadingInsights(false);
    }
  }

  const ctx = financialContext as {
    revenue_paise: number;
    expenses_paise: number;
    net_profit_paise: number;
    net_margin_pct: string;
    monthly_sub_burn_paise: number;
    currentMonth: string;
    active_subscriptions: number;
  };

  return (
    <div className="max-w-4xl space-y-5">
      {/* Context summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Revenue", value: formatINR(ctx.revenue_paise, true) },
          { label: "Expenses", value: formatINR(ctx.expenses_paise, true) },
          { label: "Net Profit", value: formatINR(ctx.net_profit_paise, true) },
          { label: "Net Margin", value: `${ctx.net_margin_pct}%` },
        ].map(({ label, value }) => (
          <div key={label} className="card-base px-4 py-3">
            <p className="data-label mb-1">{label}</p>
            <p className="font-mono font-semibold text-white">{value}</p>
          </div>
        ))}
      </div>

      {/* Proactive Insights */}
      <div className="card-base p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[#DC3C3C]/20 flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#DC3C3C" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>
            <h3 className="section-title text-sm">Proactive Insights</h3>
          </div>
          <button
            onClick={generateInsights}
            disabled={loadingInsights}
            className="btn-ghost py-1 px-3 text-xs disabled:opacity-50"
          >
            {loadingInsights ? "Analyzing…" : "Generate"}
          </button>
        </div>

        {insights.length === 0 ? (
          <p className="text-white/25 text-sm text-center py-4">
            Click Generate to get AI-powered insights about your finances
          </p>
        ) : (
          <div className="space-y-2.5">
            {insights.map((insight, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                <div className="w-5 h-5 rounded-full bg-[#DC3C3C]/20 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[#DC3C3C] text-[10px] font-bold">{i + 1}</span>
                </div>
                <p className="text-white/75 text-sm leading-relaxed">{insight}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Chat Interface */}
      <div className="card-base flex flex-col" style={{ height: "480px" }}>
        <div className="p-4 border-b border-white/[0.06] flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="font-heading font-semibold text-white text-sm">AI CFO Chat</span>
          <span className="text-white/30 text-xs">· Powered by Claude</span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-xl bg-white/[0.04] flex items-center justify-center mb-3">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <p className="text-white/30 text-sm mb-4">Ask me anything about TKOA&apos;s finances</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {QUICK_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    className="text-xs text-white/40 bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.07] hover:text-white/70 px-3 py-1.5 rounded-full transition-all duration-150 cursor-pointer text-left"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                {msg.role === "assistant" && (
                  <div className="w-7 h-7 rounded-full bg-[#DC3C3C]/20 flex items-center justify-center shrink-0 mr-2 mt-0.5">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#DC3C3C" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                    </svg>
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[80%] rounded-xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
                    msg.role === "user"
                      ? "bg-[#DC3C3C]/20 text-white/90 rounded-tr-sm"
                      : "bg-white/[0.05] text-white/85 rounded-tl-sm"
                  )}
                >
                  {msg.content}
                </div>
              </div>
            ))
          )}
          {loading && (
            <div className="flex justify-start">
              <div className="w-7 h-7 rounded-full bg-[#DC3C3C]/20 flex items-center justify-center shrink-0 mr-2">
                <div className="w-3 h-3 rounded-full border-2 border-[#DC3C3C]/50 border-t-[#DC3C3C] animate-spin" />
              </div>
              <div className="bg-white/[0.05] rounded-xl rounded-tl-sm px-4 py-2.5">
                <div className="flex gap-1.5 items-center h-5">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-4 border-t border-white/[0.06]">
          <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about revenue, expenses, GST, subscriptions…"
              disabled={loading}
              className="input-base flex-1 text-sm disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="btn-primary px-4 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
