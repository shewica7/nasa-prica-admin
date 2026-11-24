import "./style.css";

const app = document.querySelector("#app");
const savedPassword = sessionStorage.getItem("np_admin_password") || "";

const esc = (s = "") => String(s).replace(/[&<>"']/g, c => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[c]));

function shell(content) {
  app.innerHTML = `<header class="top"><div class="brand">NAŠA PRIČA <span>ADMIN</span></div><div class="topnote">Administracija personaliziranih stranica</div></header><main>${content}</main>`;
}

function loginView(message = "") {
  shell(`<section class="panel login"><div class="eyebrow">ZAŠTIĆENI PRISTUP</div><h1>Administracija</h1><p>Unesi administratorsku lozinku za pristup izradi stranica.</p>
    ${message ? `<div class="notice error">${esc(message)}</div>` : ""}
    <form id="loginForm"><label>Lozinka<input name="password" type="password" autocomplete="current-password" required autofocus></label><button class="primary">Prijava</button></form>
    <p class="hint">Lozinka se postavlja u Cloudflare Worker postavkama kao secret <code>ADMIN_PASSWORD</code>.</p></section>`);
  document.querySelector("#loginForm").addEventListener("submit", async e => {
    e.preventDefault();
    const password = new FormData(e.currentTarget).get("password");
    sessionStorage.setItem("np_admin_password", password);
    const r = await api("/api/pages");
    if (r.ok) adminView(await r.json());
    else { sessionStorage.removeItem("np_admin_password"); loginView(r.message || "Prijava nije uspjela."); }
  });
}

async function api(path, options = {}) {
  try {
    const response = await fetch(path, {
      ...options,
      headers: {
        ...(options.headers || {}),
        "X-Admin-Password": sessionStorage.getItem("np_admin_password") || ""
      }
    });
    const data = await response.json().catch(() => ({}));
    return {ok: response.ok, status: response.status, ...data};
  } catch {
    return {ok:false, message:"Nema veze sa serverom. Provjeri internetsku vezu."};
  }
}

function adminView(data = {pages:[]}) {
  const pages = data.pages || [];
  shell(`<div class="intro"><div><div class="eyebrow">RADNI PROSTOR</div><h1>Tvoje stranice</h1><p>Unesi podatke kupca i izradi privatnu stranicu s jedinstvenom poveznicom za NFC.</p></div><button id="logout" class="ghost">Odjava</button></div>
  <div class="layout">
    <section class="panel"><h2>Nova personalizirana stranica</h2>
      <form id="pageForm">
        <div class="two"><label>Ime 1<input name="name1" placeholder="Lara" required maxlength="50"></label><label>Ime 2<input name="name2" placeholder="Filip" required maxlength="50"></label></div>
        <label>Datum / posebna prigoda<input name="date" placeholder="14. lipnja 2022." maxlength="80"></label>
        <label>Naslovna fotografija<input name="hero" type="file" accept="image/*"></label>
        <label>Dodatne fotografije (do 5)<input name="gallery" type="file" accept="image/*" multiple></label>
        <label>Naslov pjesme<input name="songTitle" placeholder="Naša pjesma" maxlength="100"></label>
        <label>Spotify poveznica<input name="spotify" type="url" placeholder="https://open.spotify.com/track/..."></label>
        <label>Osobna poruka<textarea name="message" rows="4" placeholder="Napiši osobnu poruku..." maxlength="1500"></textarea></label>
        <label>Glasovna poruka (MP3, opcionalno)<input name="voice" type="file" accept="audio/*"></label>
        <label>Prilagođeni završetak<input name="footer" placeholder="Naša priča još traje... ♡" maxlength="120"></label>
        <button class="primary" id="createBtn">Izradi stranicu</button>
        <div id="formStatus" aria-live="polite"></div>
      </form>
    </section>
    <aside class="panel side"><h2>Postojeće stranice</h2>
      ${pages.length ? pages.map(p => `<div class="pageitem"><strong>${esc(p.name1)} & ${esc(p.name2)}</strong><small>${esc(p.date || "Bez datuma")}</small><a href="/p/${encodeURIComponent(p.slug)}" target="_blank" rel="noopener">Otvori stranicu ↗</a><button class="copy" data-url="${esc(location.origin + "/p/" + p.slug)}">Kopiraj NFC link</button></div>`).join("") : `<p class="hint">Još nema izrađenih stranica.</p>`}
    </aside>
  </div>
  <p class="hint bottomhint">Prije prve izrade potrebno je spojiti Cloudflare KV i R2 spremišta. Fotografije i audio datoteke pohranjuju se u R2, a podaci stranica u KV.</p>`);
  document.querySelector("#logout").onclick = () => {sessionStorage.removeItem("np_admin_password"); loginView();};
  document.querySelectorAll(".copy").forEach(b => b.onclick = async () => {
    await navigator.clipboard.writeText(b.dataset.url);
    b.textContent = "Kopirano ✓";
  });
  document.querySelector("#pageForm").addEventListener("submit", createPage);
}

async function upload(file) {
  if (!file) return null;
  const fd = new FormData(); fd.append("file", file);
  const r = await fetch("/api/upload", {method:"POST", headers:{"X-Admin-Password":sessionStorage.getItem("np_admin_password") || ""}, body:fd});
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.message || "Prijenos datoteke nije uspio.");
  return d.url;
}

async function createPage(e) {
  e.preventDefault();
  const form = e.currentTarget, btn = document.querySelector("#createBtn"), status = document.querySelector("#formStatus");
  const fd = new FormData(form);
  btn.disabled = true; btn.textContent = "Izrađujem…"; status.textContent = "Učitavam fotografije i pripremam stranicu…";
  try {
    const hero = await upload(fd.get("hero"));
    const galleryFiles = [...form.elements.gallery.files].slice(0,5);
    const gallery = [];
    for (const file of galleryFiles) gallery.push(await upload(file));
    const voice = await upload(fd.get("voice"));
    const payload = {
      name1:fd.get("name1"), name2:fd.get("name2"), date:fd.get("date"),
      hero, gallery:gallery.filter(Boolean), songTitle:fd.get("songTitle"),
      spotify:fd.get("spotify"), message:fd.get("message"), voice, footer:fd.get("footer")
    };
    const result = await api("/api/pages", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload)});
    if (!result.ok) throw new Error(result.message || "Spremanje nije uspjelo.");
    status.innerHTML = `Stranica je izrađena: <a target="_blank" rel="noopener" href="/p/${encodeURIComponent(result.slug)}">${location.origin}/p/${esc(result.slug)}</a>`;
    form.reset();
    const list = await api("/api/pages"); if (list.ok) adminView(list);
  } catch (err) {
    status.textContent = err.message;
  } finally {
    btn.disabled = false; btn.textContent = "Izradi stranicu";
  }
}

async function start() {
  if (!savedPassword) return loginView();
  const r = await api("/api/pages");
  if (r.ok) adminView(r);
  else loginView(r.message || "Prijava nije uspjela.");
}
start();