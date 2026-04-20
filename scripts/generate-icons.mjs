import sharp from 'sharp';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const saida = join(__dirname, '../public/icons');
mkdirSync(saida, { recursive: true });

// Design: C e A grandes sobrepostos, com duas barras diagonais brancas cruzando ambas as letras
// As barras são retângulos SVG rotacionados, não caracteres de texto
function gerarSVG(tamanho) {
  return `<svg xmlns="http://www.w3.org/2000/svg"
  width="${tamanho}" height="${tamanho}" viewBox="0 0 500 500">

  <defs>
    <!-- brilho: highlight claro no topo-esquerda, escurece suave em baixo -->
    <radialGradient id="brilho" cx="35%" cy="25%" r="70%">
      <stop offset="0%"   stop-color="#c8f542" stop-opacity="1"/>
      <stop offset="60%"  stop-color="#A3E635" stop-opacity="1"/>
      <stop offset="100%" stop-color="#82c420" stop-opacity="1"/>
    </radialGradient>
    <clipPath id="clip">
      <rect width="500" height="500" rx="80" ry="80"/>
    </clipPath>
  </defs>

  <!-- fundo com gradiente de brilho -->
  <rect width="500" height="500" rx="80" ry="80" fill="url(#brilho)"/>

  <!-- C grande ancorado à esquerda -->
  <text x="-10" y="390"
    font-family="'Arial Black','Impact',sans-serif"
    font-weight="900" font-size="380"
    fill="#0a0a0a" text-anchor="start">C</text>

  <!-- A grande sobreposto à direita -->
  <text x="215" y="390"
    font-family="'Arial Black','Impact',sans-serif"
    font-weight="900" font-size="380"
    fill="#0a0a0a" text-anchor="start">A</text>

  <!-- barras diagonais brancas com clip no arredondado -->
  <g clip-path="url(#clip)">
    <rect x="213" y="-60" width="26" height="620"
      fill="white" transform="rotate(-18, 226, 250)"/>
    <rect x="257" y="-60" width="26" height="620"
      fill="white" transform="rotate(-18, 270, 250)"/>
  </g>

</svg>`;
}

const arquivos = [
  { nome: 'favicon-32.png', tamanho: 32  },
  { nome: 'icon-192.png',   tamanho: 192 },
  { nome: 'icon-512.png',   tamanho: 512 },
];

for (const { nome, tamanho } of arquivos) {
  const svg = gerarSVG(tamanho);
  await sharp(Buffer.from(svg))
    .png({ compressionLevel: 9 })
    .toFile(join(saida, nome));
  console.log(`✓  ${nome}  (${tamanho}×${tamanho})`);
}

console.log('\nÍcones gerados em public/icons/');
