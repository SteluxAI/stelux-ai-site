import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// The paper-trading publisher supplies the dashboard. This site-owned layer is
// reapplied after each build so a fresh upstream copy cannot reintroduce noindex.
// It changes discoverability and explanatory copy only; the simulation is intact.
export const ARENA_URL = 'https://stelux.ai/arena/'
export const ARENA_COPY = {
  en: ['AI Stock & Crypto Paper Trading', 'Compare stock and crypto strategies with simulated money', 'Explore strategy leaderboards, equity curves, positions and trade logs using real market quotes and simulated money. This read-only paper trading dashboard sends no real orders and is not investment advice.', 'More from Stelux AI'],
  'zh-CN': ['AI 股票与加密资产模拟交易', '用虚拟资金比较股票和加密资产策略', '使用真实市场行情和虚拟资金，查看策略排行榜、净值曲线、持仓与模拟成交记录。本看板仅供只读研究，不发出真实交易委托，也不构成投资建议。', '探索更多 Stelux AI 产品'],
  'zh-TW': ['AI 股票與加密資產模擬交易', '用虛擬資金比較股票和加密資產策略', '使用真實市場行情和虛擬資金，查看策略排行榜、淨值曲線、持倉與模擬成交紀錄。本看板僅供唯讀研究，不發出真實交易委託，也不構成投資建議。', '探索更多 Stelux AI 產品'],
  ja: ['AI 株式・暗号資産のペーパートレード', '仮想資金で株式と暗号資産の戦略を比較', '実際の市場価格と仮想資金を使い、戦略ランキング、資産推移、保有ポジション、模擬取引履歴を確認できます。閲覧専用のペーパートレード画面で、実際の注文は送信せず、投資助言も行いません。', 'Stelux AI のその他の製品'],
  ko: ['AI 주식·암호화폐 모의투자', '가상 자금으로 주식과 암호화폐 전략 비교', '실제 시장 시세와 가상 자금을 사용한 전략 순위, 자산 곡선, 보유 포지션과 모의 거래 기록을 확인하세요. 이 대시보드는 조회 전용이며 실제 주문을 전송하지 않고 투자 조언을 제공하지 않습니다.', 'Stelux AI의 다른 제품'],
  es: ['Simulación de trading de acciones y criptomonedas con IA', 'Compara estrategias de acciones y criptomonedas con dinero simulado', 'Explora clasificaciones de estrategias, curvas de capital, posiciones e historiales de operaciones con cotizaciones reales y dinero simulado. Este panel es de solo lectura: no envía órdenes reales ni ofrece asesoramiento de inversión.', 'Más productos de Stelux AI'],
  'pt-BR': ['Simulação de negociação de ações e criptomoedas com IA', 'Compare estratégias de ações e criptomoedas com dinheiro simulado', 'Explore rankings de estratégias, curvas de patrimônio, posições e registros de operações com cotações reais e dinheiro simulado. Este painel é somente leitura: não envia ordens reais nem oferece aconselhamento de investimento.', 'Mais produtos da Stelux AI'],
  fr: ['Trading simulé d’actions et de cryptomonnaies avec l’IA', 'Comparez des stratégies sur actions et cryptomonnaies avec de l’argent virtuel', 'Consultez les classements des stratégies, les courbes de capital, les positions et les journaux de transactions avec des cours réels et de l’argent virtuel. Ce tableau de bord est en lecture seule : aucun ordre réel ni conseil en investissement.', 'Les autres produits Stelux AI'],
  de: ['KI-Paper-Trading für Aktien und Kryptowährungen', 'Aktien- und Kryptostrategien mit virtuellem Geld vergleichen', 'Vergleichen Sie Strategieranglisten, Kapitalkurven, Positionen und Handelsprotokolle mit echten Marktkursen und virtuellem Geld. Dieses Dashboard ist schreibgeschützt, sendet keine echten Aufträge und bietet keine Anlageberatung.', 'Weitere Produkte von Stelux AI'],
  it: ['Trading simulato di azioni e criptovalute con IA', 'Confronta strategie su azioni e criptovalute con denaro virtuale', 'Esplora classifiche delle strategie, curve del capitale, posizioni e registri delle operazioni con quotazioni reali e denaro virtuale. Questo pannello è di sola lettura: non invia ordini reali e non offre consulenza sugli investimenti.', 'Altri prodotti Stelux AI'],
  ru: ['Бумажная торговля акциями и криптовалютами с ИИ', 'Сравнивайте стратегии для акций и криптовалют на виртуальные средства', 'Изучайте рейтинги стратегий, графики капитала, позиции и историю сделок с реальными рыночными котировками и виртуальными средствами. Панель доступна только для просмотра, не отправляет реальные заявки и не предоставляет инвестиционных рекомендаций.', 'Другие продукты Stelux AI'],
  tr: ['Yapay zekâ ile hisse ve kripto işlem simülasyonu', 'Sanal parayla hisse ve kripto stratejilerini karşılaştırın', 'Gerçek piyasa fiyatları ve sanal parayla strateji sıralamalarını, sermaye eğrilerini, pozisyonları ve işlem kayıtlarını inceleyin. Bu pano salt okunurdur; gerçek emir göndermez ve yatırım tavsiyesi sunmaz.', 'Diğer Stelux AI ürünleri'],
  id: ['Simulasi perdagangan saham dan kripto dengan AI', 'Bandingkan strategi saham dan kripto dengan uang virtual', 'Lihat peringkat strategi, kurva ekuitas, posisi, dan catatan transaksi dengan harga pasar nyata dan uang virtual. Dasbor ini hanya dapat dibaca, tidak mengirim pesanan nyata, dan bukan saran investasi.', 'Produk Stelux AI lainnya'],
  vi: ['Giao dịch mô phỏng cổ phiếu và tiền mã hóa với AI', 'So sánh chiến lược cổ phiếu và tiền mã hóa bằng tiền ảo', 'Xem bảng xếp hạng chiến lược, đường vốn, vị thế và lịch sử giao dịch với giá thị trường thực và tiền mô phỏng. Bảng điều khiển này chỉ cho phép xem, không gửi lệnh thật và không cung cấp tư vấn đầu tư.', 'Các sản phẩm khác của Stelux AI'],
  th: ['จำลองการซื้อขายหุ้นและคริปโตด้วย AI', 'เปรียบเทียบกลยุทธ์หุ้นและคริปโตด้วยเงินเสมือน', 'ดูอันดับกลยุทธ์ กราฟมูลค่าพอร์ต สถานะการถือครอง และบันทึกการซื้อขาย โดยใช้ราคาตลาดจริงและเงินเสมือน แดชบอร์ดนี้ใช้ดูข้อมูลเท่านั้น ไม่ส่งคำสั่งซื้อขายจริง และไม่ใช่คำแนะนำการลงทุน', 'ผลิตภัณฑ์อื่น ๆ ของ Stelux AI'],
  hi: ['AI के साथ शेयर और क्रिप्टो की सिम्युलेटेड ट्रेडिंग', 'वर्चुअल पैसे से शेयर और क्रिप्टो रणनीतियों की तुलना करें', 'असली बाज़ार भाव और वर्चुअल पैसे के साथ रणनीति रैंकिंग, पूँजी के ग्राफ़, होल्डिंग और सौदों के रिकॉर्ड देखें। यह डैशबोर्ड केवल देखने के लिए है; यह असली ऑर्डर नहीं भेजता और निवेश सलाह नहीं देता।', 'Stelux AI के अन्य उत्पाद'],
  ar: ['محاكاة تداول الأسهم والعملات المشفرة بالذكاء الاصطناعي', 'قارن استراتيجيات الأسهم والعملات المشفرة بأموال افتراضية', 'استعرض ترتيب الاستراتيجيات ومنحنيات رأس المال والمراكز وسجلات التداول باستخدام أسعار السوق الحقيقية وأموال افتراضية. هذه اللوحة للعرض فقط؛ لا ترسل أوامر حقيقية ولا تقدم نصائح استثمارية.', 'المزيد من منتجات Stelux AI'],
}

const escapeHtml = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
const json = value => JSON.stringify(value).replaceAll('<', '\\u003c')
const title = copy => `Arena — ${copy[0]} | Stelux AI`
const marker = (name, content) => `<!-- STELUX_ARENA_SEO_${name}_START -->\n${content}\n<!-- STELUX_ARENA_SEO_${name}_END -->`

export function applyArenaSeo(source) {
  let html = source.replace(/<!-- STELUX_ARENA_SEO_(HEAD|INTRO|RUNTIME)_START -->[\s\S]*?<!-- STELUX_ARENA_SEO_\1_END -->\r?\n?/g, '')
  if (!html.includes('window.ARENA_STATIC=') || !html.includes('const SITE_LANGS = [') || !html.includes('<div class="wrap">')) {
    throw new Error('Unrecognized Arena publisher output; review the SEO integration before publishing.')
  }
  const copy = ARENA_COPY['zh-CN']
  html = html.replace(/<meta\b[^>]*(?:name|property)=["'](?:robots|description|og:title|og:description|og:url|og:site_name|twitter:title|twitter:description)["'][^>]*>\r?\n?/gi, '')
    .replace(/<link\b[^>]*rel=["']canonical["'][^>]*>\r?\n?/gi, '')
    .replace(/<link\b[^>]*rel=["']icon["'][^>]*>\r?\n?/gi, '')
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title(copy))}</title>`)
  const schema = {
    '@context': 'https://schema.org', '@graph': [
      { '@type': 'WebPage', '@id': `${ARENA_URL}#webpage`, url: ARENA_URL, name: title(copy), description: copy[2], inLanguage: 'zh-CN', isPartOf: { '@id': 'https://stelux.ai/#website' }, about: { '@id': `${ARENA_URL}#application` }, publisher: { '@type': 'Organization', name: 'Stelux AI', url: 'https://stelux.ai/' } },
      { '@type': 'Thing', '@id': `${ARENA_URL}#application`, name: 'Stelux Arena', url: ARENA_URL, description: copy[2] },
    ],
  }
  const head = marker('HEAD', `<meta name="robots" content="index,follow,max-image-preview:large">
<meta name="description" content="${escapeHtml(copy[2])}">
<link rel="canonical" href="${ARENA_URL}">
<link rel="icon" type="image/png" sizes="180x180" href="https://stelux.ai/arena/apple-touch-icon.png">
<meta property="og:site_name" content="Stelux AI">
<meta property="og:url" content="${ARENA_URL}">
<meta property="og:title" content="${escapeHtml(title(copy))}">
<meta property="og:description" content="${escapeHtml(copy[2])}">
<meta name="twitter:title" content="${escapeHtml(title(copy))}">
<meta name="twitter:description" content="${escapeHtml(copy[2])}">
<script type="application/ld+json" id="arena-seo-schema">${json(schema)}</script>
<style id="arena-seo-style">
.arena-intro{margin:0 0 18px;max-width:88ch;overflow-wrap:anywhere}
.arena-intro h2{margin:0 0 7px;font-size:clamp(18px,2.2vw,23px);line-height:1.3;letter-spacing:-.02em}
.arena-intro p{margin:0;color:var(--ink2);font-size:14px;line-height:1.6}
.arena-intro a{display:inline-flex;align-items:center;min-height:44px;color:var(--blue-ink);text-decoration:underline;text-underline-offset:3px}
</style>`)
  html = html.replace('</head>', `${head}\n</head>`)
  const intro = marker('INTRO', `<section class="arena-intro" aria-labelledby="arena-intro-heading" data-noi18n>
  <h2 id="arena-intro-heading">${escapeHtml(copy[1])}</h2>
  <p id="arena-intro-description">${escapeHtml(copy[2])}</p>
  <a id="arena-intro-link" href="https://stelux.ai/">${escapeHtml(copy[3])}</a>
</section>`)
  html = html.replace(/<div class="wrap">(?:\r?\n)*/, `<div class="wrap">\n${intro}\n`)
  const runtime = marker('RUNTIME', `<script id="arena-seo-runtime">
(function () {
  var copyByLanguage = ${json(ARENA_COPY)};
  var lang = document.documentElement.lang;
  var copy = copyByLanguage[lang] || copyByLanguage.en;
  var title = 'Arena — ' + copy[0] + ' | Stelux AI';
  document.title = title;
  [['name', 'description', copy[2]], ['property', 'og:title', title], ['property', 'og:description', copy[2]], ['name', 'twitter:title', title], ['name', 'twitter:description', copy[2]]].forEach(function (item) {
    var meta = document.querySelector('meta[' + item[0] + '="' + item[1] + '"]');
    if (meta) meta.setAttribute('content', item[2]);
  });
  ['heading', 'description', 'link'].forEach(function (id, i) {
    var element = document.getElementById('arena-intro-' + id);
    if (element) element.textContent = copy[i + 1];
  });
  var schemaElement = document.getElementById('arena-seo-schema');
  if (schemaElement) {
    var schema = JSON.parse(schemaElement.textContent);
    schema['@graph'][0].name = title;
    schema['@graph'][0].description = copy[2];
    schema['@graph'][0].inLanguage = lang;
    schema['@graph'][1].description = copy[2];
    schemaElement.textContent = JSON.stringify(schema);
  }
})();
</script>`)
  return html.replace('</body>', `${runtime}\n</body>`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = path.resolve(process.argv[2] || 'dist/arena/index.html')
  const source = fs.readFileSync(target, 'utf8')
  const result = applyArenaSeo(source)
  if (result !== source) fs.writeFileSync(target, result)
  console.log(JSON.stringify({ arenaSeo: 'ready', languages: Object.keys(ARENA_COPY).length, updated: result !== source }))
}
