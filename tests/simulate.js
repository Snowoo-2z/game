/* Test de simulation headless : charge le jeu avec un faux DOM,
   joue des entrées clavier et vérifie le déroulement complet
   (niveaux, clé/herse, boss, couronne, victoire).
   Usage : node tests/simulate.js            */
"use strict";
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");

/* ---------- Faux DOM ---------- */
function makeEl(id) {
  const classes = new Set();
  return {
    id, style: {}, dataset: {}, textContent: "", innerHTML: "",
    width: 480, height: 272,
    classList: {
      add: (c) => classes.add(c), remove: (c) => classes.delete(c),
      toggle: (c, f) => { f ? classes.add(c) : classes.delete(c); }, contains: (c) => classes.has(c),
    },
    addEventListener: () => {}, requestFullscreen: () => {},
    getContext: () => ctx2d,
  };
}
const ctx2d = new Proxy({}, {
  get(t, p) { if (p in t) return t[p]; return () => {}; },
  set(t, p, v) { t[p] = v; return true; },
});
const els = {};
const elById = (id) => (els[id] = els[id] || makeEl(id));
const screens = ["screen-title", "screen-help", "screen-level", "screen-pause", "screen-over", "screen-clear", "screen-win"].map(elById);

const store = {};
let rafCb = null;
const winListeners = {};

global.window = global;
global.location = { search: "?debug" };
global.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};
global.document = {
  getElementById: elById,
  querySelectorAll: (sel) => (sel === ".screen" ? screens : []),
  querySelector: () => makeEl("q"),
  addEventListener: () => {},
  hidden: false,
};
global.requestAnimationFrame = (cb) => { rafCb = cb; };
global.addEventListener = (name, fn) => { (winListeners[name] = winListeners[name] || []).push(fn); };

const keyEvent = (type, code) => winListeners[type].forEach((fn) => fn({ code, repeat: false, preventDefault: () => {} }));
const down = (code) => keyEvent("keydown", code);
const up = (code) => keyEvent("keyup", code);

let clock = 0;
function frames(n) { for (let i = 0; i < n; i++) { clock += 1000 / 60; const cb = rafCb; rafCb = null; cb(1000 + clock); } }

function check(cond, label) {
  if (!cond) throw new Error("ÉCHEC: " + label);
  console.log("  ✓", label);
}

/* ---------- Chargement du jeu ---------- */
eval(fs.readFileSync(path.join(root, "js/audio.js"), "utf8"));
eval(fs.readFileSync(path.join(root, "js/sprites.js"), "utf8"));
eval(fs.readFileSync(path.join(root, "js/levels.js"), "utf8"));
eval(fs.readFileSync(path.join(root, "js/game.js"), "utf8"));
const D = global.__EPEE__;
check(!!D, "crochet debug présent");
frames(5);
check(D.G.state === "title", "écran titre affiché");

console.log("▶ Chapitre 1 : course, sauts, combat");
down("Enter"); up("Enter");
check(D.G.state === "intro", "intro chapitre 1");
down("Enter"); up("Enter");
check(D.G.state === "playing", "partie lancée");
const startX = D.P.x;
let maxX = startX;
down("KeyD");
for (let i = 0; i < 700; i++) {
  if (i % 45 === 0) { down("Space"); setTimeout(() => {}, 0); up("Space"); }
  if (i % 25 === 0) { down("KeyJ"); up("KeyJ"); }
  if (i % 90 === 0) { down("KeyK"); up("KeyK"); }
  frames(1);
  maxX = Math.max(maxX, D.P.x);
  if (D.G.state === "over") { down("Enter"); up("Enter"); frames(2); } // retry auto
  if (D.G.state !== "playing" && D.G.state !== "over") break;
}
up("KeyD");
console.log("   avance max x:", Math.round(maxX), "(départ", Math.round(startX) + ") pv:", D.P.hp, "écus:", D.G.stats.coins, "kills:", D.G.stats.kills);
check(maxX > startX + 120, "le héros a bien avancé dans la ville");

console.log("▶ Clé + herse (chapitre 1)");
D.loadLevel(0); D.beginLevel(); frames(2);
D.teleport(93, 7); frames(30); // tombe sur la plateforme de la clé
check(D.L.hasKey, "clé royale ramassée");
D.teleport(98, 14); frames(80); // marche vers la herse
down("KeyD"); frames(90); up("KeyD");
check(D.L.gates[0].opening, "la herse s'ouvre avec la clé");
frames(80);
down("KeyD"); frames(120); up("KeyD");
check(D.P.x > 100 * 16, "le héros a franchi la herse");

console.log("▶ Fin de niveau -> chapitre suivant");
D.teleport(145, 14); frames(30);
check(D.G.state === "clear", "chapitre 1 accompli");
down("Enter"); up("Enter");
check(D.G.state === "intro" && D.G.levelIndex === 1, "intro chapitre 2");
D.beginLevel(); frames(180);
check(D.G.state === "playing", "chapitre 2 jouable (toits)");

console.log("▶ Clé + herse des remparts (chapitre 2)");
D.teleport(79, 6); frames(25);
check(D.L.hasKey, "clé des remparts ramassée");
D.teleport(81, 10); down("KeyD"); frames(100); up("KeyD");
check(D.L.gates[0].opening, "herse des remparts ouverte");
D.teleport(166, 9); frames(25);
check(D.G.state === "clear", "chapitre 2 accompli");
down("Enter"); up("Enter");
check(D.G.levelIndex === 2 && D.G.state === "intro", "intro chapitre 3");

console.log("▶ Clé + herse de la cour (chapitre 3)");
D.beginLevel(); frames(2);
D.teleport(27, 7); frames(25);
check(D.L.hasKey, "clé de la cour ramassée");
D.teleport(31, 14); down("KeyD"); frames(110); up("KeyD");
check(D.L.gates[0].opening, "herse de la cour ouverte");

console.log("▶ Boss : Capitaine Corvus (chapitre 3)");
D.loadLevel(2); D.beginLevel(); frames(2);
D.teleport(96, 14); frames(20);
D.teleport(104, 14); frames(30);
check(D.L.bossActive, "combat de boss déclenché");
check(D.L.arenaClosed, "arène fermée par les herses");
const boss = D.L.boss;
let guard = 0;
while (!boss.dead && guard++ < 400) {
  // se placer près du boss, frapper via le vrai système de dégâts
  D.P.x = boss.x - 20; D.P.y = boss.y; D.P.hp = 5; D.P.invuln = 30;
  down("KeyJ"); up("KeyJ"); frames(14);
}
check(boss.dead, "Corvus vaincu");
check(D.L.bossDead && !D.L.arenaClosed, "arène rouverte");
check(D.L.crownItem && !D.L.crownItem.taken, "la Couronne d'Or est tombée");
D.teleport(Math.floor(D.L.crownItem.x / 16), 14); frames(40);
check(D.L.hasCrown, "couronne ramassée");

console.log("▶ Retour au Roi -> victoire");
D.teleport(146, 11); frames(30);
check(D.G.state === "win", "VICTOIRE auprès du roi Aldéric III 👑");
down("Enter"); up("Enter"); frames(5);
check(D.G.state === "title", "retour au titre");

console.log("▶ Game over + retry");
D.newGame(); D.beginLevel(); frames(2);
for (let i = 0; i < 5; i++) { D.P.invuln = 0; D.hurtPlayer(D.P.x + 50); frames(3); }
frames(80);
check(D.G.state === "over", "game over après 5 coups");
down("Enter"); up("Enter"); frames(5);
check(D.G.state === "playing" && D.P.hp === 5, "retry : vie restaurée");

console.log("▶ Pause");
down("KeyP"); up("KeyP");
check(D.G.state === "paused", "pause OK");
down("Enter"); up("Enter");
check(D.G.state === "playing", "reprise OK");

console.log("\n✅ TOUS LES TESTS PASSENT");
process.exit(0);
