"use client";

import { useState } from "react";
import { Transaction } from "@/types";
import { rupeesToPaise } from "@/lib/utils";

interface Props {
  transaction?: Transaction | null;
  onSave: (txn: Partial<Transaction>) => void;
  onClose: () => void;
  categories: string[];
}

export function TransactionForm({ transaction, onSave, onClose, categories }: Props) {
  const isEdit = !!transaction;

  const [form, setForm] = useState({
    type: transaction?.type ?? "expense",
    category: transaction?.category ?? categories[0],
    vendor: transaction?.vendor ?? "",
    description: transaction?.description ?? "",
    amount: transaction ? (transaction.amount / 100).toString() : "",
    gst_rate: transaction?.gst_rate?.toString() ?? "18",
    date: transaction?.date ?? new Date().toISOString().split("T")[0],
    status: transaction?.status ?? "paid",
    payment_method: transaction?.payment_method ?? "bank_transfer",
    is_recurring: transaction?.is_recurring ?? false,
    recurring_frequency: transaction?.recurring_frequency ?? "monthly",
    notes: transaction?.notes ?? "",
  });

  function handleChange(key: string, val: string | boolean) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amountRupees = parseFloat(form.amount);
    const gstRate = parseFloat(form.gst_rate) || 0;
    const amountPaise = rupeesToPaise(amountRupees);
    const gstPaise = rupeesToPaise((amountRupees * gstRate) / 100);

    onSave({
      type: form.type as Transaction["type"],
      category: form.category,
      vendor: form.vendor,
      description: form.description || undefined,
      amount: amountPaise,
      gst_amount: gstPaise,
      gst_rate: gstRate,
      date: form.date,
      status: form.status as Transaction["status"],
      payment_method: form.payment_method as Transaction["payment_method"],
      is_recurring: form.is_recurring,
      recurring_frequency: form.is_recurring ? form.recurring_frequency as Transaction["recurring_frequency"] : undefined,
      notes: form.notes || undefined,
    });
  }

  const inputCls = "input-base w-full text-sm";
  const labelCls = "data-label block mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="card-base w-full max-w-lg max-h-[90vh] overflow-y-auto animate-slide-up">
        <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
          <h2 className="font-heading font-semibold text-white">{isEdit ? "Edit Transaction" : "New Transaction"}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/[0.05] transition-all cursor-pointer">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Type */}
          <div>
            <label className={labelCls}>Type</label>
            <div className="flex bg-white/[0.04] rounded-lg p-0.5 gap-0.5">
              {(["expense", "income"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleChange("type", t)}
                  className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all cursor-pointer capitalize ${
                    form.type === t ? "bg-white/[0.1] text-white" : "text-white/40 hover:text-white/60"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Vendor */}
            <div className="col-span-2">
              <label className={labelCls}>Vendor / Party</label>
              <input required value={form.vendor} onChange={(e) => handleChange("vendor", e.target.value)} placeholder="e.g. Google Ads" className={inputCls} />
            </div>

            {/* Category */}
            <div>
              <label className={labelCls}>Category</label>
              <select value={form.category} onChange={(e) => handleChange("category", e.target.value)} className={`${inputCls} bg-[#111116] cursor-pointer`}>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Date */}
            <div>
              <label className={labelCls}>Date</label>
              <input required type="date" value={form.date} onChange={(e) => handleChange("date", e.target.value)} className={inputCls} />
            </div>

            {/* Amount */}
            <div>
              <label className={labelCls}>Amount (₹)</label>
              <input required type="number" min="0" step="0.01" value={form.amount} onChange={(e) => handleChange("amount", e.target.value)} placeholder="0.00" className={inputCls} />
            </div>

            {/* GST Rate */}
            <div>
              <label className={labelCls}>GST Rate (%)</label>
              <select value={form.gst_rate} onChange={(e) => handleChange("gst_rate", e.target.value)} className={`${inputCls} bg-[#111116] cursor-pointer`}>
                {["0", "5", "12", "18", "28"].map((r) => <option key={r} value={r}>{r}%</option>)}
              </select>
            </div>

            {/* Status */}
            <div>
              <label className={labelCls}>Status</label>
              <select value={form.status} onChange={(e) => handleChange("status", e.target.value)} className={`${inputCls} bg-[#111116] cursor-pointer`}>
                <option value="paid">Paid</option>
                <option value="received">Received</option>
                <option value="pending">Pending</option>
                <option value="overdue">Overdue</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            {/* Payment Method */}
            <div>
              <label className={labelCls}>Payment Method</label>
              <select value={form.payment_method} onChange={(e) => handleChange("payment_method", e.target.value)} className={`${inputCls} bg-[#111116] cursor-pointer`}>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="upi">UPI</option>
                <option value="credit_card">Credit Card</option>
                <option value="paypal">PayPal</option>
                <option value="shopify_payments">Shopify Payments</option>
                <option value="cash">Cash</option>
              </select>
            </div>

            {/* Description */}
            <div className="col-span-2">
              <label className={labelCls}>Description (optional)</label>
              <input value={form.description} onChange={(e) => handleChange("description", e.target.value)} placeholder="Brief note…" className={inputCls} />
            </div>

            {/* Recurring */}
            <div className="col-span-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_recurring}
                  onChange={(e) => handleChange("is_recurring", e.target.checked)}
                  className="w-4 h-4 rounded accent-[#DC3C3C] cursor-pointer"
                />
                <span className="text-sm text-white/60">Recurring transaction</span>
              </label>
              {form.is_recurring && (
                <select
                  value={form.recurring_frequency}
                  onChange={(e) => handleChange("recurring_frequency", e.target.value)}
                  className={`${inputCls} bg-[#111116] cursor-pointer mt-2`}
                >
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                </select>
              )}
            </div>
          </div>

          {/* GST preview */}
          {parseFloat(form.amount) > 0 && parseFloat(form.gst_rate) > 0 && (
            <div className="bg-white/[0.03] rounded-lg px-3 py-2 text-xs font-mono text-white/40">
              GST ({form.gst_rate}%) = ₹{((parseFloat(form.amount) * parseFloat(form.gst_rate)) / 100).toFixed(2)} &nbsp;·&nbsp;
              Total = ₹{(parseFloat(form.amount) * (1 + parseFloat(form.gst_rate) / 100)).toFixed(2)}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost flex-1 justify-center">Cancel</button>
            <button type="submit" className="btn-primary flex-1 justify-center">{isEdit ? "Save Changes" : "Add Transaction"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
