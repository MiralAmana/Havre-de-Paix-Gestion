window.Screens = window.Screens || {};

window.Screens.depenses = {
  async render(root) {
    const { el, formatCFA, formatDate, today, call } = window.Utils;

    async function refresh() {
      const [expenses, products] = await Promise.all([
        window.api.expenses.list(),
        window.api.products.list(),
      ]);
      root.innerHTML = '';
      root.appendChild(buildForm(products));
      root.appendChild(buildTable(expenses));
    }

    function field(label, input) {
      return el('div', { class: 'field' }, [el('label', {}, [label]), input]);
    }

    function buildForm(products) {
      const panel = el('div', { class: 'panel' }, [el('h3', {}, ['Nouvelle dépense'])]);

      const dateInput = el('input', { type: 'date', value: today() });
      const labelInput = el('input', { type: 'text', value: '' });
      const amountInput = el('input', { type: 'number', step: '1', min: '0', value: '' });
      const productSelect = el('select', {}, [
        el('option', { value: '' }, ['— (aucun) —']),
        ...products.map((p) => el('option', { value: p.id }, [`${p.code} — ${p.name}`])),
      ]);

      const grid = el('div', { class: 'form-grid' }, [
        field('Date', dateInput),
        field('Désignation', labelInput),
        field('Montant (CFA)', amountInput),
        field('Article lié (optionnel)', productSelect),
      ]);

      const submitBtn = el('button', { class: 'btn' }, ['Ajouter']);
      submitBtn.addEventListener('click', async () => {
        const amount = Number(amountInput.value);
        if (!labelInput.value.trim() || !amount || amount <= 0) {
          window.Utils.toast('Désignation et montant sont obligatoires', 'error');
          return;
        }
        await call(
          window.api.expenses.create({
            date: dateInput.value || today(),
            label: labelInput.value.trim(),
            amount,
            product_id: productSelect.value ? Number(productSelect.value) : null,
          }),
          'Dépense ajoutée'
        );
        refresh();
      });

      panel.appendChild(grid);
      panel.appendChild(submitBtn);
      return panel;
    }

    function buildTable(expenses) {
      const panel = el('div', { class: 'panel' }, [el('h3', {}, ['Journal des dépenses'])]);
      if (!expenses.length) {
        panel.appendChild(el('p', { class: 'empty-state' }, ['Aucune dépense enregistrée.']));
        return panel;
      }

      const table = el('table', {}, [
        el('thead', {}, [
          el('tr', {}, [
            el('th', {}, ['Date']),
            el('th', {}, ['Désignation']),
            el('th', {}, ['Article lié']),
            el('th', {}, ['Montant']),
            el('th', {}, ['']),
          ]),
        ]),
      ]);
      const tbody = el('tbody', {}, []);
      expenses.forEach((e) => {
        const deleteBtn = el('button', { class: 'btn small danger' }, ['Supprimer']);
        deleteBtn.addEventListener('click', async () => {
          if (!confirm('Supprimer cette dépense ?')) return;
          await call(window.api.expenses.remove(e.id), 'Dépense supprimée');
          refresh();
        });
        tbody.appendChild(
          el('tr', {}, [
            el('td', {}, [formatDate(e.date)]),
            el('td', {}, [e.label]),
            el('td', {}, [e.product_name || '—']),
            el('td', {}, [formatCFA(e.amount)]),
            el('td', { class: 'actions-cell' }, [deleteBtn]),
          ])
        );
      });
      table.appendChild(tbody);
      panel.appendChild(table);

      const total = expenses.reduce((sum, e) => sum + e.amount, 0);
      panel.appendChild(
        el('p', { style: 'margin-top: 12px; font-weight: 600;' }, [`Total : ${formatCFA(total)}`])
      );
      return panel;
    }

    await refresh();
  },
};
