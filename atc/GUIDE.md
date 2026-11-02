# ATC Trainer – build, run and host guide

A static web app (plain HTML/CSS/JS, **no build step, no server**). Everything runs in the browser.

## What it does

| Requirement | Where |
|---|---|
| Records each student's score | `js/store.js` – name/ID login, every attempt saved (score, %, stars, time, errors, skills) in the browser; export/import JSON for class-wide merging |
| 20 arcade games | `js/arcade.js` – "Departure Rush" tower sequencing (line up → clear for takeoff, runway occupancy, wake spacing, crossing runways, medevac priority) |
| 20 surveillance games | `js/radar.js` – "Radar Sector" vectoring (heading/level/speed, 5 NM / 1000 ft separation, exit fix + level, restricted zones, storms, speed mix) |
| Analyse learning data | `js/report.js` – learning curve, skill profile, error hot-spots, level map, class leaderboard, item analysis |
| Performance data sheet | Reports → *Performance data sheet* (per-level table + attempt log, print/PDF, CSV) |
| Performance analysis | Reports → *Performance analysis* (trend, strengths, development areas, stumbling blocks, next steps, cohort comparison) |

Engagement features: sequential level unlock, 1–3 stars, ranks, coach tip after every level, assists that fade out (wake-gap hints to level 8, conflict alerts and "direct-to" to level 10).

## Step 1 – Create the repository
1. Sign in at <https://github.com> → **New repository**. Name it (e.g. `MECH-III-Tools`), choose **Public** (free GitHub Pages) → **Create**.
2. Clone it: `git clone https://github.com/<you>/<repo>.git && cd <repo>`

## Step 2 – Add the project files
Folder layout (everything under `atc/`):
```
atc/index.html
atc/css/style.css
atc/js/store.js     data layer (students, attempts, import/export)
atc/js/arcade.js    20 arcade levels
atc/js/radar.js     20 surveillance levels
atc/js/report.js    analytics, data sheet, analysis
atc/js/app.js       screens, login, level select, results
```
Copy these files in (or, if you already have this repo, they are already there).

## Step 3 – Test locally
```bash
python3 -m http.server 8000      # from the repo root
```
Open <http://localhost:8000/atc/>. (Double-clicking `atc/index.html` also works.) Log in, play Arcade 1, then open **Reports**.

## Step 4 – Commit and push
```bash
git add atc
git commit -m "Add ATC trainer"
git push origin main
```

## Step 5 – Turn on GitHub Pages
1. Repository → **Settings → Pages**.
2. **Build and deployment → Source: Deploy from a branch**.
3. Branch **main**, folder **/ (root)** → **Save**.
4. After ~1–2 minutes the tool is live at `https://<you>.github.io/<repo>/atc/`.
5. Every later `git push` to `main` redeploys automatically.

Give students that URL (works on phones and tablets).

## Step 6 – Run it in class
1. Students open the URL, enter name + student ID (use the same ID every time) and play. Level *n+1* unlocks when level *n* is passed (instructor can **Open all levels** in Reports → *Data & settings*).
2. Scores are stored **per device/browser**. To collect a class: each student opens **Reports → Data & settings → Export all data (JSON)** and sends the file; the instructor opens the tool and uses **Import JSON…** for each file (duplicates are skipped).
3. Choose **Whole class** in the Reports student selector for the leaderboard, class skill profile and item analysis (which levels are hardest). Use **Performance data sheet → Print / PDF** or **CSV** for records.

## Step 7 – Optional: central score collection
Browser storage cannot be seen by the instructor remotely. If you need live central records, replace the three persistence calls in `js/store.js` (`addAttempt`, `attempts`, `students`) with calls to a backend (e.g. Google Apps Script web app writing to a Google Sheet, or Firebase). Keep the attempt record format the same and the reports keep working.

## Customising
* **Arcade levels** – edit the `CFG` table in `js/arcade.js` (runway layout, aircraft count, spawn interval, heavy/light mix, priority share, patience, allowed violations).
* **Surveillance levels** – edit the `CFG` table in `js/radar.js` (aircraft, conflicts, zones, storms, altitude changes, mixed speeds). Scenarios are seeded, so every student gets the identical traffic on a level.
* **Pass marks / stars** – `finish()` in `js/app.js`, and `passed` in each engine's `finish()`.

## Scoring summary
**Arcade:** +100 per departure (+30 if not delayed; medevac +200/+50), −100 wake violation, −50 refused clearance (runway occupied), −30 delay, −100 diverted aircraft, −50 late medevac.
**Surveillance:** +100 per correct handoff (+ up to 50 for ≤4 instructions), −200 loss of separation, −150 restricted zone, −75 storm cell, −100 wrong exit, −75 wrong level.
Skill scores (0–100) – Safety, Procedure compliance, Throughput, Workload – are saved with every attempt and drive the analytics.
