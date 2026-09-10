(function () {
  const titles = {
    dashboard: 'Tableau de bord',
    stock: 'Stock',
    produits: 'Produits',
    depenses: 'Dépenses',
    dettes: 'Dettes clients',
  };

  const viewRoot = document.getElementById('view-root');
  const pageTitle = document.getElementById('page-title');
  const navButtons = document.querySelectorAll('.nav-btn[data-screen]');

  async function showScreen(name) {
    navButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.screen === name));
    pageTitle.textContent = titles[name] || '';
    document.getElementById('page-actions').innerHTML = '';
    viewRoot.innerHTML = '<p class="empty-state">Chargement…</p>';
    try {
      await window.Screens[name].render(viewRoot);
    } catch (err) {
      console.error(err);
      viewRoot.innerHTML = '<p class="empty-state">Erreur de chargement de cet écran.</p>';
    }
  }

  navButtons.forEach((btn) => {
    btn.addEventListener('click', () => showScreen(btn.dataset.screen));
  });

  document.getElementById('import-excel-btn').addEventListener('click', async () => {
    const confirmed = confirm(
      "Importer les produits et le dernier état de stock connu depuis le fichier Excel du dossier 'gestion' ? Les produits déjà présents dans l'application ne seront pas dupliqués."
    );
    if (!confirmed) return;
    try {
      const report = await window.api.importExcel();
      const lines = [
        `${report.productsCreated.length} produit(s) créé(s)`,
        `${report.productsSkippedExisting.length} déjà présent(s), ignoré(s)`,
        `${report.openingStockEntriesCreated.length} entrée(s) de stock initial créée(s)`,
      ];
      if (report.productsIncomplete.length) {
        lines.push(
          `⚠ ${report.productsIncomplete.length} produit(s) importé(s) sans prix/bénéfice complet (à compléter dans "Produits") : ${report.productsIncomplete.join(', ')}`
        );
      }
      alert(lines.join('\n'));
      window.Utils.toast('Import terminé', 'success');
      const activeBtn = document.querySelector('.nav-btn.active');
      showScreen(activeBtn ? activeBtn.dataset.screen : 'dashboard');
    } catch (err) {
      console.error(err);
      window.Utils.toast(err.message || "Échec de l'import", 'error');
    }
  });

  showScreen('dashboard');
})();
