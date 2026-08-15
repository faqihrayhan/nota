"use client";

import { useMemo } from "react";
import { type Transaction } from "@/lib/supabase";
import { aggregateDailyRevenue, aggregateByCategory } from "@/lib/analytics-utils";

export function useAnalytics(transactions: Transaction[]) {
  const dailyRevenue = useMemo(() => aggregateDailyRevenue(transactions), [transactions]);
  const categoryData = useMemo(() => aggregateByCategory(transactions), [transactions]);
  
  const totalRevenue = useMemo(() => 
    transactions.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0)
  , [transactions]);

  const avgTransactionValue = useMemo(() => 
    transactions.length > 0 ? totalRevenue / transactions.length : 0
  , [totalRevenue, transactions.length]);

  return {
    dailyRevenue,
    categoryData,
    totalRevenue,
    avgTransactionValue,
    transactionCount: transactions.length
  };
}
