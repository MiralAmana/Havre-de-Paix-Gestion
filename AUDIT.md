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

## 2026-09-10 — Sauvegarde automatique de la base de données

**Pourquoi** : toutes les données de la cliente vivent dans un seul fichier SQLite (`%AppData%/havre-de-paix-gestion/havre-de-paix.sqlite`). Sans copie de secours, un disque qui lâche ou un fichier corrompu efface tout — le même genre de perte totale que celle vécue avec le code source du projet (voir plus haut), mais cette fois sur les données réelles de la cliente.

**Ce qui a été fait** ([db/backup.js](db/backup.js)) :
- Sauvegarde automatique **au démarrage de l'appli**, une fois par jour maximum (fichier daté `havre-de-paix-AAAA-MM-JJ.sqlite`), dans un sous-dossier `backups/` à côté de la base.
- Nettoyage automatique des sauvegardes de plus de 30 jours à chaque démarrage.
- Bouton **"Sauvegarder maintenant"** dans la barre latérale (`renderer/app.js`) : force une sauvegarde horodatée immédiate et ouvre le dossier des sauvegardes dans l'explorateur Windows.
- Handlers IPC `backup:createNow` / `backup:openFolder` dans [main.js](main.js), exposés via `preload.js`.

**Vérification faite** : testé directement contre la vraie base (hors clic UI) — sauvegarde du jour créée une seule fois même en appelant deux fois de suite, sauvegarde manuelle horodatée distincte créée sans écraser celle du jour, et purge confirmée sur un faux fichier vieux de 40 jours. Application relancée sans erreur avec la sauvegarde au démarrage active.

**Limite connue** : ce n'est pas une sauvegarde hors-site — si tout l'ordinateur est perdu (vol, incendie), les sauvegardes locales ne protègent pas. Pas demandé pour l'instant, mais à garder en tête.

## 2026-09-10 — Packaging en installeur Windows (.exe)

**Ce qui a été fait** : `npm run dist` (config `electron-builder` déjà présente dans `package.json`, jamais testée jusqu'ici). Génère `dist/Havre de Paix - Gestion Setup 1.0.0.exe`, un installeur NSIS "one-click" (pas de droits admin requis, installation par utilisateur).

**Vérification faite** :
- Build terminé sans erreur (aucune dépendance native à recompiler, grâce au choix initial de `node-sqlite3-wasm`/`exceljs` plutôt que des paquets natifs).
- Installeur exécuté réellement : installation dans `%LOCALAPPDATA%\Programs\havre-de-paix-gestion`, raccourcis créés sur le Bureau et dans le menu Démarrer, appli lancée automatiquement après installation.
- Arbre de processus de l'appli installée vérifié sain (main + gpu + réseau + renderer), pointant vers le même dossier de données (`%AppData%\havre-de-paix-gestion`) que la version de développement — donc les données déjà saisies (produits, sauvegardes) sont immédiatement visibles dans l'appli installée.
- L'ancienne instance lancée via `npm start` a été arrêtée pour éviter que deux copies de l'appli écrivent en même temps dans la même base.

**Limite connue** : aucune icône personnalisée (icône Electron par défaut) — améliration cosmétique possible plus tard si voulu. Le `.exe` n'est pas signé avec un certificat (signature "auto" de `electron-builder`/Windows), donc Windows SmartScreen peut afficher un avertissement "éditeur inconnu" au premier lancement sur une autre machine — normal pour une appli non publiée, à accepter une fois.
