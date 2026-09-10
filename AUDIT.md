# AUDIT — Havre de Paix - Gestion

Journal des changements notables du projet. Tenu à jour après chaque évolution importante (nouvelle fonctionnalité, changement d'architecture, correctif de sécurité). Les ajustements purement cosmétiques ne sont pas listés ici.

## 2026-09-10 — Reconstruction du projet après suppression

**Contexte** : ce projet avait été entièrement construit et validé (v1 + import Excel + export Excel/PDF) entre le 2026-09-05 et le 2026-09-07, puis **supprimé le 2026-09-08** à la demande de l'utilisateur (la cliente voulait rester sur Excel). Rien n'avait été commité dans git à ce moment-là — la suppression était donc définitive et irrécupérable. Un détour a suivi : reconstruction d'une version Excel améliorée du fichier `gestion/Nouveau Tableau Finance Officiel Havre de Paix.xlsx` (tableau de bord, journal de mouvements, dettes avec versements multiples, listes déroulantes), avec une tentative de formulaires VBA interrompue par un problème d'accès au projet VBA via automation COM. Le 2026-09-10, la cliente a finalement redemandé l'application desktop — ce projet est donc reconstruit à l'identique de la version validée précédemment (même architecture, mêmes écrans, mêmes corrections de bugs déjà trouvées).

**Contenu identique à la version précédente** (voir le détail dans l'historique de la conversation) :
- Electron + `node-sqlite3-wasm` (pas de compilation native) + `exceljs` (pas les failles connues de `xlsx`/SheetJS).
- 5 écrans : Tableau de bord, Stock, Produits, Dépenses, Dettes clients.
- Import Excel avec les deux correctifs déjà trouvés par les tests précédents : cellules formule sans résultat mis en cache traitées comme vides (pas de plantage), et import idempotent (pas de doublon de mouvement de stock si on relance l'import).
- Export des rapports en Excel (`exceljs`, 4 feuilles) et PDF (`webContents.printToPDF` sur une fenêtre cachée).

**Différence avec avant** : cette fois, un premier commit git est fait dès que le socle tourne, pour ne pas revivre une perte totale du travail.

**Fichier Excel source de l'import** : `gestion/Nouveau Tableau Finance Officiel Havre de Paix.xlsx` a été restauré à son état original (la version modifiée pendant le détour Excel a été archivée sous `Nouveau Tableau Finance Officiel Havre de Paix (version Excel avec formulaires, abandonnee).xlsx`).
