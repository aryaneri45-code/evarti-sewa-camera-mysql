import test from 'node:test';
import assert from 'node:assert/strict';
import { loadDailyTransactions } from '../src/services/history-report.js';

test('daily report loads every page, including transactions beyond the first 100', async () => {
  const transactions = Array.from({ length: 237 }, (_, id) => ({
    id, paymentStatus: ['paid', 'pending_verification', 'void'][id % 3],
  }));
  const calls = [];
  const result = await loadDailyTransactions('2026-11-14', async (params) => {
    calls.push(params);
    return { transactions: transactions.slice(params.offset, params.offset + params.limit) };
  });
  assert.deepEqual(result, transactions);
  assert.deepEqual(calls, [0, 100, 200].map((offset) => ({ date: '2026-11-14', limit: 100, offset })));
});

test('daily report handles an exact page boundary and a day with no transactions', async () => {
  for (const count of [0, 100, 200]) {
    const transactions = Array.from({ length: count }, (_, id) => ({ id }));
    let calls = 0;
    const result = await loadDailyTransactions('2026-11-14', async ({ offset, limit }) => {
      calls++;
      return { transactions: transactions.slice(offset, offset + limit) };
    });
    assert.equal(result.length, count);
    assert.equal(calls, count / 100 + 1);
  }
});

test('a failed later page rejects the report instead of printing incomplete data', async () => {
  await assert.rejects(loadDailyTransactions('2026-11-14', async ({ offset }) => {
    if (offset) throw new Error('Koneksi terputus');
    return { transactions: Array.from({ length: 100 }, (_, id) => ({ id })) };
  }), /Koneksi terputus/);
});

test('daily report requires a date before fetching transactions', async () => {
  for (const date of ['', undefined, '14-11-2026']) {
    await assert.rejects(loadDailyTransactions(date, () => assert.fail('must not fetch')), /tanggal/);
  }
});
