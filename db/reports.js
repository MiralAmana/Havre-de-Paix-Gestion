function buildReportData(repo, filters = {}) {
  return {
    filters,
    generatedAt: new Date().toISOString(),
    summary: repo.dashboard.summary(filters),
    stockState: repo.stock.currentState(),
    expenses: repo.expenses.list(filters),
    debts: repo.debts.list({ onlyOutstanding: true }),
  };
}

module.exports = { buildReportData };
