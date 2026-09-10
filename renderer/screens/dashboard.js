window.Screens = window.Screens || {};

window.Screens.dashboard = {
  async render(root) {
    const { el, formatCFA, formatNumber, today, call } = window.Utils;
    let chartInstance;

    function firstDayOfMonth() {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    }

    let filters = { from: firstDayOfMonth(), to: today() };

    async function refresh() {
      const [summary, salesByDay] = await Promise.all([
        window.api.dashboard.summary(filters),
        window.api.dashboard.salesByDay(filters),
      ]);
      root.innerHTML = '';
      root.appendChild(buildFilterBar());
      root.appendChild(buildCards(summary));
      root.appendChild(buildChart(salesByDay));
      root.appendChild(buildAlerts(summary));
    }

    async function handleExport(kind, button) {
      const originalText = button.textContent;
      button.disabled = true;
      button.textContent = 'Génération…';
      try {
        const result = await (kind === 'excel' ? window.api.exportExcel(filters) : window.api.exportPdf(filters));
        if (result.canceled) {
          window.Utils.toast('Export annulé', 'error');
        } else {
          window.Utils.toast(`Rapport exporté : ${result.filePath}`, 'success');
        }
      } catch (err) {
        console.error(err);
        window.Utils.toast(err.message || "Échec de l'export", 'error');
      } finally {
        button.disabled = false;
        button.textContent = originalText;
      }
    }

    function buildFilterBar() {
      const fromInput = el('input', { type: 'date', value: filters.from });
      const toInput = el('input', { type: 'date', value: filters.to });
      const applyBtn = el('button', { class: 'btn secondary small' }, ['Appliquer']);
      applyBtn.addEventListener('click', () => {
        filters = { from: fromInput.value, to: toInput.value };
        refresh();
      });

      const exportExcelBtn = el('button', { class: 'btn secondary small' }, ['Exporter (Excel)']);
      exportExcelBtn.addEventListener('click', () => handleExport('excel', exportExcelBtn));

      const exportPdfBtn = el('button', { class: 'btn secondary small' }, ['Exporter (PDF)']);
      exportPdfBtn.addEventListener('click', () => handleExport('pdf', exportPdfBtn));

      return el('div', { class: 'form-grid', style: 'margin-bottom: 8px;' }, [
        el('div', { class: 'field' }, [el('label', {}, ['Du']), fromInput]),
        el('div', { class: 'field' }, [el('label', {}, ['Au']), toInput]),
        applyBtn,
        exportExcelBtn,
        exportPdfBtn,
      ]);
    }

    function buildCards(summary) {
      return el('div', { class: 'cards' }, [
        card('Valeur du stock', formatCFA(summary.stock_value)),
        card("Chiffre d'affaires (période)", formatCFA(summary.revenue)),
        card('Dépenses (période)', formatCFA(summary.expenses_total)),
        card('Bénéfice net (période)', formatCFA(summary.net_profit), summary.net_profit >= 0 ? 'positive' : 'negative'),
        card('Dettes clients en cours', formatCFA(summary.debts_outstanding), summary.debts_outstanding > 0 ? 'negative' : ''),
        card('Produits sous le seuil min.', String(summary.below_min_products.length), summary.below_min_products.length ? 'negative' : ''),
      ]);
    }

    function card(label, value, modifier) {
      return el('div', { class: `card ${modifier || ''}` }, [
        el('div', { class: 'label' }, [label]),
        el('div', { class: 'value' }, [value]),
      ]);
    }

    function buildChart(salesByDay) {
      const panel = el('div', { class: 'panel' }, [el('h3', {}, ["Chiffre d'affaires par jour"])]);
      if (!salesByDay.length) {
        panel.appendChild(el('p', { class: 'empty-state' }, ['Aucune vente enregistrée sur cette période.']));
        return panel;
      }
      const wrap = el('div', { class: 'chart-wrap' });
      const canvas = el('canvas');
      wrap.appendChild(canvas);
      panel.appendChild(wrap);

      requestAnimationFrame(() => {
        if (chartInstance) chartInstance.destroy();
        chartInstance = new Chart(canvas.getContext('2d'), {
          type: 'bar',
          data: {
            labels: salesByDay.map((r) => r.date),
            datasets: [
              {
                label: "Chiffre d'affaires (CFA)",
                data: salesByDay.map((r) => r.revenue),
                backgroundColor: '#1d4ed8',
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } },
          },
        });
      });

      return panel;
    }

    function buildAlerts(summary) {
      const panel = el('div', { class: 'panel' }, [el('h3', {}, ['Alertes de stock bas'])]);
      if (!summary.below_min_products.length) {
        panel.appendChild(el('p', { class: 'empty-state' }, ['Aucune alerte — tous les stocks sont au-dessus du seuil minimum.']));
        return panel;
      }
      const table = el('table', {}, [
        el('thead', {}, [
          el('tr', {}, [el('th', {}, ['Code']), el('th', {}, ['Désignation']), el('th', {}, ['Stock actuel']), el('th', {}, ['Stock min.'])]),
        ]),
      ]);
      const tbody = el('tbody', {}, []);
      summary.below_min_products.forEach((p) => {
        tbody.appendChild(
          el('tr', { class: 'alert-row' }, [
            el('td', {}, [p.code]),
            el('td', {}, [p.name]),
            el('td', {}, [formatNumber(p.current_stock)]),
            el('td', {}, [formatNumber(p.min_stock)]),
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
