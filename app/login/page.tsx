"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"password" | "magic">("password");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [magicSent, setMagicSent] = useState(false);

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    });

    if (error) {
      setError(error.message);
    } else {
      setMagicSent(true);
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-[#060608] flex items-center justify-center p-4">
      {/* Background glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
      >
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-[#DC3C3C]/5 rounded-full blur-[120px]" />
      </div>

      <div className="w-full max-w-sm relative animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-6">
            <div className="w-9 h-9 rounded-lg bg-[#DC3C3C] flex items-center justify-center shadow-red">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </div>
            <span className="font-heading text-xl font-bold text-white">TKOA Finance</span>
          </div>
          <p className="text-white/40 text-sm">Internal Command Center</p>
        </div>

        {/* Card */}
        <div className="card-base p-6">
          {magicSent ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-green-400/10 flex items-center justify-center mx-auto mb-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              </div>
              <h3 className="font-heading font-semibold text-white mb-1">Check your email</h3>
              <p className="text-white/50 text-sm">We sent a magic link to <strong className="text-white/70">{email}</strong></p>
              <button
                onClick={() => setMagicSent(false)}
                className="mt-4 text-sm text-[#DC3C3C] hover:text-[#DC3C3C]/80 cursor-pointer transition-colors"
              >
                Try again
              </button>
            </div>
          ) : (
            <>
              {/* Mode tabs */}
              <div className="flex bg-white/[0.04] rounded-lg p-0.5 mb-5">
                {(["password", "magic"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all duration-150 cursor-pointer ${
                      mode === m
                        ? "bg-white/[0.08] text-white shadow-sm"
                        : "text-white/40 hover:text-white/60"
                    }`}
                  >
                    {m === "password" ? "Password" : "Magic Link"}
                  </button>
                ))}
              </div>

              <form onSubmit={mode === "password" ? handlePasswordLogin : handleMagicLink} className="space-y-4">
                <div>
                  <label htmlFor="email" className="data-label block mb-1.5">Email</label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@tkoa.in"
                    required
                    className="input-base w-full"
                  />
                </div>

                {mode === "password" && (
                  <div>
                    <label htmlFor="password" className="data-label block mb-1.5">Password</label>
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="input-base w-full"
                    />
                  </div>
                )}

                {error && (
                  <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full justify-center py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      {mode === "password" ? "Signing in…" : "Sending link…"}
                    </span>
                  ) : mode === "password" ? "Sign In" : "Send Magic Link"}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-white/20 text-xs mt-6">
          TKOA Private Limited · Internal Tool
        </p>
      </div>
    </div>
  );
}
