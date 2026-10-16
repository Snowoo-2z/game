/* ============================================================
   ÉPÉE & NÉONS — Le Dernier Écuyer
   Platformer pixel art : ville moderne, Roi et gardes royaux,
   combats 100% à l'épée (décret royal : aucune arme à feu !).
   Moteur canvas maison, résolution interne 480×272.
   ============================================================ */
(function () {
  "use strict";
  const cvs = document.getElementById("game");
  const ctx = cvs.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const W = 480, H = 272, T = 16, ROWS = 17;
  const GRAV = 0.32;
  const S = window.Sprites, AU = window.GameAudio;
  const $ = (id) => document.getElementById(id);

  /* ---------------- État global ---------------- */
  const G = {
    state: "title", levelIndex: 0, t: 0, hitStop: 0, shake: 0,
    stats: { coins: 0, kills: 0, deaths: 0, time: 0 },
    snapshot: null, helpReturn: "title",
    toastUntil: 0, toastText: "", lastGateToast: 0, lastKingToast: 0,
    deathTimer: -1,
  };
  let L = null;      // niveau courant (runtime)
  let P = null;      // joueur
  let cam = { x: 0 };

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  const hash = (n) => { let x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const key2 = (x, y) => x + "," + y;
  const fmtTime = (frames) => {
    const s = Math.floor(frames / 60);
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  };
  const totalCoinsAll = window.LEVELS.reduce((n, lv) => n + lv.coins.reduce((m, cg) => m + cg[2], 0), 0);

  /* ---------------- Entrées clavier ---------------- */
  const input = { left: false, right: false, jumpHeld: false };
  let jumpQueued = 0, attackQueued = false, dashQueued = false;
  const MOVE_L = ["ArrowLeft", "KeyA"], MOVE_R = ["ArrowRight", "KeyD"];
  const JUMP = ["Space", "ArrowUp", "KeyW"], ATTACK = ["KeyJ", "KeyX", "KeyF"], DASH = ["KeyK", "ShiftLeft", "ShiftRight", "KeyL"];

  window.addEventListener("keydown", (e) => {
    AU.unlock();
    const code = e.code;
    if ([...MOVE_L, ...MOVE_R, ...JUMP, ...ATTACK, ...DASH].includes(code)) e.preventDefault();
    if (e.repeat) return;
    if (MOVE_L.includes(code)) input.left = true;
    if (MOVE_R.includes(code)) input.right = true;
    if (JUMP.includes(code)) { input.jumpHeld = true; jumpQueued = 8; onConfirmKey(); }
    if (ATTACK.includes(code)) { attackQueued = true; }
    if (DASH.includes(code)) { dashQueued = true; }
    if (code === "Enter") onConfirmKey();
    if (code === "KeyP" || code === "Escape") togglePauseKey();
    if (code === "KeyM") toggleMute();
    if (code === "KeyR" && (G.state === "over")) retryLevel();
  });
  window.addEventListener("keyup", (e) => {
    const code = e.code;
    if (MOVE_L.includes(code)) input.left = false;
    if (MOVE_R.includes(code)) input.right = false;
    if (JUMP.includes(code)) {
      input.jumpHeld = false;
      if (P && P.vy < -2.6) P.vy = -2.6;      // saut variable
    }
  });
  // Tactile
  document.querySelectorAll(".tbtn").forEach((btn) => {
    const k = btn.dataset.k;
    const on = (e) => {
      e.preventDefault(); AU.unlock(); btn.classList.add("on");
      if (k === "left") input.left = true;
      if (k === "right") input.right = true;
      if (k === "jump") { input.jumpHeld = true; jumpQueued = 8; onConfirmKey(); }
      if (k === "attack") attackQueued = true;
      if (k === "dash") dashQueued = true;
    };
    const off = (e) => {
      e.preventDefault(); btn.classList.remove("on");
      if (k === "left") input.left = false;
      if (k === "right") input.right = false;
      if (k === "jump") { input.jumpHeld = false; if (P && P.vy < -2.6) P.vy = -2.6; }
    };
    btn.addEventListener("pointerdown", on);
    btn.addEventListener("pointerup", off);
    btn.addEventListener("pointerleave", off);
    btn.addEventListener("pointercancel", off);
  });
  cvs.addEventListener("pointerdown", () => { AU.unlock(); if (G.state === "intro") beginLevel(); });

  function onConfirmKey() {
    if (G.state === "title") {
      const save = loadProgress();
      if (save && save.level > 0) continueGame(); else newGame();
    } else if (G.state === "intro") beginLevel();
    else if (G.state === "clear") nextLevel();
    else if (G.state === "over") retryLevel();
    else if (G.state === "paused") resumeGame();
    else if (G.state === "win") goTitle();
  }
  function togglePauseKey() {
    if (G.state === "playing") pauseGame();
    else if (G.state === "paused") resumeGame();
    else if (G.state === "help") closeHelp();
  }

  /* ---------------- Construction d'un niveau ---------------- */
  function buildLevel(idx) {
    const spec = window.LEVELS[idx];
    const lv = {
      spec, idx, width: spec.width,
      solids: new Set(), oneways: new Set(), spikes: new Set(), dyn: new Set(),
      gates: [], movers: [], enemies: [], coins: [], hearts: [],
      projectiles: [], particles: [], texts: [], droppedHearts: [],
      hasKey: false, hasCrown: false, keyItem: null, crownItem: null,
      checkpoints: [], spawnPt: { x: spec.spawn[0] * T + 3, feet: spec.spawn[1] * T },
      boss: null, bossActive: false, bossDead: false, arenaClosed: false,
      coinsGot: 0, coinsTotal: 0,
    };
    spec.solids.forEach(([x, y, w, h]) => {
      for (let i = x; i < x + w; i++) for (let j = y; j < y + h; j++) lv.solids.add(key2(i, j));
    });
    spec.oneways.forEach(([x, y, w]) => { for (let i = x; i < x + w; i++) lv.oneways.add(key2(i, y)); });
    spec.spikes.forEach(([x, y, w]) => { for (let i = x; i < x + w; i++) lv.spikes.add(key2(i, y)); });
    (spec.gates || []).forEach((g) => lv.gates.push({ x: g.x, y: g.y, h: g.h, open: 0, opening: false }));
    (spec.movers || []).forEach((m, i) => lv.movers.push({
      x0: m.x * T, y0: m.y * T, x: m.x * T, y: m.y * T, w: m.w * T, h: 7,
      axis: m.axis, range: m.range * T, speed: m.speed, phase: i * 1.7, dx: 0, dy: 0,
    }));
    spec.coins.forEach(([x, y, n, dx, arc]) => {
      for (let i = 0; i < n; i++) {
        const lift = arc && n > 1 ? Math.sin((i / (n - 1)) * Math.PI) * arc * T : 0;
        lv.coins.push({ x: (x + i * dx) * T + 8, y: y * T + 8 - lift, taken: false });
      }
    });
    lv.coinsTotal = lv.coins.length;
    (spec.hearts || []).forEach(([x, y]) => lv.hearts.push({ x: x * T + 8, y: y * T + 8, taken: false }));
    if (spec.key) lv.keyItem = { x: spec.key[0] * T + 8, y: spec.key[1] * T + 8, taken: false };
    (spec.checkpoints || []).forEach(([x, y]) => lv.checkpoints.push({ x: x * T, feet: y * T, active: false }));
    spec.enemies.forEach(([type, x, y]) => lv.enemies.push(makeEnemy(type, x, y)));
    if (spec.boss) {
      lv.boss = makeEnemy("boss", spec.boss.bossX, spec.boss.bossY);
      lv.enemies.push(lv.boss);
    }
    return lv;
  }

  function makeEnemy(type, tx, ty) {
    const base = {
      type, dir: -1, vx: 0, vy: 0, state: "walk", timer: 0, attackCd: 0,
      flash: 0, dead: false, onGround: false, hitWall: false,
      homeX: tx * T, tSeed: Math.random() * 1000, swingHit: false, turnCd: 0,
    };
    if (type === "garde")  Object.assign(base, { w: 10, h: 20, hp: 2, maxHp: 2, speed: 0.45 });
    if (type === "elite")  Object.assign(base, { w: 11, h: 21, hp: 4, maxHp: 4, speed: 0.5 });
    if (type === "archer") Object.assign(base, { w: 10, h: 20, hp: 2, maxHp: 2, speed: 0, state: "idle", timer: 40 + Math.random() * 40 });
    if (type === "corbeau")Object.assign(base, { w: 12, h: 8, hp: 1, maxHp: 1, speed: 0.6, baseY: ty * T, state: "patrol" });
    if (type === "boss")   Object.assign(base, { w: 16, h: 30, hp: 18, maxHp: 18, speed: 0.55, state: "dormant", combo: 0, staggerCount: 0, decideCd: 60 });
    base.x = tx * T + (T - base.w) / 2;
    base.y = type === "corbeau" ? ty * T : ty * T - base.h;
    return base;
  }

  function makePlayer(spawn) {
    return {
      x: spawn.x, y: spawn.feet - 18, w: 10, h: 18, vx: 0, vy: 0, dir: 1,
      hp: 5, maxHp: 5, onGround: false, coyote: 0, jumps: 0,
      attackTimer: 0, attackCd: 0, swingId: 0,
      dashTimer: 0, dashCd: 0, canAirDash: true,
      invuln: 0, hurtFlash: 0, standingMover: null, dead: false,
    };
  }

  function loadLevel(idx) {
    jumpQueued = 0; attackQueued = false; dashQueued = false;
    G.levelIndex = idx;
    G.snapshot = { ...G.stats };
    L = buildLevel(idx);
    P = makePlayer(L.spawnPt);
    cam.x = clamp(P.x - W / 2, 0, L.width * T - W);
    G.deathTimer = -1;
    hideBossBar();
    clearToast();
  }

  /* ---------------- Collision tuiles ---------------- */
  function isSolid(tx, ty) {
    if (tx < 0 || tx >= L.width) return true;
    if (ty < 0 || ty >= ROWS) return false;
    if (L.solids.has(key2(tx, ty))) return true;
    if (L.dyn.has(key2(tx, ty))) return true;
    for (const g of L.gates) {
      if (g.open < 0.75 && tx === g.x && ty >= g.y && ty < g.y + g.h) return true;
    }
    return false;
  }
  const isOneway = (tx, ty) => L.oneways.has(key2(tx, ty));
  function groundAhead(e) {
    const feetTy = Math.floor((e.y + e.h + 2) / T);
    const aheadTx = Math.floor((e.dir > 0 ? e.x + e.w + 2 : e.x - 2) / T);
    return isSolid(aheadTx, feetTy) || isOneway(aheadTx, feetTy);
  }

  function physics(e, useOneway) {
    const prevBottom = e.y + e.h;
    e.hitWall = false;
    // Horizontal
    e.x += e.vx;
    if (e.vx !== 0) {
      const ty0 = Math.floor(e.y / T), ty1 = Math.floor((e.y + e.h - 1) / T);
      const edgeTx = e.vx > 0 ? Math.floor((e.x + e.w) / T) : Math.floor(e.x / T);
      for (let ty = ty0; ty <= ty1; ty++) {
        if (isSolid(edgeTx, ty)) {
          e.x = e.vx > 0 ? edgeTx * T - e.w : (edgeTx + 1) * T;
          e.hitWall = true; e.vx = 0; break;
        }
      }
    }
    // Vertical
    e.y += e.vy;
    const wasGround = e.onGround;
    e.onGround = false; e.standingMover = null;
    const tx0 = Math.floor((e.x + 1) / T), tx1 = Math.floor((e.x + e.w - 2) / T);
    if (e.vy >= 0) {
      const ty = Math.floor((e.y + e.h) / T);
      for (let tx = tx0; tx <= tx1; tx++) {
        const ow = useOneway && isOneway(tx, ty) && prevBottom <= ty * T + 1;
        if (isSolid(tx, ty) || ow) { e.y = ty * T - e.h; e.vy = 0; e.onGround = true; break; }
      }
      // plateformes mobiles
      if (!e.onGround) {
        for (const m of L.movers) {
          if (e.x + e.w > m.x + 2 && e.x < m.x + m.w - 2 && prevBottom <= m.y + 5 && e.y + e.h >= m.y) {
            e.y = m.y - e.h; e.vy = 0; e.onGround = true; e.standingMover = m; break;
          }
        }
      }
    } else {
      const ty = Math.floor(e.y / T);
      for (let tx = tx0; tx <= tx1; tx++) {
        if (isSolid(tx, ty)) { e.y = (ty + 1) * T; e.vy = 0; break; }
      }
    }
    if (e.onGround && !wasGround && e === P) landDust(e);
  }

  /* ---------------- Particules & textes ---------------- */
  function burst(x, y, n, colors, spd, life, grav) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = (0.3 + Math.random() * 0.7) * (spd || 1.6);
      L.particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 0.6,
        life: 0, max: (life || 26) * (0.6 + Math.random() * 0.7),
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 1 + Math.floor(Math.random() * 2), grav: grav === undefined ? 0.06 : grav,
      });
    }
  }
  function landDust(e) { burst(e.x + e.w / 2, e.y + e.h - 1, 5, ["#cfc4a8", "#9b8f76"], 0.7, 14, -0.01); }
  function floatText(x, y, txt, color) { L.texts.push({ x, y, txt, color: color || "#ffd75e", life: 0 }); }

  /* ---------------- Toast ---------------- */
  function showToast(txt, ms) {
    G.toastText = txt; G.toastUntil = performance.now() + (ms || 2600);
    const el = $("toast"); el.textContent = txt; el.classList.remove("hidden");
  }
  function clearToast() { $("toast").classList.add("hidden"); G.toastUntil = 0; }
  function updateToast() {
    if (G.toastUntil && performance.now() > G.toastUntil) clearToast();
    if (!G.toastUntil && G.state === "playing" && L) {
      // panneaux de bois
      for (const [sx, sy, txt] of L.spec.signs || []) {
        if (Math.abs(P.x - sx * T) < 26 && Math.abs((P.y + P.h) - sy * T) < 30) {
          const el = $("toast"); el.textContent = txt; el.classList.remove("hidden");
          return;
        }
      }
      $("toast").classList.add("hidden");
    }
  }

  /* ---------------- Joueur ---------------- */
  function updatePlayer() {
    if (P.dead) { P.vy = Math.min(P.vy + GRAV, 7); P.y += P.vy; return; }
    const inDash = P.dashTimer > 0;
    // plateformes mobiles : transport
    if (P.standingMover) { P.x += P.standingMover.dx; P.y += P.standingMover.dy; }

    // Course
    const maxSpd = 1.85, accel = P.onGround ? 0.4 : 0.25;
    if (!inDash) {
      if (input.left) { P.vx = Math.max(P.vx - accel, -maxSpd); P.dir = -1; }
      else if (input.right) { P.vx = Math.min(P.vx + accel, maxSpd); P.dir = 1; }
      else P.vx *= P.onGround ? 0.7 : 0.92;
      if (Math.abs(P.vx) < 0.05) P.vx = 0;
    }
    // Saut / double saut
    if (P.onGround) { P.coyote = 7; P.jumps = 0; P.canAirDash = true; }
    else if (P.coyote > 0) P.coyote--;
    if (jumpQueued > 0) jumpQueued--;
    if (jumpQueued > 0) {
      if (P.onGround || P.coyote > 0) {
        P.vy = -6.4; P.jumps = 1; P.coyote = 0; jumpQueued = 0;
        AU.sfx.jump(); landDust(P);
      } else if (P.jumps < 2) {
        P.vy = -5.6; P.jumps = 2; jumpQueued = 0;
        AU.sfx.doubleJump();
        burst(P.x + P.w / 2, P.y + P.h, 8, ["#ffffff", "#bfe3ff"], 1.1, 16, 0.02);
      }
    }
    // Dash
    if (dashQueued) {
      dashQueued = false;
      if (P.dashCd <= 0 && (P.onGround || P.canAirDash)) {
        P.dashTimer = 9; P.dashCd = 26; if (!P.onGround) P.canAirDash = false;
        AU.sfx.dash();
      }
    }
    if (P.dashTimer > 0) {
      P.dashTimer--; P.vx = P.dir * 4.3; P.vy = 0;
      L.particles.push({ x: P.x + P.w / 2, y: P.y + P.h / 2, vx: -P.dir * 0.4, vy: 0, life: 0, max: 12, color: "#7ad9ff", size: 2, grav: 0 });
    }
    if (P.dashCd > 0) P.dashCd--;
    // Attaque épée
    if (P.attackCd > 0) P.attackCd--;
    if (attackQueued) {
      attackQueued = false;
      if (P.attackCd <= 0) {
        P.attackTimer = 12; P.attackCd = 21; P.swingId++;
        AU.sfx.slash();
        if (P.onGround) P.vx += P.dir * 0.7;
      }
    }
    if (P.attackTimer > 0) { P.attackTimer--; playerAttackHits(); }

    if (!inDash) P.vy = Math.min(P.vy + GRAV, 7.5);
    physics(P, true);
    P.x = clamp(P.x, 0, L.width * T - P.w);
    if (P.invuln > 0) P.invuln--;
    if (P.hurtFlash > 0) P.hurtFlash--;

    // Piques
    const ptx0 = Math.floor((P.x + 2) / T), ptx1 = Math.floor((P.x + P.w - 3) / T);
    const pty = Math.floor((P.y + P.h - 4) / T);
    for (let tx = ptx0; tx <= ptx1; tx++) {
      if (L.spikes.has(key2(tx, pty)) && P.invuln <= 0) {
        hurtPlayer(P.x + P.w / 2, true); P.vy = -4.2; break;
      }
    }
    // Chute dans le vide
    if (P.y > H + 60) {
      P.hp--;
      AU.sfx.hurt();
      if (P.hp <= 0) { startDeath(); return; }
      G.stats.deaths++;
      showToast("Aïe ! Retour à la dernière bannière 🚩", 1600);
      respawnAtCheckpoint();
    }
    pickupsAndTriggers();
  }

  function respawnAtCheckpoint() {
    P.x = L.spawnPt.x; P.y = L.spawnPt.feet - P.h;
    P.vx = 0; P.vy = 0; P.invuln = 70; P.dashTimer = 0;
    cam.x = clamp(P.x - W / 2, 0, L.width * T - W);
  }

  function hurtPlayer(srcX, fromSpikes) {
    if (P.invuln > 0 || P.dashTimer > 0 || P.dead) return;
    P.hp--; P.invuln = 65; P.hurtFlash = 14; G.shake = Math.max(G.shake, 4);
    AU.sfx.hurt();
    burst(P.x + P.w / 2, P.y + 8, 8, ["#f43f52", "#ffd7dd"], 1.4, 20);
    if (!fromSpikes) {
      P.vx = (P.x + P.w / 2 < srcX ? -1 : 1) * 2.2;
      P.vy = -3;
    }
    if (P.hp <= 0) startDeath();
  }
  function startDeath() {
    if (P.dead) return;
    P.dead = true; P.vy = -4; G.stats.deaths++;
    AU.sfx.kill(); G.shake = 7;
    burst(P.x + P.w / 2, P.y + 9, 22, ["#f43f52", "#ffffff", "#7ad9ff"], 2, 40);
    G.deathTimer = 55;
  }

  function playerAttackHits() {
    const hb = {
      x: P.dir > 0 ? P.x + P.w - 3 : P.x - 14, y: P.y - 2, w: 17, h: 20,
    };
    // flèches tranchées !
    for (const pr of L.projectiles) {
      if (pr.type === "arrow" && !pr.dead && overlap(hb, pr)) {
        pr.dead = true; AU.sfx.arrowBreak();
        burst(pr.x, pr.y, 5, ["#c9a165", "#e84855"], 1, 12);
        floatText(pr.x, pr.y - 6, "TRANCHÉE !", "#7ad9ff");
      }
    }
    for (const e of L.enemies) {
      if (e.dead || e.lastSwing === P.swingId) continue;
      if (!overlap(hb, e)) continue;
      e.lastSwing = P.swingId;
      // Bouclier de l'élite : bloque de face, sauf par-dessus ou pendant son attaque
      if (e.type === "elite") {
        const playerInFront = Math.sign((P.x + P.w / 2) - (e.x + e.w / 2)) === e.dir;
        const fromAbove = P.y + P.h < e.y + 9;
        if (playerInFront && !fromAbove && e.state !== "attack") {
          AU.sfx.clang();
          burst(e.x + e.w / 2 + e.dir * 7, e.y + 8, 6, ["#ffe98a", "#ffffff"], 1.3, 12);
          floatText(e.x + e.w / 2 - 10, e.y - 8, "BLOQUÉ !", "#bfe3ff");
          P.vx = -P.dir * 1.6;
          continue;
        }
      }
      damageEnemy(e, 1, P.dir);
    }
  }

  function damageEnemy(e, dmg, dir) {
    if (e.type === "boss" && e.hitCd > 0) return;
    e.hp -= dmg; e.flash = 7; G.hitStop = 3;
    AU.sfx.hit();
    burst(e.x + e.w / 2, e.y + e.h / 2, 7, ["#ffe98a", "#f43f52", "#ffffff"], 1.4, 18);
    if (e.type === "boss") {
      e.hitCd = 6; e.staggerCount++;
      updateBossBar(e);
      if (e.hp > 0 && e.staggerCount >= 6 && e.state !== "stagger" && e.state !== "charge" && e.state !== "leapAir") {
        e.staggerCount = 0; e.state = "stagger"; e.timer = 95; e.vx = 0;
        floatText(e.x - 4, e.y - 10, "IL CHANCELLE !", "#ffd75e");
        AU.sfx.bossRoar();
      }
    } else {
      e.vx = dir * 1.8; e.vy = Math.min(e.vy, -1.2);
      if (e.type !== "archer") { e.state = "chase"; }
    }
    if (e.hp <= 0) killEnemy(e);
  }

  function killEnemy(e) {
    e.dead = true; G.stats.kills++;
    AU.sfx.kill(); G.shake = Math.max(G.shake, e.type === "boss" ? 10 : 3);
    const cols = e.type === "corbeau" ? ["#31314e", "#23233a", "#e8a33d"] : ["#c9d6e6", "#315fae", "#f43f52", "#ffd75e"];
    burst(e.x + e.w / 2, e.y + e.h / 2, e.type === "boss" ? 60 : 16, cols, e.type === "boss" ? 2.6 : 1.7, 40);
    if (e.type === "boss") {
      L.bossDead = true; hideBossBar();
      AU.sfx.fanfare(); AU.playMusic("level");
      openArena();
      L.crownItem = { x: e.x + e.w / 2, y: (L.spec.boss.bossY) * T - 10, taken: false };
      showToast("👑 CORVUS EST VAINCU ! La Couronne d'Or est tombée !", 4000);
      L.droppedHearts.push({ x: e.x - 14, y: e.y + 10, taken: false });
    } else if (Math.random() < 0.18 && P.hp < P.maxHp) {
      L.droppedHearts.push({ x: e.x + e.w / 2, y: e.y + 6, taken: false });
    }
  }

  /* ---------------- Ramassages & déclencheurs ---------------- */
  function pickupsAndTriggers() {
    const pc = { x: P.x + P.w / 2, y: P.y + P.h / 2 };
    const near = (it, d) => Math.abs(it.x - pc.x) < d && Math.abs(it.y - pc.y) < d + 4;
    for (const cn of L.coins) {
      if (!cn.taken && near(cn, 10)) {
        cn.taken = true; L.coinsGot++; G.stats.coins++;
        AU.sfx.coin(); burst(cn.x, cn.y, 4, ["#ffd75e", "#fff0b3"], 0.8, 12, 0);
      }
    }
    const eatHeart = (ht) => {
      if (P.hp >= P.maxHp) return; // vie pleine : on garde le cœur pour plus tard
      ht.taken = true; AU.sfx.heart();
      P.hp++; floatText(pc.x - 8, P.y - 8, "+1 PV", "#ff8fa3");
      burst(pc.x, pc.y, 6, ["#f43f52", "#ffd7dd"], 0.9, 16, 0);
    };
    L.hearts.forEach((ht) => { if (!ht.taken && near(ht, 11)) eatHeart(ht); });
    L.droppedHearts.forEach((ht) => { if (!ht.taken && near(ht, 11)) eatHeart(ht); });
    if (L.keyItem && !L.keyItem.taken && near(L.keyItem, 12)) {
      L.keyItem.taken = true; L.hasKey = true;
      AU.sfx.key(); showToast("🗝️ Clé royale obtenue ! Direction la herse !", 2800);
      burst(L.keyItem.x, L.keyItem.y, 10, ["#ffd75e", "#fff0b3"], 1.2, 22, 0);
    }
    if (L.crownItem && !L.crownItem.taken && near(L.crownItem, 13)) {
      L.crownItem.taken = true; L.hasCrown = true;
      AU.sfx.fanfare();
      showToast("👑 LA COURONNE D'OR ! Rapportez-la au roi Aldéric III, sur son trône !", 4200);
      burst(L.crownItem.x, L.crownItem.y, 18, ["#ffd75e", "#ffffff", "#f43f52"], 1.6, 30, 0);
    }
    for (const cp of L.checkpoints) {
      if (!cp.active && Math.abs(P.x - cp.x) < 14 && Math.abs((P.y + P.h) - cp.feet) < 26) {
        cp.active = true; L.spawnPt = { x: cp.x + 3, feet: cp.feet };
        AU.sfx.checkpoint();
        floatText(cp.x - 6, cp.feet - 34, "BANNIÈRE !", "#7ad9ff");
        burst(cp.x + 10, cp.feet - 20, 8, ["#c1273d", "#ffd75e"], 1, 18, 0.02);
      }
    }
    // Herses
    for (const g of L.gates) {
      if (g.opening && g.open < 1) g.open = Math.min(1, g.open + 0.02);
      if (!g.opening && P.x + P.w > g.x * T - 8 && P.x < g.x * T + T + 4 && (P.y + P.h) > g.y * T) {
        if (L.hasKey) {
          g.opening = true; AU.sfx.gate(); G.shake = Math.max(G.shake, 3);
          showToast("🔓 La herse royale se lève dans un grincement...", 2200);
        } else if (performance.now() - G.lastGateToast > 2500) {
          G.lastGateToast = performance.now();
          showToast("🔒 Herse verrouillée ! Il faut la clé royale... cherchez en hauteur !", 2400);
        }
      }
    }
    // Déclenchement du boss
    if (L.spec.boss && !L.bossActive && !L.bossDead && (P.x / T) >= L.spec.boss.triggerX) startBossFight();
    // Arrivée
    const [gx, gy] = L.spec.goal;
    if (Math.abs(pc.x - (gx * T + 8)) < 20 && Math.abs((P.y + P.h) - gy * T) < 32) {
      if (L.spec.king) {
        if (L.bossDead && L.hasCrown) return victory();
        if (performance.now() - G.lastKingToast > 3000) {
          G.lastKingToast = performance.now();
          showToast(L.bossDead ? "👑 Le Roi : « Ma couronne, écuyer ! Elle est tombée près de Corvus ! »"
                               : "👑 Le Roi : « Vite, écuyer ! Corvus détient ma couronne dans la grande salle ! »", 3000);
        }
      } else {
        return completeLevel();
      }
    }
  }

  /* ---------------- Ennemis ---------------- */
  function updateEnemy(e) {
    if (e.dead) return;
    if (e.flash > 0) e.flash--;
    if (e.attackCd > 0) e.attackCd--;
    if (e.turnCd > 0) e.turnCd--;
    const pcx = P.x + P.w / 2, ecx = e.x + e.w / 2;
    const dx = pcx - ecx, dy = (P.y + P.h / 2) - (e.y + e.h / 2);
    const adx = Math.abs(dx);

    if (e.type === "corbeau") {
      const t = G.t + e.tSeed * 10;
      if (adx < 75 && Math.abs(dy) < 55 && !P.dead) {
        e.vx = clamp(dx * 0.03, -1.25, 1.25); e.vy = clamp(dy * 0.03, -1, 1);
        e.dir = dx > 0 ? 1 : -1;
      } else {
        if (e.x < e.homeX - 44) e.dir = 1;
        if (e.x > e.homeX + 44) e.dir = -1;
        e.vx = e.dir * e.speed;
        e.vy = ((e.baseY + Math.sin(t / 320) * 6) - e.y) * 0.08;
      }
      e.x += e.vx; e.y += e.vy;
    } else if (e.type === "archer") {
      e.vy = Math.min(e.vy + GRAV, 7);
      e.vx *= 0.8;
      physics(e, true);
      if (adx < 170) e.dir = dx > 0 ? 1 : -1;
      if (e.state === "idle") {
        e.timer--;
        if (e.timer <= 0 && adx > 24 && adx < 165 && Math.abs(dy) < 55 && !P.dead) { e.state = "aim"; e.timer = 34; }
        else if (e.timer <= 0) e.timer = 20;
      } else if (e.state === "aim") {
        e.timer--;
        if (e.timer <= 0) {
          e.state = "idle"; e.timer = 95 + Math.random() * 35;
          AU.sfx.arrow();
          L.projectiles.push({
            type: "arrow", x: ecx + e.dir * 8, y: e.y + 8, w: 7, h: 2,
            vx: e.dir * 2.4, vy: clamp(dy * 0.008, -0.5, 0.5), dead: false, life: 0,
          });
        }
      }
    } else if (e.type === "boss") {
      updateBoss(e, dx, dy, adx);
    } else {
      // garde & élite
      e.vy = Math.min(e.vy + GRAV, 7.5);
      const chaseSpd = e.type === "elite" ? 0.78 : 0.68;
      if (e.state === "walk") {
        e.vx = e.dir * e.speed;
        if (adx < 78 && Math.abs(dy) < 28 && !P.dead) e.state = "chase";
      } else if (e.state === "chase") {
        const wantDir = dx > 0 ? 1 : -1;
        if (wantDir !== e.dir && e.turnCd <= 0) { e.dir = wantDir; e.turnCd = e.type === "elite" ? 22 : 8; }
        e.vx = e.dir * chaseSpd;
        const reach = e.type === "elite" ? 23 : 25;
        if (adx < reach && Math.abs(dy) < 20 && e.attackCd <= 0 && !P.dead) {
          e.state = "attack"; e.timer = e.type === "elite" ? 26 : 24; e.swingHit = false; e.vx = 0;
          AU.sfx.slash();
        }
        if (adx > 125 || Math.abs(dy) > 60) e.state = "walk";
      } else if (e.state === "attack") {
        e.vx = 0; e.timer--;
        const total = e.type === "elite" ? 26 : 24;
        const prog = 1 - e.timer / total;
        if (!e.swingHit && prog > 0.45 && prog < 0.8) {
          const hb = e.type === "garde"
            ? { x: e.dir > 0 ? e.x + e.w - 2 : e.x - 17, y: e.y + 5, w: 19, h: 10 }
            : { x: e.dir > 0 ? e.x + e.w - 3 : e.x - 14, y: e.y + 1, w: 17, h: 18 };
          if (overlap(hb, P)) { hurtPlayer(ecx); e.swingHit = true; }
        }
        if (e.timer <= 0) { e.state = "chase"; e.attackCd = e.type === "elite" ? 55 : 70; }
      }
      physics(e, true);
      if (e.hitWall && e.state === "walk") e.dir *= -1;
      if (e.onGround && e.state !== "attack" && !groundAhead(e)) {
        if (e.state === "walk") e.dir *= -1;
        else e.x -= e.vx; // l'élite/garde en chasse s'arrête au bord
      }
      if (e.y > H + 80) e.dead = true;
    }
    // dégât de contact
    if (!P.dead && overlap(P, e)) hurtPlayer(ecx);
  }

  /* ---------------- BOSS : Capitaine Corvus ---------------- */
  function startBossFight() {
    L.bossActive = true;
    const b = L.spec.boss;
    for (const colX of [b.arenaL, b.arenaR])
      for (let ty = 5; ty <= 13; ty++) L.dyn.add(key2(colX, ty));
    L.arenaClosed = true;
    AU.sfx.gate(); AU.sfx.bossRoar(); AU.playMusic("boss");
    G.shake = 8;
    showToast("☠️ CORVUS : « La couronne est à moi, petit écuyer en baskets ! »", 3800);
    const boss = L.boss;
    boss.state = "intro"; boss.timer = 70;
    showBossBar(boss);
  }
  function openArena() {
    L.dyn.clear(); L.arenaClosed = false;
    AU.sfx.gate();
  }
  function showBossBar(boss) { $("bossbar").classList.remove("hidden"); updateBossBar(boss); }
  function hideBossBar() { $("bossbar").classList.add("hidden"); }
  function updateBossBar(boss) { $("boss-fill").style.width = Math.max(0, (boss.hp / boss.maxHp) * 100) + "%"; }

  function updateBoss(e, dx, dy, adx) {
    if (e.hitCd > 0) e.hitCd--;
    if (e.state === "dormant") { e.vy = Math.min(e.vy + GRAV, 7); physics(e, true); return; }
    const phase2 = e.hp <= e.maxHp / 2;
    const spdMul = phase2 ? 1.35 : 1;
    if (e.state !== "leapAir") e.vy = Math.min(e.vy + GRAV, 8);

    switch (e.state) {
      case "intro":
        e.vx = 0; e.timer--;
        if (e.timer <= 0) { e.state = "walk"; e.decideCd = 50; }
        break;
      case "walk": {
        e.dir = dx > 0 ? 1 : -1;
        e.vx = e.dir * e.speed * spdMul;
        e.decideCd--;
        if (adx < 30 && e.attackCd <= 0) {
          e.state = "attack"; e.timer = 24; e.combo = phase2 ? 3 : 2; e.swingHit = false; e.vx = 0; AU.sfx.slash();
        } else if (e.decideCd <= 0 && !P.dead) {
          e.decideCd = (phase2 ? 80 : 115) + Math.random() * 40;
          if (adx > 55 && Math.random() < 0.55) { e.state = "telegraph"; e.timer = phase2 ? 28 : 38; e.vx = 0; }
          else if (adx > 40) {
            e.state = "leapAir"; e.vy = -7.2; e.vx = clamp(dx * 0.022, -2.2, 2.2); AU.sfx.jump();
          }
        }
        break;
      }
      case "attack": {
        e.timer--;
        const prog = 1 - e.timer / 24;
        e.vx = prog < 0.5 ? e.dir * 0.5 : 0;
        if (!e.swingHit && prog > 0.4 && prog < 0.85) {
          const hb = { x: e.dir > 0 ? e.x + e.w - 4 : e.x - 19, y: e.y + 2, w: 23, h: 24 };
          if (overlap(hb, P)) { hurtPlayer(e.x + e.w / 2); e.swingHit = true; }
        }
        if (e.timer <= 0) {
          e.combo--;
          if (e.combo > 0) { e.timer = 24; e.swingHit = false; e.dir = dx > 0 ? 1 : -1; AU.sfx.slash(); }
          else { e.state = "walk"; e.attackCd = 55; }
        }
        break;
      }
      case "telegraph":
        e.vx = 0; e.timer--;
        if (e.timer === 30 || e.timer === 10) AU.sfx.clang();
        if (e.timer <= 0) { e.state = "charge"; e.timer = 95; AU.sfx.dash(); AU.sfx.bossRoar(); }
        break;
      case "charge":
        e.vx = e.dir * 3.1 * spdMul; e.timer--;
        L.particles.push({ x: e.x + e.w / 2, y: e.y + e.h - 2, vx: -e.dir * 0.5, vy: -Math.random(), life: 0, max: 12, color: "#cfc4a8", size: 2, grav: 0.02 });
        if (e.hitWallPrev) {
          e.state = "stagger"; e.timer = 110; e.staggerCount = 0;
          G.shake = 9; AU.sfx.slam();
          burst(e.x + e.w / 2 + e.dir * 8, e.y + 10, 14, ["#c9d6e6", "#ffd75e"], 1.6, 24);
          floatText(e.x - 6, e.y - 12, "SONNÉ ! FRAPPE !", "#ffd75e");
        } else if (e.timer <= 0) { e.state = "walk"; e.decideCd = 60; }
        break;
      case "leapAir":
        e.vy = Math.min(e.vy + GRAV, 8.5);
        break;
      case "stagger":
        e.vx *= 0.8; e.timer--;
        if (e.timer <= 0) { e.state = "walk"; e.decideCd = 70; AU.sfx.bossRoar(); }
        break;
    }
    const wasAir = e.state === "leapAir";
    const prevWall = e.hitWall;
    physics(e, true);
    e.hitWallPrev = e.hitWall && e.state === "charge" ? true : (e.state === "charge" ? e.hitWallPrev && false : false);
    if (e.state === "charge" && e.hitWall) e.hitWallPrev = true;
    if (wasAir && e.onGround) {
      // Atterrissage fracassant : ondes de choc au sol
      e.state = "walk"; e.decideCd = 80; e.vx = 0;
      G.shake = 8; AU.sfx.slam();
      burst(e.x + e.w / 2, e.y + e.h, 18, ["#9b8f76", "#cfc4a8", "#ff8a5c"], 1.8, 26);
      [1, -1].forEach((sd) => L.projectiles.push({
        type: "shock", x: e.x + e.w / 2 + sd * 10, y: e.y + e.h - 8, w: 8, h: 8,
        vx: sd * 1.5, vy: 0, dead: false, life: 0,
      }));
    }
  }

  /* ---------------- Projectiles / plateformes ---------------- */
  function updateProjectiles() {
    for (const pr of L.projectiles) {
      if (pr.dead) continue;
      pr.life++;
      if (pr.type === "arrow") {
        pr.vy += 0.025; pr.x += pr.vx; pr.y += pr.vy;
        if (pr.vx < 0) pr.x -= 0; // (la hitbox suit x)
      } else {
        pr.x += pr.vx;
        if (pr.life % 4 === 0) L.particles.push({ x: pr.x + 4, y: pr.y + 8, vx: 0, vy: -0.5, life: 0, max: 10, color: "#ff8a5c", size: 1, grav: 0 });
      }
      const tx = Math.floor((pr.x + pr.w / 2) / T), ty = Math.floor((pr.y + pr.h / 2) / T);
      if (isSolid(tx, ty) || pr.life > 320 || pr.y > H + 30) {
        pr.dead = true;
        if (pr.type === "arrow") burst(pr.x, pr.y, 3, ["#c9a165"], 0.6, 8);
        continue;
      }
      if (!P.dead && overlap(pr, P)) { hurtPlayer(pr.x); pr.dead = true; }
    }
    L.projectiles = L.projectiles.filter((p) => !p.dead);
  }
  function updateMovers() {
    for (const m of L.movers) {
      const off = Math.sin(G.t / 1000 * m.speed * 2 + m.phase) * m.range;
      const nx = m.axis === "x" ? m.x0 + off : m.x0;
      const ny = m.axis === "y" ? m.y0 + off : m.y0;
      m.dx = nx - m.x; m.dy = ny - m.y; m.x = nx; m.y = ny;
    }
  }
  function updateParticles() {
    for (const p of L.particles) { p.life++; p.x += p.vx; p.y += p.vy; p.vy += p.grav; }
    L.particles = L.particles.filter((p) => p.life < p.max);
    for (const tx of L.texts) { tx.life++; tx.y -= 0.35; }
    L.texts = L.texts.filter((t) => t.life < 48);
  }

  /* ---------------- Boucle de mise à jour ---------------- */
  function update() {
    G.t += 1000 / 60;
    if (G.state !== "playing") { updateParticles(); return; }
    G.stats.time++;
    updateMovers();
    updatePlayer();
    if (G.deathTimer > 0) { G.deathTimer--; if (G.deathTimer === 0) gameOver(); }
    for (const e of L.enemies) {
      // on n'active l'IA qu'à portée d'écran (+ marge), sauf le boss déclenché
      if (Math.abs(e.x - P.x) < 340 || (e.type === "boss" && L.bossActive)) updateEnemy(e);
      else if (e.flash > 0) e.flash--;
    }
    updateProjectiles();
    updateParticles();
    // caméra douce
    const target = clamp(P.x + P.w / 2 - W / 2, 0, L.width * T - W);
    cam.x += (target - cam.x) * 0.14;
    if (Math.abs(target - cam.x) < 0.4) cam.x = target;
    if (G.shake > 0) G.shake = Math.max(0, G.shake - 0.35);
    updateToast();
  }

  /* ============================================================
     RENDU
     ============================================================ */
  function R(color, x, y, w, h) { ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
  function blockyCircle(cx, cy, r, color) {
    ctx.fillStyle = color;
    for (let y = -r; y <= r; y += 2) {
      const wHalf = Math.floor(Math.sqrt(r * r - y * y));
      ctx.fillRect(cx - wHalf, cy + y, wHalf * 2, 2);
    }
  }

  function drawBackground() {
    const th = L.spec.theme, t = G.t;
    const camF = cam.x * 0.22, camM = cam.x * 0.5;
    if (th === "ville") {
      const bands = ["#2c2150", "#4a2a63", "#7a3560", "#b34a5e", "#e07a4e", "#ffb35c"];
      bands.forEach((col, i) => R(col, 0, i * 24, W, 24));
      blockyCircle(352 - (cam.x * 0.05) % 60, 118, 21, "#ffd75e");
      blockyCircle(352 - (cam.x * 0.05) % 60, 118, 16, "#fff0b3");
      drawSkyline(camF, 150, "#3b2c5e", true);
      drawSkyline(camM, 196, "#241a42", false);
    } else if (th === "toits") {
      const bands = ["#0d1226", "#141b3d", "#1d2650", "#263260", "#2f3d6e", "#38497c"];
      bands.forEach((col, i) => R(col, 0, i * 24, W, 24));
      for (let i = 0; i < 60; i++) {
        const sx = (hash(i * 3) * 900 - cam.x * 0.06) % W, sy = hash(i * 7) * 110;
        if (Math.sin(t / 500 + i) > -0.4) R("#dfe9f5", (sx + W) % W, sy, 1.4, 1.4);
      }
      blockyCircle(70, 42, 13, "#eef3fa");
      blockyCircle(76, 38, 11, "#141b3d");
      drawSkyline(camF, 168, "#1d2650", true);
      drawSkyline(camM, 214, "#11172f", false);
    } else {
      // Intérieur de château : pierre sombre et grandes fenêtres au couchant
      R("#241d3d", 0, 0, W, H);
      for (let bx = -((camF) % 32); bx < W; bx += 32)
        for (let by = 0; by < H; by += 16) {
          if (hash(bx * 0.13 + by) > 0.5) R("#2b2349", bx, by, 31, 1);
        }
      const winOff = -(camM % 150);
      for (let wx = winOff; wx < W + 60; wx += 150) {
        R("#171130", wx, 26, 44, 84);
        R("#e8914f", wx + 4, 34, 36, 68);
        R("#ffb35c", wx + 4, 70, 36, 32);
        R("#171130", wx + 20, 30, 4, 72);
        R("#171130", wx + 4, 58, 36, 4);
        R("#0f0b26", wx + 8, 26, 28, 6);
      }
      const banOff = -(camM % 96);
      for (let bx = banOff + 58; bx < W + 60; bx += 96) {
        R("#8f1d2e", bx, 18, 16, 40);
        R("#c1273d", bx + 2, 20, 12, 30);
        R("#ffd75e", bx + 6, 28, 4, 6);
        R("#8f1d2e", bx + 4, 58, 8, 5);
      }
    }
  }
  function drawSkyline(off, baseY, color, withCastle) {
    const segW = 300;
    const start = Math.floor(off / segW) - 1;
    for (let s = start; s < start + 4; s++) {
      const ox = s * segW - off;
      let x = ox;
      let i = 0;
      while (x < ox + segW) {
        const h1 = hash(s * 31 + i * 7);
        const bw = 26 + h1 * 30, bh = 40 + hash(s * 17 + i * 3) * (withCastle ? 60 : 44);
        const isTower = withCastle && (i % 4 === 2);
        R(color, x, baseY - bh, bw, bh + (H - baseY));
        if (isTower) {
          for (let cx2 = 0; cx2 < bw; cx2 += 7) R(color, x + cx2, baseY - bh - 5, 4, 5); // créneaux
          R("#e84855", x + bw / 2, baseY - bh - 13, 7, 4);                              // drapeau royal
          R(color, x + bw / 2, baseY - bh - 13, 1.5, 9);
        } else if (hash(s + i * 13) > 0.6) {
          R(color, x + bw / 2 - 2, baseY - bh - 6, 4, 6);                              // antenne moderne
        }
        // fenêtres allumées
        for (let wy = baseY - bh + 7; wy < baseY - 8; wy += 9)
          for (let wx = x + 4; wx < x + bw - 4; wx += 8)
            if (hash(wx * 1.3 + wy * 2.1 + s) > 0.55) R(hash(wx + wy) > 0.8 ? "#7ad9ff" : "#ffd75e", wx, wy, 3, 4);
        x += bw + 3; i++;
      }
    }
  }

  function tileColors(th) {
    if (th === "ville") return { top: "#5a5f7d", topLine: "#ffd75e", body: "#55486b", dark: "#42365a", lite: "#6b5b85" };
    if (th === "toits") return { top: "#54679c", topLine: "#8fb0ff", body: "#5d3d4e", dark: "#46303f", lite: "#74505f" };
    return { top: "#8b98ad", topLine: "#d7e2f2", body: "#707a8f", dark: "#59637a", lite: "#8b98ad" };
  }
  function drawTiles() {
    const th = L.spec.theme, C = tileColors(th);
    const tx0 = Math.max(0, Math.floor(cam.x / T) - 1), tx1 = Math.min(L.width - 1, tx0 + 32);
    for (let ty = 0; ty < ROWS; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const sx = tx * T - cam.x, sy = ty * T;
        if (isSolid(tx, ty) && !L.dyn.has(key2(tx, ty))) {
          const topOpen = !isSolid(tx, ty - 1);
          R(C.body, sx, sy, T, T);
          // motif brique
          R(C.dark, sx, sy + 7, T, 1);
          R(C.dark, sx, sy + 15, T, 1);
          const bo = (ty % 2) ? 4 : 11;
          R(C.dark, sx + bo, sy, 1, 8); R(C.dark, sx + (bo + 8) % 16, sy + 8, 1, 8);
          if (hash(tx * 3.7 + ty * 9.1) > 0.7) R(C.lite, sx + 3 + hash(tx + ty) * 9, sy + 3, 2, 2);
          if (topOpen) {
            R(C.top, sx, sy, T, 5);
            R(C.topLine, sx, sy, T, 1.6);
            if (th === "toits") { R(C.dark, sx + 4, sy + 2, 1, 3); R(C.dark, sx + 11, sy + 2, 1, 3); }
            if (th === "chateau" && tx >= 139) { R("#c1273d", sx, sy, T, 3); R("#ffd75e", sx, sy + 3, T, 1); } // tapis rouge du trône
            if (th === "ville" && hash(tx * 5.3) > 0.86) R("#3c4059", sx + 5, sy + 1, 6, 2); // plaque d'égout
          } else if (th === "toits" && hash(tx * 7.9 + ty * 3.3) > 0.82 && ty > 3) {
            R("#ffd75e", sx + 5, sy + 5, 5, 7); R("#2b2349", sx + 7, sy + 5, 1, 7); // fenêtre d'immeuble
          }
        }
        if (isOneway(tx, ty)) {
          R("#8a5a2b", sx, sy, T, 5);
          R("#a86f3a", sx, sy, T, 2);
          R("#5d3a17", sx, sy + 4, T, 1);
          R("#5d3a17", sx + 2, sy + 1, 1.5, 1.5); R("#5d3a17", sx + 13, sy + 1, 1.5, 1.5);
          if (th === "ville") R(hash(tx) > 0.5 ? "#ff7ad9" : "#7ad9ff", sx, sy + 5, T, 1.2); // liseré néon
        }
        if (L.spikes.has(key2(tx, ty))) {
          R("#3a3f4d", sx, sy + 13, T, 3);
          for (let i = 0; i < 4; i++) {
            const px = sx + i * 4;
            R("#8b98a8", px, sy + 9, 3, 4); R("#c9d6e6", px + 0.5, sy + 6, 2, 3); R("#ffffff", px + 1, sy + 4, 1, 2);
          }
        }
      }
    }
    // Herses à clé
    for (const g of L.gates) {
      const gx = g.x * T - cam.x; if (gx < -30 || gx > W + 30) continue;
      const gy = g.y * T - g.open * g.h * T * 0.95;
      S.drawPortcullis(ctx, gx, gy, T, g.h * T);
      // serrure dorée
      if (!g.opening) { R("#ffd75e", gx + 5, gy + g.h * T / 2 - 3, 6, 7); R("#a86f14", gx + 7, gy + g.h * T / 2 - 1, 2, 3); }
    }
    // Herses d'arène du boss
    if (L.arenaClosed && L.spec.boss) {
      for (const colX of [L.spec.boss.arenaL, L.spec.boss.arenaR]) {
        const gx = colX * T - cam.x; if (gx < -30 || gx > W + 30) continue;
        S.drawPortcullis(ctx, gx, 5 * T, T, 9 * T);
      }
    }
    // Plateformes mobiles (échafaudages royaux motorisés... à poulies !)
    for (const m of L.movers) {
      const sx = m.x - cam.x; if (sx < -70 || sx > W + 70) continue;
      ctx.strokeStyle = "rgba(220,225,240,.5)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(sx + 4, m.y); ctx.lineTo(sx + 4, m.y - 26);
      ctx.moveTo(sx + m.w - 4, m.y); ctx.lineTo(sx + m.w - 4, m.y - 26); ctx.stroke();
      R("#596273", sx, m.y, m.w, 7);
      R("#8b98a8", sx, m.y, m.w, 2);
      R("#ff7ad9", sx, m.y + 6, m.w, 1.4);
      R("#ffd75e", sx + 3, m.y + 3, 3, 2); R("#ffd75e", sx + m.w - 6, m.y + 3, 3, 2);
    }
  }

  function surfaceFeetY(tx) {
    for (let ty = 4; ty < ROWS; ty++) if (isSolid(tx, ty)) return ty * T;
    return -1;
  }
  function drawDecor() {
    const th = L.spec.theme, t = G.t;
    const tx0 = Math.max(0, Math.floor(cam.x / T) - 1), tx1 = Math.min(L.width - 1, tx0 + 32);
    const neons = [["CAFÉ", "#ff7ad9"], ["FORGE", "#ffb35c"], ["PIZZA", "#7dff8a"], ["BAR", "#7ad9ff"], ["HÔTEL", "#ff8fa3"], ["BOULANGERIE", "#ffd75e"]];
    for (let tx = tx0; tx <= tx1; tx++) {
      const feet = surfaceFeetY(tx);
      if (feet < 0) continue;
      const sx = tx * T - cam.x;
      if (th === "ville" && tx % 11 === 5) S.drawLamp(ctx, sx + 4, feet, t + tx * 40, "#ffd75e");
      if (th === "ville" && tx % 17 === 8 && feet >= 14 * T) {
        const [word, col] = neons[Math.floor(hash(tx) * neons.length)];
        R("rgba(15,10,38,.85)", sx - 4, feet - 62, 44, 14);
        ctx.strokeStyle = col; ctx.lineWidth = 1.4; ctx.strokeRect(sx - 4, feet - 62, 44, 14);
        ctx.fillStyle = col; ctx.font = "bold 8px monospace"; ctx.textAlign = "left";
        if (Math.sin(t / 130 + tx) > -0.94) ctx.fillText(word, sx, feet - 51);
      }
      if (th === "toits" && tx % 9 === 4) { R("#6b4038", sx + 5, feet - 9, 6, 9); R("#8a5a48", sx + 4, feet - 11, 8, 3); } // cheminées
      if (th === "chateau" && tx % 8 === 3 && feet > 60) S.drawTorch(ctx, sx + 7, feet - 34, t + tx * 70);
      if (th !== "ville" && tx % 23 === 12) S.drawBanner(ctx, sx, feet, true, t + tx * 30); // bannières décoratives
    }
    // Panneaux
    for (const [sx2, sy2] of L.spec.signs || []) {
      const x = sx2 * T - cam.x; if (x < -30 || x > W + 30) continue;
      S.drawSign(ctx, x, sy2 * T);
    }
    // Checkpoints
    for (const cp of L.checkpoints) {
      const x = cp.x - cam.x; if (x < -30 || x > W + 30) continue;
      S.drawBanner(ctx, x, cp.feet, cp.active, t);
    }
    // But du niveau
    const [gx, gy] = L.spec.goal;
    const goalX = gx * T - cam.x, goalFeet = gy * T;
    if (goalX > -90 && goalX < W + 90) {
      if (L.spec.king) {
        S.drawThrone(ctx, goalX + 8, goalFeet);
        S.drawKing(ctx, goalX - 4, goalFeet, t);
        if (!L.hasCrown && Math.floor(t / 600) % 2 === 0) {
          ctx.fillStyle = "#ffd75e"; ctx.font = "bold 11px monospace"; ctx.textAlign = "center";
          ctx.fillText("!", goalX - 4, goalFeet - 34 + Math.sin(t / 200) * 1.5);
        }
      } else {
        // grande bannière royale d'arrivée
        R("#5d3a17", goalX + 7, goalFeet - 40, 2.4, 40);
        R("#ffd75e", goalX + 5, goalFeet - 43, 6, 4);
        const wv = Math.round(Math.sin(t / 220) * 2);
        R("#315fae", goalX + 10, goalFeet - 40, 17 + wv, 11);
        R("#ffd75e", goalX + 15, goalFeet - 37, 6, 6);
        R("#c1273d", goalX + 17, goalFeet - 35, 2, 2);
        if (Math.random() < 0.06) L.particles.push({ x: gx * T + 14, y: goalFeet - 24, vx: (Math.random() - 0.5) * 0.5, vy: -0.4, life: 0, max: 26, color: "#ffd75e", size: 1, grav: -0.005 });
      }
    }
  }

  function drawPickups() {
    const t = G.t;
    for (const cn of L.coins) {
      if (cn.taken) continue;
      const x = cn.x - cam.x; if (x < -16 || x > W + 16) continue;
      S.drawCoin(ctx, x, cn.y + Math.sin(t / 400 + cn.x) * 1, t + cn.x * 3);
    }
    const drawH = (ht) => {
      if (ht.taken) return;
      const x = ht.x - cam.x; if (x < -16 || x > W + 16) return;
      const Bob = Math.round(Math.sin(t / 320 + ht.x) * 1.5);
      ctx.save(); ctx.translate(x - 3, ht.y - 3 + Bob); ctx.scale(1.15, 1.15);
      S.drawHeart(ctx, 0, 0, true); ctx.restore();
    };
    L.hearts.forEach(drawH); L.droppedHearts.forEach(drawH);
    if (L.keyItem && !L.keyItem.taken) {
      const x = L.keyItem.x - cam.x;
      if (x > -20 && x < W + 20) S.drawKey(ctx, x, L.keyItem.y, t);
    }
    if (L.crownItem && !L.crownItem.taken) {
      const x = L.crownItem.x - cam.x;
      if (x > -20 && x < W + 20) S.drawCrownItem(ctx, x, L.crownItem.y, t);
    }
  }

  function drawEntities() {
    const t = G.t;
    for (const e of L.enemies) {
      if (e.dead) continue;
      const cx = e.x + e.w / 2 - cam.x, feet = e.y + e.h;
      if (cx < -50 || cx > W + 50) continue;
      // ombre
      ctx.fillStyle = "rgba(0,0,0,.30)";
      ctx.fillRect(cx - e.w / 2, feet - 1, e.w, 2);
      const total = e.type === "elite" ? 26 : e.type === "boss" ? 24 : 24;
      const atkT = e.state === "attack" ? 1 - e.timer / total : 0;
      const st = { state: e.state === "dormant" || e.state === "intro" ? "walk" : e.state, t: t + e.tSeed, flash: e.flash > 0, attackT: atkT };
      if (e.type === "garde") S.drawGuard(ctx, cx, feet, e.dir, st);
      else if (e.type === "elite") S.drawElite(ctx, cx, feet, e.dir, st);
      else if (e.type === "archer") S.drawArcher(ctx, cx, feet, e.dir, st);
      else if (e.type === "corbeau") S.drawCrow(ctx, cx, e.y + 4, e.dir, st);
      else if (e.type === "boss") {
        const bst = { ...st, state: e.state === "leapAir" ? "leap" : st.state };
        S.drawBoss(ctx, cx, feet, e.dir, bst);
        if (e.state === "stagger") { // étoiles
          ctx.fillStyle = "#ffd75e"; ctx.font = "8px monospace"; ctx.textAlign = "center";
          ctx.fillText("✦ ✦ ✦", cx, e.y - 6 + Math.sin(t / 120) * 1.5);
        }
      }
      // mini jauge de vie ennemie (hors boss)
      if (e.type !== "boss" && e.hp < e.maxHp) {
        R("rgba(10,8,25,.7)", cx - 7, e.y - (e.type === "corbeau" ? 6 : 9), 14, 3);
        R("#f43f52", cx - 6, e.y - (e.type === "corbeau" ? 5 : 8), 12 * (e.hp / e.maxHp), 1.6);
      }
    }
    // Projectiles
    for (const pr of L.projectiles) {
      const x = pr.x - cam.x;
      if (pr.type === "arrow") {
        const sgn = pr.vx > 0 ? 1 : -1;
        R("#c9a165", x, pr.y, 7, 1.6);
        R("#dfe9f5", x + (sgn > 0 ? 7 : -2), pr.y, 2, 1.6);
        R("#e84855", x + (sgn > 0 ? -1 : 6), pr.y - 1, 2, 1.4);
        R("#e84855", x + (sgn > 0 ? -1 : 6), pr.y + 1.4, 2, 1.4);
      } else {
        const fl = Math.floor(t / 90) % 2;
        R("#8a5a2b", x, pr.y + 4, 8, 4);
        R("#ff8a3d", x + 1, pr.y + 1 + fl, 6, 4);
        R("#ffd75e", x + 3, pr.y - 1 + fl, 2.4, 3);
      }
    }
    // Joueur (clignote pendant l'invulnérabilité)
    if (!P.dead) {
      const blink = P.invuln > 0 && Math.floor(t / 70) % 2 === 0 && P.dashTimer <= 0;
      if (!blink) {
        const cx = P.x + P.w / 2 - cam.x, feet = P.y + P.h;
        ctx.fillStyle = "rgba(0,0,0,.30)"; ctx.fillRect(cx - 5, feet - 1, 10, 2);
        let state = "idle", attackT = 0;
        if (P.attackTimer > 0) { state = "attack"; attackT = 1 - P.attackTimer / 12; }
        else if (P.dashTimer > 0) state = "dash";
        else if (!P.onGround) state = "air";
        else if (Math.abs(P.vx) > 0.25) state = "run";
        S.drawPlayer(ctx, cx, feet, P.dir, { state, t, attackT, flash: P.hurtFlash > 8 });
        if (L.hasCrown) S.drawCrownItem(ctx, cx - P.dir * 2, P.y - 9, t); // la couronne portée fièrement !
        if (state === "attack") { // arc lumineux de l'épée
          ctx.strokeStyle = "rgba(190,230,255,.75)"; ctx.lineWidth = 2;
          ctx.beginPath();
          const a0 = P.dir > 0 ? -1.7 : Math.PI + 1.7, a1 = P.dir > 0 ? 0.7 : Math.PI - 0.7;
          ctx.arc(cx + P.dir * 5, feet - 11, 12, Math.min(a0, a1) + Math.abs(a1 - a0) * attackT * 0.6, Math.min(a0, a1) + Math.abs(a1 - a0) * (0.25 + attackT * 0.6), false);
          ctx.stroke();
        }
      }
    }
  }

  function drawParticles() {
    for (const p of L.particles) {
      const a = 1 - p.life / p.max;
      ctx.globalAlpha = Math.max(0, a);
      R(p.color, p.x - cam.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    ctx.font = "bold 7px monospace"; ctx.textAlign = "left";
    for (const tx of L.texts) {
      ctx.globalAlpha = Math.max(0, 1 - tx.life / 48);
      ctx.fillStyle = "#14102a"; ctx.fillText(tx.txt, tx.x - cam.x + 1, tx.y + 1);
      ctx.fillStyle = tx.color; ctx.fillText(tx.txt, tx.x - cam.x, tx.y);
    }
    ctx.globalAlpha = 1;
  }

  function drawHUD() {
    if (G.state === "title") return;
    R("rgba(12,8,30,.62)", 4, 4, 150, 22);
    ctx.strokeStyle = "rgba(255,215,94,.5)"; ctx.lineWidth = 1; ctx.strokeRect(4, 4, 150, 22);
    for (let i = 0; i < P.maxHp; i++) {
      ctx.save(); ctx.translate(8 + i * 11, 8); ctx.scale(1.3, 1.3);
      S.drawHeart(ctx, 0, 0, i < P.hp); ctx.restore();
    }
    S.drawCoin(ctx, 72, 15, G.t);
    ctx.fillStyle = "#fff"; ctx.font = "bold 9px monospace"; ctx.textAlign = "left";
    ctx.fillText("×" + G.stats.coins, 78, 18);
    if (L.hasKey) S.drawKey(ctx, 112, 15, 0);
    if (L.hasCrown) S.drawCrownItem(ctx, 132, 15, 0);
    // chapitre + chrono
    ctx.textAlign = "right"; ctx.font = "bold 8px monospace";
    ctx.fillStyle = "rgba(12,8,30,.62)"; ctx.fillRect(W - 118, 4, 114, 15);
    ctx.fillStyle = "#ffd75e";
    ctx.fillText(L.spec.chap + "  •  " + fmtTime(G.stats.time), W - 8, 15);
    ctx.textAlign = "left";
    // flash rouge si blessé
    if (P.hurtFlash > 0) {
      ctx.fillStyle = "rgba(244,63,82," + (P.hurtFlash / 14 * 0.14) + ")";
      ctx.fillRect(0, 0, W, H);
    }
    if (P.hp === 1 && G.state === "playing" && Math.sin(G.t / 180) > 0) {
      ctx.strokeStyle = "rgba(244,63,82,.8)"; ctx.lineWidth = 3; ctx.strokeRect(1, 1, W - 2, H - 2);
    }
  }

  function draw() {
    if (!L || !P) return;
    ctx.save();
    if (G.shake > 0.2) ctx.translate((Math.random() - 0.5) * G.shake, (Math.random() - 0.5) * G.shake);
    drawBackground();
    drawDecor();
    drawTiles();
    drawPickups();
    drawEntities();
    drawParticles();
    ctx.restore();
    drawHUD();
  }

  /* ---------------- Écrans / flux de jeu ---------------- */
  function show(id) {
    document.querySelectorAll(".screen").forEach((el) => el.classList.add("hidden"));
    if (id) $(id).classList.remove("hidden");
  }
  function newGame() {
    AU.unlock(); AU.sfx.ui();
    G.stats = { coins: 0, kills: 0, deaths: 0, time: 0 };
    localStorage.removeItem("epeeNeonsSave");
    showLevelIntro(0);
  }
  function continueGame() {
    const save = loadProgress();
    if (!save) return newGame();
    AU.unlock(); AU.sfx.ui();
    G.stats = { coins: save.coins || 0, kills: save.kills || 0, deaths: save.deaths || 0, time: save.time || 0 };
    showLevelIntro(clamp(save.level, 0, window.LEVELS.length - 1));
  }
  function showLevelIntro(idx) {
    loadLevel(idx);
    G.state = "intro";
    $("level-num").textContent = L.spec.chap + " / " + window.LEVELS.length;
    $("level-name").textContent = L.spec.name;
    $("level-desc").textContent = L.spec.desc;
    show("screen-level");
    AU.playMusic("title");
  }
  $("screen-level").addEventListener("pointerdown", () => { if (G.state === "intro") beginLevel(); });
  function beginLevel() {
    jumpQueued = 0; attackQueued = false; dashQueued = false;
    G.state = "playing"; show(null);
    AU.playMusic("level");
  }
  function pauseGame() { G.state = "paused"; show("screen-pause"); AU.stopMusic(); }
  function resumeGame() {
    G.state = "playing"; show(null);
    AU.playMusic(L && L.bossActive && !L.bossDead ? "boss" : "level");
  }
  function retryLevel() {
    G.stats = { ...G.snapshot };
    loadLevel(G.levelIndex);
    G.state = "playing"; show(null);
    AU.playMusic("level");
  }
  function gameOver() {
    G.state = "over"; show("screen-over");
    AU.sfx.gameOver(); AU.stopMusic(); hideBossBar();
  }
  function completeLevel() {
    G.state = "clear";
    AU.sfx.fanfare(); AU.playMusic("title");
    $("clear-stats").innerHTML =
      "Écus du chapitre : <b>" + L.coinsGot + " / " + L.coinsTotal + "</b> 🪙<br>" +
      "Écus totaux : <b>" + G.stats.coins + "</b> • Gardes vaincus : <b>" + G.stats.kills + "</b><br>" +
      "Temps : <b>" + fmtTime(G.stats.time) + "</b> • Chutes : <b>" + G.stats.deaths + "</b>";
    show("screen-clear");
    saveProgress(G.levelIndex + 1);
  }
  function nextLevel() { AU.sfx.ui(); showLevelIntro(G.levelIndex + 1); }
  function victory() {
    G.state = "win";
    AU.sfx.victory(); AU.playMusic("title"); hideBossBar();
    for (let i = 0; i < 5; i++)
      setTimeout(() => L && burst(P.x + (Math.random() - 0.5) * 120, P.y - 40 - Math.random() * 40, 22, ["#ffd75e", "#ff7ad9", "#7ad9ff", "#7dff8a"], 1.8, 45, 0.03), i * 220);
    const coinPct = G.stats.coins / Math.max(1, totalCoinsAll);
    let score = coinPct * 60 + Math.max(0, 25 - G.stats.deaths * 1.6) + Math.max(0, 15 - G.stats.time / 3600);
    const rank = score >= 88 ? "🏆 RANG S — CHEVALIER LÉGENDAIRE !" : score >= 72 ? "🥇 RANG A — CHEVALIER DU ROI !" : score >= 54 ? "🥈 RANG B — ÉCUYER MÉRITANT" : "🥉 RANG C — ÉCUYER COURAGEUX";
    $("win-stats").innerHTML =
      "🪙 Écus : <b>" + G.stats.coins + " / " + totalCoinsAll + "</b><br>" +
      "⚔️ Ennemis vaincus : <b>" + G.stats.kills + "</b> • Chutes : <b>" + G.stats.deaths + "</b><br>" +
      "⏱ Temps de quête : <b>" + fmtTime(G.stats.time) + "</b>";
    $("win-rank").textContent = rank;
    show("screen-win");
    localStorage.removeItem("epeeNeonsSave");
    const best = JSON.parse(localStorage.getItem("epeeNeonsBest") || "null");
    if (!best || score > best.score)
      localStorage.setItem("epeeNeonsBest", JSON.stringify({ score: Math.round(score), rank, coins: G.stats.coins, time: G.stats.time }));
    refreshTitleButtons();
  }
  function goTitle() {
    G.state = "title"; show("screen-title");
    hideBossBar(); clearToast();
    loadLevel(0);
    AU.playMusic("title");
    refreshTitleButtons();
  }

  /* ---------------- Sauvegarde ---------------- */
  function saveProgress(nextLevel) {
    if (nextLevel >= window.LEVELS.length) return;
    localStorage.setItem("epeeNeonsSave", JSON.stringify({
      level: nextLevel, coins: G.stats.coins, kills: G.stats.kills, deaths: G.stats.deaths, time: G.stats.time,
    }));
  }
  function loadProgress() {
    try { return JSON.parse(localStorage.getItem("epeeNeonsSave") || "null"); }
    catch (e) { return null; }
  }
  function refreshTitleButtons() {
    const save = loadProgress();
    $("btn-continue").classList.toggle("hidden", !(save && save.level > 0));
    if (save) $("btn-continue").textContent = "↪ CONTINUER — CHAPITRE " + (save.level + 1);
    const best = JSON.parse(localStorage.getItem("epeeNeonsBest") || "null");
    if (best) {
      $("best-score").textContent = "🏅 Meilleure quête : " + best.rank.split("—")[0].trim() + " • " + best.coins + " écus • " + fmtTime(best.time);
      $("best-score").classList.remove("hidden");
    } else $("best-score").classList.add("hidden");
  }

  /* ---------------- Boutons UI ---------------- */
  function openHelp() {
    G.helpReturn = G.state;
    if (G.state === "playing") AU.stopMusic();
    G.state = "help"; show("screen-help");
  }
  function closeHelp() {
    if (G.helpReturn === "playing" || G.helpReturn === "paused") { G.state = "paused"; show("screen-pause"); }
    else { G.state = "title"; show("screen-title"); AU.playMusic("title"); }
  }
  function toggleMute() {
    const m = AU.toggleMute();
    $("btn-sound").textContent = m ? "🔇" : "🔊";
  }
  $("btn-play").onclick = newGame;
  $("btn-continue").onclick = continueGame;
  $("btn-how").onclick = openHelp;
  $("btn-help").onclick = openHelp;
  document.querySelector(".btn-close-help").onclick = closeHelp;
  $("btn-resume").onclick = resumeGame;
  $("btn-restart").onclick = retryLevel;
  $("btn-quit").onclick = goTitle;
  $("btn-retry").onclick = retryLevel;
  $("btn-over-title").onclick = goTitle;
  $("btn-next").onclick = nextLevel;
  $("btn-again").onclick = newGame;
  $("btn-win-title").onclick = goTitle;
  $("btn-sound").onclick = () => { AU.unlock(); toggleMute(); };
  $("btn-sound").textContent = AU.isMuted() ? "🔇" : "🔊";
  $("btn-full").onclick = () => {
    const stage = $("stage");
    if (document.fullscreenElement) document.exitFullscreen();
    else if (stage.requestFullscreen) stage.requestFullscreen();
  };
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && G.state === "playing") pauseGame();
  });
  window.addEventListener("blur", () => { input.left = false; input.right = false; input.jumpHeld = false; });
  window.addEventListener("pointerdown", () => {
    AU.unlock();
    if (G.state === "title") AU.playMusic("title");
  }, { once: true });

  /* Crochet de débogage (tests automatisés) — actif seulement avec ?debug */
  if ((window.location && window.location.search || "").includes("debug")) {
    window.__EPEE__ = {
      get G() { return G; }, get L() { return L; }, get P() { return P; },
      loadLevel, beginLevel, newGame, damageEnemy, hurtPlayer,
      teleport(tx, feetTy) { P.x = tx * T + 3; P.y = feetTy * T - P.h; P.vx = 0; P.vy = 0; P.hp = P.maxHp; P.invuln = 30; cam.x = clamp(P.x - W / 2, 0, L.width * T - W); },
    };
  }

  /* ---------------- Boucle principale ---------------- */
  loadLevel(0);
  G.state = "title";
  show("screen-title");
  refreshTitleButtons();

  let last = performance.now(), acc = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = now - last; last = now;
    if (dt > 120) dt = 120;
    acc += dt;
    const STEP = 1000 / 60;
    while (acc >= STEP) {
      if (G.hitStop > 0) { G.hitStop--; }
      else update();
      acc -= STEP;
    }
    draw();
  }
  requestAnimationFrame(frame);
})();
