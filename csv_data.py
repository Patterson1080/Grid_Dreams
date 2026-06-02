# Script TOP callback: pack the CSV table into a 1 x N RGBA control texture.
# Each CSV row -> one pixel column. First 4 columns -> R,G,B,A.
# Numeric cells pass through; text cells are hashed to a stable 0..1 value.
# The GLSL TOP samples this at x = cell.id to drive register / brokenness / feedback.

import numpy as np


def onCook(scriptOp):
    dat = op('csv_table')                       # sibling Table DAT (the CSV)
    rows = dat.rows() if dat is not None else []

    # drop a header row if its first cell is non-numeric
    if rows:
        try:
            float(rows[0][0].val)
        except (ValueError, IndexError):
            rows = rows[1:]

    if not rows:
        scriptOp.copyNumpyArray(np.zeros((1, 1, 4), np.float32))
        return

    out = []
    for r in rows:
        vals = []
        for c in r[:4]:
            s = c.val
            try:
                vals.append(float(s))
            except ValueError:
                vals.append((abs(hash(s)) % 1000) / 1000.0)
        while len(vals) < 4:
            vals.append(0.0)
        out.append(vals)

    arr = np.asarray(out, np.float32)
    mn = arr.min(0)
    mx = arr.max(0)
    rng = np.where(mx - mn < 1e-6, 1.0, mx - mn)
    arr = (arr - mn) / rng                       # normalise each channel to 0..1

    # shape (height=1, width=rows, 4) float32 for copyNumpyArray
    scriptOp.copyNumpyArray(arr.reshape(1, len(out), 4))
    return
