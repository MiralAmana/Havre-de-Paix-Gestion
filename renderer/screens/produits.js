window.Screens = window.Screens || {};

window.Screens.produits = {
  async render(root) {
    const { el, formatCFA, formatNumber, call } = window.Utils;

    async function refresh() {
      const products = await window.api.products.list();
      root.innerHTML = '';
      root.appendChild(buildForm());
      root.appendChild(buildTable(products));
    }

    function buildForm(editing) {
      const panel = el('div', { class: 'panel' }, [
        el('h3', {}, [editing ? 'Modifier le produit' : 'Nouveau produit']),
      ]);

      const codeInput = el('input', { type: 'text', value: editing ? editing.code : '' });
      const nameInput = el('input', { type: 'text', value: editing ? editing.name : '' });
      const priceInput = el('input', { type: 'number', step: '1', value: editing ? editing.unit_price : '' });
      const caseInput = el('input', {
        type: 'number',
        step: '1',
        value: editing ? editing.units_per_case : '1',
      });
      const profitInput = el('input', { type: 'number', step: '1', value: editing ? editing.unit_profit : '' });
      const minStockInput = el('input', { type: 'number', step: '1', value: editing ? editing.min_stock : '0' });

      const grid = el('div', { class: 'form-grid' }, [
        field('Code article', codeInput),
        field('Désignation', nameInput),
        field('Prix unitaire (CFA)', priceInput),
        field('Unités / caisse', caseInput),
        field('Bénéfice unitaire (CFA)', profitInput),
        field('Stock minimum', minStockInput),
      ]);

      const submitBtn = el('button', { class: 'btn' }, [editing ? 'Enregistrer' : 'Ajouter']);
      const cancelBtn = editing ? el('button', { class: 'btn secondary' }, ['Annuler']) : null;

      submitBtn.addEventListener('click', async () => {
        const data = {
          code: codeInput.value.trim(),
          name: nameInput.value.trim(),
          unit_price: Number(priceInput.value) || 0,
          units_per_case: Number(caseInput.value) || 1,
          unit_profit: Number(profitInput.value) || 0,
          min_stock: Number(minStockInput.value) || 0,
        };
        if (!data.code || !data.name) {
          window.Utils.toast('Code et désignation sont obligatoires', 'error');
          return;
        }
        if (editing) {
          await call(window.api.products.update(editing.id, data), 'Produit modifié');
        } else {
          await call(window.api.products.create(data), 'Produit ajouté');
        }
        refresh();
      });

      const actions = el('div', { style: 'display:flex; gap:8px;' }, [submitBtn, cancelBtn]);
      panel.appendChild(grid);
      panel.appendChild(actions);
      if (cancelBtn) cancelBtn.addEventListener('click', refresh);
      return panel;
    }

    function field(label, input) {
      return el('div', { class: 'field' }, [el('label', {}, [label]), input]);
    }

    function buildTable(products) {
      const panel = el('div', { class: 'panel' }, [el('h3', {}, ['Liste des produits'])]);
      if (!products.length) {
        panel.appendChild(el('p', { class: 'empty-state' }, ['Aucun produit pour le moment.']));
        return panel;
      }

      const table = el('table', {}, [
        el('thead', {}, [
          el('tr', {}, [
            el('th', {}, ['Code']),
            el('th', {}, ['Désignation']),
            el('th', {}, ['Prix unitaire']),
            el('th', {}, ['Unités / caisse']),
            el('th', {}, ['Bénéfice unitaire']),
            el('th', {}, ['Stock min.']),
            el('th', {}, ['']),
          ]),
        ]),
      ]);

      const tbody = el('tbody', {}, []);
      products.forEach((p) => {
        const editBtn = el('button', { class: 'btn small secondary' }, ['Modifier']);
        const deleteBtn = el('button', { class: 'btn small danger' }, ['Supprimer']);
        editBtn.addEventListener('click', () => {
          root.innerHTML = '';
          root.appendChild(buildForm(p));
          root.appendChild(buildTable(products));
        });
        deleteBtn.addEventListener('click', async () => {
          if (!confirm(`Supprimer le produit "${p.name}" ? Ses mouvements de stock associés seront aussi supprimés.`)) return;
          await call(window.api.products.remove(p.id), 'Produit supprimé');
          refresh();
        });

        tbody.appendChild(
          el('tr', {}, [
            el('td', {}, [p.code]),
            el('td', {}, [p.name]),
            el('td', {}, [formatCFA(p.unit_price)]),
            el('td', {}, [formatNumber(p.units_per_case)]),
            el('td', {}, [formatCFA(p.unit_profit)]),
            el('td', {}, [formatNumber(p.min_stock)]),
            el('td', { class: 'actions-cell' }, [editBtn, deleteBtn]),
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
