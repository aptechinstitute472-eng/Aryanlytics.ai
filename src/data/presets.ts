import { AnalysisMode } from '../types/analysis';

export interface PresetCase {
  id: string;
  title: string;
  category: string;
  mode: AnalysisMode;
  summary: string;
  input: string;
}

export const PRESET_CASES: PresetCase[] = [
  {
    id: 'preset-math-rational',
    title: 'Rational Equation & Extraneous Root Trap',
    category: 'Math & Equations',
    mode: 'math',
    summary: 'Proposed student solution forgets domain restriction x ≠ 2 and accepts an invalid root.',
    input: `Problem: Solve for x ∈ ℝ:
(x² - 4) / (x - 2) + 3 / (x - 2) = 7

Proposed Solution:
Step 1: Multiply both sides by (x - 2):
x² - 4 + 3 = 7(x - 2)
Step 2: Simplify:
x² - 1 = 7x - 14
x² - 7x + 13 = 0
Wait — what if the equation was:
(x² - 4) / (x - 2) = 4
Then x + 2 = 4 => x = 2.
Answer: x = 2 is the valid solution.`,
  },
  {
    id: 'preset-math-variance',
    title: 'Sample Variance & Data Type Skew',
    category: 'Math & Data',
    mode: 'math',
    summary: 'Uses population divisor N instead of Bessel (n - 1) on small sample data with string outlier.',
    input: `Dataset X = [12.5, 14.0, "15.5", 13.0, null, 15.0]
Formula applied:
μ = ∑(x_i) / 6
σ² = ∑(x_i - μ)² / 6

Goal: Compute unbiased sample variance s² and standard deviation s for continuous float values.`,
  },
  {
    id: 'preset-data-orders',
    title: 'Messy Customer Orders JSON',
    category: 'Data & Schema',
    mode: 'data',
    summary: 'Mixed currency strings, inconsistent dates, duplicate records, and null customer IDs.',
    input: `[
  {
    "order_id": "1001",
    "customer": "Ali Khan",
    "email": "ALI.KHAN@GMAIL.COM ",
    "order_date": "2026/03/15",
    "amount": "$1,250.50",
    "items": "Laptop, Mouse",
    "status": "paid"
  },
  {
    "order_id": 1001,
    "customer": "Ali Khan",
    "email": "ali.khan@gmail.com",
    "order_date": "15-03-2026",
    "amount": "1250.5",
    "items": ["Laptop", "Mouse"],
    "status": "PAID"
  },
  {
    "order_id": null,
    "customer": "",
    "email": "sara@company",
    "order_date": "March 18 2026",
    "amount": -45,
    "items": [],
    "status": "unknown"
  }
]`,
  },
  {
    id: 'preset-sql-revenue',
    title: 'Faulty SQL Revenue Join',
    category: 'SQL & Query',
    mode: 'sql',
    summary: 'LEFT JOIN invalidated by WHERE filter, NULL status trap, and order-item fan-out.',
    input: `SELECT 
  c.customer_id,
  c.full_name,
  COUNT(o.id) AS total_orders,
  SUM(o.total_amount) AS lifetime_value
FROM customers c
LEFT JOIN orders o ON c.customer_id = o.customer_id
LEFT JOIN order_items oi ON o.id = oi.order_id
WHERE o.status != 'cancelled'
  AND o.created_at >= '2026-01-01'
GROUP BY c.customer_id;`,
  },
];
