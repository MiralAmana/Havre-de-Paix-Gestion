window.Screens = window.Screens || {};

window.Screens.stock = {
  async render(root) {
    const { el, formatCFA, formatNumber, formatDate, today, call } = window.Utils;

    async function refresh() {
      const [state, products, movements] = await Promise.all([
        window.api.stock.currentState(),
        window.api.products.list(),
        window.api.stock.listMovements(),
      ]);
      root.innerHTML = '';
      root.appendChild(buildMovementForm(products));
      root.appendChild(buildStateTable(state));
      root.appendChild(buildMovementsHistory(movements.slice(0, 30)));
    }

    function field(label, input) {
      return el('div', { class: 'field' }, [el('label', {}, [label]), input]);
    }

    function buildMovementForm(products) {
      const panel = el('div', { class: 'panel' }, [el('h3', {}, ['Nouveau mouvement de stock'])]);

      if (!products.length) {
        panel.appendChild(
          el('p', { class: 'empty-state' }, ['Ajoutez d\'abord des produits dans l\'écran "Produits".'])
        );
        return panel;
      }

      const productSelect = el(
        'select',
        {},
        products.map((p) => el('option', { value: p.id }, [`${p.code} — ${p.name}`]))
      );
      const typeSelect = el('select', {}, [
        el('option', { value: 'entree' }, ['Entrée']),
        el('option', { value: 'sortie' }, ['Sortie']),
      ]);
      const dateInput = el('input', { type: 'date', value: today() });
      const qtyInput = el('input', { type: 'number', step: '1', min: '0', value: '' });
      const noteInput = el('input', { type: 'text', value: '' });

      const grid = el('div', { class: 'form-grid' }, [
        field('Produit', productSelect),
        field('Type', typeSelect),
        field('Date', dateInput),
        field('Quantité', qtyInput),
        field('Note (optionnel)', noteInput),
      ]);

      const submitBtn = el('button', { class: 'btn' }, ['Enregistrer']);
      submitBtn.addEventListener('click', async () => {
        const quantity = Number(qtyInput.value);
        if (!quantity || quantity <= 0) {
          window.Utils.toast('Indiquez une quantité valide', 'error');
          return;
        }
        await call(
          window.api.stock.addMovement({
            product_id: Number(productSelect.value),
            date: dateInput.value || today(),
            type: typeSelect.value,
            quantity,
            note: noteInput.value.trim() || null,
          }),
          'Mouvement enregistré'
        );
        refresh();
      });

      panel.appendChild(grid);
      panel.appendChild(submitBtn);
      return panel;
    }

    function buildStateTable(state) {
      const panel = el('div', { class: 'panel' }, [el('h3', {}, ['État actuel du stock'])]);
      if (!state.length) {
        panel.appendChild(el('p', { class: 'empty-state' }, ['Aucun produit.']));
        return panel;
      }

      const table = el('table', {}, [
        el('thead', {}, [
          el('tr', {}, [
            el('th', {}, ['Code']),
            el('th', {}, ['Désignation']),
            el('th', {}, ['Stock actuel']),
            el('th', {}, ['Stock min.']),
            el('th', {}, ['P.U.']),
            el('th', {}, ['Valeur du stock']),
            el('th', {}, ['']),
          ]),
        ]),
      ]);

      const tbody = el('tbody', {}, []);
      state.forEach((s) => {
        const row = el('tr', { class: s.below_min ? 'alert-row' : '' }, [
          el('td', {}, [s.code]),
          el('td', {}, [s.name]),
          el('td', {}, [formatNumber(s.current_stock)]),
          el('td', {}, [formatNumber(s.min_stock)]),
          el('td', {}, [formatCFA(s.unit_price)]),
          el('td', {}, [formatCFA(s.stock_value)]),
          el('td', {}, [s.below_min ? el('span', { class: 'badge danger' }, ['Stock bas']) : '']),
        ]);
        tbody.appendChild(row);
      });
      table.appendChild(tbody);
      panel.appendChild(table);

      const total = state.reduce((sum, s) => sum + s.stock_value, 0);
      panel.appendChild(
        el('p', { style: 'margin-top: 12px; font-weight: 600;' }, [`Valeur totale du stock : ${formatCFA(total)}`])
      );
      return panel;
    }

    function buildMovementsHistory(movements) {
      const panel = el('div', { class: 'panel' }, [el('h3', {}, ['Derniers mouvements'])]);
      if (!movements.length) {
        panel.appendChild(el('p', { class: 'empty-state' }, ['Aucun mouvement enregistré.']));
        return panel;
      }

      const table = el('table', {}, [
        el('thead', {}, [
          el('tr', {}, [
            el('th', {}, ['Date']),
            el('th', {}, ['Produit']),
            el('th', {}, ['Type']),
            el('th', {}, ['Quantité']),
            el('th', {}, ['Note']),
            el('th', {}, ['']),
          ]),
        ]),
      ]);
      const tbody = el('tbody', {}, []);
      movements.forEach((m) => {
        const deleteBtn = el('button', { class: 'btn small danger' }, ['Supprimer']);
        deleteBtn.addEventListener('click', async () => {
          if (!confirm('Supprimer ce mouvement ?')) return;
          await call(window.api.stock.removeMovement(m.id), 'Mouvement supprimé');
          refresh();
        });
        tbody.appendChild(
          el('tr', {}, [
            el('td', {}, [formatDate(m.date)]),
            el('td', {}, [`${m.code} — ${m.name}`]),
            el(
              'td',
              {},
              [el('span', { class: `badge ${m.type === 'sortie' ? 'danger' : 'muted'}` }, [
                m.type === 'sortie' ? 'Sortie' : 'Entrée',
              ])]
            ),
            el('td', {}, [formatNumber(m.quantity)]),
            el('td', {}, [m.note || '']),
            el('td', { class: 'actions-cell' }, [deleteBtn]),
          ])
        );
      });
      table.appendChild(tbody);
      panel.appendChild(table);
      return panel;
    }

    await refresh();
  },
};
