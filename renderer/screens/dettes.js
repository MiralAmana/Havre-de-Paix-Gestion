window.Screens = window.Screens || {};

window.Screens.dettes = {
  async render(root) {
    const { el, formatCFA, formatDate, today, call } = window.Utils;

    async function refresh() {
      const [clients, products, debts] = await Promise.all([
        window.api.clients.list(),
        window.api.products.list(),
        window.api.debts.list(),
      ]);
      root.innerHTML = '';
      root.appendChild(buildClientForm());
      root.appendChild(buildDebtForm(clients, products));
      root.appendChild(buildDebtsTable(debts));
    }

    function field(label, input) {
      return el('div', { class: 'field' }, [el('label', {}, [label]), input]);
    }

    function buildClientForm() {
      const panel = el('div', { class: 'panel' }, [el('h3', {}, ['Nouveau client'])]);
      const nameInput = el('input', { type: 'text', value: '' });
      const phoneInput = el('input', { type: 'text', value: '' });
      const grid = el('div', { class: 'form-grid' }, [
        field('Nom du client', nameInput),
        field('Téléphone (optionnel)', phoneInput),
      ]);
      const submitBtn = el('button', { class: 'btn' }, ['Ajouter le client']);
      submitBtn.addEventListener('click', async () => {
        if (!nameInput.value.trim()) {
          window.Utils.toast('Le nom du client est obligatoire', 'error');
          return;
        }
        await call(
          window.api.clients.create({ name: nameInput.value.trim(), phone: phoneInput.value.trim() || null }),
          'Client ajouté'
        );
        refresh();
      });
      panel.appendChild(grid);
      panel.appendChild(submitBtn);
      return panel;
    }

    function buildDebtForm(clients, products) {
      const panel = el('div', { class: 'panel' }, [el('h3', {}, ['Nouvelle vente à crédit'])]);
      if (!clients.length) {
        panel.appendChild(el('p', { class: 'empty-state' }, ['Ajoutez d\'abord un client ci-dessus.']));
        return panel;
      }

      const clientSelect = el(
        'select',
        {},
        clients.map((c) => el('option', { value: c.id }, [c.name]))
      );
      const productSelect = el('select', {}, [
        el('option', { value: '' }, ['— (aucun) —']),
        ...products.map((p) => el('option', { value: p.id }, [`${p.code} — ${p.name}`])),
      ]);
      const dateInput = el('input', { type: 'date', value: today() });
      const qtyInput = el('input', { type: 'number', step: '1', min: '0', value: '' });
      const amountInput = el('input', { type: 'number', step: '1', min: '0', value: '' });
      const noteInput = el('input', { type: 'text', value: '' });

      const grid = el('div', { class: 'form-grid' }, [
        field('Client', clientSelect),
        field('Date', dateInput),
        field('Article (optionnel)', productSelect),
        field('Quantité (optionnel)', qtyInput),
        field('Montant total (CFA)', amountInput),
        field('Note (optionnel)', noteInput),
      ]);

      const submitBtn = el('button', { class: 'btn' }, ['Enregistrer la dette']);
      submitBtn.addEventListener('click', async () => {
        const amount = Number(amountInput.value);
        if (!amount || amount <= 0) {
          window.Utils.toast('Le montant total est obligatoire', 'error');
          return;
        }
        await call(
          window.api.debts.create({
            client_id: Number(clientSelect.value),
            date: dateInput.value || today(),
            product_id: productSelect.value ? Number(productSelect.value) : null,
            quantity: qtyInput.value ? Number(qtyInput.value) : null,
            total_amount: amount,
            note: noteInput.value.trim() || null,
          }),
          'Dette enregistrée'
        );
        refresh();
      });

      panel.appendChild(grid);
      panel.appendChild(submitBtn);
      return panel;
    }

    function buildDebtsTable(debts) {
      const panel = el('div', { class: 'panel' }, [el('h3', {}, ['Dettes clients'])]);
      if (!debts.length) {
        panel.appendChild(el('p', { class: 'empty-state' }, ['Aucune dette enregistrée.']));
        return panel;
      }

      const totalOutstanding = debts.reduce((sum, d) => sum + Math.max(d.balance, 0), 0);
      panel.appendChild(
        el('p', { style: 'margin-bottom: 12px; font-weight: 600;' }, [
          `Total dû par les clients : ${formatCFA(totalOutstanding)}`,
        ])
      );

      const table = el('table', {}, [
        el('thead', {}, [
          el('tr', {}, [
            el('th', {}, ['Date']),
            el('th', {}, ['Client']),
            el('th', {}, ['Article']),
            el('th', {}, ['Montant total']),
            el('th', {}, ['Versé']),
            el('th', {}, ['Solde']),
            el('th', {}, ['']),
          ]),
        ]),
      ]);

      const tbody = el('tbody', {}, []);
      debts.forEach((d) => {
        const isPaid = d.balance <= 0.0001;
        const payBtn = el('button', { class: 'btn small' }, ['Ajouter un versement']);
        const deleteBtn = el('button', { class: 'btn small danger' }, ['Supprimer']);

        payBtn.disabled = isPaid;
        payBtn.addEventListener('click', () => openPaymentForm(d));
        deleteBtn.addEventListener('click', async () => {
          if (!confirm('Supprimer cette dette et ses versements ?')) return;
          await call(window.api.debts.remove(d.id), 'Dette supprimée');
          refresh();
        });

        const row = el('tr', { class: isPaid ? '' : 'warning-row' }, [
          el('td', {}, [formatDate(d.date)]),
          el('td', {}, [d.client_name]),
          el('td', {}, [d.product_name || '—']),
          el('td', {}, [formatCFA(d.total_amount)]),
          el('td', {}, [formatCFA(d.paid_amount)]),
          el(
            'td',
            {},
            [isPaid ? el('span', { class: 'badge muted' }, ['Soldée']) : el('strong', {}, [formatCFA(d.balance)])]
          ),
          el('td', { class: 'actions-cell' }, [payBtn, deleteBtn]),
        ]);
        tbody.appendChild(row);
      });
      table.appendChild(tbody);
      panel.appendChild(table);
      return panel;
    }

    function openPaymentForm(debt) {
      const amountStr = prompt(
        `Montant du versement pour ${debt.client_name} (solde restant : ${formatCFA(debt.balance)}) :`
      );
      if (amountStr === null) return;
      const amount = Number(amountStr);
      if (!amount || amount <= 0) {
        window.Utils.toast('Montant invalide', 'error');
        return;
      }
      const method = prompt('Mode de paiement (espèces, mobile money, ...) — optionnel :') || null;
      call(
        window.api.debts.addPayment({
          debt_id: debt.id,
          date: today(),
          amount,
          payment_method: method,
        }),
        'Versement enregistré'
      ).then(refresh);
    }

    await refresh();
  },
};
