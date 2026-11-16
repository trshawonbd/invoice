const { chromium } = require('playwright');
const caps = [
  "আজ ফার্মে গিয়েছিলাম",
  "কী ঠান্ডা ছিল!",
  "ছোট্ট বন্ধুর সাথে হাঁসেদের দেখা",
  "ঠান্ডায় রোদটা কী সুন্দর!",
  "এই মুহূর্তগুলোই আসল সুখ"
];
(async () => {
  const out = process.argv[2];
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  for (let i = 0; i < caps.length; i++) {
    await p.setContent(`<html><body style="margin:0;background:transparent;width:1080px;height:1920px;position:relative">
    <div style="position:absolute;left:60px;right:60px;top:1280px;text-align:center">
    <span style="font-family:'Noto Sans Bengali';font-weight:700;font-size:70px;line-height:1.5;color:#fff;background:rgba(0,0,0,.45);padding:10px 36px;border-radius:30px;-webkit-box-decoration-break:clone;box-decoration-break:clone;text-shadow:0 2px 6px rgba(0,0,0,.6)">${caps[i]}</span></div></body></html>`);
    await p.screenshot({ path: `${out}/cap${i+1}.png`, omitBackground: true });
  }
  await b.close();
})();
