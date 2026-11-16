// usage: node make_captions.cjs <outdir> "line1" "line2" ...
const { chromium } = require('playwright');
(async () => {
  const [out, ...caps] = process.argv.slice(2);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  for (let i = 0; i < caps.length; i++) {
    await p.setContent(`<html><body style="margin:0;background:transparent;width:1080px;height:1920px;position:relative">
    <div style="position:absolute;left:70px;right:70px;top:1270px;text-align:center;font-family:'Noto Sans Bengali';font-weight:700;font-size:74px;line-height:1.45;color:#fff;text-shadow:0 0 14px rgba(0,0,0,.85),0 3px 6px rgba(0,0,0,.9),0 0 40px rgba(0,0,0,.5)">${caps[i]}</div></body></html>`);
    await p.screenshot({ path: `${out}/cap${i+1}.png`, omitBackground: true });
  }
  await b.close();
})();
