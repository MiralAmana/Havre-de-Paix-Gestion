window.Screens = window.Screens || {};

const KPI_ICONS = {
  stock: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/></svg>',
  revenue: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M23 6l-9.5 9.5-5-5L1 18"/><path d="M17 6h6v6"/></svg>',
  expenses: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12v18l-2.5-1.5L13 21l-2.5-1.5L8 21l-2-1.5V3z"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>',
  profit: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.5 15.5c.5 1 1.4 1.5 2.5 1.5 1.7 0 3-1 3-2.3 0-3-5.5-1.7-5.5-4.6C9.5 8.9 10.7 8 12.5 8c1.1 0 2 .5 2.5 1.4"/><path d="M12 6.5v11"/></svg>',
  debts: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  alert: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
};

window.Screens.dashboard = {
  async render(root) {
    const { el, icon, formatCFA, formatNumber, today, call } = window.Utils;
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
        card('Valeur du stock', formatCFA(summary.stock_value), null, KPI_ICONS.stock),
        card("Chiffre d'affaires (période)", formatCFA(summary.revenue), null, KPI_ICONS.revenue),
        card('Dépenses (période)', formatCFA(summary.expenses_total), null, KPI_ICONS.expenses),
        card(
          'Bénéfice net (période)',
          formatCFA(summary.net_profit),
          summary.net_profit >= 0 ? 'positive' : 'negative',
          KPI_ICONS.profit
        ),
        card(
          'Dettes clients en cours',
          formatCFA(summary.debts_outstanding),
          summary.debts_outstanding > 0 ? 'negative' : '',
          KPI_ICONS.debts
        ),
        card(
          'Produits sous le seuil min.',
          String(summary.below_min_products.length),
          summary.below_min_products.length ? 'negative' : '',
          KPI_ICONS.alert
        ),
      ]);
    }

    function card(label, value, modifier, iconSvg) {
      return el('div', { class: `card ${modifier || ''}` }, [
        el('div', { class: 'card-top' }, [
          el('div', { class: 'label' }, [label]),
          iconSvg ? el('div', { class: 'icon-badge' }, [icon(iconSvg)]) : null,
        ]),
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
