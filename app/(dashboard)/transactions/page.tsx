import { getTransactionsList } from "@/lib/server/finance-data";

export const dynamic = "force-dynamic";

function parseTransactionDate(value: string | null) {
  if (!value) {
    return null;
  }

  if (/^\d{13}$/.test(value)) {
    const parsed = new Date(Number(value));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (/^\d{10}$/.test(value)) {
    const parsed = new Date(Number(value) * 1000);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (/^\d{8}$/.test(value)) {
    const year = value.slice(0, 4);
    const month = value.slice(4, 6);
    const day = value.slice(6, 8);
    const parsed = new Date(`${year}-${month}-${day}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDisplayDate(transactionDate: string | null, bookedAt: string | null) {
  const parsed = parseTransactionDate(transactionDate) ?? parseTransactionDate(bookedAt);
  if (!parsed) {
    return "-";
  }

  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parsed);
}

function formatAmount(amount: number | null) {
  if (amount === null) {
    return "EUR 0.00";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(amount);
}

export default async function TransactionsPage() {
  const transactions = await getTransactionsList();

  return (
    <section className="table-card">
      <h2>Recent activity</h2>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Category</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {transactions.length > 0 ? (
            transactions.slice(0, 40).map((item) => (
              <tr key={item.source_uid}>
                <td>{formatDisplayDate(item.transaction_date, item.booked_at)}</td>
                <td>{item.category_name ?? "Uncategorized"}</td>
                <td>{formatAmount(item.amount_account ?? item.amount)}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={3} className="muted">
                No transactions available yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
