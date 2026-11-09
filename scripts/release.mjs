// Sürüm yayınlama yardımcısı.
// Kullanım: npm run release -- yama | küçük | büyük   (veya patch | minor | major)
// 1) package.json sürümünü yükseltir
// 2) CHANGELOG.md'deki "## [Yayınlanmamış]" altındaki maddeleri yeni sürüm başlığına taşır
// Sonra: git add -A && git commit -m "Sürüm X.Y.Z" && git tag vX.Y.Z && git push --follow-tags
import { readFileSync, writeFileSync } from 'node:fs';

const kind = { yama: 'patch', küçük: 'minor', kucuk: 'minor', büyük: 'major', buyuk: 'major' }[process.argv[2]] || process.argv[2];
if (!['patch', 'minor', 'major'].includes(kind)) {
  console.error('Kullanım: npm run release -- yama | küçük | büyük');
  process.exit(1);
}
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
let [maj, min, pat] = pkg.version.split('.').map(Number);
if (kind === 'major') { maj++; min = 0; pat = 0; } else if (kind === 'minor') { min++; pat = 0; } else pat++;
const next = `${maj}.${min}.${pat}`;

const md = readFileSync('CHANGELOG.md', 'utf8');
const head = '## [Yayınlanmamış]';
const i = md.indexOf(head);
if (i < 0) { console.error('CHANGELOG.md içinde "## [Yayınlanmamış]" başlığı yok.'); process.exit(1); }
const rest = md.slice(i + head.length);
const nextHeading = rest.search(/\n## \[/);
const body = (nextHeading < 0 ? rest : rest.slice(0, nextHeading)).trim();
if (!body) { console.error('"Yayınlanmamış" bölümü boş: önce yapılan değişiklikleri oraya yazın.'); process.exit(1); }
const date = new Date().toISOString().slice(0, 10);
const after = nextHeading < 0 ? '' : rest.slice(nextHeading);
writeFileSync('CHANGELOG.md', `${md.slice(0, i)}${head}\n\n## [${next}] - ${date}\n\n${body}\n${after}`);

pkg.version = next;
writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
console.log(`Sürüm ${next} hazır. Şimdi:\n  git add -A && git commit -m "Sürüm ${next}" && git tag v${next} && git push --follow-tags`);
