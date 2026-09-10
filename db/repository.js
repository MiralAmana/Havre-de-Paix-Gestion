function createRepository(db) {
  // ---- Products ----
  const products = {
    list: () => db.all('SELECT * FROM products ORDER BY name'),
    get: (id) => db.get('SELECT * FROM products WHERE id = ?', id),
    getByCode: (code) => db.get('SELECT * FROM products WHERE code = ?', code),
    create: ({ code, name, unit_price, units_per_case, unit_profit, min_stock }) => {
      const info = db.run(
        `INSERT INTO products (code, name, unit_price, units_per_case, unit_profit, min_stock)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [code, name, unit_price || 0, units_per_case || 1, unit_profit || 0, min_stock || 0]
      );
      return products.get(info.lastInsertRowid);
    },
    update: (id, { code, name, unit_price, units_per_case, unit_profit, min_stock }) => {
      db.run(
        `UPDATE products SET code = ?, name = ?, unit_price = ?, units_per_case = ?, unit_profit = ?, min_stock = ?
         WHERE id = ?`,
        [code, name, unit_price || 0, units_per_case || 1, unit_profit || 0, min_stock || 0, id]
      );
      return products.get(id);
    },
    remove: (id) => db.run('DELETE FROM products WHERE id = ?', id),
  };

  // ---- Stock: current state per product = sum(entree) - sum(sortie), all-time ----
  const CURRENT_STOCK_SQL = `
    SELECT
      p.id AS product_id,
      p.code,
      p.name,
      p.unit_price,
      p.units_per_case,
      p.unit_profit,
      p.min_stock,
      COALESCE(SUM(CASE WHEN sm.type = 'entree' THEN sm.quantity ELSE 0 END), 0)
        - COALESCE(SUM(CASE WHEN sm.type = 'sortie' THEN sm.quantity ELSE 0 END), 0) AS current_stock
    FROM products p
    LEFT JOIN stock_movements sm ON sm.product_id = p.id
    GROUP BY p.id
    ORDER BY p.name
  `;

  const stock = {
    currentState: () => {
      const rows = db.all(CURRENT_STOCK_SQL);
      return rows.map((r) => ({
        ...r,
        stock_value: r.current_stock * r.unit_price,
        below_min: r.current_stock < r.min_stock,
      }));
    },
    listMovements: ({ from, to, productId } = {}) => {
      let sql = `
        SELECT sm.*, p.code, p.name
        FROM stock_movements sm
        JOIN products p ON p.id = sm.product_id
        WHERE 1 = 1
      `;
      const params = [];
      if (from) {
        sql += ' AND sm.date >= ?';
        params.push(from);
      }
      if (to) {
        sql += ' AND sm.date <= ?';
        params.push(to);
      }
      if (productId) {
        sql += ' AND sm.product_id = ?';
        params.push(productId);
      }
      sql += ' ORDER BY sm.date DESC, sm.id DESC';
      return db.all(sql, params);
    },
    addMovement: ({ product_id, date, type, quantity, note }) => {
      const info = db.run(
        `INSERT INTO stock_movements (product_id, date, type, quantity, note)
         VALUES (?, ?, ?, ?, ?)`,
        [product_id, date, type, quantity, note || null]
      );
      return db.get('SELECT * FROM stock_movements WHERE id = ?', info.lastInsertRowid);
    },
    removeMovement: (id) => db.run('DELETE FROM stock_movements WHERE id = ?', id),
  };

  // ---- Expenses ----
  const expenses = {
    list: ({ from, to } = {}) => {
      let sql = `
        SELECT e.*, p.name AS product_name
        FROM expenses e
        LEFT JOIN products p ON p.id = e.product_id
        WHERE 1 = 1
      `;
      const params = [];
      if (from) {
        sql += ' AND e.date >= ?';
        params.push(from);
      }
      if (to) {
        sql += ' AND e.date <= ?';
        params.push(to);
      }
      sql += ' ORDER BY e.date DESC, e.id DESC';
      return db.all(sql, params);
    },
    create: ({ date, product_id, label, amount }) => {
      const info = db.run('INSERT INTO expenses (date, product_id, label, amount) VALUES (?, ?, ?, ?)', [
        date,
        product_id || null,
        label,
        amount,
      ]);
      return db.get('SELECT * FROM expenses WHERE id = ?', info.lastInsertRowid);
    },
    update: (id, { date, product_id, label, amount }) => {
      db.run('UPDATE expenses SET date = ?, product_id = ?, label = ?, amount = ? WHERE id = ?', [
        date,
        product_id || null,
        label,
        amount,
        id,
      ]);
      return db.get('SELECT * FROM expenses WHERE id = ?', id);
    },
    remove: (id) => db.run('DELETE FROM expenses WHERE id = ?', id),
    totalForPeriod: ({ from, to } = {}) => {
      let sql = 'SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE 1 = 1';
      const params = [];
      if (from) {
        sql += ' AND date >= ?';
        params.push(from);
      }
      if (to) {
        sql += ' AND date <= ?';
        params.push(to);
      }
      return db.get(sql, params).total;
    },
  };

  // ---- Clients ----
  const clients = {
    list: () => db.all('SELECT * FROM clients ORDER BY name'),
    get: (id) => db.get('SELECT * FROM clients WHERE id = ?', id),
    create: ({ name, phone }) => {
      const info = db.run('INSERT INTO clients (name, phone) VALUES (?, ?)', [name, phone || null]);
      return clients.get(info.lastInsertRowid);
    },
    update: (id, { name, phone }) => {
      db.run('UPDATE clients SET name = ?, phone = ? WHERE id = ?', [name, phone || null, id]);
      return clients.get(id);
    },
    remove: (id) => db.run('DELETE FROM clients WHERE id = ?', id),
  };

  // ---- Debts (ventes à crédit) + versements ----
  const DEBT_BALANCE_SQL = `
    SELECT
      d.*,
      c.name AS client_name,
      c.phone AS client_phone,
      p.name AS product_name,
      COALESCE((SELECT SUM(amount) FROM debt_payments WHERE debt_id = d.id), 0) AS paid_amount,
      d.total_amount - COALESCE((SELECT SUM(amount) FROM debt_payments WHERE debt_id = d.id), 0) AS balance
    FROM debts d
    JOIN clients c ON c.id = d.client_id
    LEFT JOIN products p ON p.id = d.product_id
  `;

  const debts = {
    list: ({ clientId, onlyOutstanding } = {}) => {
      let sql = DEBT_BALANCE_SQL + ' WHERE 1 = 1';
      const params = [];
      if (clientId) {
        sql += ' AND d.client_id = ?';
        params.push(clientId);
      }
      sql += ' ORDER BY d.date DESC, d.id DESC';
      const rows = db.all(sql, params);
      return onlyOutstanding ? rows.filter((r) => r.balance > 0.0001) : rows;
    },
    get: (id) => db.get(DEBT_BALANCE_SQL + ' WHERE d.id = ?', id),
    create: ({ client_id, date, product_id, quantity, total_amount, note }) => {
      const info = db.run(
        `INSERT INTO debts (client_id, date, product_id, quantity, total_amount, note)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [client_id, date, product_id || null, quantity || null, total_amount, note || null]
      );
      return debts.get(info.lastInsertRowid);
    },
    remove: (id) => db.run('DELETE FROM debts WHERE id = ?', id),
    addPayment: ({ debt_id, date, amount, payment_method }) => {
      db.run('INSERT INTO debt_payments (debt_id, date, amount, payment_method) VALUES (?, ?, ?, ?)', [
        debt_id,
        date,
        amount,
        payment_method || null,
      ]);
      return debts.get(debt_id);
    },
    listPayments: (debtId) =>
      db.all('SELECT * FROM debt_payments WHERE debt_id = ? ORDER BY date DESC, id DESC', debtId),
    totalOutstanding: () => {
      const rows = debts.list({ onlyOutstanding: true });
      return rows.reduce((sum, r) => sum + r.balance, 0);
    },
  };

  // ---- Dashboard aggregates ----
  const dashboard = {
    summary: ({ from, to } = {}) => {
      const stockState = stock.currentState();
      const stockValue = stockState.reduce((sum, r) => sum + r.stock_value, 0);
      const belowMin = stockState.filter((r) => r.below_min);

      let salesSql = `
        SELECT
          COALESCE(SUM(sm.quantity * p.unit_price), 0) AS revenue,
          COALESCE(SUM(sm.quantity * p.unit_profit), 0) AS gross_profit
        FROM stock_movements sm
        JOIN products p ON p.id = sm.product_id
        WHERE sm.type = 'sortie'
      `;
      const params = [];
      if (from) {
        salesSql += ' AND sm.date >= ?';
        params.push(from);
      }
      if (to) {
        salesSql += ' AND sm.date <= ?';
        params.push(to);
      }
      const sales = db.get(salesSql, params);
      const expensesTotal = expenses.totalForPeriod({ from, to });

      return {
        stock_value: stockValue,
        below_min_products: belowMin,
        revenue: sales.revenue,
        gross_profit: sales.gross_profit,
        expenses_total: expensesTotal,
        net_profit: sales.gross_profit - expensesTotal,
        debts_outstanding: debts.totalOutstanding(),
      };
    },
    salesByDay: ({ from, to } = {}) => {
      let sql = `
        SELECT sm.date AS date, SUM(sm.quantity * p.unit_price) AS revenue
        FROM stock_movements sm
        JOIN products p ON p.id = sm.product_id
        WHERE sm.type = 'sortie'
      `;
      const params = [];
      if (from) {
        sql += ' AND sm.date >= ?';
        params.push(from);
      }
      if (to) {
        sql += ' AND sm.date <= ?';
        params.push(to);
      }
      sql += ' GROUP BY sm.date ORDER BY sm.date ASC';
      return db.all(sql, params);
    },
  };

  return { products, stock, expenses, clients, debts, dashboard };
}

module.exports = { createRepository };
