# Mohr's Circle – 2D Plane Stress

Interactive single-page tool (plain HTML/JS, no build step).

- Input the **V** (vertical face) and **H** (horizontal face) coordinates (σ, τ).
- Draws Mohr's circle, principal stresses, max shear, and a plane at any angle θ.
- Shows 2D plane stress elements (given / rotated / principal) with normal stresses and strains.
- Input E and ν to get ε, γ. **Shear stress and shear strain are positive clockwise.**

## Host on GitHub Pages

1. Make sure `index.html` is at the root of the repository's default branch (e.g. `main`).
2. On GitHub open the repo → **Settings** → **Pages**.
3. Under **Build and deployment → Source** choose **Deploy from a branch**.
4. Select branch `main` and folder `/ (root)`, then **Save**.
5. Wait 1–2 minutes. The site appears at `https://<username>.github.io/MECH-III-Tools/`.
6. To update, commit changes to `main`; Pages redeploys automatically.

To try locally, just open `index.html` in a browser.
