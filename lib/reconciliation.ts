/**
 * Bank Reconciliation Matching Engine
 *
 * Matches bank_transactions against the system transactions table.
 * Uses a weighted scoring system. Auto-matches at score >= 65.
 */

export interface BankTxnInput {
  id: string;
  transaction_date: string;
  description: string;
  debit_amount: number;
  credit_amount: number;
}

export interface SystemTxnInput {
  id: string;
  date: string;
  amount: number;
  type: string; // "income" | "expense"
  vendor: string;
  description?: string;
  category: string;
}

export interface MatchResult {
  bankTxnId: string;
  systemTxnId: string;
  score: number;
  autoMatch: boolean;
}

const AUTO_MATCH_THRESHOLD = 65;
const SUGGEST_THRESHOLD = 30;

function dateDiffDays(a: string, b: string): number {
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  return Math.abs((da - db) / (1000 * 60 * 60 * 24));
}

function keywordOverlap(desc: string, vendor: string, sysDesc?: string): number {
  const haystack = `${vendor} ${sysDesc ?? ""}`.toLowerCase();
  const words = desc.toLowerCase().split(/\W+/).filter(w => w.length > 3);
  if (words.length === 0) return 0;
  const hits = words.filter(w => haystack.includes(w)).length;
  return Math.round((hits / words.length) * 20);
}

export function scoreMatch(
  bank: BankTxnInput,
  sys: SystemTxnInput
): number {
  let score = 0;

  // Determine bank side: debit = expense, credit = income
  const bankAmount = bank.debit_amount > 0 ? bank.debit_amount : bank.credit_amount;
  const bankType = bank.debit_amount > 0 ? "expense" : "income";

  // Type must match
  if (sys.type !== bankType) return 0;

  // Amount scoring
  const amountDiff = Math.abs(bankAmount - sys.amount);
  const amountPct = bankAmount > 0 ? amountDiff / bankAmount : 1;

  if (amountPct === 0) score += 50;
  else if (amountPct < 0.005) score += 40; // within 0.5%
  else if (amountPct < 0.02) score += 20;  // within 2%
  else return 0; // too far off — not a match

  // Date scoring
  const dayDiff = dateDiffDays(bank.transaction_date, sys.date);
  if (dayDiff === 0) score += 30;
  else if (dayDiff <= 1) score += 22;
  else if (dayDiff <= 3) score += 12;
  else if (dayDiff <= 7) score += 5;
  else return 0; // more than a week apart

  // Description / vendor keyword overlap
  score += keywordOverlap(bank.description ?? "", sys.vendor, sys.description);

  return score;
}

export function findMatches(
  bankTxns: BankTxnInput[],
  sysTxns: SystemTxnInput[]
): { autoMatches: MatchResult[]; suggestions: MatchResult[] } {
  const autoMatches: MatchResult[] = [];
  const suggestions: MatchResult[] = [];
  const usedSysTxns = new Set<string>();

  for (const bank of bankTxns) {
    let bestScore = 0;
    let bestSysTxn: string | null = null;

    for (const sys of sysTxns) {
      if (usedSysTxns.has(sys.id)) continue;
      const score = scoreMatch(bank, sys);
      if (score > bestScore) {
        bestScore = score;
        bestSysTxn = sys.id;
      }
    }

    if (bestSysTxn !== null && bestScore >= SUGGEST_THRESHOLD) {
      const result: MatchResult = {
        bankTxnId: bank.id,
        systemTxnId: bestSysTxn,
        score: bestScore,
        autoMatch: bestScore >= AUTO_MATCH_THRESHOLD,
      };

      if (bestScore >= AUTO_MATCH_THRESHOLD) {
        autoMatches.push(result);
        usedSysTxns.add(bestSysTxn);
      } else {
        suggestions.push(result);
      }
    }
  }

  return { autoMatches, suggestions };
}
