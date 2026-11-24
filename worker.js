const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
});
const esc = (s = "") => String(s).replace(/[&<>"']/g, c => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[c]));
const safeSlug = s => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,55);

function authorized(request, env) {
  const configured = env.ADMIN_PASSWORD;
  return Boolean(configured && request.headers.get("X-Admin-Password") === configured);
}
async function handle(request, env) {
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/media/")) {
    if (url.pathname.startsWith("/api/") && !authorized(request, env)) return json({message: env.ADMIN_PASSWORD ? "Pogrešna lozinka." : "Administrator još nije postavio ADMIN_PASSWORD u Cloudflare postavkama."}, 401);
  }
  if (url.pathname === "/api/pages" && request.method === "GET") {
    if (!env.PAGES) return json({message:"KV spremište PAGES još nije povezano."},503);
    const keys = await env.PAGES.list({prefix:"page:"});
    const pages = [];
    for (const key of keys.keys) {
      const page = await env.PAGES.get(key.name, "json");
      if (page) pages.push({slug:page.slug,name1:page.name1,name2:page.name2,date:page.date});
    }
    return json({pages:pages.reverse()});
  }
  if (url.pathname === "/api/upload" && request.method === "POST") {
    if (!env.MEDIA) return json({message:"R2 spremište MEDIA još nije povezano."},503);
    const form = await request.formData(), file = form.get("file");
    if (!file || typeof file === "string") return json({message:"Datoteka nije pronađena."},400);
    if (file.size > 12 * 1024 * 1024) return json({message:"Datoteka je prevelika (maksimalno 12 MB)."},413);
    if (!/^(image\/(jpeg|png|webp)|audio\/(mpeg|mp4|wav|ogg|webm))$/.test(file.type)) return json({message:"Podržane su JPG, PNG, WebP fotografije i uobičajeni audio formati."},415);
    const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g,"").slice(0,8);
    const key = `${crypto.randomUUID()}.${ext}`;
    await env.MEDIA.put(key, file.stream(), {httpMetadata:{contentType:file.type}});
    return json({url:`/media/${key}`});
  }
  if (url.pathname === "/api/pages" && request.method === "POST") {
    if (!env.PAGES) return json({message:"KV spremište PAGES još nije povezano."},503);
    const p = await request.json();
    if (!p.name1 || !p.name2) return json({message:"Potrebna su oba imena."},400);
    const base = safeSlug(`${p.name1}-${p.name2}`) || "nasa-prica";
    let slug = base, n = 2;
    while (await env.PAGES.get(`page:${slug}`)) slug = `${base}-${n++}`;
    const page = {
      slug, name1:String(p.name1).slice(0,50), name2:String(p.name2).slice(0,50),
      date:String(p.date || "").slice(0,80), hero:String(p.hero || ""),
      gallery:Array.isArray(p.gallery) ? p.gallery.slice(0,5) : [],
      songTitle:String(p.songTitle || "").slice(0,100), spotify:String(p.spotify || "").slice(0,500),
      message:String(p.message || "").slice(0,1500), voice:String(p.voice || ""),
      footer:String(p.footer || "Naša priča još traje... ♡").slice(0,120),
      createdAt:new Date().toISOString()
    };
    await env.PAGES.put(`page:${slug}`, JSON.stringify(page));
    return json({ok:true,slug});
  }
  if (url.pathname.startsWith("/media/") && request.method === "GET") {
    if (!env.MEDIA) return new Response("Media storage is not configured", {status:503});
    const key = url.pathname.slice("/media/".length);
    const object = await env.MEDIA.get(key);
    if (!object) return new Response("Not found", {status:404});
    const headers = new Headers();
    object.writeHttpMetadata(headers); headers.set("Cache-Control","public, max-age=31536000, immutable");
    return new Response(object.body,{headers});
  }
  if (url.pathname.startsWith("/p/") && request.method === "GET") {
    if (!env.PAGES) return new Response("Stranice još nisu konfigurirane.",{status:503});
    const slug = decodeURIComponent(url.pathname.slice(3));
    const p = await env.PAGES.get(`page:${slug}`,"json");
    if (!p) return new Response("Stranica nije pronađena.",{status:404});
    const spotifyId = (p.spotify.match(/open\.spotify\.com\/(?:embed\/)?track\/([A-Za-z0-9]+)/) || [])[1];
    const spotify = spotifyId ? `<iframe src="https://open.spotify.com/embed/track/${spotifyId}" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>` : `<p class="small">Dodaj svoju pjesmu u glazbenu aplikaciju.</p>`;
    const photos = [p.hero,...p.gallery].filter(Boolean);
    const gallery = photos.length ? photos.map((src,i)=>`<img src="${esc(src)}" alt="Uspomena ${i+1}">`).join("") : "";
    const voice = p.voice ? `<audio controls preload="none" src="${esc(p.voice)}"></audio>` : "";
    const html = `<!doctype html><html lang="hr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(p.name1)} & ${esc(p.name2)} – Naša priča</title><style>
      *{box-sizing:border-box}body{margin:0;background:#171510;color:#eee5d7;font-family:Georgia,serif}main{max-width:760px;margin:auto;padding:45px 22px 65px}.eyebrow,.small{text-align:center;color:#c9a66b;font:11px Arial;letter-spacing:2px}.hero{display:block;width:100%;max-height:520px;object-fit:cover;border-radius:5px;margin:25px auto}h1{text-align:center;font-size:clamp(38px,8vw,64px);font-weight:400;margin:20px 0 5px}.gold{color:#c9a66b}.subtitle,.date,footer{text-align:center;color:#c9a66b}.subtitle{font-style:italic;font-size:19px}.date{margin:25px 0;letter-spacing:2px;font:12px Arial}hr{border:0;border-top:1px solid #57472f;margin:35px 0}h2{text-align:center;font-size:24px;font-weight:400}.music,.voice{background:#201e19;padding:18px;border:1px solid #57472f;border-radius:8px}iframe{width:100%;height:152px;border:0;border-radius:8px}.gallery{display:grid;grid-template-columns:1fr 1fr;gap:10px}.gallery img{width:100%;height:210px;object-fit:cover;border-radius:5px}.gallery img:first-child{grid-column:span 2;height:300px}.message{text-align:center;font-size:19px;line-height:1.8;font-style:italic;color:#e5d5bd;white-space:pre-wrap}audio{width:100%;margin-top:12px}footer{font-size:18px;font-style:italic;margin-top:45px}@media(max-width:500px){main{padding:30px 15px}.gallery img{height:150px}.gallery img:first-child{height:220px}}</style></head><body><main><div class="eyebrow">A STORY WRITTEN IN MUSIC</div>${p.hero?`<img class="hero" src="${esc(p.hero)}" alt="Naša uspomena">`:""}<h1>${esc(p.name1)} <span class="gold">&</span> ${esc(p.name2)}</h1><div class="subtitle">Naša priča, naša pjesma.</div>${p.date?`<div class="date">${esc(p.date)}</div>`:""}<hr><section><h2>♪ ${esc(p.songTitle || "Naša pjesma")}</h2><div class="music">${spotify}</div></section>${gallery?`<hr><section><h2>♡ Naše uspomene</h2><div class="gallery">${gallery}</div></section>`:""}${p.message||voice?`<hr><section><h2>♡ Jedna poruka za tebe</h2><div class="voice">${p.message?`<p class="message">${esc(p.message)}</p>`:""}${voice?`<p class="small">Naša glasovna uspomena</p>${voice}`:""}</div></section>`:""}<footer>${esc(p.footer)}</footer></main></body></html>`;
    return new Response(html,{headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"}});
  }
  return env.ASSETS.fetch(request);
}
export default {fetch:handle};