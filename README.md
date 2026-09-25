# Havre de Paix — Gestion

Application de bureau (Windows) pour gérer un dépôt de boissons / bar : **stock avec alertes, dépenses, ventes à crédit avec versements partiels, tableau de bord et rapports Excel/PDF**. Tout fonctionne **hors-ligne**, les données restent sur l'ordinateur de la cliente (montants en CFA).

Elle remplace un fichier Excel devenu fragile (blocs de tableaux dupliqués à chaque période, formules cassées, un seul « 1er versement » par dette).

> **Pour l'utilisatrice finale** : lire le [Guide utilisateur](<Guide utilisateur - Havre de Paix Gestion.pdf>) (4 pages, sans jargon). Ce README s'adresse à la personne qui installe et maintient l'application.

---

## Fonctionnalités

| Écran | Ce qu'il fait |
|---|---|
| **Tableau de bord** | Valeur du stock, chiffre d'affaires, dépenses, bénéfice net, dettes en cours, produits sous le seuil d'alerte, graphique des ventes par jour, filtre par période, boutons d'export Excel / PDF |
| **Stock** | Saisie d'une entrée (livraison) ou d'une sortie (vente) ; stock actuel par produit avec ligne en rouge sous le seuil minimum ; historique filtrable, une erreur se supprime |
| **Produits** | Ajouter / modifier / supprimer : code, désignation, prix unitaire, unités par caisse, bénéfice unitaire, stock minimum |
| **Dépenses** | Journal des dépenses (date, désignation, montant, produit lié facultatif) avec total sur la période |
| **Dettes clients** | Clients, ventes à crédit, **versements partiels multiples** (Espèces, Mobile Money, Carte, Virement, Autre), solde restant ; un versement supérieur au solde est refusé |
| **Sauvegarde** | Copie automatique de la base chaque jour au démarrage + bouton « Sauvegarder maintenant » |

Les rapports s'exportent en **Excel** (4 feuilles : Tableau de bord, Stock, Dépenses, Dettes clients) et en **PDF** (en-tête avec le logo ADRI).

---

## Pile technique

- **Electron** 44 — fenêtre de bureau, `contextIsolation` activé, aucun accès Node dans la page (tout passe par `preload.js` → `window.api.*` → `ipcMain.handle`)
- **SQLite** via [`node-sqlite3-wasm`](https://www.npmjs.com/package/node-sqlite3-wasm) — WebAssembly, donc **aucune compilation native** (pas besoin de Visual Studio Build Tools)
- **exceljs** pour l'import et l'export Excel
- **Chart.js** 4 pour le graphique du tableau de bord
- Interface en **HTML / CSS / JavaScript pur** (un fichier par écran, pas de framework), polices système Windows (Segoe UI / Consolas) pour rester 100 % hors-ligne
- **electron-builder** pour l'installeur Windows (NSIS)

---

## Démarrer en développement

Prérequis : [Node.js](https://nodejs.org) et npm (développé et testé avec Node 22).

```bash
npm install     # installe les dépendances et copie Chart.js dans renderer/assets/vendor/ (postinstall)
npm start       # lance l'application
```

> Si l'appli affiche un graphique vide ou une erreur `Chart is not defined`, relancer `npm install` : c'est lui qui copie `chart.umd.js` (dossier `renderer/assets/vendor/`, ignoré par git).

## Fabriquer l'installeur `.exe`

```bash
npm run dist
```

Produit `dist/Havre de Paix - Gestion Setup 1.0.0.exe` (~110 Mo) : installeur « en un clic », **sans droits administrateur**, installation par utilisateur dans `%LOCALAPPDATA%\Programs\havre-de-paix-gestion`, raccourcis Bureau et menu Démarrer. L'icône vient de `build/icon.ico`.

- L'exécutable n'est **pas signé** : Windows SmartScreen peut afficher « éditeur inconnu » au premier lancement (« Informations complémentaires » → « Exécuter quand même »).
- Après toute modification du code, **relancer `npm run dist`** : l'`.exe` existant ne se met pas à jour tout seul.

---

## Où sont les données ?

| Quoi | Où |
|---|---|
| Base de données | `%AppData%\havre-de-paix-gestion\havre-de-paix.sqlite` |
| Sauvegardes | `%AppData%\havre-de-paix-gestion\backups\` |

- La version de développement (`npm start`) et la version installée **partagent le même dossier** : ne pas ouvrir les deux en même temps.
- Sauvegarde automatique au démarrage, **une par jour** (`havre-de-paix-AAAA-MM-JJ.sqlite`) ; sauvegardes de plus de **30 jours** supprimées automatiquement.
- **Restaurer** : fermer l'appli, remplacer `havre-de-paix.sqlite` par une copie du dossier `backups\` (renommée), relancer.
- Ce n'est **pas** une sauvegarde hors-site : si l'ordinateur est perdu ou volé, les copies locales le sont aussi. Conseiller à la cliente de copier régulièrement le dossier `backups\` sur une clé USB ou un espace en ligne.

---

## Structure du projet

```
main.js                 Processus principal : fenêtre, handlers IPC, exports, sauvegarde
preload.js              Pont sécurisé : expose window.api.* à la page
db/
  index.js              Ouvre la base et crée le dépôt de requêtes
  schema.js             Tables SQLite (création si absentes)
  repository.js         Requêtes : produits, stock, dépenses, clients, dettes, tableau de bord
  reports.js            Agrégation des données des rapports
  backup.js             Sauvegarde quotidienne + purge à 30 jours
  import-excel.js       Import ponctuel depuis l'ancien fichier Excel (voir plus bas)
export/
  excel-report.js       Rapport .xlsx (exceljs)
  pdf-report.js         Rapport .pdf (HTML → printToPDF dans une fenêtre cachée)
renderer/
  index.html, app.js    Coquille, navigation latérale
  styles.css            Thème marron / beige / noir (jetons CSS)
  utils.js              Formatage CFA/dates, toasts, icônes
  screens/              dashboard.js · stock.js · produits.js · depenses.js · dettes.js
  assets/               logo.svg, logo-mark.svg, icon.png (+ vendor/ généré)
build/icon.ico          Icône Windows (16 → 256 px)
scripts/copy-vendor.js  Copie Chart.js (postinstall)
design-system/          Système de design (palette d'origine remplacée par le thème marron, voir la note en tête)
AUDIT.md                Journal des changements, à lire avant de toucher au projet
```

## Modèle de données

`products` · `stock_movements` (journal : type `entree` / `sortie`) · `expenses` · `clients` · `debts` · `debt_payments`

- **Stock** d'un produit = Σ entrées − Σ sorties (journal perpétuel, pas de blocs à recopier).
- **Chiffre d'affaires** = Σ (quantité sortie × prix unitaire) ; **bénéfice brut** = Σ (quantité sortie × bénéfice unitaire) ; **bénéfice net** = bénéfice brut − dépenses.
- **Solde d'une dette** = montant total − Σ des versements.

Le schéma est créé automatiquement au premier lancement (`CREATE TABLE IF NOT EXISTS`).

---

## Points d'attention avant de livrer à la cliente

Ces points sont détaillés dans [AUDIT.md](AUDIT.md).

1. **Prix et bénéfices des bières : par caisse, pas par bouteille.** L'import a repris les valeurs du fichier Excel (ex. 8 280 CFA et 3 720 CFA de bénéfice pour une caisse de 24), alors que le stock est compté en bouteilles. Conséquence : la « Valeur du stock » (≈ 1 534 876 CFA) et, dès les premières ventes, le chiffre d'affaires et le bénéfice sont **surévalués**. À corriger dans l'écran *Produits* (prix de vente et bénéfice **à la bouteille**, à confirmer avec la cliente).
2. **Bouton « Importer depuis Excel »** : il lit un fichier du dossier `gestion/` de la machine de développement (inutile chez la cliente) et **recrée les produits B001–B007 déjà fusionnés**. À ne pas utiliser ; à retirer de la version livrée.
3. **Vins A007–A011** : bénéfice unitaire encore à 0 — à compléter.
4. **Nom affiché** : le logo dit « ADRI », l'appli s'appelle « Havre de Paix — Gestion » — à confirmer avec la cliente.

## Limites connues

- Pas de comptes utilisateurs ni de mot de passe : quiconque ouvre la session Windows accède aux données.
- Pas de sauvegarde hors-site automatique (voir plus haut).
- Windows uniquement (l'installeur n'est construit et testé que pour Windows).
- Pas de mise à jour automatique : chaque nouvelle version se réinstalle avec un nouvel `.exe` (les données sont conservées).

---

## Conventions du dépôt

- **`AUDIT.md`** est mis à jour après chaque changement notable (fonctionnalité, architecture, correctif).
- Les commandes git sont exécutées à la main par le mainteneur ; aucun push automatique.
- Licence : `UNLICENSED` — projet privé, non destiné à être publié.
