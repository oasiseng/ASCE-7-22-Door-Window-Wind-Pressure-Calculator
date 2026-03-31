import { useState, useMemo, useCallback, useRef } from "react";

// ─── MATERIAL DATABASE ───
const MATERIALS = {
  "6061-T6 Aluminum": { Fty: 35, Fcy: 35, Fsy: 20, Fu: 42, E: 10100, density: 0.1, code: "ADM-2010" },
  "A36 Steel": { Fty: 36, Fcy: 36, Fsy: 21.6, Fu: 58, E: 29000, density: 0.284, code: "AISC 360-16" },
  "A992 Steel": { Fty: 50, Fcy: 50, Fsy: 30, Fu: 65, E: 29000, density: 0.284, code: "AISC 360-16" },
};

// ─── SECTION DATABASE ───
// r = √(I/A) = radius of gyration for buckling
const SECTIONS = {
  posts: [
    { name: 'HSS 3"×3"×3/16"', type: "HSS", H: 3, B: 3, t: 0.1875, A: 2.02, I: 2.60, S: 1.73, r: 1.13 },
    { name: 'HSS 3"×3"×1/4"', type: "HSS", H: 3, B: 3, t: 0.25, A: 2.59, I: 3.22, S: 2.15, r: 1.11 },
    { name: 'HSS 4"×4"×3/16"', type: "HSS", H: 4, B: 4, t: 0.1875, A: 2.77, I: 6.59, S: 3.30, r: 1.54 },
    { name: 'HSS 4"×4"×1/4"', type: "HSS", H: 4, B: 4, t: 0.25, A: 3.59, I: 8.22, S: 4.11, r: 1.51 },
    { name: 'HSS 4"×4"×5/16"', type: "HSS", H: 4, B: 4, t: 0.3125, A: 4.36, I: 9.58, S: 4.79, r: 1.48 },
    { name: 'HSS 5"×5"×1/4"', type: "HSS", H: 5, B: 5, t: 0.25, A: 4.59, I: 17.1, S: 6.84, r: 1.93 },
    { name: 'HSS 6"×6"×1/4"', type: "HSS", H: 6, B: 6, t: 0.25, A: 5.59, I: 30.5, S: 10.2, r: 2.34 },
  ],
  beams: [
    { name: 'C 4"×2"×1/4"', type: "C", H: 4, B: 2, t: 0.25, A: 1.79, Ix: 3.68, Iy: 0.34, Sx: 1.84, Sy: 0.34, rx: 1.43, ry: 0.44 },
    { name: 'C 6"×2"×1/4"', type: "C", H: 6, B: 2, t: 0.25, A: 2.29, Ix: 0.77, Iy: 3.68, Sx: 3.68, Sy: 0.51, rx: 0.58, ry: 1.27 },
    { name: 'C 6"×3"×1/4"', type: "C", H: 6, B: 3, t: 0.25, A: 2.79, Ix: 12.9, Iy: 1.17, Sx: 4.30, Sy: 0.78, rx: 2.15, ry: 0.65 },
    { name: 'C 8"×2"×1/4"', type: "C", H: 8, B: 2, t: 0.25, A: 2.79, Ix: 22.1, Iy: 0.42, Sx: 5.53, Sy: 0.42, rx: 2.81, ry: 0.39 },
    { name: 'C 8"×3"×1/4"', type: "C", H: 8, B: 3, t: 0.25, A: 3.29, Ix: 26.8, Iy: 1.50, Sx: 6.70, Sy: 1.00, rx: 2.85, ry: 0.68 },
  ],
};

// ─── PAD SCHEDULE ───
const PAD_SCHEDULE = [
  { sym: "P18", side: 18, depth: 16, rebarQty: 3, rebarSize: "#4", capacity: 4050 },
  { sym: "P24", side: 24, depth: 16, rebarQty: 3, rebarSize: "#5", capacity: 7200 },
  { sym: "P30", side: 30, depth: 16, rebarQty: 4, rebarSize: "#5", capacity: 11250 },
  { sym: "P36", side: 36, depth: 16, rebarQty: 4, rebarSize: "#5", capacity: 16200 },
  { sym: "P42", side: 42, depth: 16, rebarQty: 4, rebarSize: "#5", capacity: 22050 },
  { sym: "P48", side: 48, depth: 16, rebarQty: 5, rebarSize: "#5", capacity: 28800 },
  { sym: "P54", side: 54, depth: 24, rebarQty: 8, rebarSize: "#5", capacity: 34425 },
  { sym: "P60", side: 60, depth: 24, rebarQty: 9, rebarSize: "#5", capacity: 42500 },
];

// ─── WIND CALC ENGINE (ASCE 7-22) ───
function calcWind({ V, riskCat, exposure, Kd, Kzt, height }) {
  const KzTable = { B: 0.57, C: 0.85, D: 1.03 };
  let Kz = KzTable[exposure] || 0.85;
  if (height > 15) {
    const alpha = exposure === "B" ? 7.0 : exposure === "C" ? 9.5 : 11.5;
    const zg = exposure === "B" ? 1200 : exposure === "C" ? 900 : 700;
    Kz = 2.01 * Math.pow(Math.max(15, Math.min(height, zg)) / zg, 2 / alpha);
  }
  const G = 0.85;
  const qh = 0.00256 * Kz * Kzt * Kd * V * V;
  return { Kz, G, qh, Kd, Kzt };
}

// ─── STRUCTURAL CHECKS ───
function checkPost({ N, M, V, section, material }) {
  const mat = MATERIALS[material];
  // N (kips), M (kip-ft), V (kips), S (in³)
  // Must convert M to kip-in (×12) before dividing by S to get ksi
  const Fb = N / section.A + (M * 12) / section.S;
  const Ft = Math.max(0, (M * 12) / section.S - N / section.A);
  const Fv = V / section.A;
  const allowTension = 0.75 * mat.Fty;
  const allowComp = 0.75 * mat.Fcy;
  const allowShear = 0.6 * mat.Fsy;
  return {
    Ft: { demand: Ft, capacity: allowTension, ratio: Ft / allowTension, ok: Ft <= allowTension },
    Fb: { demand: Fb, capacity: allowComp, ratio: Fb / allowComp, ok: Fb <= allowComp },
    Fv: { demand: Fv, capacity: allowShear, ratio: Fv / allowShear, ok: Fv <= allowShear },
    allOk: Ft <= allowTension && Fb <= allowComp && Fv <= allowShear,
  };
}

function checkBeam({ N, M_in, M_out, V, section, material }) {
  const mat = MATERIALS[material];
  // M_in, M_out in kip-ft; Sx, Sy in in³ → multiply by 12 for ksi
  const Fb = (N || 0) / section.A + (M_in * 12) / section.Sx + (M_out * 12) / section.Sy;
  const Ft = Math.max(0, (M_in * 12) / section.Sx + (M_out * 12) / section.Sy - (N || 0) / section.A);
  const Fv = V / section.A;
  const allowTension = 0.75 * mat.Fty;
  const allowComp = 0.75 * mat.Fcy;
  const allowShear = 0.6 * mat.Fsy;
  return {
    Ft: { demand: Ft, capacity: allowTension, ratio: Ft / allowTension, ok: Ft <= allowTension },
    Fb: { demand: Fb, capacity: allowComp, ratio: Fb / allowComp, ok: Fb <= allowComp },
    Fv: { demand: Fv, capacity: allowShear, ratio: Fv / allowShear, ok: Fv <= allowShear },
    allOk: Ft <= allowTension && Fb <= allowComp && Fv <= allowShear,
  };
}

function checkConnection({ M, V, P, nBolts, boltDia, boltFu, anchorN, anchorDia, anchorSpacing, anchorDepth, anchorTcap, anchorVcap }) {
  // --- BOLTS ---
  const Ab = Math.PI * (boltDia / 2) ** 2;
  const Rn = 0.45 * boltFu * Ab; // kips (ksi × in²)
  const omega = 2.0;
  const boltCapKips = Rn / omega;
  // Convert to lbs for UI display
  const boltCap = boltCapKips * 1000;
  const shearPerBolt = (V * 1000) / nBolts; // V is kips → lbs
  const boltOk = shearPerBolt <= boltCap;

  // --- ANCHORS ---
  // M (kip-ft), P (kips) → T in kips, then convert to lbs
  const T_kips = anchorN > 0 ? (M * 12) / ((anchorN / 2) * anchorSpacing) - P / anchorN : 0;
  const Fv_kips = anchorN > 0 ? V / anchorN : 0;
  // Convert to lbs to compare against anchor capacities (which are in lbs)
  const T = T_kips * 1000;
  const Fv_anchor = Fv_kips * 1000;
  const Tcap = anchorTcap || 2670; // lbs
  const Vcap = anchorVcap || 3620; // lbs
  const interaction = anchorN > 0 ? (T / Tcap) ** 2 + (Fv_anchor / Vcap) ** 2 : 0;
  const anchorOk = interaction <= 1.0 && T <= Tcap && Fv_anchor <= Vcap;

  return {
    bolt: { shearPerBolt, capacity: boltCap, ok: boltOk },
    anchor: { T, Tcap, Fv: Fv_anchor, Vcap, interaction, ok: anchorOk },
    allOk: boltOk && anchorOk,
  };
}

// ─── COLUMN BUCKLING CHECK (AISC E3 / ADM E equivalent) ───
function checkBuckling({ N, M, V, section, material, K, L_in }) {
  const mat = MATERIALS[material];
  const r = section.r || Math.sqrt(section.I / section.A);
  const KLr = (K * L_in) / r;

  // Elastic buckling stress (Euler)
  const Fe = (Math.PI * Math.PI * mat.E) / (KLr * KLr);

  // Critical buckling stress per AISC E3 / ADM equivalent
  let Fcr;
  const slenderLimit = 4.71 * Math.sqrt(mat.E / mat.Fcy);
  if (KLr <= slenderLimit) {
    // Inelastic buckling
    Fcr = mat.Fcy * Math.pow(0.658, mat.Fcy / Fe);
  } else {
    // Elastic buckling
    Fcr = 0.877 * Fe;
  }

  // ASD: Allowable = Fcr / Ω (Ω = 1.67 for compression per AISC, ~1.65 for ADM)
  const omega = 1.67;
  const Fa = Fcr / omega;

  // Actual compressive stress
  const fa = N / section.A;

  // Combined axial + bending interaction (AISC H1-1a simplified)
  const fb = (M * 12) / section.S;
  const Fb_allow = 0.75 * mat.Fcy;
  let interactionRatio;
  if (fa / Fa >= 0.2) {
    interactionRatio = fa / Fa + (8 / 9) * (fb / Fb_allow);
  } else {
    interactionRatio = fa / (2 * Fa) + fb / Fb_allow;
  }

  return {
    KLr,
    Fe,
    Fcr,
    Fa,
    fa,
    fb,
    Fb_allow,
    interactionRatio,
    slenderLimit,
    ok: interactionRatio <= 1.0,
  };
}

// ─── BEAM DEFLECTION CHECK ───
function checkDeflection({ w_plf, L_ft, E, I, limit }) {
  // w in plf, L in ft, E in ksi, I in in⁴
  // δ = 5wL⁴ / (384EI) — uniform load, simple span
  // Convert: w to lb/in = w_plf/12, L to in = L_ft*12
  const w_pli = w_plf / 12;
  const L_in = L_ft * 12;
  const delta = (5 * w_pli * Math.pow(L_in, 4)) / (384 * E * 1000 * I); // E in ksi → psi
  const deltaAllow = L_in / limit;
  return {
    delta,
    deltaAllow,
    ratio: delta / deltaAllow,
    limitLabel: `L/${limit}`,
    ok: delta <= deltaAllow,
  };
}

function checkFoundation({ P, M, B, L, H, soilBearing, concDensity }) {
  const Pfoot = (B / 12) * (L / 12) * (H / 12) * concDensity;
  const Ptotal = P + Pfoot;
  const ex = Ptotal > 0 ? (M * 12) / Ptotal : 0;
  const Bft = B / 12;
  const Lft = L / 12;
  const eLimit = B / 6;

  let qmax, qmin, uplift = false;
  if (ex <= eLimit) {
    // Full footing in compression — standard formula
    qmax = (Ptotal / (Bft * Lft)) * (1 + (6 * ex) / B);
    qmin = (Ptotal / (Bft * Lft)) * (1 - (6 * ex) / B);
  } else {
    // Eccentricity exceeds kern — triangular stress block (soil can't take tension)
    uplift = true;
    const bearingLength = 3 * (Bft / 2 - ex / 12);
    qmax = bearingLength > 0 ? (2 * Ptotal) / (Lft * bearingLength) : 99999;
    qmin = 0;
  }

  const qfoot = Pfoot / (Bft * Lft);
  const pad = PAD_SCHEDULE.find((p) => p.capacity >= Ptotal) || PAD_SCHEDULE[PAD_SCHEDULE.length - 1];

  return {
    Ptotal, Pfoot, ex, eLimit,
    qmax, qmin, uplift,
    qfoot,
    soilBearing,
    ok: qmax <= soilBearing && !uplift,
    pad,
  };
}

// ─── DEFAULT RACK STATE ───
function createDefaultRack() {
  return {
    posts: [
      { id: 1, x: 0, label: "Side post", isCenterPost: false },
      { id: 2, x: 42, label: "Center post", isCenterPost: true },
      { id: 3, x: 90, label: "Center post", isCenterPost: true },
      { id: 4, x: 132, label: "Side post", isCenterPost: false },
    ],
    beams: [
      { id: 1, y: 72, label: "Top beam" },
      { id: 2, y: 36, label: "Mid beam" },
      { id: 3, y: 6, label: "Low beam" },
    ],
    equipment: [
      { id: 1, label: "MDP", weight: 900, width: 24, height: 30, bayIndex: 0 },
      { id: 2, label: "MAIN", weight: 750, width: 24, height: 30, bayIndex: 1 },
      { id: 3, label: "TPA-1", weight: 990, width: 24, height: 24, bayIndex: 2 },
    ],
    rackHeight: 90,
    postSection: 3,
    beamSection: 1,
    material: "6061-T6 Aluminum",
  };
}

// ─── STYLES ───
const S = {
  app: { background: "#08090a", color: "#d4d4d8", fontFamily: "'DM Sans', -apple-system, sans-serif", minHeight: "100vh" },
  header: { padding: "20px 24px", borderBottom: "1px solid #1c1e22", display: "flex", alignItems: "center", gap: 14 },
  logo: { width: 34, height: 34, borderRadius: 8, background: "linear-gradient(135deg, #2563eb, #1d4ed8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: "#fff", flexShrink: 0 },
  tabs: { display: "flex", gap: 2, padding: "0 24px", borderBottom: "1px solid #1c1e22", background: "#0c0d0f", overflowX: "auto" },
  tab: (active) => ({ padding: "12px 18px", fontSize: 13, fontWeight: 500, color: active ? "#e4e4e7" : "#52525b", background: active ? "#18191d" : "transparent", borderBottom: active ? "2px solid #2563eb" : "2px solid transparent", cursor: "pointer", whiteSpace: "nowrap", letterSpacing: "0.01em", transition: "all 0.15s" }),
  panel: { padding: 24, maxWidth: 900, margin: "0 auto" },
  card: { background: "#111215", borderRadius: 10, border: "1px solid #1c1e22", padding: 20, marginBottom: 16 },
  cardTitle: { fontSize: 11, color: "#52525b", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600, marginBottom: 14 },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  grid3: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 },
  grid4: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 },
  field: { marginBottom: 14 },
  label: { display: "block", fontSize: 11, color: "#71717a", marginBottom: 5, letterSpacing: "0.03em", textTransform: "uppercase" },
  input: { width: "100%", background: "#0a0b0d", border: "1px solid #27272a", borderRadius: 6, padding: "8px 12px", color: "#e4e4e7", fontSize: 14, fontFamily: "'JetBrains Mono', monospace", outline: "none" },
  select: { width: "100%", background: "#0a0b0d", border: "1px solid #27272a", borderRadius: 6, padding: "8px 12px", color: "#e4e4e7", fontSize: 14, outline: "none", cursor: "pointer" },
  btn: (variant) => ({ padding: "8px 16px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "none", ...(variant === "primary" ? { background: "#2563eb", color: "#fff" } : variant === "danger" ? { background: "#7f1d1d", color: "#fca5a5" } : { background: "#27272a", color: "#a1a1aa" }) }),
  badge: (ok) => ({ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 16, fontSize: 11, fontWeight: 600, background: ok ? "#052e16" : "#2e0a0a", color: ok ? "#4ade80" : "#f87171", border: `1px solid ${ok ? "#166534" : "#7f1d1d"}` }),
  checkRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #1c1e22" },
  mono: { fontFamily: "'JetBrains Mono', monospace" },
};

// ─── COMPONENTS ───
function Field({ label, value, onChange, unit, type = "number", step, min, max }) {
  return (
    <div style={S.field}>
      <label style={S.label}>{label}</label>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input type={type} value={value} onChange={(e) => onChange(type === "number" ? parseFloat(e.target.value) || 0 : e.target.value)} step={step} min={min} max={max} style={S.input} />
        {unit && <span style={{ color: "#52525b", fontSize: 11, minWidth: 28 }}>{unit}</span>}
      </div>
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <div style={S.field}>
      <label style={S.label}>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={S.select}>
        {options.map((o, i) => <option key={i} value={typeof o === "object" ? o.value : o}>{typeof o === "object" ? o.label : o}</option>)}
      </select>
    </div>
  );
}

function Badge({ ok, label }) {
  return <span style={S.badge(ok)}><span style={{ fontSize: 9 }}>{ok ? "✓" : "✗"}</span>{label}</span>;
}

function CheckRow({ label, demand, capacity, unit, ok, ratio }) {
  return (
    <div style={S.checkRow}>
      <div>
        <div style={{ fontSize: 13, color: "#a1a1aa" }}>{label}</div>
        <div style={{ fontSize: 11, color: "#52525b" }}>{demand.toFixed(2)} / {capacity.toFixed(2)} {unit} ({(ratio * 100).toFixed(0)}%)</div>
      </div>
      <Badge ok={ok} label={ok ? "OK" : "NG"} />
    </div>
  );
}

// ─── ELEVATION SVG ───
function ElevationView({ rack, wind }) {
  const posts = rack.posts;
  const beams = rack.beams;
  const equip = rack.equipment;
  const W = 680;
  const H = 420;
  const padL = 60, padR = 40, padT = 30, padB = 60;
  const rackW = posts.length > 1 ? posts[posts.length - 1].x - posts[0].x : 60;
  const scaleX = rackW > 0 ? (W - padL - padR) / rackW : 1;
  const scaleY = rack.rackHeight > 0 ? (H - padT - padB) / rack.rackHeight : 1;
  const sc = Math.min(scaleX, scaleY, 3.5);
  const ox = padL;
  const baseY = H - padB;

  const px = (x) => ox + (x - (posts[0]?.x || 0)) * sc;
  const py = (y) => baseY - y * sc;

  const postSec = SECTIONS.posts[rack.postSection] || SECTIONS.posts[3];
  const postW = postSec.H * sc * 0.6;

  // Determine bays
  const bays = [];
  for (let i = 0; i < posts.length - 1; i++) {
    bays.push({ left: posts[i], right: posts[i + 1], width: posts[i + 1].x - posts[i].x });
  }

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ background: "#0a0b0d", borderRadius: 8 }}>
      {/* Ground line */}
      <line x1={ox - 20} y1={baseY + 2} x2={W - 20} y2={baseY + 2} stroke="#27272a" strokeWidth="1" />
      <line x1={ox - 20} y1={baseY + 14} x2={W - 20} y2={baseY + 14} stroke="#27272a" strokeWidth="0.5" strokeDasharray="4 3" />
      <text x={W - 22} y={baseY + 18} fill="#3f3f46" fontSize="9" textAnchor="end" fontFamily="'DM Sans', sans-serif">Grade</text>

      {/* Footings */}
      {posts.map((p, i) => (
        <g key={`ftg-${i}`}>
          <rect x={px(p.x) - 18} y={baseY + 3} width={36} height={10} rx={2} fill="#1c1e22" stroke="#27272a" strokeWidth="0.5" />
          <line x1={px(p.x) - 14} y1={baseY + 6} x2={px(p.x) + 14} y2={baseY + 6} stroke="#3f3f46" strokeWidth="0.5" />
          <line x1={px(p.x) - 14} y1={baseY + 10} x2={px(p.x) + 14} y2={baseY + 10} stroke="#3f3f46" strokeWidth="0.5" />
        </g>
      ))}

      {/* Posts */}
      {posts.map((p, i) => (
        <g key={`post-${i}`}>
          <rect x={px(p.x) - postW / 2} y={py(rack.rackHeight)} width={postW} height={rack.rackHeight * sc} rx={1} fill={p.isCenterPost ? "#1e3a5f" : "#1a2332"} stroke={p.isCenterPost ? "#2563eb" : "#3b82f6"} strokeWidth="0.8" opacity="0.85" />
          <text x={px(p.x)} y={baseY + 30} fill="#52525b" fontSize="9" textAnchor="middle" fontFamily="'DM Sans', sans-serif">{p.label}</text>
        </g>
      ))}

      {/* Beams */}
      {beams.map((b, i) =>
        posts.length > 1 && (
          <g key={`beam-${i}`}>
            <rect x={px(posts[0].x)} y={py(b.y) - 3} width={(posts[posts.length - 1].x - posts[0].x) * sc} height={6} rx={1} fill="#1c2d1c" stroke="#22c55e" strokeWidth="0.5" opacity="0.7" />
          </g>
        )
      )}

      {/* Equipment */}
      {equip.map((eq, i) => {
        const bay = bays[eq.bayIndex];
        if (!bay) return null;
        const cx = px((bay.left.x + bay.right.x) / 2);
        const eqW = Math.min(eq.width, bay.width - 4) * sc;
        const eqH = Math.min(eq.height, rack.rackHeight - 12) * sc;
        const eqBot = beams.length > 1 ? beams[1].y : 24;
        const eqY = py(eqBot + eq.height);
        return (
          <g key={`eq-${i}`}>
            <rect x={cx - eqW / 2} y={eqY} width={eqW} height={eqH} rx={3} fill="#2a1a0a" stroke="#f59e0b" strokeWidth="0.6" opacity="0.8" />
            <text x={cx} y={eqY + eqH / 2 - 5} fill="#fbbf24" fontSize="10" textAnchor="middle" fontFamily="'DM Sans', sans-serif" fontWeight="600">{eq.label}</text>
            <text x={cx} y={eqY + eqH / 2 + 8} fill="#92400e" fontSize="9" textAnchor="middle" fontFamily="'JetBrains Mono', monospace">{eq.weight} lbs</text>
          </g>
        );
      })}

      {/* Wind arrow */}
      {wind && (
        <g>
          <line x1={20} y1={py(rack.rackHeight / 2)} x2={50} y2={py(rack.rackHeight / 2)} stroke="#ef4444" strokeWidth="1.5" markerEnd="url(#warrow)" />
          <defs><marker id="warrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" /></marker></defs>
          <text x={18} y={py(rack.rackHeight / 2) - 8} fill="#ef4444" fontSize="9" fontFamily="'DM Sans', sans-serif">Wind</text>
        </g>
      )}

      {/* Dimension: total width */}
      {posts.length > 1 && (
        <g>
          <line x1={px(posts[0].x)} y1={py(rack.rackHeight) - 14} x2={px(posts[posts.length - 1].x)} y2={py(rack.rackHeight) - 14} stroke="#3f3f46" strokeWidth="0.5" />
          <text x={(px(posts[0].x) + px(posts[posts.length - 1].x)) / 2} y={py(rack.rackHeight) - 18} fill="#71717a" fontSize="10" textAnchor="middle" fontFamily="'JetBrains Mono', monospace">
            {((posts[posts.length - 1].x - posts[0].x) / 12).toFixed(1)}'-0"
          </text>
        </g>
      )}
    </svg>
  );
}

// ─── MAIN APP ───
export default function RackDesigner() {
  const [tab, setTab] = useState(0);
  const [rack, setRack] = useState(createDefaultRack);
  const [wind, setWind] = useState({ V: 170, riskCat: "II", exposure: "C", Kd: 0.85, Kzt: 1.0, height: 8.5, G: 0.85, Cf: 1.5 });
  const [soil, setSoil] = useState({ bearing: 2000, concDensity: 150 });
  const [conn, setConn] = useState({ nBolts: 3, boltDia: 0.5, boltFu: 75, anchorN: 6, anchorDia: 0.5, anchorSpacing: 10, anchorDepth: 6, anchorTcap: 2670, anchorVcap: 3620 });
  const [basePlate, setBasePlate] = useState({ size: 12, thickness: 0.75 });
  const [ftgDims, setFtgDims] = useState({ B: 48, L: 24, H: 16 });
  const [postK, setPostK] = useState(2.1); // K factor: 2.1 for cantilever (fixed base, free top)
  const [deflLimit, setDeflLimit] = useState(180); // L/180 typical

  const postSec = SECTIONS.posts[rack.postSection] || SECTIONS.posts[3];
  const beamSec = SECTIONS.beams[rack.beamSection] || SECTIONS.beams[1];
  const mat = MATERIALS[rack.material];

  // ─── FULL STRUCTURAL ANALYSIS ───
  const analysis = useMemo(() => {
    const w = calcWind(wind);
    const rackWidthFt = rack.posts.length > 1 ? (rack.posts[rack.posts.length - 1].x - rack.posts[0].x) / 12 : 9;
    const panelHeightFt = rack.rackHeight / 12;
    const heff = rack.rackHeight / 24;
    const area = rackWidthFt * panelHeightFt;
    // Wind pressure (unfactored) — G and Cf now user-editable
    const p_unfactored = Math.max(16, w.qh * wind.G * wind.Cf);
    const totalEquipWeight = rack.equipment.reduce((s, e) => s + e.weight, 0);
    const frameWeight = 200;
    const totalDL = totalEquipWeight + frameWeight;

    // Post loads (center vs side)
    const nPosts = rack.posts.length;
    const centerPosts = rack.posts.filter((p) => p.isCenterPost);
    const sidePosts = rack.posts.filter((p) => !p.isCenterPost);
    const nCenter = centerPosts.length || 1;
    const nSide = sidePosts.length || 1;

    const centerM_wind = (p_unfactored * area * heff) / nCenter;
    const centerV_wind = (p_unfactored * area) / nCenter;
    const centerP = totalDL / nCenter;
    const sideM_wind = (p_unfactored * area * heff) / (nCenter * 2);
    const sideV_wind = (p_unfactored * area) / (nCenter * 2);
    const sideP = totalDL / (nSide * 2);

    // ASD Load combinations
    const W_factor = 0.6;

    // Post strength checks (COMB 2: 1.0D + 0.6W)
    const centerPostCheck = checkPost({
      N: centerP / 1000,
      M: (centerM_wind * W_factor) / 1000,
      V: (centerV_wind * W_factor) / 1000,
      section: postSec,
      material: rack.material,
    });
    const sidePostCheck = checkPost({
      N: sideP / 1000,
      M: (sideM_wind * W_factor) / 1000,
      V: (sideV_wind * W_factor) / 1000,
      section: postSec,
      material: rack.material,
    });

    // Column buckling checks (AISC H1 interaction)
    const postLength_in = rack.rackHeight;
    const centerBuckling = checkBuckling({
      N: centerP / 1000,
      M: (centerM_wind * W_factor) / 1000,
      V: (centerV_wind * W_factor) / 1000,
      section: postSec,
      material: rack.material,
      K: postK,
      L_in: postLength_in,
    });
    const sideBuckling = checkBuckling({
      N: sideP / 1000,
      M: (sideM_wind * W_factor) / 1000,
      V: (sideV_wind * W_factor) / 1000,
      section: postSec,
      material: rack.material,
      K: postK,
      L_in: postLength_in,
    });

    // Beam checks
    const beamSpan = rack.posts.length > 2 ? (rack.posts[1].x - rack.posts[0].x) / 12 : rackWidthFt / 2;
    const tribScreen = 3.0;
    const nSpans = Math.max(1, rack.posts.length - 1);
    const qIn = totalDL / (rackWidthFt * nSpans);
    const qOut = p_unfactored * tribScreen * W_factor;
    const M_in = (qIn * beamSpan * beamSpan) / 8 / 1000;
    const M_out = (qOut * beamSpan * beamSpan) / 8 / 1000;
    const beamV = (qIn + qOut) * beamSpan / 2 / 1000;

    const beamCheck = checkBeam({ N: 0, M_in, M_out, V: beamV, section: beamSec, material: rack.material });

    // Beam deflection check
    const beamDefl = checkDeflection({
      w_plf: qIn + qOut,
      L_ft: beamSpan,
      E: mat.E,
      I: beamSec.Ix || beamSec.Sx, // use Ix if available
      limit: deflLimit,
    });

    // Connection checks (COMB 2: 1.0D + 0.6W)
    const connCheck = checkConnection({
      M: centerM_wind * W_factor / 1000,
      V: centerV_wind * W_factor / 1000,
      P: centerP / 1000,
      ...conn,
    });

    // Foundation checks (COMB 2: 1.0D + 0.6W)
    // M in lb-ft, P in lbs — consistent units
    const centerFtg = checkFoundation({
      P: centerP,
      M: centerM_wind * W_factor,
      B: ftgDims.B, L: ftgDims.L, H: ftgDims.H,
      soilBearing: soil.bearing,
      concDensity: soil.concDensity,
    });
    const sideFtg = checkFoundation({
      P: sideP,
      M: sideM_wind * W_factor,
      B: ftgDims.B, L: ftgDims.L, H: ftgDims.H,
      soilBearing: soil.bearing,
      concDensity: soil.concDensity,
    });

    const allOk = centerPostCheck.allOk && sidePostCheck.allOk && centerBuckling.ok && sideBuckling.ok && beamCheck.allOk && beamDefl.ok && connCheck.allOk && centerFtg.ok;

    return {
      wind: { ...w, G: wind.G, Cf: wind.Cf, p: p_unfactored, p_factored: p_unfactored * W_factor, area, rackWidthFt, panelHeightFt, heff },
      loads: { totalDL, totalEquipWeight, frameWeight, centerM_wind, centerV_wind, centerP, sideM_wind, sideV_wind, sideP },
      centerPost: centerPostCheck,
      sidePost: sidePostCheck,
      centerBuckling,
      sideBuckling,
      beam: beamCheck,
      beamDefl,
      connection: connCheck,
      foundation: { center: centerFtg, side: sideFtg },
      allOk,
    };
  }, [rack, wind, soil, conn, postSec, beamSec, mat, postK, deflLimit, ftgDims]);

  const TABS = ["Designer", "Wind", "Members", "Connections", "Foundation", "Summary"];

  return (
    <div style={S.app}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet" />

      <div style={S.header}>
        <div style={S.logo}>R</div>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.01em" }}>Rack designer</div>
          <div style={{ fontSize: 11, color: "#52525b" }}>Structural verification · ASCE 7-22 · ADM / AISC</div>
        </div>
        <div style={{ marginLeft: "auto" }}>
          <Badge ok={analysis.allOk} label={analysis.allOk ? "ALL PASS" : "FAILURES"} />
        </div>
      </div>

      <div style={S.tabs}>
        {TABS.map((t, i) => <div key={i} style={S.tab(tab === i)} onClick={() => setTab(i)}>{t}</div>)}
      </div>

      <div style={S.panel}>

        {/* ─── TAB 0: DESIGNER ─── */}
        {tab === 0 && (
          <>
            <ElevationView rack={rack} wind={analysis.wind} />

            <div style={{ ...S.card, marginTop: 16 }}>
              <div style={S.cardTitle}>Rack configuration</div>
              <div style={S.grid3}>
                <Field label="Rack height" value={rack.rackHeight} onChange={(v) => setRack((r) => ({ ...r, rackHeight: v }))} unit="in" />
                <Select label="Post section" value={rack.postSection} onChange={(v) => setRack((r) => ({ ...r, postSection: parseInt(v) }))} options={SECTIONS.posts.map((s, i) => ({ value: i, label: s.name }))} />
                <Select label="Beam section" value={rack.beamSection} onChange={(v) => setRack((r) => ({ ...r, beamSection: parseInt(v) }))} options={SECTIONS.beams.map((s, i) => ({ value: i, label: s.name }))} />
              </div>
              <Select label="Material" value={rack.material} onChange={(v) => setRack((r) => ({ ...r, material: v }))} options={Object.keys(MATERIALS)} />
              <div style={S.grid3}>
                <Field label="Post K factor" value={postK} onChange={setPostK} step={0.1} min={0.5} max={2.5} />
                <Field label="Deflection limit (L/)" value={deflLimit} onChange={setDeflLimit} min={120} max={360} step={10} />
                <div style={{ ...S.field, paddingTop: 20, fontSize: 11, color: "#52525b" }}>K=2.1 cantilever, 1.0 pinned</div>
              </div>
            </div>

            <div style={S.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={S.cardTitle}>Posts ({rack.posts.length})</div>
                <button style={S.btn("primary")} onClick={() => setRack((r) => ({ ...r, posts: [...r.posts, { id: Date.now(), x: (r.posts[r.posts.length - 1]?.x || 0) + 36, label: "Post " + (r.posts.length + 1), isCenterPost: false }] }))}>+ Add post</button>
              </div>
              {rack.posts.map((p, i) => (
                <div key={p.id} style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 8 }}>
                  <div style={{ flex: 1 }}><Field label={`Post ${i + 1} position`} value={p.x} onChange={(v) => setRack((r) => ({ ...r, posts: r.posts.map((pp) => (pp.id === p.id ? { ...pp, x: v } : pp)) }))} unit="in" /></div>
                  <div style={{ flex: 1 }}>
                    <div style={S.field}>
                      <label style={S.label}>Type</label>
                      <select value={p.isCenterPost ? "center" : "side"} onChange={(e) => setRack((r) => ({ ...r, posts: r.posts.map((pp) => (pp.id === p.id ? { ...pp, isCenterPost: e.target.value === "center", label: e.target.value === "center" ? "Center post" : "Side post" } : pp)) }))} style={S.select}>
                        <option value="side">Side post</option>
                        <option value="center">Center post</option>
                      </select>
                    </div>
                  </div>
                  {rack.posts.length > 2 && <button style={{ ...S.btn("danger"), marginBottom: 14 }} onClick={() => setRack((r) => ({ ...r, posts: r.posts.filter((pp) => pp.id !== p.id) }))}>×</button>}
                </div>
              ))}
            </div>

            <div style={S.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={S.cardTitle}>Equipment ({rack.equipment.length})</div>
                <button style={S.btn("primary")} onClick={() => setRack((r) => ({ ...r, equipment: [...r.equipment, { id: Date.now(), label: "Item", weight: 500, width: 20, height: 24, bayIndex: 0 }] }))}>+ Add item</button>
              </div>
              {rack.equipment.map((eq) => (
                <div key={eq.id} style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 8, flexWrap: "wrap" }}>
                  <div style={{ width: 90 }}><Field label="Label" value={eq.label} onChange={(v) => setRack((r) => ({ ...r, equipment: r.equipment.map((e) => (e.id === eq.id ? { ...e, label: v } : e)) }))} type="text" /></div>
                  <div style={{ width: 80 }}><Field label="Weight" value={eq.weight} onChange={(v) => setRack((r) => ({ ...r, equipment: r.equipment.map((e) => (e.id === eq.id ? { ...e, weight: v } : e)) }))} unit="lbs" /></div>
                  <div style={{ width: 70 }}><Field label="Width" value={eq.width} onChange={(v) => setRack((r) => ({ ...r, equipment: r.equipment.map((e) => (e.id === eq.id ? { ...e, width: v } : e)) }))} unit="in" /></div>
                  <div style={{ width: 70 }}><Field label="Height" value={eq.height} onChange={(v) => setRack((r) => ({ ...r, equipment: r.equipment.map((e) => (e.id === eq.id ? { ...e, height: v } : e)) }))} unit="in" /></div>
                  <div style={{ width: 60 }}><Field label="Bay #" value={eq.bayIndex} onChange={(v) => setRack((r) => ({ ...r, equipment: r.equipment.map((e) => (e.id === eq.id ? { ...e, bayIndex: v } : e)) }))} /></div>
                  <button style={{ ...S.btn("danger"), marginBottom: 14 }} onClick={() => setRack((r) => ({ ...r, equipment: r.equipment.filter((e) => e.id !== eq.id) }))}>×</button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ─── TAB 1: WIND ─── */}
        {tab === 1 && (
          <>
            <div style={S.card}>
              <div style={S.cardTitle}>Wind parameters (ASCE 7-22)</div>
              <div style={S.grid3}>
                <Field label="Basic wind speed" value={wind.V} onChange={(v) => setWind((w) => ({ ...w, V: v }))} unit="mph" />
                <Select label="Risk category" value={wind.riskCat} onChange={(v) => setWind((w) => ({ ...w, riskCat: v }))} options={["I", "II", "III", "IV"]} />
                <Select label="Exposure" value={wind.exposure} onChange={(v) => setWind((w) => ({ ...w, exposure: v }))} options={["B", "C", "D"]} />
              </div>
              <div style={S.grid3}>
                <Field label="Kd" value={wind.Kd} onChange={(v) => setWind((w) => ({ ...w, Kd: v }))} step={0.01} />
                <Field label="Kzt" value={wind.Kzt} onChange={(v) => setWind((w) => ({ ...w, Kzt: v }))} step={0.1} />
                <Field label="Height to top" value={wind.height} onChange={(v) => setWind((w) => ({ ...w, height: v }))} unit="ft" />
              </div>
              <div style={S.grid2}>
                <Field label="Gust effect factor (G)" value={wind.G} onChange={(v) => setWind((w) => ({ ...w, G: v }))} step={0.01} />
                <Field label="Force coefficient (Cf)" value={wind.Cf} onChange={(v) => setWind((w) => ({ ...w, Cf: v }))} step={0.1} />
              </div>
            </div>
            <div style={S.card}>
              <div style={S.cardTitle}>Computed wind loads</div>
              <div style={{ ...S.grid2, fontSize: 13, color: "#a1a1aa" }}>
                <div>Kz = <span style={S.mono}>{analysis.wind.Kz.toFixed(3)}</span></div>
                <div>G = <span style={S.mono}>{analysis.wind.G.toFixed(2)}</span></div>
                <div>qh = <span style={S.mono}>{analysis.wind.qh.toFixed(1)} psf</span></div>
                <div>Cf = <span style={S.mono}>{analysis.wind.Cf.toFixed(2)}</span></div>
                <div>p (unfactored) = <span style={S.mono}>{analysis.wind.p.toFixed(1)} psf</span></div>
                <div>0.6W = <span style={S.mono}>{analysis.wind.p_factored.toFixed(1)} psf</span></div>
              </div>
            </div>
            <div style={S.card}>
              <div style={S.cardTitle}>Load distribution</div>
              <div style={S.grid2}>
                <div style={{ padding: 12, background: "#0a0b0d", borderRadius: 8, border: "1px solid #1e3a5f" }}>
                  <div style={{ fontSize: 11, color: "#3b82f6", marginBottom: 8, fontWeight: 600 }}>CENTER POST</div>
                  <div style={{ fontSize: 12, color: "#a1a1aa", lineHeight: 2, ...S.mono }}>
                    M = {(analysis.loads.centerM_wind / 1000).toFixed(2)} kip·ft<br />
                    V = {(analysis.loads.centerV_wind / 1000).toFixed(2)} kips<br />
                    P = {(analysis.loads.centerP / 1000).toFixed(2)} kips
                  </div>
                </div>
                <div style={{ padding: 12, background: "#0a0b0d", borderRadius: 8, border: "1px solid #27272a" }}>
                  <div style={{ fontSize: 11, color: "#71717a", marginBottom: 8, fontWeight: 600 }}>SIDE POST</div>
                  <div style={{ fontSize: 12, color: "#a1a1aa", lineHeight: 2, ...S.mono }}>
                    M = {(analysis.loads.sideM_wind / 1000).toFixed(2)} kip·ft<br />
                    V = {(analysis.loads.sideV_wind / 1000).toFixed(2)} kips<br />
                    P = {(analysis.loads.sideP / 1000).toFixed(2)} kips
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ─── TAB 2: MEMBERS ─── */}
        {tab === 2 && (
          <>
            <div style={S.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={S.cardTitle}>Center post — {postSec.name}</div>
                <Badge ok={analysis.centerPost.allOk} label={analysis.centerPost.allOk ? "PASS" : "FAIL"} />
              </div>
              <div style={{ fontSize: 11, color: "#52525b", marginBottom: 12 }}>A = {postSec.A} in², I = {postSec.I} in⁴, S = {postSec.S} in³ · {mat.code}</div>
              <CheckRow label="Tension (M/S − N/A)" {...analysis.centerPost.Ft} unit="ksi" />
              <CheckRow label="Compression (N/A + M/S)" {...analysis.centerPost.Fb} unit="ksi" />
              <CheckRow label="Shear (V/A)" {...analysis.centerPost.Fv} unit="ksi" />
            </div>

            <div style={S.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={S.cardTitle}>Side post — {postSec.name}</div>
                <Badge ok={analysis.sidePost.allOk} label={analysis.sidePost.allOk ? "PASS" : "FAIL"} />
              </div>
              <CheckRow label="Tension (M/S − N/A)" {...analysis.sidePost.Ft} unit="ksi" />
              <CheckRow label="Compression (N/A + M/S)" {...analysis.sidePost.Fb} unit="ksi" />
              <CheckRow label="Shear (V/A)" {...analysis.sidePost.Fv} unit="ksi" />
            </div>

            <div style={S.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={S.cardTitle}>Beam — {beamSec.name}</div>
                <Badge ok={analysis.beam.allOk} label={analysis.beam.allOk ? "PASS" : "FAIL"} />
              </div>
              <div style={{ fontSize: 11, color: "#52525b", marginBottom: 12 }}>A = {beamSec.A} in², Sx = {beamSec.Sx} in³, Sy = {beamSec.Sy} in³ · {mat.code}</div>
              <CheckRow label="Biaxial bending (tension)" {...analysis.beam.Ft} unit="ksi" />
              <CheckRow label="Biaxial bending (compression)" {...analysis.beam.Fb} unit="ksi" />
              <CheckRow label="Shear (V/A)" {...analysis.beam.Fv} unit="ksi" />
            </div>

            {/* Buckling */}
            <div style={S.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={S.cardTitle}>Column stability (AISC E3 / H1)</div>
                <Badge ok={analysis.centerBuckling.ok && analysis.sideBuckling.ok} label={analysis.centerBuckling.ok && analysis.sideBuckling.ok ? "PASS" : "FAIL"} />
              </div>
              <div style={{ fontSize: 11, color: "#52525b", marginBottom: 12 }}>K = {postK} · L = {rack.rackHeight}" · r = {postSec.r} in · KL/r = {analysis.centerBuckling.KLr.toFixed(1)}</div>
              <div style={S.checkRow}>
                <div>
                  <div style={{ fontSize: 13, color: "#a1a1aa" }}>Center post — axial+bending interaction</div>
                  <div style={{ fontSize: 11, color: "#52525b" }}>Fa = {analysis.centerBuckling.Fa.toFixed(1)} ksi (Fcr/{(1.67).toFixed(2)}) · Ratio = {(analysis.centerBuckling.interactionRatio * 100).toFixed(0)}%</div>
                </div>
                <Badge ok={analysis.centerBuckling.ok} label={analysis.centerBuckling.ok ? "OK" : "NG"} />
              </div>
              <div style={S.checkRow}>
                <div>
                  <div style={{ fontSize: 13, color: "#a1a1aa" }}>Side post — axial+bending interaction</div>
                  <div style={{ fontSize: 11, color: "#52525b" }}>Ratio = {(analysis.sideBuckling.interactionRatio * 100).toFixed(0)}%</div>
                </div>
                <Badge ok={analysis.sideBuckling.ok} label={analysis.sideBuckling.ok ? "OK" : "NG"} />
              </div>
            </div>

            {/* Deflection */}
            <div style={S.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={S.cardTitle}>Beam deflection</div>
                <Badge ok={analysis.beamDefl.ok} label={analysis.beamDefl.ok ? "PASS" : "FAIL"} />
              </div>
              <div style={S.checkRow}>
                <div>
                  <div style={{ fontSize: 13, color: "#a1a1aa" }}>Deflection ({analysis.beamDefl.limitLabel})</div>
                  <div style={{ fontSize: 11, color: "#52525b" }}>δ = {analysis.beamDefl.delta.toFixed(3)}" vs {analysis.beamDefl.deltaAllow.toFixed(3)}" allowable ({(analysis.beamDefl.ratio * 100).toFixed(0)}%)</div>
                </div>
                <Badge ok={analysis.beamDefl.ok} label={analysis.beamDefl.ok ? "OK" : "NG"} />
              </div>
            </div>
          </>
        )}

        {/* ─── TAB 3: CONNECTIONS ─── */}
        {tab === 3 && (
          <>
            <div style={S.card}>
              <div style={S.cardTitle}>Bolt group (beam-to-post)</div>
              <div style={S.grid3}>
                <Field label="Number of bolts" value={conn.nBolts} onChange={(v) => setConn((c) => ({ ...c, nBolts: v }))} />
                <Field label="Bolt diameter" value={conn.boltDia} onChange={(v) => setConn((c) => ({ ...c, boltDia: v }))} unit="in" step={0.125} />
                <Field label="Bolt Fu" value={conn.boltFu} onChange={(v) => setConn((c) => ({ ...c, boltFu: v }))} unit="ksi" />
              </div>
              <div style={S.checkRow}>
                <div>
                  <div style={{ fontSize: 13, color: "#a1a1aa" }}>Bolt shear per bolt</div>
                  <div style={{ fontSize: 11, color: "#52525b" }}>{analysis.connection.bolt.shearPerBolt.toFixed(0)} lbs / {analysis.connection.bolt.capacity.toFixed(0)} lbs capacity</div>
                </div>
                <Badge ok={analysis.connection.bolt.ok} label={analysis.connection.bolt.ok ? "OK" : "NG"} />
              </div>
            </div>

            <div style={S.card}>
              <div style={S.cardTitle}>Anchor bolts (base plate to footing)</div>
              <div style={S.grid3}>
                <Field label="Number of anchors" value={conn.anchorN} onChange={(v) => setConn((c) => ({ ...c, anchorN: v }))} />
                <Field label="Anchor diameter" value={conn.anchorDia} onChange={(v) => setConn((c) => ({ ...c, anchorDia: v }))} unit="in" step={0.125} />
                <Field label="Anchor spacing" value={conn.anchorSpacing} onChange={(v) => setConn((c) => ({ ...c, anchorSpacing: v }))} unit="in" />
              </div>
              <div style={S.grid2}>
                <Field label="Tension capacity [T]" value={conn.anchorTcap} onChange={(v) => setConn((c) => ({ ...c, anchorTcap: v }))} unit="lbs" />
                <Field label="Shear capacity [V]" value={conn.anchorVcap} onChange={(v) => setConn((c) => ({ ...c, anchorVcap: v }))} unit="lbs" />
              </div>
              <CheckRow label="Anchor tension" demand={analysis.connection.anchor.T} capacity={analysis.connection.anchor.Tcap} unit="lbs" ok={analysis.connection.anchor.T <= analysis.connection.anchor.Tcap} ratio={analysis.connection.anchor.T / analysis.connection.anchor.Tcap} />
              <CheckRow label="Anchor shear" demand={analysis.connection.anchor.Fv} capacity={analysis.connection.anchor.Vcap} unit="lbs" ok={analysis.connection.anchor.Fv <= analysis.connection.anchor.Vcap} ratio={analysis.connection.anchor.Fv / analysis.connection.anchor.Vcap} />
              <div style={S.checkRow}>
                <div>
                  <div style={{ fontSize: 13, color: "#a1a1aa" }}>Interaction (T/[T])² + (V/[V])²</div>
                  <div style={{ ...S.mono, fontSize: 11, color: "#52525b" }}>{analysis.connection.anchor.interaction.toFixed(3)} ≤ 1.0</div>
                </div>
                <Badge ok={analysis.connection.anchor.ok} label={analysis.connection.anchor.ok ? "OK" : "NG"} />
              </div>
            </div>
          </>
        )}

        {/* ─── TAB 4: FOUNDATION ─── */}
        {tab === 4 && (
          <>
            <div style={S.card}>
              <div style={S.cardTitle}>Soil & concrete</div>
              <div style={S.grid2}>
                <Field label="Allowable soil bearing" value={soil.bearing} onChange={(v) => setSoil((s) => ({ ...s, bearing: v }))} unit="psf" />
                <Field label="Concrete unit weight" value={soil.concDensity} onChange={(v) => setSoil((s) => ({ ...s, concDensity: v }))} unit="pcf" />
              </div>
            </div>
            <div style={S.card}>
              <div style={S.cardTitle}>Footing dimensions</div>
              <div style={S.grid3}>
                <Field label="Width (B)" value={ftgDims.B} onChange={(v) => setFtgDims((f) => ({ ...f, B: v }))} unit="in" />
                <Field label="Length (L)" value={ftgDims.L} onChange={(v) => setFtgDims((f) => ({ ...f, L: v }))} unit="in" />
                <Field label="Depth (H)" value={ftgDims.H} onChange={(v) => setFtgDims((f) => ({ ...f, H: v }))} unit="in" />
              </div>
            </div>

            {[{ label: "Center post footing", data: analysis.foundation.center }, { label: "Side post footing", data: analysis.foundation.side }].map((f, i) => (
              <div key={i} style={S.card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={S.cardTitle}>{f.label}</div>
                  <Badge ok={f.data.ok} label={f.data.ok ? "PASS" : "FAIL"} />
                </div>
                <div style={{ ...S.grid2, fontSize: 13, color: "#a1a1aa", marginBottom: 12 }}>
                  <div>P_total = <span style={S.mono}>{f.data.Ptotal.toFixed(0)} lbs</span></div>
                  <div>e_x = <span style={S.mono}>{f.data.ex.toFixed(1)} in</span></div>
                  <div>q_max = <span style={S.mono}>{f.data.qmax.toFixed(0)} psf</span></div>
                  <div>q_min = <span style={S.mono}>{f.data.qmin.toFixed(0)} psf</span></div>
                </div>
                <div style={S.checkRow}>
                  <div>
                    <div style={{ fontSize: 13, color: "#a1a1aa" }}>Bearing pressure check</div>
                    <div style={{ fontSize: 11, color: "#52525b" }}>q_max = {f.data.qmax.toFixed(0)} psf vs {f.data.soilBearing} psf allowable</div>
                  </div>
                  <Badge ok={f.data.ok} label={f.data.ok ? "OK" : "NG"} />
                </div>
                {f.data.uplift && (
                  <div style={{ marginTop: 8, padding: 10, background: "#2e0a0a", borderRadius: 8, border: "1px solid #7f1d1d", fontSize: 12, color: "#fca5a5" }}>
                    ⚠ Eccentricity ({f.data.ex.toFixed(1)}") exceeds kern limit ({f.data.eLimit.toFixed(1)}") — partial uplift on footing. Triangular stress block applied. Consider increasing footing width or adding ballast weight.
                  </div>
                )}
                <div style={{ marginTop: 12, padding: 12, background: "#0a0b0d", borderRadius: 8, fontSize: 12, color: "#71717a" }}>
                  Recommended pad: <span style={{ color: "#e4e4e7", fontWeight: 600 }}>{f.data.pad.sym}</span> — {f.data.pad.side}" sq × {f.data.pad.depth}" deep, {f.data.pad.rebarQty}× {f.data.pad.rebarSize} E.W. (capacity: {f.data.pad.capacity.toLocaleString()} lbs)
                </div>
              </div>
            ))}
          </>
        )}

        {/* ─── TAB 5: SUMMARY ─── */}
        {tab === 5 && (
          <>
            <div style={{ ...S.card, border: analysis.allOk ? "1px solid #166534" : "1px solid #7f1d1d" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ fontSize: 16, fontWeight: 700 }}>Structural verification summary</div>
                <Badge ok={analysis.allOk} label={analysis.allOk ? "ALL CHECKS PASS" : "FAILURES DETECTED"} />
              </div>

              <div style={{ fontSize: 12, color: "#71717a", marginBottom: 16 }}>
                {rack.material} · {postSec.name} posts · {beamSec.name} beams · V = {wind.V} mph · Exposure {wind.exposure}
              </div>

              {[
                { label: "Center post (ADM/AISC)", ok: analysis.centerPost.allOk, ratio: Math.max(analysis.centerPost.Ft.ratio, analysis.centerPost.Fb.ratio, analysis.centerPost.Fv.ratio) },
                { label: "Side post (ADM/AISC)", ok: analysis.sidePost.allOk, ratio: Math.max(analysis.sidePost.Ft.ratio, analysis.sidePost.Fb.ratio, analysis.sidePost.Fv.ratio) },
                { label: "Center post stability (H1)", ok: analysis.centerBuckling.ok, ratio: analysis.centerBuckling.interactionRatio },
                { label: "Side post stability (H1)", ok: analysis.sideBuckling.ok, ratio: analysis.sideBuckling.interactionRatio },
                { label: "Beam (ADM/AISC)", ok: analysis.beam.allOk, ratio: Math.max(analysis.beam.Ft.ratio, analysis.beam.Fb.ratio, analysis.beam.Fv.ratio) },
                { label: `Beam deflection (${analysis.beamDefl.limitLabel})`, ok: analysis.beamDefl.ok, ratio: analysis.beamDefl.ratio },
                { label: "Bolt group", ok: analysis.connection.bolt.ok, ratio: analysis.connection.bolt.shearPerBolt / analysis.connection.bolt.capacity },
                { label: "Anchor bolts (interaction)", ok: analysis.connection.anchor.ok, ratio: analysis.connection.anchor.interaction },
                { label: "Center footing bearing", ok: analysis.foundation.center.ok, ratio: analysis.foundation.center.qmax / soil.bearing },
                { label: "Side footing bearing", ok: analysis.foundation.side.ok, ratio: analysis.foundation.side.qmax / soil.bearing },
              ].map((chk, i) => (
                <div key={i} style={{ ...S.checkRow, borderColor: "#18191d" }}>
                  <div style={{ fontSize: 13, color: "#a1a1aa" }}>{chk.label}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 120, height: 6, background: "#18191d", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ width: `${Math.min(100, chk.ratio * 100)}%`, height: "100%", background: chk.ok ? (chk.ratio > 0.75 ? "#854d0e" : "#166534") : "#991b1b", borderRadius: 3, transition: "width 0.4s" }} />
                    </div>
                    <span style={{ ...S.mono, fontSize: 12, color: "#71717a", minWidth: 36, textAlign: "right" }}>{(chk.ratio * 100).toFixed(0)}%</span>
                    <Badge ok={chk.ok} label={chk.ok ? "OK" : "NG"} />
                  </div>
                </div>
              ))}
            </div>

            <div style={{ ...S.card, background: "#1a0a0a", borderColor: "#2a1515" }}>
              <div style={{ fontSize: 11, color: "#f87171", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600, marginBottom: 10 }}>⚠ Disclaimer — preliminary estimates only</div>
              <div style={{ fontSize: 12, color: "#737373", lineHeight: 1.8 }}>
                <p style={{ margin: "0 0 8px" }}>This tool provides preliminary structural estimates for educational and planning purposes only. Results are not a substitute for a professional engineering analysis and shall not be used for construction, permitting, or installation decisions.</p>
                <p style={{ margin: "0 0 8px" }}>This tool does not constitute a professional engineering service, is not reviewed or sealed by a licensed Professional Engineer, and carries no warranty of accuracy or fitness for any particular purpose. Key simplifications include: column buckling/slenderness effects are not considered (KL/r reduction per ADM Chapter E / AISC Chapter E), torsional effects are ignored, deflection limits are not checked, and seismic loads are not included.</p>
                <p style={{ margin: "0 0 8px" }}>Actual structural adequacy depends on site-specific conditions including soil investigation results, as-built member tolerances, welding/connection details, corrosion environment, and local code amendments that this tool cannot evaluate.</p>
                <p style={{ margin: 0 }}>A licensed Professional Engineer must be engaged for final design, stamped drawings, and sealed calculations required for building permit applications.</p>
              </div>
            </div>

            <div style={{ ...S.card, background: "#0a0f1a", borderColor: "#1e3a5f" }}>
              <div style={{ fontSize: 11, color: "#3b82f6", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600, marginBottom: 10 }}>Engineering services</div>
              <div style={{ fontSize: 13, color: "#a1a1aa", lineHeight: 1.8, marginBottom: 16 }}>
                <p style={{ margin: "0 0 8px" }}>Need stamped structural drawings and sealed calculations for your equipment rack? Oasis Engineering provides full-service structural and wind engineering for outdoor equipment support structures, including:</p>
                <p style={{ margin: "0 0 4px", color: "#d4d4d8" }}>· Wind load analysis per ASCE 7-22 / FBC 2023</p>
                <p style={{ margin: "0 0 4px", color: "#d4d4d8" }}>· Member design per ADM-2010 (aluminum) / AISC 360 (steel)</p>
                <p style={{ margin: "0 0 4px", color: "#d4d4d8" }}>· Connection and anchor bolt design</p>
                <p style={{ margin: "0 0 4px", color: "#d4d4d8" }}>· Foundation design with pad footing schedules</p>
                <p style={{ margin: "0 0 4px", color: "#d4d4d8" }}>· PE-stamped drawings and sealed calculation packages</p>
                <p style={{ margin: "8px 0 0", color: "#71717a" }}>Licensed in 37 states. Typical turnaround: 3–5 business days.</p>
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <a href="https://oasisengineering.com" target="_blank" rel="noopener" style={{ ...S.btn("primary"), textDecoration: "none", display: "inline-block" }}>oasisengineering.com</a>
                <a href="https://windcalculations.com" target="_blank" rel="noopener" style={{ ...S.btn(), textDecoration: "none", display: "inline-block" }}>windcalculations.com</a>
              </div>
            </div>

            <div style={{ textAlign: "center", padding: "24px 0", borderTop: "1px solid #1c1e22", marginTop: 16 }}>
              <div style={{ color: "#52525b", fontSize: 12 }}>Oasis Engineering LLC · Tampa, FL</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
