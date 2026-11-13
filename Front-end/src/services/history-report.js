// The transactions endpoint caps each response at 100 rows. Keep requesting
// pages so a daily report never silently omits the rest of a busy day.
export async function loadDailyTransactions(date, fetchPage) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) {
    throw new Error('Pilih tanggal transaksi yang valid.');
  }
  const limit = 100;
  const transactions = [];
  for (let offset = 0; ; offset += limit) {
    const page = await fetchPage({ date, limit, offset });
    transactions.push(...page.transactions);
    if (page.transactions.length < limit) break;
  }
  return transactions;
}
