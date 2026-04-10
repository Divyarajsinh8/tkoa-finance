export type UserRole = "admin" | "manager" | "viewer";

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export type TransactionType = "income" | "expense";
export type TransactionStatus = "paid" | "received" | "pending" | "overdue" | "cancelled";
export type PaymentMethod = "credit_card" | "bank_transfer" | "upi" | "paypal" | "shopify_payments" | "cash";
export type RecurringFrequency = "weekly" | "monthly" | "quarterly" | "yearly";

export interface Transaction {
  id: string;
  txn_id: string;
  type: TransactionType;
  category: string;
  sub_category?: string;
  vendor: string;
  description?: string;
  amount: number; // in paise
  gst_amount: number;
  gst_rate?: number;
  date: string;
  status: TransactionStatus;
  payment_method?: PaymentMethod;
  is_recurring: boolean;
  recurring_frequency?: RecurringFrequency;
  invoice_id?: string;
  notes?: string;
  tags?: string[];
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export type InvoiceType = "payable" | "receivable";
export type InvoiceStatus = "draft" | "pending" | "paid" | "overdue" | "cancelled";

export interface Invoice {
  id: string;
  invoice_number: string;
  type: InvoiceType;
  vendor: string;
  vendor_gstin?: string;
  amount: number; // in paise
  gst_amount: number;
  date: string;
  due_date?: string;
  status: InvoiceStatus;
  file_path?: string;
  drive_file_id?: string;
  drive_url?: string;
  ai_extracted_data?: InvoiceAIData;
  category?: string;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface InvoiceAIData {
  vendor_name: string;
  vendor_gstin?: string;
  invoice_number: string;
  invoice_date: string;
  due_date?: string;
  line_items: {
    description: string;
    quantity: number;
    rate: number;
    amount: number;
  }[];
  subtotal: number;
  gst_rate: number;
  gst_amount: number;
  total_amount: number;
  currency: string;
  payment_terms?: string;
  suggested_category?: string;
}

export type BillingCycle = "monthly" | "quarterly" | "yearly";
export type SubscriptionStatus = "active" | "paused" | "cancelled" | "free";

export interface Subscription {
  id: string;
  name: string;
  plan?: string;
  cost: number; // in paise
  billing_cycle: BillingCycle;
  next_due_date?: string;
  status: SubscriptionStatus;
  usage_notes?: string;
  category?: string;
  auto_renew: boolean;
  vendor_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Budget {
  id: string;
  category: string;
  month: string; // first of month
  budgeted_amount: number; // in paise
  notes?: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id?: string;
  action: "create" | "update" | "delete";
  entity_type: "transaction" | "invoice" | "subscription" | "budget";
  entity_id?: string;
  old_data?: Record<string, unknown>;
  new_data?: Record<string, unknown>;
  created_at: string;
  user?: User;
}

export interface FinancialMetrics {
  revenue: number;
  expenses: number;
  netProfit: number;
  netMargin: number;
  grossProfit: number;
  grossMargin: number;
  totalOrders: number;
  cac: number;
  ltv: number;
  ltvCacRatio: number;
  cashRunway: number; // months
  accountsPayable: number;
  accountsReceivable: number;
  gstPayable: number;
}

export interface ChartDataPoint {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
}

export interface CategoryBreakdown {
  category: string;
  amount: number;
  percentage: number;
}

// Permission types
export interface Permissions {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canManageUsers: boolean;
  canManageSubscriptions: boolean;
  canSetBudgets: boolean;
  canExport: boolean;
  canViewAuditLog: boolean;
  canUseAI: boolean;
  canBundleInvoices: boolean;
  canGSTFiling: boolean;
}
