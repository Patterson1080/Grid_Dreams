// =============================================================================
//  LABELS PASS  -  TouchDesigner GLSL TOP (glslmultiTOP)
//  Stamps crisp per-cell effect labels OVER the finished grid image, AFTER the
//  feedback tap, so the letters are never fed back / quantized / strobed.
//  Recomputes the same cell layout as grid_glitch.frag so labels line up.
//
//  Do NOT add a #version line.
//  INPUTS:  [0] grid (finished image)  [1] fontatlas  [2] csv_data (ctrl)
//  UNIFORMS: uTime ; uControls(Density,Gridmode,Linewidth,Statecontrast) ; uRes
//            uBehavior(Strobe,Streaks,Colorvary,Relayout) ; uExtra(Diffusion,Labels,Heatmap,_)
// =============================================================================

layout(location = 0) out vec4 fragColor;

uniform float uTime;
uniform vec4  uControls;
uniform vec2  uRes;
uniform vec4  uBehavior;
uniform vec4  uExtra;

const float IPHI = 0.6180339887;
const int PHOTO=0, CODE=1, PAPER=2, VOID=3, STROBE=4, FEEDBK=5, OLDFR=6;

float h11(float p){ p = fract(p*0.1031); p *= p+33.33; p *= p+p; return fract(p); }
float h21(vec2 p){
    vec3 p3 = fract(vec3(p.xyx)*0.1031);
    p3 += dot(p3, p3.yzx+33.33);
    return fract((p3.x+p3.y)*p3.z);
}

// ---- font atlas (input 1): 12 cols x 11 rows ----
float atlasGlyph(int row, int col, vec2 local){
    const float NC = 12.0, NR = 11.0;
    float gy = clamp(local.y, 0.0, 1.0)*0.82 + 0.10;
    float ux = (float(col) + clamp(local.x,0.0,1.0)) / NC;
    float vy = 1.0 - (float(row) + (1.0 - gy)) / NR;
    return texture(sTD2DInputs[1], vec2(ux, vy)).r;
}
int wordRow(int m){ return 2 + m; }
int wordLen(int m){
    if(m==0) return 5; if(m==1) return 4; if(m==2) return 5; if(m==3) return 4;
    if(m==4) return 6; if(m==5) return 8; if(m==6) return 8; return 9;
}
ivec2 labelChar(int mode, int number, int k){
    if(k < 4)  return ivec2(0, k);
    if(k == 4) return ivec2(-1,-1);
    if(k == 5) return ivec2(1, number/10);
    if(k == 6) return ivec2(1, number - (number/10)*10);
    if(k == 7) return ivec2(10, 0);
    int wi = k - 8;
    if(wi < wordLen(mode)) return ivec2(wordRow(mode), wi);
    return ivec2(-1,-1);
}
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

// ---- timing (must match grid_glitch.frag) ----
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
float diffusionOn(float time, float freq){
    if(freq < 0.001) return 0.0;
    float gapMin = mix(60.0, 7.0, freq);
    float gapMax = mix(120.0, 16.0, freq);
    float window = (gapMax + 3.0) * 40.0;
    float laps = floor(time / window);
    float wt = time - laps*window;
    float t = 0.0;
    for(int i = 0; i < 40; i++){
        float ge  = laps*40.0 + float(i);
        float gap = mix(gapMin, gapMax, h11(ge*1.7 + 7.0));
        float dur = mix(2.0, 3.0, h11(ge*2.7 + 13.0));
        if(wt < t + gap)       return 0.0;
        if(wt < t + gap + dur) return 1.0;
        t += gap + dur;
    }
    return 0.0;
}

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

void main(){
    vec2  uv  = vUV.st;
    vec3  img = texture(sTD2DInputs[0], uv).rgb;       // finished grid image
    float L   = clamp(uExtra.y, 0.0, 1.0);

    // no labels during a diffusion takeover (the frame is fullscreen src4)
    if(L < 0.01 || diffusionOn(uTime, clamp(uExtra.x,0.0,1.0)) > 0.5){
        fragColor = TDOutputSwizzle(vec4(img, 1.0));
        return;
    }

    vec2  rdim   = (uRes.y > 0.5) ? uRes : vec2(16.0, 9.0);
    float aspect = rdim.x / rdim.y;
    vec2  q      = vec2(uv.x * aspect, uv.y);
    float era    = stochasticEra(uTime, uBehavior.w);
    Cell  c      = subdivide(q, aspect, era);
    vec2  sz     = c.rect.zw - c.rect.xy;
    float cellWuv = sz.x / aspect;
    float charH  = 0.013;

    if(cellWuv <= 12.0*charH*0.55){
        fragColor = TDOutputSwizzle(vec4(img, 1.0));
        return;
    }

    // ---- replicate the cell's behaviour mode (matches grid_glitch.frag) ----
    vec4  ctl = texture(sTD2DInputs[2], vec2(c.id, 0.5));
    float bid = h21(c.rect.xy*7.0 + c.rect.zw*3.0 + era*1.7);
    float elong = 1.0 - min(sz.x,sz.y)/max(max(sz.x,sz.y),1e-4);
    int   state = int(floor(fract(c.id*1.7 + c.depth*0.17 + elong*0.3) * 5.0));
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
    if (c.square > 0.5)                      mode = PHOTO;
    if (whiteStreak) mode = PAPER;
    if (blackStreak) mode = VOID;

    int  number = int(fract(c.id*7.3) * 100.0);
    vec2 org = vec2(c.rect.x/aspect + charH*0.4, c.rect.w - charH*1.3);
    float txt = drawLabel(uv, org, mode, number, charH);

    // crisp letters: white on dark cells, dark on white(PAPER) cells; red on strobe
    vec3 lcol = (mode==STROBE) ? vec3(0.95,0.40,0.30)
              : (mode==PAPER)  ? vec3(0.10,0.10,0.12)
                               : vec3(0.92,0.94,0.98);
    img = mix(img, lcol, txt * L);

    fragColor = TDOutputSwizzle(vec4(img, 1.0));
}
