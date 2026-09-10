const fs = require('fs');
const path = require('path');

const candidates = [
  'node_modules/chart.js/dist/chart.umd.js',
  'node_modules/chart.js/dist/chart.umd.min.js',
];

const src = candidates.map((p) => path.join(__dirname, '..', p)).find((p) => fs.existsSync(p));

if (!src) {
  console.error('chart.js UMD build introuvable — avez-vous lancé "npm install" ?');
  process.exit(1);
}

const destDir = path.join(__dirname, '..', 'renderer', 'assets', 'vendor');
fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, path.join(destDir, 'chart.umd.js'));
console.log('chart.js copié vers renderer/assets/vendor/chart.umd.js');
