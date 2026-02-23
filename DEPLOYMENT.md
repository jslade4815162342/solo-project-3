# Movie Collection Manager — Deployment

## Live URL
- https://jslade-movie-collection-manager.org  
- (Optional) https://www.jslade-movie-collection-manager.org

## Domain
- Domain: `jslade-movie-collection-manager.org`
- Registrar / DNS: Cloudflare (domain managed in Cloudflare DNS)

## Hosting Provider
- Render (single Web Service deployment)

## Tech Stack
- Backend: Python + Flask + Gunicorn
- Frontend: Vanilla HTML/CSS/JavaScript served by Flask
- ORM: SQLAlchemy (Flask-SQLAlchemy)
- Database: PostgreSQL

## Database
- Type: PostgreSQL
- Hosted on: Render Postgres
- Connection: Web Service reads `DATABASE_URL` from environment variables

## Architecture Snapshot (Option B: Single Service)
- Client (browser):
  - Renders UI (List / Add-Edit / Stats)
  - Sends HTTP requests to same-origin API endpoints under `/api/*`
  - Handles paging UI, sorting UI, search UI, cookie persistence for page size
- Server (Flask):
  - Serves frontend files:
    - `GET /` renders `templates/index.html`
    - `GET /static/*` serves JS/CSS
  - Provides API:
    - `GET /api/movies` (paging + sorting + filtering)
    - `POST /api/movies`
    - `PUT /api/movies/<id>`
    - `DELETE /api/movies/<id>`
    - `GET /api/stats`
  - Owns source of truth (SQL database)
- State:
  - Persistent state lives in PostgreSQL (movies table)
  - UI state (current filters/page/page size) lives in the browser
  - Page size preference persists via cookie `pageSize`

## Environment Variables / Secrets
- `DATABASE_URL` (required)
  - Stored in Render Web Service environment settings
  - Never committed to GitHub
- No credentials are hard-coded in the repository

## Seed Data
- The app starts with at least 30 seeded movie records.
- Seed source: `movies.json` in the repo
- On first run (empty DB), the server creates the schema and inserts seed rows.

## How to Deploy (Render)
1. Create a Render **PostgreSQL** database.
2. Create a Render **Web Service** from the GitHub repo.
3. Set build & start commands:
   - Build: `pip install -r requirements.txt`
   - Start: `gunicorn app:app`
4. Add environment variable in Web Service:
   - `DATABASE_URL` = Render Postgres *Internal Database URL*
5. Deploy.

## How to Update the App
- Push commits to GitHub → Render automatically redeploys.
- If only frontend changes appear “stale” behind Cloudflare cache, purge Cloudflare cache or bump querystring versions (e.g. `/static/app.js?v=5`).

## Custom Domain + HTTPS
- Custom domains configured in Render Web Service settings.
- DNS records configured in Cloudflare DNS:
  - `www` CNAME → `solo-project-3-1.onrender.com`
  - `@` A record → `216.24.57.1` (Render)
- HTTPS:
  - Enabled via Render (certificate provisioned after domain verification).
  - Browser shows secure lock icon at the custom domain.

## Local Development (Optional)
1. Create and activate a virtualenv
2. Install dependencies:
   - `pip install -r requirements.txt`
3. Set `DATABASE_URL` to a local or remote Postgres connection string.
4. Run:
   - `gunicorn app:app`
   - or `flask run` (if you prefer)
