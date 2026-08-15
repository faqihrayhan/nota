import { type Transaction } from "./supabase";

export interface TimeSeriesData {
  date: string;
  amount: number;
}

export interface CategoryData {
  name: string;
  value: number;
}

/**
 * Aggregates transactions into daily totals for line charts
 */
export function aggregateDailyRevenue(transactions: Transaction[]): TimeSeriesData[] {
  const groups: Record<string, number> = {};
  
  transactions.forEach(tx => {
    const date = new Date(tx.created_at).toISOString().split('T')[0];
    groups[date] = (groups[date] || 0) + (Number(tx.amount) || 0);
  });

  return Object.entries(groups)
    .map(([date, amount]) => ({ date, amount }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Aggregates transactions by category for donut charts
 */
export function aggregateByCategory(transactions: Transaction[]): CategoryData[] {
  const groups: Record<string, number> = {};
  
  transactions.forEach(tx => {
    const cat = tx.category || 'Other';
    groups[cat] = (groups[cat] || 0) + (Number(tx.amount) || 0);
  });

  return Object.entries(groups).map(([name, value]) => ({ name, value }));
}
