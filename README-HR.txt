NAŠA PRIČA – početna aplikacija

ŠTO JE OVO
- Vite aplikacija za administratorski panel.
- Cloudflare Worker API za spremanje stranica, fotografija i audio datoteka.
- Javna stranica kupca otvara se na /p/ime1-ime2.
- Ovo je početna verzija. Postojeća javna stranica Lara & Filip nije mijenjana.

VAŽNO PRIJE KORIŠTENJA
U Cloudflare Worker postavkama treba:
1. Dodati secret varijablu ADMIN_PASSWORD.
2. Kreirati KV namespace i povezati ga kao binding PAGES.
3. Kreirati R2 bucket i povezati ga kao binding MEDIA.

Dok se ta tri koraka ne naprave, aplikacija se može izgraditi/objaviti, ali neće moći trajno spremati stranice ni datoteke.

GITHUB UPLOAD
Raspakiraj ZIP. Na GitHubu otvori nasa-prica-admin > Add file > Upload files.
Povuci sadržaj raspakirane mape (index.html, package.json, vite.config.js, wrangler.jsonc, README-HR.txt i mapu src).
Zatim klikni Commit changes.

CLOUDFLARE BUILD
Build command: npm run build
Deploy command, ako ga Cloudflare traži: npx wrangler deploy

SIGURNOST
Nemoj dijeliti ADMIN_PASSWORD. Ne stavljaj lozinku u GitHub datoteke.
