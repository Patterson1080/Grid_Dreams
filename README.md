# GridGlitch — golden-ratio grid / glitch GLSL TOP for TouchDesigner

A self-contained `glslmultiTOP` system that treats an image or video as raw material:
a **golden-ratio recursive lattice** quantizes it into tiles, three **registers**
(painting / map / code) collide inside those tiles, the whole thing is graded onto
one **palette**, corruption is applied in a **graded hierarchy**, and **parts of the
grid feed back** on previous frames as datamosh trails.

It is built as one contained `baseCOMP` at `/project1/GridGlitch` — delete that one
node to remove everything.

![hero](previews/hero.png)

## ▶ Run it on another machine
**Requirements:** [TouchDesigner](https://derivative.ca/download) (the free
Non-Commercial edition works — note it caps output to 1280×1280; Commercial/Pro
renders the full 2160²). Tested on build 2025.32280.

1. **Clone** this repo, e.g. `git clone https://github.com/Patterson1080/Grid_Dreams C:/Grid_Dreams`
2. **Open TouchDesigner** (a new empty project is fine).
3. **Get the `GridGlitch` COMP into your project** — two ways:
   - **Easiest:** drag **[`GridGlitch.tox`](GridGlitch.tox)** from the clone into the
     network (or RMB ▸ *Import Component*). Shaders are embedded — nothing else to load.
   - **From source:** open a Textport (`Alt+T`), paste [`build_grid_dreams.py`](build_grid_dreams.py),
     set `SRC` to your clone path (e.g. `C:/Grid_Dreams`), and run `build()`. Use this
     if you've edited a `.frag`/`.py` and want to rebuild from the text files.

   Either way a self-contained `baseCOMP` **`GridGlitch`** appears; its `null1`/`out1`
   viewer is the final image.
4. **Feed the live inputs:**
   - `GridGlitch/src3`, `src4`, `src5` are **NDI In** TOPs — pick your NDI senders
     (from your other TouchDesigner instance). **`src4` is the Diffusion source**
     used by the fullscreen takeover. (Swap them to `Movie File In` / Spout if you
     prefer; just keep the input order.)
   - `GridGlitch.par.Attncsv` → point at an attention-map CSV (drives the text
     overlay during a takeover and the corner heatmap otherwise).
5. **Tune** everything live on the `GridGlitch` custom-parameter pages
   (Resolution / Grid / Content / Palette / Attention / Extra).

> The shaders (`grid_glitch.frag`, `labels.frag`) and the CSV packers
> (`csv_data.py`, `attn_data.py`) are the source of truth — the build script just
> loads them into the network. Edit a `.frag`, re-run `build()` (or re-paste the
> DAT text) to reload. No `.toe`/`.tox` needed, but you can `File ▸ Save` your
> project once it's built.

## Files
| file | role |
|------|------|
| `build_grid_dreams.py` | **one-shot builder** — reconstructs the whole network in TD |
| `grid_glitch.frag` | effects pixel shader (`grid` GLSL TOP) |
| `labels.frag`      | per-cell label pass, drawn on top after the feedback tap |
| `csv_data.py`      | Script TOP callback: packs CSV numbers into a control texture |
| `attn_data.py`     | Script TOP callback: packs the attention CSV into a heatmap |
| `sample.csv`       | default CSV (control signal + code-register text) |
| `previews/`        | rendered stills · `reference/` | the source inspiration images |

## Network (`/project1/GridGlitch`)
```
media (Movie File In) ─┐                         ┌─> null1 ─> out1   (viewer)
csv_glyphs (Text TOP) ─┤                         │
csv_data (Script TOP) ─┼─> grid (glslmultiTOP) ──┘
feedback (Feedback TOP)┘        ▲   │
   ▲ target = grid              └───┘  previous frame
```
GLSL inputs: `[0]` media, `[1]` glyphs, `[2]` csv control, `[3]` feedback.

## Inputs you provide
1. **Image or video** → drop a file on `media` (`Movie File In` handles both).
2. **CSV** → set the file on `csv_table` (or edit `sample.csv`). The CSV does double duty:
   - numeric columns → `csv_data` control texture → biases each tile's **register
     choice, brokenness, feedback amount, and frozen-ness** (data-driven grid rules);
   - the raw cells are rendered by `csv_glyphs` as the green-on-black **code register**.

## FULL PIPELINE (stages 2-6 built)
The shader now: routes each cell to a **register** (3 photo inputs + CSV code +
void) → **cover-fit crop** so each tile is a fragment → **graded brokenness**
(block quantize / channel split / band tear / scanlines) → **feedback** trails
on the worst cells → **controlled palette** grade → **diegetic marks**.

Inputs to the GLSL TOP (9): `[0]`src3 `[1]`src4(diffusion) `[2]`src5 `[3]`csv_glyphs
`[4]`csv_data `[5]`feedback `[6]`fontatlas `[7]`attn_text `[8]`attn_data.
`src3/4/5` are NDI/Spout In TOPs from another TD instance; **src4 is the Diffusion source**.

### Per-cell effect LABELS  (separate pass: `labels.frag`)
Each large-enough cell prints a tiny architectural label `GRID NN_<MODE>` (e.g.
`GRID 03_FEEDBACK`) from a monospace **font atlas** (`fontatlas`, 12x11 grid:
GRID / digits / mode words / `_`). Toggle/scale with `Labels`.

**Pipeline order matters:** `grid` (effects) → `feedback` taps `grid` → `labels`
GLSL TOP stamps the letters OVER the finished image → `null1`/`out1`/`ndiout1`.
Because labels are added AFTER the feedback tap, they are never fed back,
quantized, or strobed — the letters stay crisp. `labels` recomputes the same
cell layout (identical uniforms) so labels line up with their cells; it skips
drawing during a diffusion takeover. White-on-dark, dark-on-PAPER, red-on-strobe.

### DIFFUSION takeover  (Extra > `Diffusion`)
A stochastic event (random gaps, **on for 2-3s**) strobes the whole frame to
**src4 fullscreen** with a grid overlay, centre crosshair, and the attention-map
text overlaid. `Diffusion` 0 = never, 1 = frequent.

### ATTENTION map  (Attention > `Attncsv` = upload slot)
Drop a CSV on `Attncsv`. `attn_table` reads it; `attn_text` renders its glyphs
(overlaid on src4 during takeover); `attn_data` packs its numbers into a square
heatmap shown as a **pixelated black/white matrix** in the top-right corner when
src4 is NOT fullscreen. `Heatmap` toggles the corner matrix.

## Controls — custom parameters on the `GridGlitch` COMP
**Resolution page**
| par | meaning |
|-----|---------|
| `Gridres` | single square-resolution constant. Drives every TOP (`grid`, `feedback` via expression `parent().par.Gridres`) **and** the shader `uRes` uniform. Default 2160. |

**Grid page**
| par | meaning |
|-----|---------|
| `Density`       | few big cells → many cells |
| `Gridmode`      | subdivision state: Golden Spiral · Golden BSP · Columns + Bands |
| `Linewidth`     | survey-rule thickness |
| `Statecontrast` | tonal spread between cell states |
| `Evolve`        | re-layout speed (0 = frozen layout) |

**Content page**
| par | meaning |
|-----|---------|
| `Brokenness` | global corruption amount (graded per cell by state + CSV) |
| `Feedback`   | trail / ghost-cell persistence |
| `Marks`      | diegetic interface intensity (crosshairs, ticks, rules, flare) |
| `Cropvary`   | how much each cell zooms into a fragment of its source |
| `Strobe`     | how many cells run the strobe-glitch flicker |
| `Streaks`    | frequency of long white / black runs of cells |
| `Colorvary`  | per-cell colour spread (oxblood / blue / olive) |
| `Relayout`   | average seconds between random layout reshuffles |

### Per-cell BEHAVIOUR modes
Each cell is assigned a mode (re-rolled on every layout change), CSV-biased:
`PHOTO` (graded fragment) · `CODE` (CSV glyphs) · `PAPER` (bone-white doc) ·
`VOID` (black) · `STROBE` (random-rate flicker: invert / white / black flashes) ·
`FEEDBACK` (glow trails from the previous frame) · `OLDFRAME` (held past frame).
**White/black streaks**: random vertical/horizontal slabs force a whole run of
cells to pure white or black. **Stochastic re-layout**: an in-shader accumulator
with random hold durations changes the layout at unpredictable times (`Relayout`
sets the average cadence; it is never on a fixed clock).

**Palette page** (the unifying grade — live-adjustable)
| par | meaning |
|-----|---------|
| `Palvoid`   | void/rest cell colour |
| `Palshadow` | grade target for shadows (default dusty blue-black) |
| `Palmid`    | grade target for mids (default oxblood) |
| `Palhigh`   | grade target for highlights (default bone) |
| `Palmix`    | 0 = source colour through · 1 = fully graded |

These bind to the GLSL TOP uniforms: `uControls = (Density, Gridmode.menuIndex,
Linewidth, Statecontrast)`, `uTime = absTime.seconds * Evolve`, `uRes = (Gridres, Gridres)`.

### ⚠ Resolution cap on Non-Commercial TouchDesigner
This install is the free **Non-Commercial** license (`app.product == "TouchDesigner"`),
which hard-caps every TOP to **1280×1280**. `Gridres` is set to 2160 and is honoured
by the parameters/uniform (the layout is resolution-independent — square aspect = 1),
but the actual GPU texture is clamped to 1280². On a **Commercial/Pro** license it
renders at the full 2160² with **no changes needed**.

## Governing-principle → implementation map
- **Grid as law, content as chaos** → `subdivide()` cuts the longer axis at `1/φ`,
  a per-node hash flips the cut and decides where to stop → law-bound but irregular.
- **Collision of registers** → one media source becomes three "ways of seeing":
  PAINTING (crop), MAP (sobel edges + false-colour terrain ramp + contour lines),
  CODE (the CSV glyph texture). The winner per tile is chosen by CSV bias + hash.
- **Diegetic interface** → grid borders, per-tile red crosshairs + ruler ticks,
  a global frame crosshair, corner brackets, and a single four-point lens flare.
- **Controlled palette** → `grade()` split-tones every register onto one axis.
- **Hierarchy of brokenness** → per-tile `broken` (hash × CSV × uControls.y) drives
  DCT-style block quantization, RGB channel tearing, and feedback smear amount.
- **Feedback of *parts* of the grid** → only tiles whose `broken`/`frozen`/CSV mask
  crosses threshold blend with input `[3]`; broken tiles trail, frozen tiles ghost.

## Notes
- The shader compiles clean (vertex + pixel) on TD 2025.32280.
- The project is **not** auto-saved — save `GLSL_Grid_Dreams.toe` yourself if you want to keep it.
- `errchk` (Info DAT) shows live compile results when you edit `grid_pixel`.
