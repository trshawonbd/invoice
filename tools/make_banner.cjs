// usage: node make_banner.cjs <background.jpg> <out.jpg> "<name>" "<Bangla tagline>"
// YouTube banner 2560x1440; text kept inside the 1546x423 safe area that shows on every device
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const [bg, out, name, tag] = process.argv.slice(2);
  const data = 'data:image/jpeg;base64,' + fs.readFileSync(bg).toString('base64');
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 2560, height: 1440 } });
  await p.setContent(`<html><body style="margin:0;width:2560px;height:1440px;background:url('${data}') center/cover;position:relative;font-family:'Noto Sans Bengali','Noto Sans',sans-serif">
  <div style="position:absolute;inset:0;background:radial-gradient(ellipse at center,rgba(0,15,30,.50) 0%,rgba(0,15,30,.15) 60%,rgba(0,0,0,0) 100%)"></div>
  <div style="position:absolute;left:507px;top:508px;width:1546px;height:423px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;text-shadow:0 3px 16px rgba(0,0,0,.75)">
    <div style="font-family:'Noto Sans',sans-serif;font-weight:800;font-size:118px;letter-spacing:2px">${name}</div>
    <div style="font-weight:700;font-size:62px;margin-top:8px">${tag}</div>
  </div></body></html>`, { waitUntil: 'load' });
  await p.screenshot({ path: out, type: 'jpeg', quality: 92 }); await b.close();
})();
