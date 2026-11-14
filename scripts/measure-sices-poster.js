// Mide la altura de cada bloque del informe SICES para calibrar el layout A4.
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const file = 'file://' + path.resolve(process.argv[2] || 'SICES-descripcion-proyecto.html');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 794, height: 1123 } });
  await page.goto(file, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const data = await page.evaluate(() => {
    const m = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return Math.round(r.height);
    };
    return {
      poster_scroll: document.querySelector('.poster').scrollHeight,
      content: m('.content'),
      header: m('header'),
      bleed1: m('.bleed'),
      stats: m('.stats'),
      vision: m('.vision'),
      cols: m('.cols'),
      col_arch: m('.col-arch'),
      col_func: m('.col-func'),
      arch_ul: m('.arch ul'),
      funcs_wrap: m('.funcs > div'),
      datos: m('.datos'),
      tabla: m('table.data'),
      import: m('.import'),
      steps: m('.steps'),
      footer: m('.footer'),
    };
  });
  console.log(JSON.stringify(data, null, 1));
  await browser.close();
})();
