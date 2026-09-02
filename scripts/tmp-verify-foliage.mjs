import { chromium } from 'playwright';
const b = await chromium.launch(); const p = await b.newPage({ viewport:{width:1440,height:900}, deviceScaleFactor:1 });
await p.goto('http://localhost:4173/', { waitUntil:'networkidle' });
await p.waitForTimeout(800);
// Sample the foliage webp and hills webp directly via canvas (decoded pixel colors, no compositing)
const res = await p.evaluate(async () => {
  async function sample(src, rows){
    const img = new Image(); img.src = src; await img.decode();
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const ctx = c.getContext('2d'); ctx.drawImage(img,0,0);
    const out = {w:c.width,h:c.height,rows:{}};
    for (const y of rows){
      const d = ctx.getImageData(0, Math.round(y*c.height), c.width, 1).data;
      let n=0,r=0,g=0,bb=0;
      for (let i=0;i<d.length;i+=4){ if(d[i+3]>240){ n++; r+=d[i]; g+=d[i+1]; bb+=d[i+2]; } }
      out.rows[y] = n? {opaque:n, rgb:[Math.round(r/n),Math.round(g/n),Math.round(bb/n)]} : null;
    }
    return out;
  }
  const fol = await sample('/assets/foliage.webp', [0.35,0.42,0.5,0.6,0.75,0.9]);
  const hills = await sample('/assets/hills.webp', [0.45,0.55,0.7,0.85]);
  // Also composited page pixels: read hero-fg bounding box and screenshot-free DOM color checks
  const fg = document.querySelector('.hero-fg').getBoundingClientRect();
  const hw = document.querySelector('.hills-wrap').getBoundingClientRect();
  return { fol, hills, fgTop: fg.top, hillsTop: hw.top, vh: innerHeight };
});
console.log(JSON.stringify(res,null,1));
// composited screenshot pixel samples via canvas
for (const y of [0, 375]) {
  await p.evaluate(v=>window.scrollTo(0,v), y); await p.waitForTimeout(500);
  const buf = await p.screenshot();
  const px = await p.evaluate(async (b64) => {
    const img = new Image(); img.src = 'data:image/png;base64,'+b64; await img.decode();
    const c = document.createElement('canvas'); c.width=img.width; c.height=img.height; const ctx=c.getContext('2d'); ctx.drawImage(img,0,0);
    const pts = [[60,880],[300,895],[1380,880],[720,560],[720,650],[100,450],[1300,450],[720,780]];
    return pts.map(([x,y])=>{ const d=ctx.getImageData(x,y,1,1).data; return {x,y,rgb:[d[0],d[1],d[2]]}; });
  }, buf.toString('base64'));
  console.log('scrollY', y, JSON.stringify(px));
}
await b.close();
