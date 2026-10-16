/* ============================================================
   ÉPÉE & NÉONS — Définition des 3 chapitres.
   Coordonnées en TUILES (16 px). Hauteur du monde : 17 tuiles.
   solids  : [x, y, largeur, hauteur]
   oneways : [x, y, largeur]  (plateformes qu'on traverse par en bas)
   spikes  : [x, y, largeur]  (piques posées sur le sol de la ligne y+1)
   enemies : [type, x, yPieds]  (yPieds = ligne du sol sous les pieds)
   coins   : [x, y, nombre, pasX, hauteurArc]
   ============================================================ */
(function () {
  "use strict";

  const LEVELS = [
    /* ---------------- CHAPITRE 1 : LA VILLE ---------------- */
    {
      name: "Les Rues de Valnéon",
      chap: "CHAPITRE 1",
      desc: "Entre néons et pavés, les gardes renégats patrouillent. Fonce, écuyer — le château est au bout de l'avenue royale !",
      theme: "ville",
      width: 150,
      spawn: [2, 14],
      goal: [146, 14],
      solids: [
        [0, 14, 27, 3], [30, 14, 19, 3], [52, 14, 24, 3],
        [80, 14, 26, 3], [106, 14, 27, 3], [136, 14, 14, 3],
        [12, 13, 2, 1], [14, 12, 2, 2],                  // caisses / marches
        [35, 13, 2, 1], [37, 12, 2, 2], [39, 11, 2, 3],  // escalier de chantier
        [100, 0, 1, 11],                                  // mur de la herse royale
        [139, 13, 2, 1], [141, 12, 2, 2],
        [148, 4, 2, 10],                                  // tour de la porte du château
      ],
      oneways: [
        [11, 10, 5], [20, 11, 4], [27, 12, 3], [42, 9, 4], [49, 11, 3],
        [55, 11, 4], [61, 11, 6], [84, 11, 3], [88, 9, 3], [91, 7, 4],
        [112, 11, 4], [118, 9, 4], [126, 12, 4], [133, 12, 3],
      ],
      spikes: [[62, 13, 4]],
      gates: [{ x: 100, y: 11, h: 3 }],
      movers: [{ x: 76, y: 13, w: 3, axis: "x", range: 1, speed: 0.55 }],
      key: [93, 6],
      hearts: [[43, 8], [120, 8]],
      checkpoints: [[52, 14], [107, 14]],
      enemies: [
        ["garde", 18, 14], ["garde", 33, 14], ["garde", 58, 14], ["archer", 56, 11],
        ["garde", 71, 14], ["garde", 85, 14], ["archer", 89, 9], ["elite", 96, 14],
        ["corbeau", 97, 8], ["garde", 111, 14], ["corbeau", 117, 7], ["elite", 122, 14],
        ["archer", 127, 12], ["garde", 140, 14],
      ],
      coins: [
        [11, 9, 4, 1, 0], [21, 10, 3, 1, 0], [27, 12, 3, 1, 0.8], [42, 8, 3, 1, 0],
        [49, 10, 3, 1, 0.6], [62, 10, 4, 1, 0], [76, 11, 4, 1, 0.7], [84, 10, 3, 1, 0],
        [91, 6, 2, 1, 0], [112, 10, 3, 1, 0], [118, 8, 4, 1, 0], [133, 11, 3, 1, 0.5],
        [5, 12, 3, 1, 0], [137, 12, 3, 1, 0],
      ],
      signs: [
        [4, 14, "🪧 Bienvenue à Valnéon ! ← → (ou Q D) pour courir."],
        [10, 14, "🪧 ESPACE pour sauter. Encore ESPACE en l'air = DOUBLE SAUT !"],
        [16, 14, "🪧 Un garde renégat ! Touche J / X pour frapper à l'épée. K = dash."],
        [81, 14, "🪧 Herse royale fermée. La clé brille en hauteur, vers l'Est... 🗝️"],
        [109, 14, "🪧 Les élites bloquent de face 🛡️ : frappe dans le dos ou en sautant !"],
      ],
    },

    /* ---------------- CHAPITRE 2 : LES TOITS ---------------- */
    {
      name: "Toits & Remparts",
      chap: "CHAPITRE 2",
      desc: "La nuit tombe sur Valnéon. Par les toits et les remparts, rejoins la tour du château. Gare aux corbeaux de Corvus !",
      theme: "toits",
      width: 170,
      spawn: [2, 12],
      goal: [166, 9],
      solids: [
        [0, 12, 16, 5], [19, 11, 14, 6], [37, 9, 12, 8], [54, 13, 15, 4],
        [72, 10, 16, 7], [92, 12, 13, 5], [105, 11, 3, 6], [108, 9, 3, 8],
        [111, 8, 14, 9], [129, 13, 12, 4], [145, 11, 15, 6], [163, 9, 7, 8],
        [84, 0, 1, 7],                                     // mur de la herse des remparts
      ],
      oneways: [
        [8, 9, 4], [33, 10, 3], [23, 8, 4], [40, 6, 4], [59, 10, 6], [69, 11, 3],
        [74, 8, 3], [78, 6, 3], [95, 9, 4], [115, 5, 4], [125, 10, 2], [127, 12, 2],
        [132, 10, 6], [148, 8, 4], [160, 10, 3],
      ],
      spikes: [[25, 10, 3], [60, 12, 4], [133, 12, 4]],
      gates: [{ x: 84, y: 7, h: 3 }],
      movers: [
        { x: 50, y: 10, w: 3, axis: "y", range: 2.6, speed: 0.5 },
        { x: 88, y: 11, w: 3, axis: "x", range: 1.2, speed: 0.6 },
        { x: 141, y: 12, w: 3, axis: "x", range: 1.2, speed: 0.65 },
      ],
      key: [79, 5],
      hearts: [[42, 5], [103, 10], [150, 7]],
      checkpoints: [[20, 11], [55, 13], [93, 12], [130, 13], [146, 11]],
      enemies: [
        ["garde", 12, 12], ["archer", 29, 11], ["corbeau", 34, 6], ["garde", 44, 9],
        ["garde", 56, 13], ["elite", 66, 13], ["archer", 75, 10], ["corbeau", 81, 5],
        ["elite", 82, 10], ["garde", 98, 12], ["archer", 114, 8], ["elite", 120, 8],
        ["corbeau", 126, 7], ["garde", 131, 13], ["archer", 134, 10], ["elite", 152, 11],
        ["garde", 157, 11], ["corbeau", 161, 6],
      ],
      coins: [
        [8, 8, 4, 1, 0], [16, 10, 3, 1, 0.8], [23, 7, 4, 1, 0], [40, 5, 3, 1, 0],
        [50, 8, 3, 1, 0.5], [60, 9, 4, 1, 0], [69, 10, 3, 1, 0.6], [74, 7, 2, 1, 0],
        [88, 9, 4, 1, 0.6], [95, 8, 4, 1, 0], [115, 4, 4, 1, 0], [125, 9, 2, 1, 0],
        [132, 9, 4, 1, 0], [141, 10, 4, 1, 0.6], [148, 7, 3, 1, 0], [160, 9, 3, 1, 0.5],
      ],
      signs: [
        [3, 12, "🪧 Par les toits, vite ! Tomber coûte 1 ❤️ et renvoie à la dernière bannière."],
        [73, 10, "🪧 Herse des remparts. La clé est perchée là-haut, gardée par un corbeau..."],
        [112, 8, "🪧 Le chemin de ronde. Le château est proche, tiens bon, écuyer !"],
      ],
    },

    /* ---------------- CHAPITRE 3 : LE CHÂTEAU ---------------- */
    {
      name: "Le Château du Roi",
      chap: "CHAPITRE 3",
      desc: "Corvus s'est barricadé dans la grande salle avec la Couronne d'Or. Reprends le château, affronte le Capitaine... et rends la couronne au roi Aldéric III !",
      theme: "chateau",
      width: 155,
      spawn: [2, 14],
      goal: [147, 11],
      king: true,
      boss: { triggerX: 102, bossX: 122, bossY: 14, arenaL: 100, arenaR: 131 },
      solids: [
        [0, 14, 38, 3], [38, 14, 30, 3], [71, 14, 28, 3], [99, 14, 34, 3],
        [34, 0, 1, 11],                                    // mur de la herse de la cour
        [133, 13, 3, 4], [136, 12, 3, 5], [139, 11, 16, 6], // estrade du trône
        [154, 2, 1, 9],
      ],
      oneways: [
        [18, 11, 3], [22, 9, 3], [26, 7, 3], [42, 10, 5], [52, 8, 5], [60, 11, 4],
        [68, 12, 3], [80, 11, 3], [84, 9, 3], [91, 10, 3],
      ],
      spikes: [[55, 13, 4], [87, 13, 3]],
      gates: [{ x: 34, y: 11, h: 3 }],
      movers: [],
      key: [27, 6],
      hearts: [[54, 7], [85, 8], [97, 12]],
      checkpoints: [[38, 14], [72, 14], [95, 14]],
      enemies: [
        ["garde", 10, 14], ["garde", 16, 14], ["archer", 23, 9], ["elite", 30, 14],
        ["garde", 40, 14], ["archer", 44, 10], ["elite", 49, 14], ["garde", 63, 14],
        ["corbeau", 66, 8], ["elite", 76, 14], ["archer", 92, 10], ["garde", 79, 14],
      ],
      coins: [
        [18, 10, 3, 1, 0], [26, 6, 2, 1, 0], [42, 9, 4, 1, 0], [52, 7, 4, 1, 0],
        [60, 10, 3, 1, 0], [68, 11, 3, 1, 0.6], [80, 10, 3, 1, 0], [91, 9, 3, 1, 0],
        [5, 12, 4, 1, 0], [134, 11, 3, 1, 0], [140, 9, 4, 1, 0],
      ],
      signs: [
        [4, 14, "🪧 Cour du château. La clé de la herse est dans la tour de garde, en hauteur."],
        [73, 14, "🪧 La grande salle est proche... On entend Corvus aiguiser sa lame."],
        [96, 14, "🪧 ⚠️ Capitaine CORVUS droit devant. Esquive sa charge, frappe quand il chancelle !"],
      ],
    },
  ];

  window.LEVELS = LEVELS;
})();
