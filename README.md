# MECH III Tools

Interactive single-page tools (plain HTML/JS, no build step).

| Page | Tool |
| --- | --- |
| `index.html` | Home page linking to the tools |
| `stress.html` | Mohr's circle for 2D plane **stress** |
| `strain.html` | Mohr's circle for 2D plane **strain** |

## Mohr's circle – stress

- Input the **V** (vertical face) and **H** (horizontal face) coordinates (σ, τ).
- Draws Mohr's circle, principal stresses and max shear.
- Shows 2D plane stress elements with normal stresses and strains.
- Input E and ν to get ε, γ.

## Mohr's circle – strain

- Choose a strain rosette (**Rectangle** 0°/45°/90°, **Delta** 0°/60°/120°, **Star** 0°/60°/120°) and enter gauge strains ε1, ε2, ε3 in µε.
- εx, εy, γxy and the V/H points are derived from the three readings; the gauges are marked on the circle.
- Draws Mohr's circle, principal strains and max shear strain.
- Shows the deformed element, and the corresponding stresses from E and ν (plane stress).

**Shear stress and shear strain are positive clockwise** in both tools.

## Host on GitHub Pages

1. Make sure `index.html` is at the root of the repository's default branch (e.g. `main`).
2. On GitHub open the repo → **Settings** → **Pages**.
3. Under **Build and deployment → Source** choose **Deploy from a branch**.
4. Select branch `main` and folder `/ (root)`, then **Save**.
5. Wait 1–2 minutes. The site appears at `https://<username>.github.io/MECH-III-Tools/`.
6. To update, commit changes to `main`; Pages redeploys automatically.

To try locally, just open `index.html` in a browser.
