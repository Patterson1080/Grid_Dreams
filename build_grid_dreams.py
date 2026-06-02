# =============================================================================
#  Grid_Dreams - one-shot builder for the GridGlitch network in TouchDesigner.
#
#  HOW TO RUN (on any machine with TouchDesigner installed):
#    1. Clone this repo, e.g. to  C:/Grid_Dreams
#    2. Open TouchDesigner (a new empty project is fine).
#    3. Open a Textport (Alt+T) or a Text DAT, set SRC below to the repo path,
#       paste this whole file, and call:   build()
#    4. A self-contained baseCOMP 'GridGlitch' appears under /project1.
#       Its viewer (null1 / out1) is the final image.
#
#  Then configure the live inputs (see README.md):
#    - src3 / src4 / src5  : NDI In TOPs -> pick your NDI sources.
#                            src4 is the DIFFUSION source (fullscreen takeover).
#    - GridGlitch.par.Attncsv : point at an attention-map CSV to drive the
#                               text overlay + corner heatmap.
#  All look controls live on the GridGlitch custom-parameter pages.
# =============================================================================

import os

# ---- EDIT THIS to the folder where you cloned the repo --------------------
SRC = r'C:/Grid_Dreams'
# ---------------------------------------------------------------------------

PARENT = '/project1'


def _set(o, name, val, expr=False):
    try:
        p = getattr(o.par, name)
        if expr:
            p.expr = val
        else:
            p.val = val
    except Exception as e:
        print('  skip %s.%s: %s' % (o.name, name, e))


def build():
    root = op(PARENT)
    old = root.op('GridGlitch')
    if old:
        old.destroy()
    g = root.create(baseCOMP, 'GridGlitch')
    g.nodeX, g.nodeY = 0, -400
    P = g.path

    # ---------------- live sources : NDI (src4 = diffusion) ----------------
    srcs = []
    for i in range(3, 6):
        s = g.create(ndiinTOP, 'src%d' % i)
        s.nodeX, s.nodeY = -1050, 350 - (i-3)*180
        srcs.append(s)               # [src3, src4, src5]

    # ---------------- CSV : control texture + code glyphs ------------------
    import csv as _csv
    tbl = g.create(tableDAT, 'csv_table'); tbl.nodeX, tbl.nodeY = -1050, -100
    csvfile = os.path.join(SRC, 'sample.csv')
    if os.path.exists(csvfile):
        with open(csvfile, newline='') as f:
            for r in _csv.reader(f):
                tbl.appendRow(r)

    glyphs = g.create(textTOP, 'csv_glyphs'); glyphs.nodeX, glyphs.nodeY = -800, -100
    _set(glyphs, 'outputresolution', 'custom'); _set(glyphs, 'resolutionw', 1024); _set(glyphs, 'resolutionh', 1024)
    _set(glyphs, 'font', 'Courier New'); _set(glyphs, 'fontsizex', 26)
    _set(glyphs, 'alignx', 0); _set(glyphs, 'aligny', 0); _set(glyphs, 'wordwrap', 0)
    _set(glyphs, 'fontcolorr', 0.7); _set(glyphs, 'fontcolorg', 0.95); _set(glyphs, 'fontcolorb', 0.8)
    _set(glyphs, 'bgcolorr', 0.02); _set(glyphs, 'bgcolorg', 0.03); _set(glyphs, 'bgcolorb', 0.04)
    _set(glyphs, 'text', "'\\n'.join('  '.join(c.val for c in row) for row in op('csv_table').rows())", expr=True)

    cb = g.create(textDAT, 'csv_data_cb'); cb.nodeX, cb.nodeY = -1050, -280
    cb.text = open(os.path.join(SRC, 'csv_data.py')).read()
    sdata = g.create(scriptTOP, 'csv_data'); sdata.nodeX, sdata.nodeY = -800, -280
    _set(sdata, 'callbacks', P + '/csv_data_cb')

    # ---------------- attention : text + heatmap ---------------------------
    at = g.create(tableDAT, 'attn_table'); at.nodeX, at.nodeY = -1050, -460
    _set(at, 'file', 'parent().par.Attncsv', expr=True)
    atx = g.create(textTOP, 'attn_text'); atx.nodeX, atx.nodeY = -800, -460
    _set(atx, 'outputresolution', 'custom'); _set(atx, 'resolutionw', 1024); _set(atx, 'resolutionh', 1024)
    _set(atx, 'font', 'Courier New'); _set(atx, 'fontsizex', 18)
    _set(atx, 'alignx', 0); _set(atx, 'aligny', 0); _set(atx, 'wordwrap', 0)
    _set(atx, 'fontcolorr', 0.6); _set(atx, 'fontcolorg', 0.95); _set(atx, 'fontcolorb', 0.7)
    _set(atx, 'bgcolorr', 0.01); _set(atx, 'bgcolorg', 0.02); _set(atx, 'bgcolorb', 0.02)
    _set(atx, 'text', "'\\n'.join('  '.join(c.val for c in row) for row in op('attn_table').rows())", expr=True)
    acb = g.create(textDAT, 'attn_data_cb'); acb.nodeX, acb.nodeY = -1050, -640
    acb.text = open(os.path.join(SRC, 'attn_data.py')).read()
    ad = g.create(scriptTOP, 'attn_data'); ad.nodeX, ad.nodeY = -800, -640
    _set(ad, 'callbacks', P + '/attn_data_cb')

    # ---------------- font atlas (12 cols x 11 rows) -----------------------
    rows = ['GRID', '0123456789', 'PHOTO', 'CODE', 'PAPER', 'VOID',
            'STROBE', 'FEEDBACK', 'OLDFRAME', 'DIFFUSION', '_']
    fa = g.create(textTOP, 'fontatlas'); fa.nodeX, fa.nodeY = -1050, 50
    _set(fa, 'outputresolution', 'custom'); _set(fa, 'resolutionw', 264); _set(fa, 'resolutionh', 484)
    _set(fa, 'font', 'Courier New'); _set(fa, 'fontsizex', 37)
    _set(fa, 'alignx', 0); _set(fa, 'aligny', 0); _set(fa, 'wordwrap', 0)
    _set(fa, 'fontcolorr', 1); _set(fa, 'fontcolorg', 1); _set(fa, 'fontcolorb', 1)
    _set(fa, 'bgcolorr', 0); _set(fa, 'bgcolorg', 0); _set(fa, 'bgcolorb', 0)
    fa.text = '\n'.join(r.ljust(12)[:12] for r in rows)

    # ---------------- custom parameter pages -------------------------------
    rp = g.appendCustomPage('Resolution')
    pr = rp.appendInt('Gridres', label='Resolution (square)')[0]
    pr.min = 16; pr.clampMin = True; pr.normMin = 256; pr.normMax = 4096; pr.default = 2160; pr.val = 2160

    gp = g.appendCustomPage('Grid')
    for nm, lab, dv in (('Density', 'Density', 0.35),):
        p = gp.appendFloat(nm, label=lab)[0]; p.normMin = 0; p.normMax = 1; p.clampMin = True; p.clampMax = True; p.default = dv; p.val = dv
    pm = gp.appendMenu('Gridmode', label='Subdivision State')[0]
    pm.menuNames = ['spiral', 'bsp', 'columns']
    pm.menuLabels = ['Golden Spiral', 'Golden BSP', 'Columns + Bands']; pm.default = 'bsp'; pm.val = 'bsp'
    for nm, lab, dv, mx in (('Linewidth', 'Line Width', 0.35, 1), ('Statecontrast', 'State Contrast', 1.0, 1),
                            ('Evolve', 'Evolve Speed', 1.0, 2)):
        p = gp.appendFloat(nm, label=lab)[0]; p.normMin = 0; p.normMax = mx; p.clampMin = True; p.default = dv; p.val = dv
        if mx == 1: p.clampMax = True

    cp = g.appendCustomPage('Content')
    for nm, lab, dv in (('Brokenness', 'Brokenness', 0.35), ('Feedback', 'Feedback', 0.4),
                        ('Marks', 'Interface Marks', 0.4), ('Cropvary', 'Crop Variation', 0.5),
                        ('Strobe', 'Strobe Amount', 0.5), ('Streaks', 'White/Black Streaks', 0.4),
                        ('Colorvary', 'Colour Variation', 0.5)):
        p = cp.appendFloat(nm, label=lab)[0]; p.normMin = 0; p.normMax = 1; p.clampMin = True; p.clampMax = True; p.default = dv; p.val = dv
    pr2 = cp.appendFloat('Relayout', label='Re-layout Avg (s)')[0]
    pr2.normMin = 1; pr2.normMax = 40; pr2.clampMin = True; pr2.default = 6; pr2.val = 6

    pp = g.appendCustomPage('Palette')
    cols = {'Palvoid': (0.02, 0.025, 0.04), 'Palshadow': (0.05, 0.07, 0.13),
            'Palmid': (0.46, 0.11, 0.10), 'Palhigh': (0.91, 0.88, 0.82)}
    for nm, (r, gg, b) in cols.items():
        grp = pp.appendRGB(nm, label=nm.replace('Pal', ''))
        grp[0].default = r; grp[0].val = r; grp[1].default = gg; grp[1].val = gg; grp[2].default = b; grp[2].val = b
    pmx = pp.appendFloat('Palmix', label='Palette Mix')[0]
    pmx.normMin = 0; pmx.normMax = 1; pmx.clampMin = True; pmx.clampMax = True; pmx.default = 0.5; pmx.val = 0.5

    ap = g.appendCustomPage('Attention')
    ap.appendFile('Attncsv', label='Attention CSV')
    ep = g.appendCustomPage('Extra')
    for nm, lab, dv in (('Diffusion', 'Diffusion Takeover', 0.35), ('Labels', 'Effect Labels', 1.0), ('Heatmap', 'Attn Heatmap', 0.8)):
        p = ep.appendFloat(nm, label=lab)[0]; p.normMin = 0; p.normMax = 1; p.clampMin = True; p.clampMax = True; p.default = dv; p.val = dv

    # ---------------- GRID glsl (effects) ----------------------------------
    gpx = g.create(textDAT, 'grid_pixel'); gpx.nodeX, gpx.nodeY = -250, -500
    gpx.text = open(os.path.join(SRC, 'grid_glitch.frag')).read()
    grid = g.create(glslmultiTOP, 'grid'); grid.nodeX, grid.nodeY = 0, 0
    _set(grid, 'pixeldat', P + '/grid_pixel')
    _set(grid, 'outputresolution', 'custom')
    _set(grid, 'resolutionw', 'parent().par.Gridres', expr=True)
    _set(grid, 'resolutionh', 'parent().par.Gridres', expr=True)
    _set(grid, 'uniname0', 'uTime'); _set(grid, 'value0x', 'absTime.seconds * parent().par.Evolve', expr=True)
    _set(grid, 'uniname1', 'uControls')
    _set(grid, 'value1x', 'parent().par.Density', expr=True); _set(grid, 'value1y', 'parent().par.Gridmode.menuIndex', expr=True)
    _set(grid, 'value1z', 'parent().par.Linewidth', expr=True); _set(grid, 'value1w', 'parent().par.Statecontrast', expr=True)
    _set(grid, 'uniname2', 'uRes'); _set(grid, 'value2x', 'parent().par.Gridres', expr=True); _set(grid, 'value2y', 'parent().par.Gridres', expr=True)
    _set(grid, 'uniname3', 'uContent')
    _set(grid, 'value3x', 'parent().par.Brokenness', expr=True); _set(grid, 'value3y', 'parent().par.Feedback', expr=True)
    _set(grid, 'value3z', 'parent().par.Marks', expr=True); _set(grid, 'value3w', 'parent().par.Cropvary', expr=True)
    for slot, nm in ((4, 'Void'), (5, 'Shadow'), (6, 'Mid'), (7, 'High')):
        _set(grid, 'uniname%d' % slot, 'uPal' + nm)
        for axis, comp in (('x', 'r'), ('y', 'g'), ('z', 'b')):
            _set(grid, 'value%d%s' % (slot, axis), 'parent().par.Pal%s%s' % (nm.lower(), comp), expr=True)
    _set(grid, 'uniname8', 'uPalMix'); _set(grid, 'value8x', 'parent().par.Palmix', expr=True)
    _set(grid, 'uniname9', 'uBehavior')
    _set(grid, 'value9x', 'parent().par.Strobe', expr=True); _set(grid, 'value9y', 'parent().par.Streaks', expr=True)
    _set(grid, 'value9z', 'parent().par.Colorvary', expr=True); _set(grid, 'value9w', 'parent().par.Relayout', expr=True)
    _set(grid, 'uniname10', 'uExtra')
    _set(grid, 'value10x', 'parent().par.Diffusion', expr=True); _set(grid, 'value10y', 'parent().par.Labels', expr=True)
    _set(grid, 'value10z', 'parent().par.Heatmap', expr=True); _set(grid, 'value10w', 0.0)

    # ---------------- feedback (taps grid, BEFORE labels) ------------------
    fb = g.create(feedbackTOP, 'feedback'); fb.nodeX, fb.nodeY = -250, 250
    _set(fb, 'top', P + '/grid')
    _set(fb, 'outputresolution', 'custom')
    _set(fb, 'resolutionw', 'parent().par.Gridres', expr=True); _set(fb, 'resolutionh', 'parent().par.Gridres', expr=True)

    # ---------------- LABELS glsl (on top, after feedback tap) -------------
    lpx = g.create(textDAT, 'labels_pixel'); lpx.nodeX, lpx.nodeY = 0, 150
    lpx.text = open(os.path.join(SRC, 'labels.frag')).read()
    lab = g.create(glslmultiTOP, 'labels'); lab.nodeX, lab.nodeY = 200, -100
    _set(lab, 'pixeldat', P + '/labels_pixel')
    _set(lab, 'uniname0', 'uTime'); _set(lab, 'value0x', 'absTime.seconds * parent().par.Evolve', expr=True)
    _set(lab, 'uniname1', 'uControls')
    _set(lab, 'value1x', 'parent().par.Density', expr=True); _set(lab, 'value1y', 'parent().par.Gridmode.menuIndex', expr=True)
    _set(lab, 'value1z', 'parent().par.Linewidth', expr=True); _set(lab, 'value1w', 'parent().par.Statecontrast', expr=True)
    _set(lab, 'uniname2', 'uRes'); _set(lab, 'value2x', 'parent().par.Gridres', expr=True); _set(lab, 'value2y', 'parent().par.Gridres', expr=True)
    _set(lab, 'uniname3', 'uBehavior')
    _set(lab, 'value3x', 'parent().par.Strobe', expr=True); _set(lab, 'value3y', 'parent().par.Streaks', expr=True)
    _set(lab, 'value3z', 'parent().par.Colorvary', expr=True); _set(lab, 'value3w', 'parent().par.Relayout', expr=True)
    _set(lab, 'uniname4', 'uExtra')
    _set(lab, 'value4x', 'parent().par.Diffusion', expr=True); _set(lab, 'value4y', 'parent().par.Labels', expr=True)
    _set(lab, 'value4z', 'parent().par.Heatmap', expr=True); _set(lab, 'value4w', 0.0)

    # ---------------- output chain -----------------------------------------
    nul = g.create(nullTOP, 'null1'); nul.nodeX, nul.nodeY = 400, 0
    out = g.create(outTOP, 'out1'); out.nodeX, out.nodeY = 600, 0
    ndo = g.create(ndioutTOP, 'ndiout1'); ndo.nodeX, ndo.nodeY = 600, 150
    nul.viewer = out.viewer = True

    # ---------------- wiring -----------------------------------------------
    grid.inputConnectors[0].connect(srcs[0])      # src3
    grid.inputConnectors[1].connect(srcs[1])      # src4 (diffusion)
    grid.inputConnectors[2].connect(srcs[2])      # src5
    grid.inputConnectors[3].connect(glyphs)
    grid.inputConnectors[4].connect(sdata)
    grid.inputConnectors[5].connect(fb)
    grid.inputConnectors[6].connect(fa)
    grid.inputConnectors[7].connect(atx)
    grid.inputConnectors[8].connect(ad)
    fb.inputConnectors[0].connect(srcs[0])
    lab.inputConnectors[0].connect(grid)
    lab.inputConnectors[1].connect(fa)
    lab.inputConnectors[2].connect(sdata)
    nul.inputConnectors[0].connect(lab)
    out.inputConnectors[0].connect(nul)
    ndo.inputConnectors[0].connect(nul)

    print('GridGlitch built at', P, '- set NDI sources on src3/4/5 and Attncsv to taste.')
    return g
