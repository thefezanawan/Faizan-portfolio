# Faizan Akbar - Portfolio (Vercel)

`index.html` is **self-contained**: the 5 automation workflow images, the AI Automation page and the CV are all embedded inside it, so they work on any host (Vercel, GitHub Pages, Netlify, or by double-clicking the file). Only the contact form needs Vercel (`/api`).

## What's where
- `index.html` - the whole site.
  - **Download CV** buttons: top bar (desktop and mobile), hero, and mobile menu.
  - **View my work** buttons (AI Automation service card and the n8n project card) and the **AI Automation** menu link open the automation page (`index.html#ai-automation`).
  - The automation page shows the 5 workflows: tap to enlarge, download button on every image.
- `ai-automation.html` - tiny redirect to `index.html#ai-automation` (keeps old links working).
- `Faizan_Akbar_CV.pdf` - the CV (ID number removed for the website copy).
- `assets/automation/` - the original workflow images (reference only; the site does not need them).
- `tools/embed-cv.js` - re-embeds a new CV into `index.html`.
- `api/` + `admin.html` - contact form backend and private inbox (`/admin.html`).

## Change the CV later
1. Replace `Faizan_Akbar_CV.pdf` in the project root with your new file (same name).
2. Run: `node tools/embed-cv.js`
3. Commit and push.

## Environment variables (Vercel -> Settings -> Environment Variables)
| Name | Required | Notes |
|---|---|---|
| DATABASE_URL | yes | Added automatically when you connect Neon in the Storage tab |
| RESEND_API_KEY | yes | From resend.com |
| CONTACT_TO_EMAIL | yes | Where messages are emailed. Without a verified domain, Resend only delivers to the email you signed up with |
| ADMIN_TOKEN | yes | Long random string for /admin.html |
| RATE_LIMIT_PER_HOUR | no | Per visitor (per IP). Default 30. Use 0 for no limit |

## Deploy (important)
Upload/push the **contents of this folder** so `index.html` is at the repository root (not inside a sub-folder), then Vercel -> Add New -> Project -> import -> Deploy. Add the variables above and Redeploy.

## Run locally
    npm install
    npm i -g vercel
    vercel link
    vercel env pull .env.local
    vercel dev
