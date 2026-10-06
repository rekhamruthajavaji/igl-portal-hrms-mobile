# Deployment Guide — IGL Portal (Free)

Deploy the full app to the internet for **$0** using **Vercel** (frontend) + **Render** (backend). No credit card needed.

> **Cold-start behavior:** Render's free tier puts the backend to sleep after ~15 minutes of inactivity. The first request after that takes ~30 seconds to respond. The SQLite database is wiped on restart — but we auto-reseed on empty DB, so demo accounts always work.

---

## Prerequisites — what you need

1. **GitHub account** — https://github.com (sign up free)
2. **Git installed on your computer** — https://git-scm.com/download (if not already)
3. **Vercel account** — https://vercel.com (sign up with GitHub)
4. **Render account** — https://render.com (sign up with GitHub)

That's it. Roughly 30 minutes start to finish.

---

## Step 1 — Push the code to GitHub

Open PowerShell in the `HRMS` folder and run:

```powershell
cd c:\Users\FerozR-IL\Desktop\HRMS
git init
git add .
git commit -m "Initial commit: IGL Portal"
```

Now create a new repository on GitHub:
1. Go to https://github.com/new
2. Name it something like `igl-portal`
3. **Don't** add a README/.gitignore/license (we already have one)
4. Click **Create repository**

Then connect your local code to GitHub (copy these lines from the GitHub page, or adapt — replace `YOUR_USERNAME`):

```powershell
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/igl-portal.git
git push -u origin main
```

Refresh GitHub — you should see all your files.

---

## Step 2 — Deploy the backend on Render

1. Go to https://dashboard.render.com/
2. Click **New +** → **Web Service**
3. Click **Connect a repository** → authorize Render to read GitHub → select your `igl-portal` repo
4. Fill in the form:
   - **Name**: `igl-portal-api` (or any name — this becomes the URL)
   - **Region**: closest to you (e.g. Singapore for India)
   - **Branch**: `main`
   - **Root Directory**: `server`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: **Free**
5. Scroll down to **Environment Variables** and add:
   - `JWT_SECRET` → click **Generate** for a random value
   - `JWT_EXPIRES_IN` → `7d`
   - `NODE_ENV` → `production`
   - (Leave `CLIENT_URL` blank for now — we'll set it after deploying the frontend)
6. Click **Create Web Service**

Render will start building. After ~3–5 minutes you'll see a green **Live** badge and a URL like:

```
https://igl-portal-api.onrender.com
```

**Copy this URL — you need it for Step 3.**

Open `https://igl-portal-api.onrender.com/api/health` in a new tab. You should see:
```json
{ "ok": true, "service": "IGL Portal API" }
```

---

## Step 3 — Deploy the frontend on Vercel

1. Go to https://vercel.com/new
2. Click **Import** next to your `igl-portal` repo (authorize Vercel for GitHub if asked)
3. Configure the project:
   - **Framework Preset**: Vite (should auto-detect)
   - **Root Directory**: click **Edit** → select `client`
   - **Build Command**: `npm run build` (auto)
   - **Output Directory**: `dist` (auto)
4. Expand **Environment Variables** and add:
   - **Name**: `VITE_API_URL`
   - **Value**: paste your Render backend URL from Step 2 (e.g. `https://igl-portal-api.onrender.com`) — **without** a trailing slash
5. Click **Deploy**

After ~1–2 minutes you get a URL like:

```
https://igl-portal.vercel.app
```

**Open it — but don't try to log in yet.** We need one more step.

---

## Step 4 — Tell the backend to trust the frontend

Right now the Render backend rejects requests from the Vercel domain (CORS protection). We already allow any `*.vercel.app` URL by default, but let's lock it down properly.

1. Go back to https://dashboard.render.com/
2. Click your `igl-portal-api` service
3. Click **Environment** in the left sidebar
4. Edit `CLIENT_URL` and set its value to your full Vercel URL (no trailing slash):
   ```
   https://igl-portal.vercel.app
   ```
5. Click **Save Changes**

Render will auto-redeploy in ~1 minute.

---

## Step 5 — Log in

Open your Vercel URL (`https://igl-portal.vercel.app`). The first request will take ~30 seconds because Render is waking up — be patient.

Use any demo account:
- Admin (HR): `admin@igenielabs.com` / `Admin@123`
- Manager: `manager@igenielabs.com` / `Manager@123`
- Employee: `employee@igenielabs.com` / `Employee@123`

You're live.

---

## Troubleshooting

**"Login failed" or page hangs on first try**
The backend is waking up from sleep. Wait 30 seconds and try again.

**Login still fails after backend is awake**
Open browser DevTools (F12) → Console tab → see any error?
- *"CORS"* or *"blocked by CORS policy"* → double-check `CLIENT_URL` on Render exactly matches your Vercel URL (no trailing slash, no typo, https not http)
- *"Network error"* → check the Render service is **Live** (green badge in dashboard)

**Documents/leaves I created disappeared**
That's expected. The free Render disk resets on cold start. The demo accounts always come back via auto-seed.

**I want to keep my own data persistent**
Upgrade Render to a paid plan ($7/mo, gives persistent disk) OR ask to migrate to free Neon PostgreSQL (500 MB persistent free).

**Deploys aren't picking up my latest changes**
Both Render and Vercel auto-deploy on `git push origin main`. If you pushed and nothing happened, check the **Deployments** tab in each dashboard for build errors.

**Different employee logging in sees old data**
Cold start may have just wiped+reseeded the DB. Refresh.

---

## Custom domain (optional, also free)

- Vercel: Project Settings → Domains → add yours (you need to own one; free options are rare — Freenom is unreliable, look into `is-a.dev` for a free dev subdomain)
- Render: Service → Settings → Custom Domain → add yours and update DNS

---

## What you'd pay if you outgrow free

| Service | Free tier limit | First paid tier |
|---|---|---|
| Vercel | 100 GB bandwidth/mo (plenty) | $20/mo if exceeded |
| Render Web Service | sleeps after 15 min idle | $7/mo always-on + 1 GB persistent disk |
| Render Postgres (optional) | 256 MB, expires after 90 days | $7/mo |
| Neon Postgres (alt) | 500 MB free forever | $19/mo if exceeded |

For a college/personal project demo, the free tier is more than enough.
