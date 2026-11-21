// usage: node make_captions.cjs <outdir> <spec.json>   (renders one transparent PNG per segment caption)
const { chromium } = require('playwright');
const fs = require('fs');
const shadow = "text-shadow:0 0 14px rgba(0,0,0,.85),0 3px 6px rgba(0,0,0,.9),0 0 40px rgba(0,0,0,.5)";
(async () => {
  const [out, specPath] = process.argv.slice(2);
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8')); const segs = spec.segs;
  const capTop = spec.cap_top || 1270, capSize = spec.cap_size || 74;
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i]; let inner = '';
    if (s.title) inner = `<div style="position:absolute;left:60px;right:60px;top:560px;text-align:center;font-family:'Noto Sans Bengali';color:#fff;${shadow}">
        <div style="font-weight:700;font-size:104px;line-height:1.3">${s.title}</div>
        <div style="margin:26px auto 0;width:180px;height:6px;background:#fff;border-radius:3px;box-shadow:0 2px 8px rgba(0,0,0,.7)"></div>
        <div style="font-weight:400;font-size:56px;margin-top:26px">${s.sub || ''}</div></div>`;
    else if (s.cap) inner = `<div style="position:absolute;left:70px;right:70px;top:${capTop}px;text-align:center;font-family:'Noto Sans Bengali';font-weight:700;font-size:${capSize}px;line-height:1.45;color:#fff;${shadow}">${s.cap}
        ${s.tag ? `<div style="font-family:'Noto Sans',sans-serif;font-weight:700;font-size:60px;letter-spacing:4px;margin-top:18px">${s.tag}</div>` : ''}</div>`;
    await p.setContent(`<html><body style="margin:0;background:transparent;width:1080px;height:1920px;position:relative">${inner}</body></html>`);
    await p.screenshot({ path: `${out}/cap${i}.png`, omitBackground: true });
  }
  await b.close();
})();
