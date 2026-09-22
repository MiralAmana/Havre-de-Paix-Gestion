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

## 2026-09-11 — Refonte visuelle (skill UI/UX)

**Ce qui a été fait** : nouveau système de design généré via le skill `ui-ux-pro-max` (style "Data-Dense Dashboard" — palette bleu marine/ambre, cartes KPI, tableaux denses), persisté dans [design-system/havre-de-paix-gestion/MASTER.md](design-system/havre-de-paix-gestion/MASTER.md) pour rester cohérent sur les prochains écrans.
- [renderer/styles.css](renderer/styles.css) réécrit avec des jetons CSS (couleurs, ombres, rayons, transitions), cartes KPI avec badge d'icône et valeurs en police à chiffres tabulaires, tableaux zébrés avec surlignage au survol, focus clavier visible, `prefers-reduced-motion` respecté.
- Icônes SVG (style contour, sans emoji) ajoutées à la barre latérale et aux cartes du tableau de bord ; helper `Utils.icon()` ajouté dans [renderer/utils.js](renderer/utils.js) pour injecter du SVG dans les vues.
- **Écart assumé par rapport au système généré** : la police recommandée (Fira Sans/Fira Code, Google Fonts) demanderait une dépendance réseau à l'exécution — inacceptable pour une appli qui doit fonctionner hors-ligne dans la boutique. Remplacée par les polices Windows natives (Segoe UI / Consolas), qui donnent le même esprit (sans-serif propre + chiffres tabulaires) sans dépendance.

**Vérification faite** : capture d'écran réelle de la fenêtre via le protocole de débogage Chrome DevTools d'Electron (`--remote-debugging-port`), pas juste une relecture de code — Tableau de bord, Stock et Dettes clients contrôlés visuellement.

**Effet de bord détecté et corrigé pendant la vérification** : les doublons B00x fusionnés le 2026-09-10 étaient réapparus (le bouton "Importer depuis Excel" a dû être recliqué entre-temps — l'import ne sait pas qu'un produit a été fusionné/retiré depuis). Revérifié qu'aucun mouvement/dépense/dette n'y était rattaché avant de refusionner. **Limite non corrigée** : recliquer sur "Importer depuis Excel" reproduira ce doublon — l'import n'est pas au courant des fusions faites depuis dans l'appli.

**Limite connue** : aucune icône personnalisée (icône Electron par défaut) — améliration cosmétique possible plus tard si voulu. Le `.exe` n'est pas signé avec un certificat (signature "auto" de `electron-builder`/Windows), donc Windows SmartScreen peut afficher un avertissement "éditeur inconnu" au premier lancement sur une autre machine — normal pour une appli non publiée, à accepter une fois.

## 2026-09-20 — Thème marron/beige/noir + logo ADRI de la cliente

**Demande** : la cliente veut finalement un thème marron / blanc / beige / noir et son logo dans l'appli.

**Logo** : l'utilisateur a fourni une capture d'écran (WhatsApp) du logo — trop basse résolution pour un simple agrandissement. Il a été **vectorisé** : formes géométriques ajustées par optimisation sur les pixels d'origine (écart résiduel ~1 % de pixels, dû à l'anti-crénelage), couleurs relevées exactement (`#D0886F`, `#E09F67`, `#BE6336`, `#000`, cercle `#F7E8E3`), mot « ADRI » converti en tracés (police Times New Roman, la plus proche de l'original) pour un rendu identique partout. Le SVG reste net à toute taille.
- [renderer/assets/logo.svg](renderer/assets/logo.svg) (logo complet), [renderer/assets/logo-mark.svg](renderer/assets/logo-mark.svg) (symbole seul), [renderer/assets/icon.png](renderer/assets/icon.png) et [build/icon.ico](build/icon.ico) (icône d'appli multi-tailles 16→256 px).
- Logo affiché dans la barre latérale (sur une tuile blanche, car le noir du logo disparaîtrait sur le fond sombre), dans l'icône de fenêtre/exe/raccourcis (`build/icon.ico` via `win.icon` dans `package.json`, `icon` dans `main.js`) et en en-tête du rapport PDF.

**Thème** ([renderer/styles.css](renderer/styles.css)) : jetons de couleur remplacés — marron `#8B4A24` (boutons), terracotta `#A5521F` (navigation active), fond beige `#FAF6EF`, texte noir chaud `#1C1510`, barre latérale noir chaud `#171009`. Couleurs sémantiques (rouge alertes, vert bénéfice) conservées pour le sens. Tous les couples texte/fond vérifiés ≥ 4,5:1 (WCAG AA). Graphique du tableau de bord, exports PDF (bordures/titres marron) et en-têtes des feuilles Excel (fond marron) alignés sur la même palette. Note ajoutée en tête de [design-system/havre-de-paix-gestion/MASTER.md](design-system/havre-de-paix-gestion/MASTER.md) (la palette bleue d'origine y est marquée comme remplacée).

**Vérification faite** : captures réelles de la fenêtre via Chrome DevTools (Tableau de bord, Stock), rendu du rapport PDF contrôlé visuellement sur une copie de la base (données de test uniquement sur la copie, supprimée ensuite), installeur regénéré.

**À noter** : le logo affiche « ADRI » alors que l'appli s'intitule « Havre de Paix — Gestion » — à confirmer avec la cliente quel nom afficher.

## 2026-09-20 — Correctif : « Ajouter un versement » ne fonctionnait pas + guide utilisateur PDF

**Bug trouvé (en rédigeant le guide)** : le bouton « Ajouter un versement » (écran Dettes clients) utilisait `window.prompt()`, que **Electron ne supporte pas** (`prompt() is not supported`). Le bouton était donc cassé dans l'appli desktop depuis sa création — jamais détecté car mes tests passaient par des scripts sur la base, pas par un vrai clic sur ce bouton.
- **Correctif** ([renderer/screens/dettes.js](renderer/screens/dettes.js), `openPaymentForm`) : `prompt()` remplacé par une petite fenêtre intégrée à la page (montant, mode de paiement en liste : Espèces / Mobile Money / Carte / Virement / Autre, date). Fermeture par « Annuler », clic à l'extérieur ou Échap. Styles `.modal*` ajoutés à [renderer/styles.css](renderer/styles.css).
- **Validation ajoutée** : montant vide/≤ 0 refusé, et **versement supérieur au solde restant refusé** (avant : rien n'empêchait un solde négatif).
- **Vérification faite** : test piloté dans la vraie fenêtre (Chrome DevTools) sur une base d'exemple — la fenêtre s'ouvre avec le solde, refuse le trop-perçu et le montant vide, enregistre un vrai versement (Mobile Money), met à jour Versé/Solde de la ligne, et se ferme avec Échap. Plus aucun `prompt()` dans le code (`alert`/`confirm`, eux, sont supportés).

**Guide utilisateur** : [Guide utilisateur - Havre de Paix Gestion.pdf](<Guide utilisateur - Havre de Paix Gestion.pdf>) (4 pages A4, français simple, aux couleurs de l'appli, logo ADRI). Généré en HTML → PDF via Electron (`printToPDF`), avec de vraies captures de l'appli annotées (pastilles numérotées) prises sur une **base d'exemple séparée** (données fictives : jamais les vraies données de la cliente, ni ses chiffres). Contenu : ouvrir/installer, menu, noter une vente ou une livraison, alertes de stock bas, corriger une erreur, dépenses, ventes à crédit et versements, produits, tableau de bord et exports, sauvegarde. Les sources (HTML, script de captures) ne sont pas dans le dépôt : à régénérer si l'interface change.

**Constats non corrigés — à décider avec la cliente** :
1. **Prix/bénéfice par caisse vs par bouteille (important).** Dans le fichier Excel d'origine, « Prix unitaire » (ex. 8 280 pour Gazelle) et « Bénéfice unitaire » (3 720) sont **par caisse de 24** (la formule Excel multiplie le bénéfice par le nombre de caisses), alors que les stocks sont comptés **en bouteilles**. L'import a repris ces valeurs telles quelles : l'appli calcule donc bouteilles × prix d'une caisse. Effet visible : « Valeur du stock » = **1 534 876 CFA** dans l'appli, contre **122 500 CFA** dans le dernier bloc du fichier Excel (qui valorisait à 1 000 CFA/bouteille pour les bières, 2 500 pour les vins). Le chiffre d'affaires et le bénéfice seraient faux de la même façon dès les premières ventes. Le guide décrit le prix et le bénéfice « d'une unité » ; il faut **corriger les prix des bières avant de remettre l'appli** (prix de vente et bénéfice à la bouteille : à confirmer avec la cliente).
2. **Bouton « Importer depuis Excel »** : il relit le fichier du dossier `gestion` de la machine de développement (inutile chez la cliente) et **recrée les doublons B001–B007** déjà fusionnés. Le guide dit de ne pas l'utiliser ; idéalement, le retirer de la version livrée.
3. Les 5 vins (A007–A011) ont toujours un bénéfice unitaire à 0 (décision de l'utilisateur, à compléter).
