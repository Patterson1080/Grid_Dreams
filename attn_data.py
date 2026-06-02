# Script TOP callback: pack the attention-map CSV into a square 0..1 heatmap.
# Every numeric cell becomes one heatmap pixel; the shader renders it as a
# pixelated black/white matrix in a corner (and the text overlays src4).

import math
import numpy as np


def onCook(scriptOp):
    dat = op('attn_table')
    vals = []
    if dat is not None:
        for r in dat.rows():
            for cc in r:
                try:
                    vals.append(float(cc.val))
                except ValueError:
                    pass   # skip header / label cells

    if not vals:
        scriptOp.copyNumpyArray(np.zeros((1, 1, 4), np.float32))
        return

    n = len(vals)
    side = int(math.ceil(math.sqrt(n)))
    flat = np.zeros(side * side, np.float32)
    flat[:n] = vals
    a = flat.reshape(side, side)

    mn, mx = a.min(), a.max()
    a = (a - mn) / ((mx - mn) if (mx - mn) > 1e-6 else 1.0)

    img = np.repeat(a[:, :, None], 4, axis=2).astype(np.float32)
    img[:, :, 3] = 1.0
    scriptOp.copyNumpyArray(img)
    return
