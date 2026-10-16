/* ============================================================
   ÉPÉE & NÉONS — Sprites pixel art dessinés en code.
   Chaque personnage est tracé pixel par pixel (fillRect 1×1)
   dans la résolution interne 480×272, puis agrandi en CSS.
   Convention : (cx, feetY) = centre horizontal / bas des pieds.
   ============================================================ */
(function () {
  "use strict";

  function makePen(c, flash) {
    return function R(color, x, y, w, h) {
      c.fillStyle = flash ? (color === "flashKeep" ? "#ff5566" : "#ffffff") : color;
      c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    };
  }
  // Ligne de pixels (pour les lames) le long d'un angle.
  function blade(c, R, x, y, angle, len, color, guardColor) {
    // garde
    R(guardColor || "#e8a33d", x - 1, y - 1, 2, 2);
    for (let i = 1; i <= len; i++) {
      const px = x + Math.cos(angle) * i, py = y + Math.sin(angle) * i;
      R(color, px, py, 1.6, 1.6);
    }
    const tx = x + Math.cos(angle) * (len + 1), ty = y + Math.sin(angle) * (len + 1);
    R("#ffffff", tx, ty, 1.2, 1.2);
  }
  function matrix(c, x, y, rows, pal) {
    for (let j = 0; j < rows.length; j++)
      for (let i = 0; i < rows[j].length; i++) {
        const col = pal[rows[j][i]];
        if (col) { c.fillStyle = col; c.fillRect(x + i, y + j, 1, 1); }
      }
  }
  const HEART = [".XX.XX.", "XRRRRRX", "XRWRRRX", "XRRRRRX", ".XRRRX.", "..XRX..", "...X..."];
  const HEART_PAL = { X: "#7a1020", R: "#f43f52", W: "#ffd7dd" };
  const CROWN = ["X.X.X.X.X", "XXXYXYXXX", "XYYYYYYYX", "XYRYYYBYX", "XYYYYYYYX", ".XXXXXXX."];
  const CROWN_PAL = { X: "#a86f14", Y: "#ffd75e", R: "#f43f52", B: "#4db2ff" };

  /* ================= LE HÉROS : Léo, écuyer moderne ================= */
  function drawPlayer(c, cx, feetY, dir, st) {
    // st : {state, t, attackT, flash, vx}
    const R = makePen(c, st.flash);
    const t = st.t || 0;
    const run = st.state === "run";
    const air = st.state === "air";
    const ph = Math.floor(t / 95) % 2;           // phase jambes course
    const Bob = run ? (ph ? 0 : -1) : (st.state === "idle" ? Math.round(Math.sin(t / 380)) : 0);
    const y = feetY + Bob;
    const d = dir;

    // Cape rouge (derrière, flotte à l'opposé du regard)
    const flutter = air ? 3 : run ? 2 + ph : 1 + Math.round(Math.sin(t / 300));
    R("#c1273d", cx - d * 3 - 3 - flutter, y - 17, 4 + flutter, 9);
    R("#8f1d2e", cx - d * 3 - 3 - flutter, y - 9, 4 + flutter, 1);
    R("#e84855", cx - d * 3 - 3 - flutter, y - 17, 4 + flutter, 1);

    // Jambes + baskets rouges (touche moderne !)
    let l1 = -3, l2 = 1, lift1 = 0, lift2 = 0;
    if (run) { if (ph) { l1 = -4; lift2 = 2; l2 = 2; } else { l2 = -1; lift1 = 2; l1 = -2; } }
    if (air) { l1 = -4; lift1 = 1; l2 = 1; lift2 = 3; }
    R("#33334d", cx + l1, y - 7, 3, 6 - lift1);
    R("#33334d", cx + l2, y - 7, 3, 6 - lift2);
    R("#e84855", cx + l1 - (d < 0 ? 1 : 0), y - 2 - lift1, 4, 2);
    R("#e84855", cx + l2 - (d < 0 ? 1 : 0), y - 2 - lift2, 4, 2);
    R("#ffffff", cx + l1 - (d < 0 ? 1 : 0), y - 1 - lift1, 4, 1);
    R("#ffffff", cx + l2 - (d < 0 ? 1 : 0), y - 1 - lift2, 4, 1);

    // Torse : hoodie bleu + tabard blanc à blason rouge
    R("#3d7bd9", cx - 4, y - 14, 8, 6);
    R("#f3ead2", cx - 2, y - 14, 5, 7);
    R("#c1273d", cx - 1, y - 13, 3, 3);           // blason
    R("#ffd75e", cx, y - 12, 1, 1);
    R("#6b4423", cx - 4, y - 8, 8, 1);            // ceinture
    R("#ffd75e", cx - 1, y - 8, 2, 1);

    // Tête : cheveux bruns ébouriffés
    R("#f2c18c", cx - 3, y - 19, 6, 5);
    R("#6b4423", cx - 3, y - 21, 7, 3);
    R("#6b4423", cx - 4, y - 20, 2, 2);
    R("#6b4423", cx + 2, y - 22, 2, 1);
    R("#20304d", cx + d * 2, y - 17, 1, 2);       // œil déterminé
    R("#3d7bd9", cx - 4, y - 15, 8, 1);           // capuche

    // Bras arrière
    R("#3569b8", cx - d * 5 - 1, y - 13 + (run && ph ? 1 : 0), 2, 5);
    R("#f2c18c", cx - d * 5 - 1, y - 8 + (run && ph ? 1 : 0), 2, 2);

    // Bras d'épée + épée
    const hx = cx + d * 5, hy = y - 11;
    R("#3d7bd9", cx + d * 3 - 1, y - 13, 3, 3);
    R("#f2c18c", hx - 1, hy - 1, 2, 2);
    let ang;
    if (st.state === "attack") {
      const p = Math.min(1, st.attackT || 0);    // balayage du haut vers le bas
      ang = d > 0 ? (-1.9 + p * 2.6) : (Math.PI + 1.9 - p * 2.6);
    } else if (air) ang = d > 0 ? -0.5 : Math.PI + 0.5;
    else if (st.state === "dash") ang = d > 0 ? 0.15 : Math.PI - 0.15;
    else ang = d > 0 ? 0.9 : Math.PI - 0.9;      // au repos, pointe basse
    blade(c, R, hx, hy, ang, 9, "#dfe9f5");
  }

  /* ================= GARDE ROYAL (lance) ================= */
  function drawGuard(c, cx, feetY, dir, st) {
    const R = makePen(c, st.flash);
    const t = st.t || 0, d = dir;
    const walk = st.state === "walk" || st.state === "chase";
    const ph = Math.floor(t / 140) % 2;
    const y = feetY + (walk && ph ? -1 : 0);
    // jambes cotte de mailles + bottes
    const off = walk ? (ph ? 1 : -1) : 0;
    R("#8b98a8", cx - 3 + off, y - 6, 3, 5);
    R("#8b98a8", cx + 1 - off, y - 6, 3, 5);
    R("#4a3220", cx - 3 + off, y - 2, 4, 2);
    R("#4a3220", cx + 1 - off, y - 2, 4, 2);
    // tabard bleu royal
    R("#315fae", cx - 4, y - 14, 8, 9);
    R("#ffd75e", cx - 1, y - 12, 2, 3);
    R("#274b8a", cx - 4, y - 6, 8, 1);
    R("#8b98a8", cx - 5, y - 14, 2, 4);
    R("#8b98a8", cx + 3, y - 14, 2, 4);
    // casque d'acier
    R("#f2c18c", cx - 3, y - 18, 6, 4);
    R("#20304d", cx + d * 2, y - 16, 1, 1);
    R("#c9d6e6", cx - 4, y - 21, 8, 4);
    R("#93a7bd", cx - 4, y - 18, 8, 1);
    R("#c9d6e6", cx - 1, y - 17, 2, 2);            // nasal
    R("#e84855", cx - 1, y - 23, 2, 2);            // plumet
    // lance
    if (st.state === "attack") {
      const ext = Math.sin(Math.min(1, st.attackT || 0) * Math.PI) * 6;
      R("#6b4423", cx + d * 4 - (d < 0 ? 10 + ext : 0), y - 12, 10 + ext, 2);
      R("#dfe9f5", cx + d * (13 + ext) - (d < 0 ? 3 : 0), y - 13, 3, 4);
    } else {
      R("#6b4423", cx + d * 5 - 1, y - 24, 2, 20);
      R("#dfe9f5", cx + d * 5 - 1, y - 27, 2, 3);
      R("#ffffff", cx + d * 5, y - 28, 1, 1);
    }
  }

  /* ================= GARDE D'ÉLITE (épée + bouclier) ================= */
  function drawElite(c, cx, feetY, dir, st) {
    const R = makePen(c, st.flash);
    const t = st.t || 0, d = dir;
    const ph = Math.floor(t / 130) % 2;
    const y = feetY + ((st.state === "chase" || st.state === "walk") && ph ? -1 : 0);
    R("#596273", cx - 3, y - 6, 3, 5);
    R("#596273", cx + 1, y - 6, 3, 5);
    R("#2c2f3a", cx - 4, y - 2, 4, 2);
    R("#2c2f3a", cx + 1, y - 2, 4, 2);
    // armure noire, tabard rouge sombre
    R("#3a3f4d", cx - 4, y - 15, 8, 9);
    R("#8f1d2e", cx - 2, y - 15, 4, 9);
    R("#6b7280", cx - 5, y - 15, 2, 3);
    R("#6b7280", cx + 3, y - 15, 2, 3);
    R("#ffd75e", cx - 4, y - 9, 8, 1);
    // heaume + panache rouge
    R("#9fb2c8", cx - 3, y - 21, 7, 6);
    R("#14102a", cx + (d > 0 ? 0 : -2), y - 18, 4, 1);   // fente des yeux
    R("flashKeep", cx + d * 2, y - 18, 1, 1);
    R("#c1273d", cx - 2 - (d > 0 ? 2 : 0), y - 24, 5, 3);
    R("#8f1d2e", cx - 2 - (d > 0 ? 3 : -1), y - 23, 2, 4);
    // bouclier (toujours face au regard : c'est lui qui bloque !)
    const sx = d > 0 ? cx + 3 : cx - 7;
    if (st.state !== "attack") {
      R("#7d8aa0", sx, y - 15, 4, 10);
      R("#c9d6e6", sx + 1, y - 14, 2, 8);
      R("#c1273d", sx + 1, y - 12, 2, 3);
      R("#ffd75e", sx + 1, y - 11, 2, 1);
    }
    // épée
    const hx = cx - d * 4, hy = y - 11;
    let ang;
    if (st.state === "attack") {
      const p = Math.min(1, st.attackT || 0);
      ang = d > 0 ? (-2 + p * 2.4) : (Math.PI + 2 - p * 2.4);
      blade(c, R, cx + d * 2, hy, ang, 10, "#dfe9f5");
    } else {
      ang = d > 0 ? 2.4 : Math.PI - 2.4;
      blade(c, R, hx, hy, ang, 9, "#b9c8da");
    }
  }

  /* ================= ARCHER RENÉGAT ================= */
  function drawArcher(c, cx, feetY, dir, st) {
    const R = makePen(c, st.flash);
    const d = dir, y = feetY;
    R("#5a4632", cx - 3, y - 6, 3, 5);
    R("#5a4632", cx + 1, y - 6, 3, 5);
    R("#33241a", cx - 3, y - 2, 4, 2);
    R("#33241a", cx + 1, y - 2, 4, 2);
    R("#6d5a3f", cx - 4, y - 13, 8, 8);        // tunique
    R("#3f7d44", cx - 4, y - 13, 8, 3);        // cape verte
    R("#4a3220", cx - 4, y - 8, 8, 1);
    // carquois dans le dos
    R("#7a4b21", cx - d * 5 - 1, y - 16, 2, 6);
    R("#dfe9f5", cx - d * 5 - 1, y - 18, 1, 2);
    R("#dfe9f5", cx - d * 5 + 1, y - 17, 1, 2);
    // capuche
    R("#f2c18c", cx - 3, y - 18, 6, 4);
    R("#3f7d44", cx - 4, y - 21, 8, 4);
    R("#2f6134", cx - 4, y - 18, 2, 3);
    R("#20304d", cx + d * 2, y - 16, 1, 1);
    // arc (courbe de pixels) + flèche si vise
    const bx = cx + d * 6, by = y - 12;
    const pts = [[0,-7],[1,-5],[2,-3],[2,0],[2,3],[1,5],[0,7]];
    pts.forEach(([ox, oy]) => R("#8a5a2b", bx + ox * d, by + oy, 1, 2));
    R("#e8e8e8", bx, by - 6, 1, 13);           // corde
    if (st.state === "aim") {
      R("#c9a165", bx - (d < 0 ? 8 : 0), by, 9, 1);
      R("#dfe9f5", bx + (d > 0 ? 8 : -9), by, 2, 1);
      R("#e84855", bx - (d > 0 ? 2 : -1), by - 1, 2, 1);
    }
  }

  /* ================= CORBEAU ================= */
  function drawCrow(c, cx, cy, dir, st) {
    const R = makePen(c, st.flash);
    const flap = Math.floor((st.t || 0) / 110) % 2;
    const d = dir;
    // ailes
    if (flap) { R("#23233a", cx - 7, cy - 5, 6, 2); R("#23233a", cx + 2, cy - 5, 6, 2); }
    else      { R("#23233a", cx - 7, cy + 1, 6, 2); R("#23233a", cx + 2, cy + 1, 6, 2); }
    R("#31314e", cx - 4, cy - 2, 8, 4);        // corps
    R("#31314e", cx + d * 3 - 2, cy - 4, 4, 4); // tête
    R("#e8a33d", cx + d * 6 - (d < 0 ? 2 : 0), cy - 2, 2, 1); // bec
    R("flashKeep", cx + d * 4, cy - 3, 1, 1);
    R("#23233a", cx - d * 6 - 1, cy - 1, 3, 2); // queue
  }

  /* ================= BOSS : Capitaine CORVUS ================= */
  function drawBoss(c, cx, feetY, dir, st) {
    const R = makePen(c, st.flash);
    const t = st.t || 0, d = dir;
    const ph = Math.floor(t / 150) % 2;
    const kneel = st.state === "stagger" ? 3 : 0;
    const y = feetY + (st.state === "walk" && ph ? -1 : 0) + kneel;
    // cape violette immense
    R("#4b2358", cx - d * 4 - 6, y - 26, 7, 18);
    R("#67307a", cx - d * 4 - 6, y - 26, 7, 2);
    // jambes d'armure
    const off = st.state === "walk" ? (ph ? 2 : -1) : 0;
    R("#596273", cx - 5 + off, y - 9, 4, 7);
    R("#596273", cx + 2 - off, y - 9, 4, 7);
    R("#23232f", cx - 6 + off, y - 3, 5, 3);
    R("#23232f", cx + 2 - off, y - 3, 5, 3);
    // plastron noir et or
    R("#2e3242", cx - 6, y - 22, 12, 13);
    R("#454d66", cx - 6, y - 22, 12, 3);
    R("#ffd75e", cx - 6, y - 14, 12, 2);
    R("#c1273d", cx - 2, y - 20, 4, 5);          // gemme / blason renégat
    R("#ff8a5c", cx - 1, y - 19, 2, 2);
    R("#6b7280", cx - 8, y - 22, 3, 5);          // épaulières
    R("#6b7280", cx + 5, y - 22, 3, 5);
    R("#ffd75e", cx - 8, y - 23, 3, 1);
    R("#ffd75e", cx + 5, y - 23, 3, 1);
    // heaume à cornes dorées
    R("#9fb2c8", cx - 4, y - 30, 9, 8);
    R("#14102a", cx + (d > 0 ? -1 : -3), y - 27, 6, 2);
    R("flashKeep", cx + d * 3, y - 27, 2, 1);    // yeux rouges
    R("#ffd75e", cx - 7, y - 32, 3, 3);
    R("#ffd75e", cx + 5, y - 32, 3, 3);
    R("#e8a33d", cx - 8, y - 33, 2, 1);
    R("#e8a33d", cx + 7, y - 33, 2, 1);
    if (st.state === "telegraph") {              // il va charger !
      R("flashKeep", cx - 8, y - 36, 16, 2);
      R("#ffffff", cx - 1, y - 39, 2, 3);
      R("#ffffff", cx - 1, y - 35, 2, 2);
    }
    // grande épée
    const hy = y - 16;
    let ang, hx = cx + d * 7;
    if (st.state === "attack") {
      const p = Math.min(1, st.attackT || 0);
      ang = d > 0 ? (-2.1 + p * 2.9) : (Math.PI + 2.1 - p * 2.9);
      blade(c, R, hx, hy, ang, 16, "#e8f1fb");
    } else if (st.state === "charge") {
      blade(c, R, hx, hy, d > 0 ? 0 : Math.PI, 16, "#e8f1fb");
    } else if (st.state === "slam" || st.state === "leap") {
      blade(c, R, hx, hy - 6, d > 0 ? -1.2 : Math.PI + 1.2, 16, "#e8f1fb");
    } else if (st.state === "stagger") {
      blade(c, R, hx, hy + 6, d > 0 ? 1.4 : Math.PI - 1.4, 13, "#b9c8da");
    } else {
      blade(c, R, hx, hy, d > 0 ? 1.0 : Math.PI - 1.0, 15, "#cdd9e8");
    }
  }

  /* ================= LE ROI Aldéric III ================= */
  function drawKing(c, cx, feetY, t) {
    const R = makePen(c, false);
    const y = feetY;
    const wave = Math.floor(t / 320) % 2;
    // robe rouge bordée d'hermine
    R("#a51f33", cx - 6, y - 12, 12, 12);
    R("#c1273d", cx - 5, y - 14, 10, 4);
    R("#ffffff", cx - 5, y - 15, 10, 2);
    R("#14102a", cx - 4, y - 14, 1, 1); R("#14102a", cx + 1, y - 14, 1, 1); R("#14102a", cx + 4, y - 14, 1, 1);
    R("#ffd75e", cx - 1, y - 11, 2, 6);
    R("#8f1d2e", cx - 6, y - 1, 12, 1);
    // tête + barbe blanche
    R("#f2c18c", cx - 3, y - 21, 7, 5);
    R("#f4f6f8", cx - 3, y - 17, 7, 4);
    R("#dbe2ea", cx - 2, y - 13, 5, 1);
    R("#20304d", cx - 2, y - 19, 1, 1); R("#20304d", cx + 2, y - 19, 1, 1);
    // couronne (celle du trône — la vraie, en or, est à rapporter !)
    matrix(c, cx - 4, y - 27, CROWN, CROWN_PAL);
    // bras qui salue + sceptre
    R("#a51f33", cx + 5, y - 20 - wave, 2, 6);
    R("#f2c18c", cx + 5, y - 22 - wave, 2, 2);
    R("#a51f33", cx - 7, y - 13, 2, 5);
    R("#ffd75e", cx - 8, y - 19, 1, 8);
    R("#f43f52", cx - 9, y - 21, 3, 3);
  }

  function drawThrone(c, x, feetY) {
    const R = makePen(c, false);
    R("#7a1020", x, feetY - 30, 22, 26);
    R("#c1273d", x + 2, feetY - 28, 18, 20);
    R("#ffd75e", x, feetY - 30, 22, 2);
    R("#ffd75e", x, feetY - 8, 22, 2);
    R("#ffd75e", x + 9, feetY - 34, 4, 4);
    R("#e8a33d", x + 10, feetY - 36, 2, 2);
    R("#5d3a17", x + 1, feetY - 4, 3, 4);
    R("#5d3a17", x + 18, feetY - 4, 3, 4);
  }

  /* ================= OBJETS ================= */
  function drawCoin(c, cx, cy, t) {
    const w = Math.max(1.6, Math.abs(Math.cos(t / 280)) * 4);
    c.fillStyle = "#a86f14"; c.fillRect(Math.round(cx - w / 2) - 1, cy - 4, Math.round(w) + 2, 8);
    c.fillStyle = "#ffd75e"; c.fillRect(Math.round(cx - w / 2), cy - 3, Math.round(w), 6);
    if (w > 3) { c.fillStyle = "#fff0b3"; c.fillRect(Math.round(cx - 1), cy - 2, 2, 4); }
  }
  function drawHeart(c, x, y, full) {
    matrix(c, x, y, HEART, full ? HEART_PAL : { X: "#3a3350", R: "#574f75", W: "#574f75" });
  }
  function drawKey(c, cx, cy, t) {
    const R = makePen(c, false);
    const b = Math.round(Math.sin(t / 300) * 1.5);
    R("#ffd75e", cx - 5, cy - 2 + b, 4, 4);
    R("#a86f14", cx - 4, cy - 1 + b, 2, 2);
    R("#ffd75e", cx - 1, cy - 1 + b, 7, 2);
    R("#ffd75e", cx + 4, cy + 1 + b, 2, 2);
    R("#ffd75e", cx + 1, cy + 1 + b, 2, 2);
    R("#fff0b3", cx - 5, cy - 2 + b, 1, 1);
  }
  function drawCrownItem(c, cx, cy, t) {
    const b = Math.round(Math.sin(t / 320) * 1.5);
    // halo doré
    c.fillStyle = "rgba(255,215,94,.20)";
    c.fillRect(cx - 8, cy - 6 + b, 16, 12);
    matrix(c, cx - 4, cy - 3 + b, CROWN, CROWN_PAL);
  }
  function drawBanner(c, x, feetY, active, t) {
    const R = makePen(c, false);
    R("#5d3a17", x + 7, feetY - 24, 2, 24);
    R("#ffd75e", x + 6, feetY - 26, 4, 3);
    const wv = Math.round(Math.sin(t / 240) * 1.5);
    const col = active ? "#c1273d" : "#6b7280", col2 = active ? "#ffd75e" : "#9aa3af";
    R(col, x + 9, feetY - 24, 7 + wv, 6);
    R(col, x + 9, feetY - 18, 4 + wv, 2);
    R(col2, x + 11, feetY - 22, 3, 3);
  }
  function drawSign(c, x, feetY) {
    const R = makePen(c, false);
    R("#5d3a17", x + 7, feetY - 9, 2, 9);
    R("#8a5a2b", x + 1, feetY - 15, 14, 7);
    R("#a86f3a", x + 2, feetY - 14, 12, 2);
    R("#5d3a17", x + 3, feetY - 11, 10, 1);
    R("#5d3a17", x + 4, feetY - 9, 7, 1);
  }
  function drawPortcullis(c, x, y, w, h) {
    const R = makePen(c, false);
    c.fillStyle = "rgba(10,10,25,.45)"; c.fillRect(x, y, w, h);
    for (let i = 0; i < w; i += 4) R("#596273", x + i, y, 2, h);
    for (let j = 4; j < h; j += 8) R("#596273", x, y + j, w, 2);
    R("#8b98a8", x, y, w, 2);
    // pointes en bas
    for (let i = 0; i < w; i += 4) R("#8b98a8", x + i, y + h - 2, 2, 2);
  }
  function drawTorch(c, x, y, t) {
    const R = makePen(c, false);
    R("#2c2f3a", x - 3, y + 5, 8, 2);              // applique murale en fer
    R("#2c2f3a", x, y, 2, 6);
    R("#8a5a2b", x - 1.5, y - 2, 5, 3);            // coupelle
    const f = Math.floor(t / 110) % 2;
    R("#ff8a3d", x - 1.5, y - 6 - f, 5, 5 + f);
    R("#ffd75e", x - 0.5, y - 5 - f, 3, 4);
    R("#fff0b3", x, y - 3, 1.5, 2);
  }
  function drawLamp(c, x, feetY, t, color) {
    const R = makePen(c, false);
    R("#23233a", x + 3, feetY - 26, 2, 26);
    R("#23233a", x + 1, feetY - 28, 6, 2);
    const flick = (Math.sin(t / 90 + x) > -0.92);
    c.fillStyle = flick ? (color || "#ffd75e") : "#8a7530";
    c.fillRect(x + 2, feetY - 26, 4, 4);
  }

  window.Sprites = {
    drawPlayer, drawGuard, drawElite, drawArcher, drawCrow, drawBoss, drawKing, drawThrone,
    drawCoin, drawHeart, drawKey, drawCrownItem, drawBanner, drawSign, drawPortcullis, drawTorch, drawLamp,
  };
})();
