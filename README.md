# Mohr's Circle – 2D Plane Stress

Interactive single-page tool (plain HTML/JS, no build step).

- Input the **V** (vertical face) and **H** (horizontal face) coordinates (σ, τ).
- Draws Mohr's circle, principal stresses and max shear.
- Shows 2D plane stress elements (at 0°) with normal stresses and strains.
- Input E and ν to get ε, γ. **Shear stress and shear strain are positive clockwise.**

## Mohr's Circle Tutor (`mohr-tutor.html`)

Self-learning tool that walks students through drawing Mohr's circle step by step.

- Choose **stress** (σx, σy, τxy) or **strain** (εx, εy, γxy, or a 0°/45°/90° rosette) to begin.
- 12 steps: given data → V & H points → axes & scale → plot → centre C → radius R → circle →
  principal values → max shear → principal angle → inclined plane → summary.
- The circle is built up on screen one step at a time; an element sketch shows the stresses/strains.
- **Check yourself** boxes give instant feedback with hints; **Show working** reveals the full calculation.
- Worked examples or the student's own values; suggested graph-paper scale for drawing by hand.

## Host on GitHub Pages

1. Make sure `index.html` is at the root of the repository's default branch (e.g. `main`).
2. On GitHub open the repo → **Settings** → **Pages**.
3. Under **Build and deployment → Source** choose **Deploy from a branch**.
4. Select branch `main` and folder `/ (root)`, then **Save**.
5. Wait 1–2 minutes. The site appears at `https://<username>.github.io/MECH-III-Tools/`.
6. To update, commit changes to `main`; Pages redeploys automatically.

To try locally, just open `index.html` in a browser.
