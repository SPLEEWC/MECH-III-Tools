# MECH III Tools

Interactive single-page tools (plain HTML/JS, no build step).

| Page | Tool |
| --- | --- |
| `index.html` | Home page linking to the tools |
| `stress.html` | Mohr's circle for 2D plane **stress** |
| `strain.html` | Mohr's circle for 2D plane **strain** |
| `mohr-tutor.html` | Step-by-step **tutor** for drawing Mohr's circle (stress or strain) |

## Mohr's circle – stress

- Input the **V** (vertical face) and **H** (horizontal face) coordinates (σ, τ).
- Draws Mohr's circle, principal stresses and max shear.
- Shows 2D plane stress elements with normal stresses and strains.
- Input E and ν to get ε, γ.

## Mohr's circle – strain

- Choose a strain rosette (**Rectangle** 0°/45°/90°, **Delta** triangle 0°/60°/120°, **Star** one vertical gauge and the others 120° apart: 90°/210°/330°) and enter gauge strains ε1, ε2, ε3 in µε.
- For Delta and Star rosettes you can choose which gauge is vertical (or keep the original orientation); the rosette diagram shows the original beside the rotated one, and the McClintock construction uses that gauge's vertical line for the pole.
- The circle is built step by step with **McClintock's construction** (gauge lines → arbitrary point O → lines at the gauge spacing to A and C → circle through A, O, C → ε axis through its centre → read results).
- εx, εy, γxy and the V/H points are derived from the three readings; the gauges are marked on the circle.
- Draws Mohr's circle, principal strains and max shear strain.
- Gives the corresponding stresses from E and ν (plane stress).

**Shear stress and shear strain are positive clockwise** in both tools.

## Mohr's Circle Tutor (`mohr-tutor.html`)

Self-learning tool that walks students through drawing Mohr's circle step by step.

- Choose **stress** (σx, σy, τxy) or **strain** to begin.
- Strain uses **McClintock's method** for **rectangular** (0°/45°/90°), **delta** (0°/60°/120°) and **star** (0°/120°/240°) rosettes, with any gauge chosen as the vertical (pole) gauge. For the delta rosette the tutor shows how the triangle's gauges are rearranged (slid parallel to themselves) to pass through one point before the construction: 10 steps from the vertical lines through the readings, the pole O and gauge lines, perpendicular bisectors and circle, to εp, εq, γmax and the principal direction.
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
