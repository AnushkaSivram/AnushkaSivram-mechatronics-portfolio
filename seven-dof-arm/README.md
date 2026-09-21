# Robotic Arm Pose Visualizer

An interactive 7-DOF robotic arm simulator built with React and three.js,
using the real kinematics and mesh geometry of the Franka Emika "FER"
research arm (from the official, Apache-2.0-licensed
[`franka_description`](https://github.com/frankaemika/franka_description)
repo). Drag to orbit, move the joint sliders, or click the reachable dome to
teach the arm target positions — a numerical inverse-kinematics solver
(Cyclic Coordinate Descent) finds the joint angles and animates the arm
through them one joint at a time.

## Project structure

```
robotic-arm-app/
├── index.html                     Vite entry HTML
├── package.json
├── vite.config.js
└── src/
    ├── main.jsx                   Mounts <App /> into the page
    ├── App.jsx                    Top-level component
    ├── RoboticArmSimulator.jsx    The simulator: three.js scene, IK runner, layout
    ├── lib/
    │   └── kinematics.js          Chain building, forward kinematics, CCD IK solver
    ├── data/
    │   └── meshData.js            Embedded mesh geometry (vertices + triangle indices)
    ├── styles/
    │   └── theme.js                Color palette and font tokens
    └── components/
        ├── GlobalStyle.jsx        Injected CSS (panels, sliders, animations)
        ├── Panel.jsx
        ├── SectionTitle.jsx
        ├── Slider.jsx
        ├── PresetButton.jsx
        └── Readout.jsx
```

## Running it locally

You'll need [Node.js](https://nodejs.org) (v18 or newer) installed.

```bash
# 1. Install dependencies
npm install

# 2. Start the dev server
npm run dev
```

Vite will print a local URL (usually `http://localhost:5173`) — open that in
your browser. Changes to any file are reflected instantly.

## Turning it into a real, deployed website

A production build is just static files (HTML/JS/CSS) — no server or
database needed — so any static hosting service works. Here are the three
easiest options, from simplest to most flexible:

### Option A — Vercel (recommended, easiest)

1. Push this folder to a GitHub repository.
2. Go to [vercel.com](https://vercel.com), sign in with GitHub, and click
   **"Add New Project"**.
3. Select your repository. Vercel auto-detects Vite projects — leave the
   build settings as-is (`npm run build`, output directory `dist`).
4. Click **Deploy**. You'll get a live URL (e.g.
   `your-project.vercel.app`) in about a minute, and it auto-redeploys
   every time you push new commits.

### Option B — Netlify

Same idea as Vercel:
1. Push to GitHub.
2. Go to [netlify.com](https://netlify.com) → **"Add new site" → "Import an
   existing project"**.
3. Connect your repo. Build command: `npm run build`. Publish directory:
   `dist`.
4. Deploy — you'll get a live URL immediately.

### Option C — GitHub Pages (free, tied to your GitHub account)

1. Install the deploy helper:
   ```bash
   npm install --save-dev gh-pages
   ```
2. In `package.json`, add:
   ```json
   "homepage": "https://<your-username>.github.io/<repo-name>",
   "scripts": {
     "deploy": "vite build && gh-pages -d dist"
   }
   ```
3. In `vite.config.js`, set the `base` option to your repo name:
   ```js
   export default defineConfig({
     plugins: [react()],
     base: "/<repo-name>/",
   });
   ```
4. Run:
   ```bash
   npm run deploy
   ```
   Your site will be live at `https://<your-username>.github.io/<repo-name>`
   within a minute or two.

### Testing the production build locally first (optional but recommended)

Before deploying, you can build and preview the exact static output that
will be hosted:

```bash
npm run build      # creates the dist/ folder
npm run preview    # serves dist/ locally so you can double-check it
```

## Notes

- The mesh data in `src/data/meshData.js` is fairly large (~240 KB) because
  it embeds real 3D geometry directly in the JavaScript bundle rather than
  fetching external model files at runtime — this keeps the whole app
  self-contained and avoids network requests, at the cost of a bigger
  initial download. That's a reasonable tradeoff for a demo/portfolio piece.
- All mesh geometry is derived from Franka Emika's `franka_description`
  repository, licensed Apache 2.0.
