// =============================================================================
//  GRID GLITCH  -  TouchDesigner GLSL TOP (glslmultiTOP)
//  + per-cell effect LABELS (font atlas), DIFFUSION takeover (src4 fullscreen,
//    random 2-3s), ATTENTION-map text/heatmap, thinner rules, tiny fonts.
//
//  Do NOT add a #version line - TouchDesigner prepends it.
//
//  INPUTS:
//   [0]src3  [1]src4(diffusion)  [2]src5  [3]csv_glyphs  [4]csv_data(ctrl)
//   [5]feedback  [6]fontatlas  [7]attn_text  [8]attn_heat
//  UNIFORMS:
//   uTime ; uControls(Density,Gridmode,Linewidth,Statecontrast) ; uRes
//   uContent(Brokenness,Feedback,Marks,Cropvary)
//   uPalVoid/Shadow/Mid/High ; uPalMix ; uBehavior(Strobe,Streaks,Colorvary,Relayout)
//   uExtra(Diffusion, Labels, Heatmap, spare)
// =============================================================================

layout(location = 0) out vec4 fragColor;

uniform float uTime;
uniform vec4  uControls;
uniform vec2  uRes;
uniform vec4  uContent;
uniform vec3  uPalVoid;
uniform vec3  uPalShadow;
uniform vec3  uPalMid;
uniform vec3  uPalHigh;
uniform float uPalMix;
uniform vec4  uBehavior;
uniform vec4  uExtra;

const float IPHI = 0.6180339887;
const int PHOTO=0, CODE=1, PAPER=2, VOID=3, STROBE=4, FEEDBK=5, OLDFR=6, DIFF=7;

float h11(float p){ p = fract(p*0.1031); p *= p+33.33; p *= p+p; return fract(p); }
float h21(vec2 p){
    vec3 p3 = fract(vec3(p.xyx)*0.1031);
    p3 += dot(p3, p3.yzx+33.33);
    return fract((p3.x+p3.y)*p3.z);
}
float lineMask(float d, float w){ float aa = fwidth(d)*1.5 + 1e-5; return 1.0 - smoothstep(w, w+aa, abs(d)); }

// ---------------- font atlas (input 6): 12 cols x 11 rows --------------------
//  row0 GRID  row1 0-9  row2 PHOTO row3 CODE row4 PAPER row5 VOID
//  row6 STROBE row7 FEEDBACK row8 OLDFRAME row9 DIFFUSION row10 '_'
float atlasGlyph(int row, int col, vec2 local){
    const float NC = 12.0, NR = 11.0;
    float gy = clamp(local.y, 0.0, 1.0)*0.82 + 0.10;          // squeeze glyph into cell
    float ux = (float(col) + clamp(local.x,0.0,1.0)) / NC;
    float vy = 1.0 - (float(row) + (1.0 - gy)) / NR;
    return texture(sTD2DInputs[6], vec2(ux, vy)).r;
}
int wordRow(int m){ return 2 + m; }
int wordLen(int m){
    if(m==0) return 5; if(m==1) return 4; if(m==2) return 5; if(m==3) return 4;
    if(m==4) return 6; if(m==5) return 8; if(m==6) return 8; return 9;
}
// atlas (row,col) for char k of "GRID NN_WORD"; (-1,-1) = blank
ivec2 labelChar(int mode, int number, int k){
    if(k < 4)  return ivec2(0, k);                    // G R I D
    if(k == 4) return ivec2(-1,-1);                   // space
    if(k == 5) return ivec2(1, number/10);            // tens
    if(k == 6) return ivec2(1, number - (number/10)*10);
    if(k == 7) return ivec2(10, 0);                   // _
    int wi = k - 8;
    if(wi < wordLen(mode)) return ivec2(wordRow(mode), wi);
    return ivec2(-1,-1);
}
// returns text mask for the cell label; org = top-left interior in uv
float drawLabel(vec2 uv, vec2 org, int mode, int number, float charH){
    float charW = charH * 0.55;
    vec2 lp = uv - org;
    if(lp.y < 0.0 || lp.y > charH || lp.x < 0.0) return 0.0;
    int k = int(floor(lp.x / charW));
    if(k >= 18) return 0.0;
    ivec2 rc = labelChar(mode, number, k);
    if(rc.x < 0) return 0.0;
    return atlasGlyph(rc.x, rc.y, vec2(fract(lp.x/charW), lp.y/charH));
}

// ---------------- content registers -----------------------------------------
vec2 coverUV(vec2 t, float cellAsp, float srcAsp){
    vec2 uv = t;
    if(srcAsp > cellAsp){ float s = cellAsp/srcAsp; uv.x = (t.x-0.5)*s + 0.5; }
    else               { float s = srcAsp/cellAsp; uv.y = (t.y-0.5)*s + 0.5; }
    return uv;
}
vec3 photoSample(sampler2D smp, vec2 sres, vec2 t, float cellAsp, vec2 coff, float z, float bk, float id){
    float sa  = sres.x / max(sres.y, 1.0);
    vec2  uvc = coff + coverUV(t, cellAsp, sa) * z;
    float bsz = mix(0.004, 0.16, bk);
    vec2  sUV = mix(uvc, floor(uvc/bsz)*bsz + bsz*0.5, smoothstep(0.20, 0.85, bk));
    float band = floor(sUV.y * mix(60.0, 14.0, bk));
    sUV.x += (h11(band + id*5.0) - 0.5) * bk * 0.12 * step(0.45, bk);
    vec2 sh = vec2(bk*0.02 + 0.003, 0.0);
    return vec3(texture(smp, sUV+sh).r, texture(smp, sUV).g, texture(smp, sUV-sh).b);
}
vec3 photoByIndex(int src, vec2 t, float cellAsp, vec2 coff, float z, float bk, float id){
    if(src == 0) return photoSample(sTD2DInputs[0], uTD2DInfos[0].res.zw, t, cellAsp, coff, z, bk, id);
    if(src == 1) return photoSample(sTD2DInputs[1], uTD2DInfos[1].res.zw, t, cellAsp, coff, z, bk, id);
    return               photoSample(sTD2DInputs[2], uTD2DInfos[2].res.zw, t, cellAsp, coff, z, bk, id);
}
vec3 codeColor(vec2 t, float id){
    vec2 g = fract(t*vec2(1.5, 2.5) + vec2(id, id*1.7));
    float gl = dot(texture(sTD2DInputs[3], g).rgb, vec3(0.333));
    return mix(vec3(0.02,0.03,0.035), vec3(0.50,0.75,0.60), gl);
}
vec3 paperColor(vec2 t, float id){
    vec2 g = fract(t*vec2(2.0, 3.0) + vec2(id*1.3, id));
    float gl = dot(texture(sTD2DInputs[3], g).rgb, vec3(0.333));
    float grain = h21(floor(t*vec2(220.0)) + id);
    return uPalHigh*(0.92 + 0.06*grain) - gl*0.18*vec3(0.6,0.5,0.4);
}
vec3 gradeCell(vec3 c, float bid){
    float l = dot(c, vec3(0.299,0.587,0.114));
    float pick = fract(bid*5.0);
    vec3 midC = (pick < 0.34) ? uPalMid : (pick < 0.67) ? vec3(0.12,0.20,0.42) : vec3(0.30,0.34,0.20);
    midC = mix(uPalMid, midC, clamp(uBehavior.z,0.0,1.0));
    vec3 toned = l < 0.5 ? mix(uPalShadow, midC, l*2.0) : mix(midC, uPalHigh, (l-0.5)*2.0);
    return mix(c, toned, clamp(uPalMix,0.0,1.0));
}

// ---------------- stochastic timing -----------------------------------------
float stochasticEra(float time, float relayout){
    float avg = clamp(relayout, 1.0, 40.0);
    float window = avg * 48.0;
    float laps = floor(time / window);
    float wt = time - laps*window;
    float t = 0.0, local = 0.0;
    for(int i = 0; i < 64; i++){
        float ge = laps*64.0 + local;
        float hold = avg * mix(0.4, 1.8, h11(ge*1.7 + 3.0));
        if(t + hold > wt) break;
        t += hold; local += 1.0;
    }
    return laps*64.0 + local;
}
// returns (on, progress 0..1) for the diffusion takeover event
vec2 diffusionEvent(float time, float freq){
    if(freq < 0.001) return vec2(0.0);
    float gapMin = mix(60.0, 7.0, freq);
    float gapMax = mix(120.0, 16.0, freq);
    float window = (gapMax + 3.0) * 40.0;
    float laps = floor(time / window);
    float wt = time - laps*window;
    float t = 0.0;
    for(int i = 0; i < 40; i++){
        float ge  = laps*40.0 + float(i);
        float gap = mix(gapMin, gapMax, h11(ge*1.7 + 7.0));
        float dur = mix(2.0, 3.0, h11(ge*2.7 + 13.0));     // 2-3 s
        if(wt < t + gap)        return vec2(0.0, 0.0);
        if(wt < t + gap + dur)  return vec2(1.0, (wt - (t+gap)) / dur);
        t += gap + dur;
    }
    return vec2(0.0);
}

// ---------------- DIFFUSION fullscreen scene --------------------------------
vec3 diffusionScene(vec2 uv, float aspect, float prog){
    vec3 dv = texture(sTD2DInputs[1], uv).rgb;          // src4 fullscreen
    dv = mix(dv, gradeCell(dv, 0.3), 0.35);

    // onset strobe (the "strobe to src4")
    if(prog < 0.22){
        float s = step(0.5, fract(uTime*22.0));
        dv = (s > 0.5) ? dv : ((fract(uTime*11.0) > 0.5) ? vec3(0.95) : uPalVoid);
    }
    // grid around it
    vec2 gq = uv * vec2(aspect, 1.0);
    float g = lineMask(fract(gq.x*9.0)-0.5, 0.0035) + lineMask(fract(gq.y*9.0)-0.5, 0.0035);
    dv = mix(dv, vec3(0.85), clamp(g,0.0,1.0) * 0.16);
    dv = mix(dv, vec3(0.95,0.30,0.25), (lineMask(uv.x-0.5,0.0006)+lineMask(uv.y-0.5,0.0006))*0.30);

    // attention-map text overlaid (tiny, tiled)
    float at = dot(texture(sTD2DInputs[7], fract(uv*vec2(2.0,4.0))).rgb, vec3(0.333));
    dv = mix(dv, vec3(0.65,0.92,0.72), at * 0.22);
    return dv;
}

// -----------------------------------------------------------------------------
struct Cell { vec4 rect; float id; float depth; float square; };

Cell subdivide(vec2 q, float aspect, float era){
    vec2  uv = q;
    vec4  rect = vec4(0.0, 0.0, aspect, 1.0);
    float id = 0.13, depth = 0.0, square = 0.0;
    int   mode  = int(floor(clamp(uControls.y, 0.0, 2.0) + 0.5));
    float maxLvl = mix(3.0, 9.0, clamp(uControls.x, 0.0, 1.0));
    float minSz  = mix(0.34, 0.05, clamp(uControls.x, 0.0, 1.0));
    for(int i = 0; i < 12; i++){
        if(float(i) >= maxLvl) break;
        vec2 s = rect.zw - rect.xy;
        float seed = h21(rect.xy*vec2(91.7,57.3) + rect.zw*vec2(13.1,7.7) + era*1.7 + float(mode)*5.0);
        if(mode == 0){
            float sq = min(s.x, s.y);
            if(s.x >= s.y){
                bool left = mod(float(i),2.0) < 1.0; float xm = left ? rect.x+sq : rect.z-sq;
                bool inSq = left ? (uv.x < xm) : (uv.x > xm);
                if(inSq){ if(left) rect.z=xm; else rect.x=xm; square=1.0; } else { if(left) rect.x=xm; else rect.z=xm; }
            } else {
                bool top = mod(float(i),2.0) < 1.0; float ym = top ? rect.y+sq : rect.w-sq;
                bool inSq = top ? (uv.y < ym) : (uv.y > ym);
                if(inSq){ if(top) rect.w=ym; else rect.y=ym; square=1.0; } else { if(top) rect.y=ym; else rect.w=ym; }
            }
            id = h21(rect.xy*vec2(269.5,183.3) + rect.zw*vec2(11.0,3.0)); depth += 1.0;
            if(square > 0.5) break;
        } else if(mode == 2){
            bool vertical = (i < int(maxLvl*0.55));
            float cut = (seed < 0.5) ? IPHI : (1.0 - IPHI);
            if(vertical){ float xm=mix(rect.x,rect.z,cut); if(uv.x<xm) rect.z=xm; else rect.x=xm; }
            else        { float ym=mix(rect.y,rect.w,cut); if(uv.y<ym) rect.w=ym; else rect.y=ym; }
            id = h21(rect.xy*vec2(269.5,183.3) + rect.zw*vec2(11.0,3.0)); depth += 1.0;
            if(min(rect.z-rect.x, rect.w-rect.y) < minSz && seed < 0.5) break;
        } else {
            if(min(s.x, s.y) < minSz && seed < 0.45) break;
            bool horiz = s.x >= s.y; float cut = (seed < 0.5) ? IPHI : (1.0 - IPHI);
            if(horiz){ float xm=mix(rect.x,rect.z,cut); if(uv.x<xm) rect.z=xm; else rect.x=xm; }
            else     { float ym=mix(rect.y,rect.w,cut); if(uv.y<ym) rect.w=ym; else rect.y=ym; }
            id = h21(rect.xy*vec2(269.5,183.3) + rect.zw*vec2(11.0,3.0)); depth += 1.0;
        }
    }
    return Cell(rect, id, depth, square);
}

// =============================================================================
void main(){
    vec2  uv     = vUV.st;
    vec2  rdim   = (uRes.y > 0.5) ? uRes : vec2(16.0, 9.0);
    float aspect = rdim.x / rdim.y;
    vec2  q      = vec2(uv.x * aspect, uv.y);

    // ---- DIFFUSION takeover (global) ----
    vec2 dEvt = diffusionEvent(uTime, clamp(uExtra.x,0.0,1.0));
    if(dEvt.x > 0.5){
        vec3 d = clamp(diffusionScene(uv, aspect, dEvt.y)*1.04 - 0.02, 0.0, 1.0);
        fragColor = TDOutputSwizzle(vec4(d, 1.0));
        return;
    }

    float era = stochasticEra(uTime, uBehavior.w);
    Cell  c   = subdivide(q, aspect, era);
    vec2  sz  = c.rect.zw - c.rect.xy;
    vec2  t   = (q - c.rect.xy) / max(sz, vec2(1e-4));
    float cellAsp = sz.x / max(sz.y, 1e-4);

    vec4  ctl = texture(sTD2DInputs[4], vec2(c.id, 0.5));
    float bid = h21(c.rect.xy*7.0 + c.rect.zw*3.0 + era*1.7);
    float elong = 1.0 - min(sz.x,sz.y)/max(max(sz.x,sz.y),1e-4);
    int   state = int(floor(fract(c.id*1.7 + c.depth*0.17 + elong*0.3) * 5.0));

    float bk   = clamp(uContent.x * (0.20 + 1.20*mix(h11(c.id*7.0), ctl.y, 0.55)) + c.depth*0.025, 0.0, 1.0);
    float z    = mix(1.0, 0.42, clamp(uContent.w,0.0,1.0) * h11(c.id*3.3));
    vec2  coff = vec2(h11(c.id*4.4), h11(c.id*9.2)) * (1.0 - z);
    int   src  = int(floor(fract(ctl.x*0.9 + bid*1.7) * 3.0));

    vec2  cCtr = vec2(((c.rect.x+c.rect.z)*0.5)/aspect, (c.rect.y+c.rect.w)*0.5);
    float colH = h11(floor(cCtr.x*6.0)*3.7 + era*1.3 + 11.0);
    float rowH = h11(floor(cCtr.y*6.0)*2.9 + era*2.1 + 50.0);
    float strk = clamp(uBehavior.y, 0.0, 1.0);
    bool whiteStreak = (colH > mix(1.01,0.86,strk)) || (rowH > mix(1.01,0.90,strk));
    bool blackStreak = (colH < mix(-0.01,0.13,strk)) || (rowH < mix(-0.01,0.09,strk));

    int  mode;
    float msel = fract(ctl.x*0.5 + bid*0.5);
    if      (msel < 0.45) mode = PHOTO;
    else if (msel < 0.60) mode = CODE;
    else if (msel < 0.72) mode = STROBE;
    else if (msel < 0.84) mode = FEEDBK;
    else if (msel < 0.92) mode = OLDFR;
    else                  mode = VOID;
    if (state == 0 && msel < 0.5)            mode = VOID;
    if (mode == STROBE && bid > uBehavior.x) mode = PHOTO;
    if (c.square > 0.5){ mode = PHOTO; bk *= 0.4; }
    if (whiteStreak) mode = PAPER;
    if (blackStreak) mode = VOID;

    bool photoFam = (mode==PHOTO || mode==STROBE || mode==FEEDBK || mode==OLDFR);
    vec3 content;
    if      (photoFam)      content = photoByIndex(src, t, cellAsp, coff, z, bk, c.id);
    else if (mode == CODE)  content = codeColor(t, c.id);
    else if (mode == PAPER) content = paperColor(t, c.id);
    else                    content = uPalVoid;
    if (photoFam) content = gradeCell(content, bid);

    vec3 prev = texture(sTD2DInputs[5], uv).rgb;
    if (mode == FEEDBK){
        vec2 drift = (vec2(h11(c.id*6.1), h11(c.id*8.3)) - 0.5) * 0.012;
        vec3 prevD = texture(sTD2DInputs[5], uv + drift).rgb;
        content = max(prevD*0.97, content);
        content = mix(content, prevD, clamp(0.55*uContent.y + 0.15, 0.0, 0.9));
    } else if (mode == OLDFR){
        content = mix(content, prev, clamp(0.85*uContent.y + 0.15, 0.0, 0.95));
    } else if (mode == PHOTO && bk > 0.5){
        vec2 drift = (vec2(h11(c.id*6.1), h11(c.id*8.3)) - 0.5) * 0.01;
        content = mix(content, texture(sTD2DInputs[5], uv+drift).rgb, uContent.y*bk*0.45);
    }
    if (mode == STROBE){
        float rate = mix(3.0, 16.0, bid);
        float ph   = fract(uTime*rate + bid*7.0);
        vec2  jit  = vec2((h11(floor(uTime*rate)+bid)-0.5)*0.04, 0.0);
        content = gradeCell(photoByIndex(src, t+jit, cellAsp, coff, z, min(bk+0.4,1.0), c.id), bid);
        if      (ph < 0.22) content = vec3(1.0) - content;
        else if (ph < 0.36) content = uPalHigh;
        else if (ph < 0.46) content = uPalVoid;
    }
    content *= 1.0 - 0.12 * bk * step(0.5, bk) * (0.5 + 0.5*sin(uv.y * rdim.y * 3.14159));

    // ============ DIEGETIC INTERFACE (scaled by Marks) ============
    float M = clamp(uContent.z, 0.0, 1.0);
    vec2  ed = min(q - c.rect.xy, c.rect.zw - q);
    float border = min(ed.x, ed.y);
    float lw = mix(0.00012, 0.0007, clamp(uControls.z, 0.0, 1.0));     // thinner rules
    content = mix(content, vec3(0.80,0.82,0.86), lineMask(border, lw) * mix(0.22, 0.5, M));

    if(h11(c.id*21.0 + era) > 0.88){
        vec2 d = uv - cCtr;
        float cross = lineMask(d.x, 0.0005)*step(abs(d.y),0.10) + lineMask(d.y, 0.0005)*step(abs(d.x),0.10);
        float ticks = lineMask(fract((uv.x-cCtr.x)*140.0)-0.5, 0.07)*step(abs(d.y),0.0035)
                    + lineMask(fract((uv.y-cCtr.y)*140.0)-0.5, 0.07)*step(abs(d.x),0.0035);
        content = mix(content, vec3(0.95,0.30,0.22), clamp(cross+ticks,0.0,1.0) * 0.8 * M);
    }
    float fcross = lineMask(uv.x-0.5, 0.0003) + lineMask(uv.y-0.5, 0.0003);
    content = mix(content, vec3(0.85), fcross * 0.16 * M);
    vec2 cb = min(uv, 1.0-uv);
    float bracket = step(cb.x,0.05)*lineMask(cb.y,0.0007) + step(cb.y,0.05)*lineMask(cb.x,0.0007);
    content = mix(content, vec3(0.9), clamp(bracket,0.0,1.0) * 0.4 * M);
    content = mix(content, vec3(0.85), step(uv.x,0.045)*lineMask(fract(uv.y*22.0)-0.5,0.05)*0.5*M);
    {
        vec2 a = vec2(0.5) + 0.45*vec2(h11(era+1.0)-0.5, h11(era+2.0)-0.5);
        vec2 d = uv - a;
        float star = lineMask(d.x,0.0005)*smoothstep(0.16,0.0,abs(d.y)) + lineMask(d.y,0.0005)*smoothstep(0.16,0.0,abs(d.x));
        content += vec3(0.9,0.93,1.0) * star * 0.5 * M;
    }

    // (per-cell effect LABELS are drawn in a separate downstream pass, labels.frag,
    //  AFTER the feedback tap, so the letters stay crisp / are never fed back)

    // ============ ATTENTION HEATMAP (corner, when not in takeover) ============
    if(uExtra.z > 0.01){
        vec2 cmin = vec2(0.795, 0.795), cs = vec2(0.185, 0.185);
        if(all(greaterThan(uv, cmin)) && all(lessThan(uv, cmin+cs))){
            vec2 huv = (uv - cmin) / cs;
            float N = 16.0;
            vec2 blk = (floor(huv*N) + 0.5) / N;
            float v = texture(sTD2DInputs[8], blk).r;
            vec3 hm = (v > 0.5) ? vec3(0.92) : vec3(0.04);
            vec2 f = fract(huv*N);
            hm = mix(hm, vec3(0.45), step(0.94, max(f.x,f.y)) * 0.6);
            content = mix(content, hm, clamp(uExtra.z,0.0,1.0));
        }
    }

    content = clamp(content*1.04 - 0.02, 0.0, 1.0);
    fragColor = TDOutputSwizzle(vec4(content, 1.0));
}
