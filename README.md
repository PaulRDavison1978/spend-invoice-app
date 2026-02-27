# Spend & Invoice Management System

## Prerequisites

- **Node.js** (v18+) — download the .msi installer from https://nodejs.org
- **VS Code** — download from https://code.visualstudio.com
- **Git** — download from https://git-scm.com/download/win

After installing each one, **close and reopen VS Code** so the terminal picks up the new PATH.

Verify everything works by opening a VS Code terminal (`Ctrl + ~`) and running:
```
node --version
npm --version
git --version
```

---

## Step 1: Download and Open the Project

1. Download the project zip from Claude (or copy the folder)
2. Extract it somewhere like `C:\Projects\spend-invoice-app`
3. Open VS Code → **File → Open Folder** → select `spend-invoice-app`

---

## Step 2: Install Dependencies

Open the VS Code terminal (`Ctrl + ~`) and run:

```
npm install
```

This downloads React, Tailwind, Vite, and all other dependencies into `node_modules/`. Takes about 30 seconds.

---

## Step 3: Run the App

```
npm run dev
```

Your browser will open automatically at **http://localhost:3000**. You should see the login page.

The dev server hot-reloads — any file changes appear instantly in the browser.

To stop the server, press `Ctrl + C` in the terminal.

---

## Step 4: Set Up Git & GitHub

### Create a GitHub repo:
1. Go to https://github.com/new
2. Name it `spend-invoice-app`, leave it empty (no README), click **Create**

### Connect your local project:
```
git init
git add .
git commit -m "Initial commit - v16 with escalation workflow"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/spend-invoice-app.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your actual GitHub username.

---

## Step 5: Install Claude Code

```
npm install -g @anthropic-ai/claude-code
```

Then in your project folder, just run:

```
claude
```

You can now ask Claude to make changes directly to your files. For example:
- "Add email notifications when a spend approval is escalated"
- "Refactor the matching algorithm to also check invoice dates"
- "Add a dashboard with spend summary charts"

Claude Code reads your actual files, makes edits, and you can review + commit them.

---

## Project Structure

```
spend-invoice-app/
├── index.html          ← HTML shell
├── package.json        ← Dependencies & scripts
├── vite.config.js      ← Vite dev server config
├── tailwind.config.js  ← Tailwind CSS config
├── postcss.config.js   ← PostCSS config
├── .gitignore          ← Git ignore rules
├── src/
│   ├── main.jsx        ← React entry point
│   ├── index.css       ← Tailwind imports
│   └── App.jsx         ← The entire application (145KB)
└── public/             ← Static assets (empty for now)
```

---

## Demo Logins

| Email | OTP | Role | Approval Limit |
|-------|-----|------|----------------|
| john.doe@company.com | 123456 | Admin (CEO) | Unlimited |
| jane.smith@company.com | 234567 | Finance | £25,000 |
| bob.johnson@company.com | 345678 | Approver | £10,000 |
| alice.williams@company.com | 456789 | User | — |

---

## Useful Commands

| Command | What it does |
|---------|-------------|
| `npm run dev` | Start local dev server |
| `npm run build` | Build for production (creates `dist/`) |
| `npm run preview` | Preview the production build locally |
| `claude` | Start Claude Code for AI-assisted development |
