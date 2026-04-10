"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type SetupStep = "idle" | "scan" | "verify" | "done";
type DisableStep = "idle" | "confirm";

interface Props {
  isEnabled: boolean;
  isAdmin: boolean;
}

export function TwoFactorSetup({ isEnabled: initialEnabled, isAdmin }: Props) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [setupStep, setSetupStep] = useState<SetupStep>("idle");
  const [disableStep, setDisableStep] = useState<DisableStep>("idle");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [token, setToken] = useState("");
  const [disableToken, setDisableToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function startSetup() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/2fa/setup", { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Setup failed.");
      setLoading(false);
      return;
    }
    setQrCode(data.qrCode);
    setSecret(data.secret);
    setSetupStep("scan");
    setLoading(false);
  }

  async function verifyAndEnable() {
    if (token.replace(/\s/g, "").length !== 6) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/2fa/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, enableAfterVerify: true }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Verification failed.");
      setLoading(false);
      return;
    }
    setEnabled(true);
    setSetupStep("done");
    setLoading(false);
  }

  async function disable2FA() {
    if (disableToken.replace(/\s/g, "").length !== 6) {
      setError("Enter the 6-digit code to confirm.");
      return;
    }
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/2fa/enable", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: disableToken }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to disable 2FA.");
      setLoading(false);
      return;
    }
    setEnabled(false);
    setDisableStep("idle");
    setDisableToken("");
    setLoading(false);
  }

  if (!isAdmin) {
    return (
      <div className="card-base p-5">
        <h3 className="section-title mb-3">Two-Factor Authentication</h3>
        <p className="text-white/40 text-sm">2FA is only configurable by admins.</p>
      </div>
    );
  }

  return (
    <div className="card-base p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="section-title">Two-Factor Authentication</h3>
          <p className="text-white/40 text-sm mt-0.5">
            TOTP authenticator app (Google Authenticator, Authy, 1Password)
          </p>
        </div>
        <span className={cn(
          "text-[10px] font-semibold px-2.5 py-1 rounded-full",
          enabled
            ? "bg-green-500/10 text-green-400"
            : "bg-white/[0.05] text-white/30"
        )}>
          {enabled ? "Enabled" : "Disabled"}
        </span>
      </div>

      {error && (
        <div className="mb-4 px-3 py-2 rounded-lg text-sm bg-red-500/10 text-red-400 border border-red-500/20">
          {error}
        </div>
      )}

      {/* ── Disabled state ──────────────────────────── */}
      {!enabled && setupStep === "idle" && (
        <div>
          <p className="text-white/50 text-sm mb-4">
            Add an extra layer of security to your admin account. You&apos;ll need an authenticator app on your phone.
          </p>
          <button
            onClick={startSetup}
            disabled={loading}
            className="btn-primary py-2 px-4 text-sm disabled:opacity-50 cursor-pointer"
          >
            {loading ? "Starting…" : "Set Up 2FA"}
          </button>
        </div>
      )}

      {/* ── Step 1: Scan QR ─────────────────────────── */}
      {setupStep === "scan" && (
        <div className="space-y-4">
          <p className="text-white/60 text-sm">
            Scan this QR code with your authenticator app, then enter the 6-digit code to confirm.
          </p>

          <div className="flex flex-col sm:flex-row gap-6 items-start">
            {/* QR code */}
            <div className="bg-white p-3 rounded-xl shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrCode} alt="2FA QR Code" width={160} height={160} />
            </div>

            <div className="space-y-4 flex-1">
              {/* Manual entry secret */}
              <div>
                <p className="text-white/30 text-xs mb-1">Or enter manually:</p>
                <code className="text-white/60 text-xs font-mono bg-white/[0.04] px-3 py-2 rounded-lg block break-all select-all">
                  {secret}
                </code>
              </div>

              {/* Verification input */}
              <div>
                <label className="data-label block mb-1.5">6-digit code from app</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={7}
                  value={token}
                  onChange={e => setToken(e.target.value.replace(/[^0-9\s]/g, ""))}
                  placeholder="000 000"
                  className="input-base w-36 font-mono text-center text-lg tracking-widest"
                  onKeyDown={e => e.key === "Enter" && verifyAndEnable()}
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={verifyAndEnable}
                  disabled={loading || token.replace(/\s/g, "").length < 6}
                  className="btn-primary py-2 px-4 text-sm disabled:opacity-50 cursor-pointer"
                >
                  {loading ? "Verifying…" : "Verify & Enable"}
                </button>
                <button
                  onClick={() => { setSetupStep("idle"); setToken(""); setError(""); }}
                  className="btn-ghost py-2 px-4 text-sm cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 2: Success ─────────────────────────── */}
      {setupStep === "done" && (
        <div className="flex items-center gap-3 py-2">
          <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div>
            <p className="text-green-400 font-semibold text-sm">2FA enabled successfully</p>
            <p className="text-white/40 text-xs mt-0.5">You&apos;ll be prompted for a code at each login.</p>
          </div>
        </div>
      )}

      {/* ── Enabled — disable flow ──────────────────── */}
      {enabled && setupStep === "idle" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-green-400/70 text-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Your account is protected with 2FA
          </div>

          {disableStep === "idle" ? (
            <button
              onClick={() => { setDisableStep("confirm"); setError(""); }}
              className="btn-ghost py-1.5 px-3 text-xs text-red-400/70 hover:text-red-400 cursor-pointer border border-red-400/10 hover:border-red-400/30"
            >
              Disable 2FA
            </button>
          ) : (
            <div className="space-y-3 border border-red-500/20 rounded-xl p-4 bg-red-500/5">
              <p className="text-red-400/80 text-sm">Enter your current 2FA code to disable:</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={7}
                  value={disableToken}
                  onChange={e => setDisableToken(e.target.value.replace(/[^0-9\s]/g, ""))}
                  placeholder="000 000"
                  className="input-base w-32 font-mono text-center tracking-widest"
                />
                <button
                  onClick={disable2FA}
                  disabled={loading || disableToken.replace(/\s/g, "").length < 6}
                  className="btn-ghost py-1.5 px-3 text-xs text-red-400 border border-red-400/20 hover:bg-red-400/10 disabled:opacity-50 cursor-pointer"
                >
                  {loading ? "Disabling…" : "Confirm Disable"}
                </button>
                <button
                  onClick={() => { setDisableStep("idle"); setDisableToken(""); setError(""); }}
                  className="btn-ghost py-1.5 px-3 text-xs cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
