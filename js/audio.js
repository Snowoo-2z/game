/* ============================================================
   ÉPÉE & NÉONS — Moteur audio 8-bit (WebAudio, aucun fichier)
   Sons synthétisés + petite musique médiévale chiptune.
   ============================================================ */
(function () {
  "use strict";
  let ctx = null, master = null, musicGain = null, sfxGain = null;
  let muted = localStorage.getItem("epeeNeonsMuted") === "1";
  let musicTimer = null, step = 0, currentTrack = null;

  function ensure() {
    if (ctx) { if (ctx.state === "suspended") ctx.resume(); return true; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = muted ? 0 : 0.9; master.connect(ctx.destination);
      musicGain = ctx.createGain(); musicGain.gain.value = 0.34; musicGain.connect(master);
      sfxGain = ctx.createGain(); sfxGain.gain.value = 0.9; sfxGain.connect(master);
      return true;
    } catch (e) { return false; }
  }

  function tone(freq, dur, type, vol, slideTo, dest, delay) {
    if (!ensure()) return;
    const t = ctx.currentTime + (delay || 0);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || "square"; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol || 0.15, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(dest || sfxGain);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function noise(dur, vol, freq, slideTo, delay) {
    if (!ensure()) return;
    const t = ctx.currentTime + (delay || 0);
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.Q.value = 1.1;
    f.frequency.setValueAtTime(freq || 1800, t);
    if (slideTo) f.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(sfxGain);
    src.start(t);
  }

  /* ---------- Effets sonores ---------- */
  const SFX = {
    jump()      { tone(280, 0.14, "square", 0.10, 620); },
    doubleJump(){ tone(420, 0.13, "square", 0.10, 900); noise(0.08, 0.05, 2400, 900); },
    dash()      { noise(0.16, 0.16, 900, 2600); },
    slash()     { noise(0.10, 0.22, 3200, 700); },
    hit()       { tone(180, 0.09, "square", 0.16, 70); noise(0.08, 0.14, 1400, 300); },
    clang()     { tone(1350, 0.12, "square", 0.10, 900); tone(2080, 0.09, "square", 0.07, 1400); },
    kill()      { tone(520, 0.20, "square", 0.14, 60); noise(0.18, 0.16, 900, 120); },
    hurt()      { tone(220, 0.18, "sawtooth", 0.16, 80); },
    coin()      { tone(988, 0.07, "square", 0.10); tone(1319, 0.16, "square", 0.10, null, null, 0.06); },
    heart()     { tone(659, 0.09, "triangle", 0.16); tone(880, 0.14, "triangle", 0.16, null, null, 0.08); },
    key()       { [784, 988, 1175, 1568].forEach((n, i) => tone(n, 0.11, "square", 0.10, null, null, i * 0.07)); },
    gate()      { noise(0.45, 0.18, 300, 90); tone(90, 0.45, "sawtooth", 0.10, 55); },
    checkpoint(){ [523, 659, 784].forEach((n, i) => tone(n, 0.12, "triangle", 0.15, null, null, i * 0.07)); },
    arrow()     { noise(0.09, 0.09, 2600, 1200); },
    arrowBreak(){ noise(0.07, 0.14, 2000, 500); tone(700, 0.05, "square", 0.08, 200); },
    slam()      { tone(70, 0.30, "sine", 0.35, 35); noise(0.25, 0.25, 400, 70); },
    bossRoar()  { tone(110, 0.55, "sawtooth", 0.22, 65); tone(165, 0.55, "sawtooth", 0.12, 90, null, 0.05); },
    fanfare()   { [523, 523, 523, 659, 784, 1047].forEach((n, i) => tone(n, i === 5 ? 0.5 : 0.13, "square", 0.11, null, null, i * 0.11)); },
    victory()   { [523, 659, 784, 1047, 784, 1047, 1319, 1568].forEach((n, i) => tone(n, i === 7 ? 0.7 : 0.14, "square", 0.11, null, null, i * 0.12)); },
    gameOver()  { [392, 370, 349, 311].forEach((n, i) => tone(n, 0.24, "triangle", 0.16, null, null, i * 0.18)); },
    ui()        { tone(700, 0.05, "square", 0.07, 900); },
  };

  /* ---------- Musique (boucles chiptune) ---------- */
  // Notes en Hz — mélodies en mode dorien pour l'ambiance médiévale.
  const N = { R:0, D3:147, E3:165, F3:175, G3:196, A3:220, B3:247, C4:262, D4:294, E4:330, F4:349, G4:392, A4:440, B4:494, C5:523, D5:587, E5:659,
              A2:110, C3:131, G2:98, F2:87, E3b:156 };
  const TRACKS = {
    title: {
      tempo: 240, // ms par pas
      lead: ["D4","R","F4","R","E4","R","D4","C4","D4","R","A3","R","D4","R","R","R",
             "D4","R","F4","R","G4","R","F4","E4","F4","E4","D4","C4","D4","R","R","R"],
      bass: ["D3","R","R","R","A2","R","R","R","F2","R","R","R","A2","R","R","R",
             "D3","R","R","R","A2","R","R","R","C3","R","R","R","D3","R","R","R"],
    },
    level: {
      tempo: 205,
      lead: ["A3","R","C4","D4","E4","R","D4","C4","D4","E4","G4","E4","D4","C4","D4","R",
             "A3","R","C4","D4","E4","R","G4","E4","A4","G4","E4","D4","C4","D4","E4","R",
             "F4","R","E4","F4","G4","R","F4","E4","D4","E4","F4","D4","E4","R","R","R",
             "A3","R","C4","D4","E4","D4","C4","D4","B3","R","C4","D4","A3","R","R","R"],
      bass: ["A2","R","A2","R","E3","R","E3","R","F2","R","F2","R","G2","R","G2","R",
             "A2","R","A2","R","E3","R","E3","R","F2","R","G2","R","A2","R","A2","R",
             "D3","R","D3","R","A2","R","A2","R","F2","R","F2","R","E3","R","E3","R",
             "A2","R","A2","R","E3","R","E3","R","G2","R","G2","R","A2","R","A2","R"],
    },
    boss: {
      tempo: 160,
      lead: ["D4","D4","R","D4","F4","R","E4","R","D4","D4","R","D4","C4","R","B3","R",
             "D4","D4","R","D4","G4","R","F4","R","E4","F4","E4","D4","C4","B3","D4","R"],
      bass: ["D3","R","D3","R","D3","R","D3","R","C3","R","C3","R","B3","R","B3","R",
             "D3","R","D3","R","D3","R","D3","R","A2","R","A2","R","A2","R","A2","R"],
    },
  };

  function playMusic(name) {
    if (currentTrack === name) return;
    stopMusic();
    currentTrack = name;
    if (!name || !TRACKS[name]) return;
    if (!ensure()) return;
    step = 0;
    const track = TRACKS[name];
    musicTimer = setInterval(() => {
      if (muted || !ctx) return;
      const l = track.lead[step % track.lead.length];
      const b = track.bass[step % track.bass.length];
      if (l && N[l]) tone(N[l], track.tempo / 1000 * 0.95, "square", 0.055, null, musicGain);
      if (b && N[b]) tone(N[b], track.tempo / 1000 * 0.95, "triangle", 0.11, null, musicGain);
      if (step % 4 === 2) noise(0.03, 0.012, 6000, 4000); // petit "tambourin"
      step++;
    }, track.tempo);
  }
  function stopMusic() {
    if (musicTimer) clearInterval(musicTimer);
    musicTimer = null; currentTrack = null;
  }

  function setMuted(m) {
    muted = m;
    localStorage.setItem("epeeNeonsMuted", m ? "1" : "0");
    if (master) master.gain.value = m ? 0 : 0.9;
    return muted;
  }

  window.GameAudio = {
    sfx: SFX, playMusic, stopMusic,
    unlock() { ensure(); },
    isMuted: () => muted,
    toggleMute() { return setMuted(!muted); },
  };
})();
