
(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const canvas = $("game");
  const ctx = canvas.getContext("2d");
  const W = 1100, H = 620;

  const worlds = [
    { name: "Sugar Valley", theme: "candy", difficulty: "EASY", color: "#ff82ce", bg1: "#21103e", bg2: "#f38bc9", speed: 1, gap: 170, gravity: 1450, jump: 650, count: 12, description: "A sugary little adventure." },
    { name: "Mystic Forest", theme: "forest", difficulty: "MEDIUM", color: "#bd98ff", bg1: "#101d38", bg2: "#6b4c9b", speed: 1.15, gap: 190, gravity: 1550, jump: 665, count: 15, description: "Glowing mushrooms. Sneaky paths." },
    { name: "Frostbite Peaks", theme: "ice", difficulty: "HARD", color: "#8af4ff", bg1: "#10243d", bg2: "#7abbd8", speed: 1.3, gap: 205, gravity: 1620, jump: 680, count: 17, description: "Slippery platforms and frozen jumps." },
    { name: "Neon Rush", theme: "neon", difficulty: "VERY HARD", color: "#ff66d0", bg1: "#100d30", bg2: "#693bd4", speed: 1.5, gap: 225, gravity: 1700, jump: 690, count: 20, description: "Move fast. Think faster." },
    { name: "Chocolate Chaos", theme: "lava", difficulty: "EXPERT", color: "#ffd078", bg1: "#210d2d", bg2: "#bb4a64", speed: 1.7, gap: 235, gravity: 1750, jump: 700, count: 23, description: "The sweetest final nightmare." }
  ];

  const avatars = [
    { name: "Cherry", desc: "Pink hair · Sweet style", hair: "#e85b9d", skin: "#ffc99e", outfit: "#ff4fae", pants: "#7133b3", bow: true, type: "girl" },
    { name: "Luna", desc: "Dark hair · Moon magic", hair: "#34203e", skin: "#d99b78", outfit: "#8d68ff", pants: "#39276d", bow: false, type: "girl" },
    { name: "Milo", desc: "Fluffy brown hair · Chill", hair: "#81502e", skin: "#f0bf96", outfit: "#43d8da", pants: "#354b9b", bow: false, type: "boy" },
    { name: "Kai", desc: "Black hair · Neon energy", hair: "#201b31", skin: "#b97854", outfit: "#ff8d51", pants: "#4d247b", bow: false, type: "boy" }
  ];

  let mode = "menu", worldIndex = 0, avatarIndex = 0;
  let unlocked = 1, soundOn = true, score = 0, candyCount = 0;
  let lives = 3, best = 0, time = 0, camera = 0, last = 0;
  let platforms = [], candies = [], enemies = [], particles = [], texts = [];
  let decorations = [], keys = {}, checkpoint = 0, toastTime = 0;
  let shake = 0, goal, levelWidth = 4000, audio;
  let selectedWorld = 0;

  try {
    best = Number(localStorage.getItem("candyDashBestV2")) || 0;
    unlocked = Math.max(1, Number(localStorage.getItem("candyDashUnlocked")) || 1);
  } catch (_) {}

  const player = {
    x: 80, y: 300, w: 30, h: 45, vx: 0, vy: 0,
    face: 1, grounded: false, jumps: 0,
    dash: 0, dashCooldown: 0, invulnerable: 0,
    anim: 0, trail: []
  };

  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const mix = (a, b, t) => a + (b - a) * t;
  const world = () => worlds[worldIndex];

  function round(x, y, w, h, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
  }

  function playSound(freq = 600, duration = .08, type = "sine") {
    if (!soundOn) return;
    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === "suspended") audio.resume();
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(.04, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + duration);
      osc.connect(gain);
      gain.connect(audio.destination);
      osc.start();
      osc.stop(audio.currentTime + duration);
    } catch (_) {}
  }

  function notify(message) {
    $("toast").textContent = message;
    $("toast").classList.add("show");
    toastTime = 1.5;
  }

  function burst(x, y, color, amount = 12) {
    for (let i = 0; i < amount; i++) {
      const a = rand(0, Math.PI * 2), speed = rand(60, 260);
      particles.push({
        x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
        life: rand(.3, .85), max: .85, size: rand(2, 6),
        color, rotation: rand(0, 6), spin: rand(-8, 8)
      });
    }
  }

  function floatText(x, y, text, color = "#fff") {
    texts.push({ x, y, text, color, life: 1 });
  }

  function updateHUD() {
    $("score").textContent = String(score).padStart(6, "0");
    $("candyCount").textContent = String(candyCount).padStart(2, "0");
    $("lives").textContent = lives > 0 ? "♥ ".repeat(lives).trim() : "0";
    $("bestScore").textContent = String(best).padStart(6, "0");
    $("worldCounter").textContent =
      `WORLD ${String(worldIndex + 1).padStart(2, "0")} / 05`;
    $("worldTitle").textContent = world().name;
    $("worldEyebrow").textContent = `${world().difficulty} · ${world().theme.toUpperCase()} WORLD`;
  }

  // Every avatar is drawn in code, so no external sprite downloads are needed.
  function avatarSVG(a, large = false) {
    const scale = large ? 1.2 : 1;
    return `<svg viewBox="0 0 100 110" aria-hidden="true">
      <ellipse cx="50" cy="101" rx="22" ry="5" fill="#130b25" opacity=".4"/>
      <path d="M34 72 L31 96 L43 96 L49 76 M56 76 L61 96 L73 96 L67 72"
        stroke="${a.pants}" stroke-width="10" stroke-linecap="round" fill="none"/>
      <path d="M26 99 Q25 91 35 92 L46 96 L46 103 L27 103 Z" fill="${a.outfit}"/>
      <path d="M55 96 L68 92 Q77 91 76 99 L75 103 L56 103 Z" fill="${a.outfit}"/>
      <path d="M29 47 Q25 34 36 25 Q48 14 62 24 Q75 29 73 47 L68 65 L32 65 Z" fill="${a.hair}"/>
      <path d="M31 50 Q27 43 30 37 L23 48 L31 60" fill="${a.hair}"/>
      <path d="M68 49 Q76 38 70 31 L80 46 L69 62" fill="${a.hair}"/>
      <rect x="27" y="58" width="46" height="29" rx="11" fill="${a.outfit}"/>
      <path d="M42 59 Q50 66 58 59" stroke="#ffffff77" stroke-width="3" fill="none"/>
      <rect x="45" y="73" width="11" height="9" rx="3" fill="#ffffff50"/>
      <ellipse cx="50" cy="43" rx="20" ry="23" fill="${a.skin}"/>
      <path d="M30 39 Q28 17 50 19 Q72 17 71 39 Q61 30 56 30 Q45 39 30 39" fill="${a.hair}"/>
      <path d="M32 29 Q42 17 53 24" stroke="#ffffff30" stroke-width="4" fill="none"/>
      <ellipse cx="43" cy="44" rx="2.2" ry="3" fill="#39223a"/>
      <ellipse cx="58" cy="44" rx="2.2" ry="3" fill="#39223a"/>
      <path d="M46 53 Q50 57 55 52" stroke="#a44c64" stroke-width="2" fill="none" stroke-linecap="round"/>
      <circle cx="37" cy="51" r="4" fill="#ff88a9" opacity=".6"/>
      <circle cx="64" cy="51" r="4" fill="#ff88a9" opacity=".6"/>
      ${a.bow ? `<path d="M35 25 L23 15 L25 30 L37 26 L48 14 L47 29 Z" fill="#ff55b8" stroke="#ffc4e8" stroke-width="1.5"/>` : ""}
      ${a.type === "boy" ? `<path d="M33 29 Q40 14 53 20 Q67 17 70 33 L61 29 L54 24 L44 31 L36 34 Z" fill="${a.hair}"/>` : ""}
    </svg>`;
  }

  function showMenu(title, description, content, buttons, eyebrow = "CANDY DASH") {
    const overlay = $("overlay");
    overlay.innerHTML = `
      <div class="menu-panel">
        <div class="eyebrow">${eyebrow}</div>
        <h2 class="hero-title">${title}</h2>
        <p class="hero-description">${description}</p>
        ${content || ""}
        <div id="menuActions"></div>
        <div class="menu-footer">
          <span>MADE OF SUGAR, POWERED BY CHAOS.</span>
          <span>EST. 2026</span>
        </div>
      </div>`;

    const actions = $("menuActions");
    buttons.forEach((b, i) => {
      const el = document.createElement("button");
      el.className = i === 0 ? "primary-button" : "secondary-button";
      el.innerHTML = `<span>${b.label}</span><span>${i === 0 ? "↗" : "+"}</span>`;
      el.addEventListener("click", b.action);
      actions.appendChild(el);
    });
    overlay.classList.remove("hidden");
  }

  function mainMenu() {
    mode = "menu";
    $("hud").style.display = "none";
    showMenu(
      `CANDY<br><span>DASH ✳</span>`,
      "Five magical worlds. Four characters. A whole lot of trouble.",
      `<div class="menu-stats">
        <div><span>WORLDS UNLOCKED</span><strong>${unlocked} / 5</strong></div>
        <div><span>BEST SCORE</span><strong>${best}</strong></div>
        <div><span>CHARACTERS</span><strong>04</strong></div>
      </div>`,
      [
        { label: "PLAY NOW", action: avatarMenu },
        { label: "HOW TO PLAY", action: instructions }
      ],
      "YOUR NEXT OBSESSION"
    );
    $("statusText").textContent = "READY TO PLAY";
  }

  function instructions() {
    mode = "instructions";
    showMenu("HOW TO<br><span>PLAY</span>",
      "Move with A and D or the arrow keys. Press SPACE to jump, then again to double-jump. SHIFT gives you a dash. Collect candy, avoid hazards, stomp monsters, and reach the finish. Each world gets harder. If you fall, you'll respawn at the latest checkpoint.",
      "",
      [
        { label: "CHOOSE MY CHARACTER", action: avatarMenu },
        { label: "BACK TO MENU", action: mainMenu }
      ],
      "PLAYER GUIDE / 001"
    );
  }

  function avatarMenu() {
    mode = "avatar";
    const cards = avatars.map((a, i) => `
      <button class="avatar-card ${i === avatarIndex ? "selected" : ""}" data-avatar="${i}">
        <div class="avatar-art">${avatarSVG(a)}</div>
        <span class="avatar-name">${a.name}</span>
        <span class="avatar-description">${a.desc}</span>
      </button>`).join("");

    showMenu("PICK YOUR<br><span>PLAYER</span>",
      "Choose your main character. You can switch any time before a run.",
      `<div class="section-title">SELECT AVATAR · ${avatars.length} AVAILABLE</div>
       <div class="menu-grid">${cards}</div>`,
      [
        { label: "CHOOSE A WORLD", action: levelMenu },
        { label: "BACK", action: mainMenu }
      ],
      "CHARACTER SELECT"
    );

    document.querySelectorAll("[data-avatar]").forEach(el => {
      el.addEventListener("click", () => {
        avatarIndex = Number(el.dataset.avatar);
        document.querySelectorAll("[data-avatar]").forEach(c => c.classList.remove("selected"));
        el.classList.add("selected");
        playSound(560);
      });
    });
  }

  function levelMenu() {
    mode = "levels";

    const cards = worlds.map((w, i) => {
      const locked = i + 1 > unlocked;
      const icons = ["🍭", "🍄", "❄", "⚡", "🍫"];
      const backgrounds = [
        "linear-gradient(140deg,#ff70bd,#63338b)",
        "linear-gradient(140deg,#6d56a8,#192f45)",
        "linear-gradient(140deg,#6ce6f5,#405eaa)",
        "linear-gradient(140deg,#ec4bc5,#3026a0)",
        "linear-gradient(140deg,#ff9c55,#5d1e43)"
      ];
      return `<button class="level-card ${locked ? "locked" : ""} ${i === selectedWorld ? "selected" : ""}" data-world="${i}" ${locked ? "disabled" : ""}>
        <span class="level-number">0${i + 1}${locked ? " · LOCKED" : ""}</span>
        <div class="level-art" style="background:${backgrounds[i]}"><span>${icons[i]}</span></div>
        <div class="level-info">
          <span class="level-name">${w.name}</span>
          <div class="level-meta"><span class="difficulty">${w.difficulty}</span><span>${locked ? "LOCKED" : "PLAYABLE"}</span></div>
        </div>
      </button>`;
    }).join("");

    showMenu("CHOOSE YOUR<br><span>WORLD</span>",
      "Every world brings new obstacles, tougher monsters, and bigger rewards.",
      `<div class="section-title">WORLD MAP · ${unlocked} / 5 UNLOCKED</div>
       <div class="menu-grid">${cards}</div>`,
      [
        { label: "START THIS WORLD", action: () => startGame(selectedWorld) },
        { label: "CHANGE AVATAR", action: avatarMenu }
      ],
      "EXPEDITION SELECT"
    );

    document.querySelectorAll("[data-world]").forEach(el => {
      el.addEventListener("click", () => {
        selectedWorld = Number(el.dataset.world);
        document.querySelectorAll("[data-world]").forEach(c => c.classList.remove("selected"));
        el.classList.add("selected");
        playSound(470);
      });
    });
  }

  function addPlatform(x, y, w) {
    platforms.push({ x, y, w, h: 25, moving: false, baseY: y, phase: rand(0, 6), speed: rand(35, 80) });
  }

  function buildLevel() {
    platforms = [];
    candies = [];
    enemies = [];
    decorations = [];
    particles = [];
    texts = [];
    const w = world();

    levelWidth = 1100 + w.count * 205;
    addPlatform(0, 510, 420);

    let x = 420;
    for (let i = 0; i < w.count; i++) {
      const gap = w.gap + rand(-22, 20);
      x += gap;
      const y = clamp(445 - (i % 3) * 38 + rand(-20, 18), 260, 470);
      const width = rand(100, wIndexWidth());
      addPlatform(x, y, width);

      // Later worlds use moving platforms.
      if (worldIndex >= 1 && i % (worldIndex >= 3 ? 2 : 4) === 1) {
        platforms[platforms.length - 1].moving = true;
      }

      for (let j = 0; j < 3; j++) {
        candies.push({
          x: x + 20 + j * 31,
          y: y - 37 - Math.sin(j) * 16,
          type: j === 1 && i % 3 === 0 ? "star" : "candy",
          collected: false,
          phase: rand(0, 6)
        });
      }

      if (i % 2 === 0 || worldIndex >= 2 && i % 3 === 0) {
        enemies.push({
          x: x + 25, y: y - 31, w: 32, h: 29,
          min: x + 4, max: x + width - 34,
          speed: (55 + worldIndex * 25) * w.speed,
          dir: 1, alive: true, phase: rand(0, 6),
          boss: false
        });
      }
    }

    addPlatform(levelWidth - 220, 455, 250);
    goal = { x: levelWidth - 115, y: 330 };

    // The final world has a larger boss guarding the exit.
    if (worldIndex === 4) {
      enemies.push({
        x: levelWidth - 360, y: 390, w: 72, h: 65,
        min: levelWidth - 480, max: levelWidth - 230,
        speed: 95, dir: 1, alive: true, phase: 0,
        boss: true, hp: 3
      });
      for (let i = 0; i < 10; i++) {
        candies.push({
          x: levelWidth - 510 + i * 27,
          y: 315 - Math.sin(i / 9 * Math.PI) * 42,
          type: i % 3 === 0 ? "star" : "candy",
          collected: false, phase: rand(0, 6)
        });
      }
    }

    for (let i = 0; i < 120; i++) {
      decorations.push({
        x: rand(0, levelWidth), y: rand(20, 360),
        size: rand(1, 3), phase: rand(0, 6)
      });
    }
  }

  function wIndexWidth() {
    return worldIndex >= 3 ? 115 : worldIndex >= 1 ? 145 : 175;
  }

  function startGame(index = selectedWorld) {
    worldIndex = index;
    selectedWorld = index;
    buildLevel();

    mode = "playing";
    player.x = 55;
    player.y = 350;
    player.vx = player.vy = 0;
    player.face = 1;
    player.grounded = false;
    player.jumps = 0;
    player.dash = 0;
    player.dashCooldown = 0;
    player.invulnerable = 0;
    player.anim = 0;
    player.trail = [];
    camera = 0;
    checkpoint = 0;
    lives = 3;
    score = 0;
    candyCount = 0;
    time = 0;
    shake = 0;

    $("hud").style.display = "flex";
    $("overlay").classList.add("hidden");
    $("statusText").textContent = `${world().difficulty} · RUN IN PROGRESS`;
    updateHUD();
    playSound(560, .12);
    last = performance.now();
  }

  function saveProgress() {
    if (worldIndex + 2 > unlocked && worldIndex < 4) unlocked = worldIndex + 2;
    try {
      localStorage.setItem("candyDashUnlocked", String(unlocked));
    } catch (_) {}
  }

  function endGame(won) {
    if (mode !== "playing") return;
    mode = won ? "won" : "over";
    if (won) {
      score += 250 + worldIndex * 100;
      saveProgress();
      burst(player.x, player.y, world().color, 60);
      playSound(820, .3);
    }

    if (score > best) {
      best = score;
      try { localStorage.setItem("candyDashBestV2", String(best)); } catch (_) {}
    }
    updateHUD();

    const next = worldIndex < 4 && won;
    showMenu(
      won ? "WORLD<br><span>CONQUERED!</span>" : "SUGAR<br><span>DOWN!</span>",
      won
        ? `You conquered ${world().name}! You collected ${candyCount} candies and earned ${score} points.`
        : `You scored ${score} points. ${world().description} Ready to try again?`,
      `<div class="menu-stats">
        <div><span>SCORE</span><strong>${score}</strong></div>
        <div><span>CANDIES</span><strong>${candyCount}</strong></div>
        <div><span>WORLD</span><strong>${worldIndex + 1} / 5</strong></div>
      </div>`,
      [
        ...(next ? [{ label: `NEXT WORLD: ${worlds[worldIndex + 1].name}`, action: () => startGame(worldIndex + 1) }] : []),
        { label: "PLAY AGAIN", action: () => startGame(worldIndex) },
        { label: "WORLD MAP", action: levelMenu }
      ],
      won ? "MISSION COMPLETE" : "RUN ENDED"
    );
    $("hud").style.display = "none";
    $("statusText").textContent = won ? "WORLD COMPLETE" : "RUN ENDED";
  }

  function pauseGame() {
    if (mode === "playing") {
      mode = "paused";
      showMenu("TAKE A<br><span>BREAK</span>",
        "Your adventure is paused. The candy isn't going anywhere.",
        "",
        [
          { label: "RESUME", action: () => {
            mode = "playing";
            $("overlay").classList.add("hidden");
            last = performance.now();
          }},
          { label: "RESTART WORLD", action: () => startGame(worldIndex) },
          { label: "WORLD MAP", action: levelMenu }
        ],
        "PAUSE MENU"
      );
    }
  }

  function jump() {
    if (mode !== "playing" || player.jumps >= 2) return;
    player.vy = player.jumps === 0 ? -world().jump : -world().jump * .88;
    player.jumps++;
    player.grounded = false;
    burst(player.x + 15, player.y + player.h, world().color, 7);
    playSound(player.jumps === 1 ? 420 : 680);
  }

  function dash() {
    if (mode !== "playing" || player.dashCooldown > 0) return;
    player.dash = .2;
    player.dashCooldown = 1.1;
    player.vx = player.face * (760 + worldIndex * 35);
    player.vy *= .3;
    player.invulnerable = Math.max(player.invulnerable, .22);
    burst(player.x + 15, player.y + 20, world().color, 12);
    notify("SUGAR RUSH!");
    playSound(270, .12, "sawtooth");
  }

  function overlaps(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x &&
      a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function damage() {
    if (player.invulnerable > 0 || mode !== "playing") return;
    lives--;
    player.invulnerable = 1.4;
    player.vy = -380;
    player.vx = -player.face * 240;
    shake = .3;
    burst(player.x + 15, player.y + 20, "#ff4b8e", 20);
    playSound(155, .18, "sawtooth");
    updateHUD();

    if (lives <= 0) {
      endGame(false);
    } else {
      notify("OUCH! WATCH YOUR STEP");
      player.x = Math.max(45, checkpoint);
      player.y = 320;
      player.vy = -80;
    }
  }

  function update(dt) {
    time += dt;
    const w = world();

    if (toastTime > 0) {
      toastTime -= dt;
      if (toastTime <= 0) $("toast").classList.remove("show");
    }
    shake = Math.max(0, shake - dt);
    player.invulnerable = Math.max(0, player.invulnerable - dt);
    player.dashCooldown = Math.max(0, player.dashCooldown - dt);
    player.dash = Math.max(0, player.dash - dt);
    player.anim += dt * (Math.abs(player.vx) > 20 ? 12 : 3);

    const left = keys.ArrowLeft || keys.a || keys.A;
    const right = keys.ArrowRight || keys.d || keys.D;
    if (player.dash <= 0) {
      if (left) { player.vx -= 1450 * dt; player.face = -1; }
      if (right) { player.vx += 1450 * dt; player.face = 1; }
      if (!left && !right) player.vx *= Math.pow(.001, dt);
      player.vx = clamp(player.vx, -310, 310);
    }

    // Moving platforms.
    for (const p of platforms) {
      if (p.moving) p.y = p.baseY + Math.sin(time * 1.5 + p.phase) * (22 + worldIndex * 5);
    }

    const oldBottom = player.y + player.h;
    const oldY = player.y;
    player.vy += w.gravity * dt;
    player.vy = Math.min(player.vy, 920);
    player.x = clamp(player.x + player.vx * dt, 0, levelWidth - player.w);
    player.y += player.vy * dt;
    player.grounded = false;

    for (const p of platforms) {
      if (player.x + player.w > p.x && player.x < p.x + p.w &&
          oldBottom <= p.y + 11 && player.y + player.h >= p.y && player.vy >= 0) {
        player.y = p.y - player.h;
        player.vy = 0;
        player.grounded = true;
        player.jumps = 0;
        if (player.x > checkpoint) checkpoint = p.x;
      }
    }

    if (player.y > H + 150) damage();

    if (player.dash > 0) {
      player.trail.push({ x: player.x, y: player.y, life: .24 });
    }
    player.trail.forEach(t => t.life -= dt);
    player.trail = player.trail.filter(t => t.life > 0);

    for (const c of candies) {
      if (c.collected) continue;
      const cx = player.x + player.w / 2;
      const cy = player.y + player.h / 2;
      if (Math.hypot(cx - c.x, cy - (c.y + Math.sin(time * 3 + c.phase) * 4)) < 25) {
        c.collected = true;
        const points = c.type === "star" ? 50 : 10;
        score += points;
        candyCount++;
        burst(c.x, c.y, c.type === "star" ? "#ffe77d" : world().color, 12);
        floatText(c.x, c.y, `+${points}`, c.type === "star" ? "#ffe77d" : "#fff");
        playSound(c.type === "star" ? 900 : 650, .06);
        updateHUD();
      }
    }

    for (const e of enemies) {
      if (!e.alive) continue;
      e.phase += dt * 6;
      e.x += e.dir * e.speed * dt;
      if (e.x < e.min || e.x + e.w > e.max) e.dir *= -1;

      if (overlaps(
        { x: player.x + 4, y: player.y + 3, w: player.w - 8, h: player.h - 4 },
        { x: e.x, y: e.y, w: e.w, h: e.h }
      )) {
        if (player.vy > 70 && oldBottom < e.y + 19) {
          if (e.boss) {
            e.hp--;
            player.vy = -450;
            burst(e.x + e.w / 2, e.y + 15, "#ffe77d", 25);
            floatText(e.x, e.y - 10, `BOSS ${e.hp > 0 ? e.hp + " HP" : "DEFEATED!"}`, "#ffe77d");
            if (e.hp <= 0) {
              e.alive = false;
              score += 500;
              notify("BOSS DEFEATED +500");
            } else {
              notify("HIT THE BOSS AGAIN!");
            }
          } else {
            e.alive = false;
            player.vy = -420;
            score += 100;
            burst(e.x + e.w / 2, e.y + 10, "#ff91d0", 20);
            floatText(e.x, e.y, "+100 STOMP", "#ffe77d");
            playSound(760);
          }
          updateHUD();
        } else {
          damage();
        }
      }
    }

    // Final-world exit opens only after defeating the boss.
    const boss = enemies.find(e => e.boss);
    if (player.x > goal.x && (!boss || !boss.alive)) endGame(true);

    camera = mix(camera, clamp(player.x - W * .34, 0, levelWidth - W), Math.min(1, dt * 5));

    for (const p of particles) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += 400 * dt; p.rotation += p.spin * dt; p.life -= dt;
    }
    particles = particles.filter(p => p.life > 0);

    for (const t of texts) { t.y -= 35 * dt; t.life -= dt; }
    texts = texts.filter(t => t.life > 0);
  }

  // Drawing helpers.
  function drawBackground() {
    const w = world();
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, w.bg1);
    g.addColorStop(1, w.bg2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    for (const d of decorations) {
      const x = d.x - camera * .35;
      if (x < 0 || x > W) continue;
      ctx.globalAlpha = .3 + Math.sin(time * 2 + d.phase) * .25;
      ctx.fillStyle = w.color;
      ctx.fillRect(x, d.y, d.size, d.size);
    }
    ctx.globalAlpha = 1;

    // Moon and atmospheric glow.
    const mx = 820 - camera * .05;
    ctx.save();
    ctx.shadowBlur = 50;
    ctx.shadowColor = w.color;
    ctx.fillStyle = w.color;
    ctx.globalAlpha = .8;
    ctx.beginPath();
    ctx.arc(mx, 125, 48, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Themed distant silhouettes.
    for (let i = 0; i < 11; i++) {
      const x = i * 150 - camera * .17 % 1650;
      if (w.theme === "forest") {
        ctx.fillStyle = "#211e4b";
        ctx.beginPath();
        ctx.moveTo(x, 420);
        ctx.lineTo(x + 42, 280 + (i % 3) * 25);
        ctx.lineTo(x + 84, 420);
        ctx.fill();
        ctx.fillStyle = "#b68aff77";
        ctx.beginPath();
        ctx.arc(x + 42, 315 + (i % 3) * 25, 23, 0, Math.PI * 2);
        ctx.fill();
      } else if (w.theme === "ice") {
        ctx.fillStyle = "#d9f9ff55";
        ctx.beginPath();
        ctx.moveTo(x, 430);
        ctx.lineTo(x + 50, 250 + (i % 3) * 28);
        ctx.lineTo(x + 105, 430);
        ctx.fill();
      } else if (w.theme === "neon") {
        ctx.fillStyle = "#26124b";
        ctx.fillRect(x, 290 + (i % 4) * 25, 70, 220);
        ctx.fillStyle = "#ff55b888";
        for (let j = 0; j < 5; j++) ctx.fillRect(x + 12, 310 + j * 22 + (i % 4) * 25, 9, 11);
      } else if (w.theme === "lava") {
        ctx.fillStyle = "#4a1d46";
        ctx.beginPath();
        ctx.moveTo(x, 460);
        ctx.lineTo(x + 40, 300 + (i % 3) * 35);
        ctx.lineTo(x + 90, 460);
        ctx.fill();
        ctx.fillStyle = "#ffb35d66";
        ctx.fillRect(x + 38, 350 + (i % 3) * 35, 5, 65);
      } else {
        ctx.fillStyle = "#7b4e9b";
        ctx.beginPath();
        ctx.arc(x + 40, 355, 32, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ff9dd9";
        ctx.fillRect(x + 37, 370, 7, 85);
      }
    }
  }

  function drawPlatform(p) {
    const x = p.x - camera, y = p.y;
    if (x + p.w < 0 || x > W) return;
    const w = world();
    const palettes = {
      candy: ["#ff7ac8", "#b92d91", "#ffd0ec"],
      forest: ["#ad85ff", "#593d8b", "#e1c9ff"],
      ice: ["#83f5ff", "#317ea9", "#e0fdff"],
      neon: ["#ff5dc8", "#622a9e", "#b8ffff"],
      lava: ["#ffab62", "#8c3558", "#ffe0a0"]
    };
    const colors = palettes[w.theme];

    ctx.save();
    round(x + 3, y + 10, p.w, 25, 8, "#160c2c77");
    ctx.shadowBlur = 15;
    ctx.shadowColor = colors[0];
    round(x, y, p.w, 25, 8, colors[1]);
    ctx.shadowBlur = 0;
    round(x, y - 7, p.w, 15, 7, colors[0]);
    round(x + 5, y - 4, p.w - 10, 3, 2, colors[2]);

    if (w.theme === "ice") {
      ctx.strokeStyle = "#ffffff90";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 20, y + 4);
      ctx.lineTo(x + 37, y + 12);
      ctx.lineTo(x + 54, y + 4);
      ctx.stroke();
    } else {
      for (let i = 12; i < p.w - 10; i += 29) {
        round(x + i, y - 3, 7, 3, 2, ["#ffe77d", "#ffffff", "#8cf6ff"][Math.floor(i / 29) % 3]);
      }
    }
    ctx.restore();
  }

  function drawCandy(c) {
    const x = c.x - camera;
    const y = c.y + Math.sin(time * 3 + c.phase) * 5;
    if (x < -30 || x > W + 30) return;

    ctx.save();
    ctx.shadowBlur = 18;
    ctx.shadowColor = c.type === "star" ? "#ffe77d" : world().color;
    if (c.type === "star") {
      ctx.translate(x, y);
      ctx.rotate(Math.sin(time + c.phase) * .15);
      ctx.fillStyle = "#ffe77d";
      ctx.strokeStyle = "#fff8d5";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + i * Math.PI / 5;
        const r = i % 2 ? 7 : 15;
        const px = Math.cos(a) * r, py = Math.sin(a) * r;
        if (!i) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.strokeStyle = "#fff0fb";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x, y + 7);
      ctx.lineTo(x, y + 25);
      ctx.stroke();
      ctx.fillStyle = world().color;
      ctx.beginPath();
      ctx.arc(x, y, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 7, time, time + Math.PI * 1.4);
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(x - 3, y - 4, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawEnemy(e) {
    const x = e.x - camera, y = e.y + Math.sin(time * 5 + e.phase) * 3;
    ctx.save();
    ctx.shadowBlur = e.boss ? 28 : 14;
    ctx.shadowColor = e.boss ? "#ff8b45" : world().color;
    ctx.fillStyle = e.boss ? "#853d66" : world().theme === "ice" ? "#58b7db" : "#e958a6";
    ctx.beginPath();
    ctx.moveTo(x, y + e.h);
    ctx.quadraticCurveTo(x - 3, y + 4, x + e.w / 2, y);
    ctx.quadraticCurveTo(x + e.w + 3, y + 4, x + e.w, y + e.h);
    ctx.quadraticCurveTo(x + e.w / 2, y + e.h + 6, x, y + e.h);
    ctx.fill();
    ctx.shadowBlur = 0;

    if (e.boss) {
      ctx.fillStyle = "#ffcf72";
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(x + 12 + i * 21, y + 4);
        ctx.lineTo(x + 20 + i * 21, y - 14);
        ctx.lineTo(x + 27 + i * 21, y + 4);
        ctx.fill();
      }
    } else {
      round(x + 3, y + 5, e.w - 6, 7, 4, "#ffffff88");
    }

    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(x + e.w * .32, y + e.h * .55, e.boss ? 7 : 4, 0, Math.PI * 2);
    ctx.arc(x + e.w * .68, y + e.h * .55, e.boss ? 7 : 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#29113b";
    ctx.beginPath();
    ctx.arc(x + e.w * .33, y + e.h * .56, e.boss ? 3 : 2, 0, Math.PI * 2);
    ctx.arc(x + e.w * .67, y + e.h * .56, e.boss ? 3 : 2, 0, Math.PI * 2);
    ctx.fill();

    if (e.boss) {
      ctx.fillStyle = "#ffe77d";
      ctx.font = "bold 11px Fredoka";
      ctx.textAlign = "center";
      ctx.fillText(`HP ${e.hp}/3`, x + e.w / 2, y - 21);
    }
    ctx.restore();
  }

  function drawPlayerShape(x, y, alpha = 1) {
    const a = avatars[avatarIndex];
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x + player.w / 2, y + player.h / 2);
    ctx.scale(player.face, 1);
    const run = player.grounded ? Math.sin(player.anim) * 4 : -1;

    ctx.fillStyle = "#160c2c55";
    ctx.beginPath();
    ctx.ellipse(0, 26, 15, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = a.pants;
    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-6, 13);
    ctx.lineTo(-8 + run, 22);
    ctx.moveTo(6, 13);
    ctx.lineTo(8 - run, 22);
    ctx.stroke();

    round(-17 + run, 18, 14, 7, 4, a.outfit);
    round(4 - run, 18, 14, 7, 4, a.outfit);
    round(-14, -8, 28, 25, 8, a.outfit);
    round(-7, -2, 14, 12, 4, "#ffffff50");

    // Hair behind the head.
    ctx.fillStyle = a.hair;
    ctx.beginPath();
    ctx.ellipse(-10, -13, 6, 14, -.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = a.skin;
    ctx.beginPath();
    ctx.ellipse(1, -12, 12, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = a.hair;
    ctx.beginPath();
    ctx.arc(0, -17, 13, Math.PI, Math.PI * 2);
    ctx.quadraticCurveTo(14, -19, 11, -9);
    ctx.quadraticCurveTo(3, -18, -3, -11);
    ctx.quadraticCurveTo(-8, -7, -12, -15);
    ctx.fill();

    ctx.fillStyle = "#352039";
    ctx.beginPath();
    ctx.arc(-3, -12, 1.7, 0, Math.PI * 2);
    ctx.arc(6, -12, 1.7, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#a54d66";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(2, -7, 3.5, .15, Math.PI - .15);
    ctx.stroke();

    if (a.bow) {
      ctx.fillStyle = "#ff55b8";
      ctx.beginPath();
      ctx.moveTo(-7, -23);
      ctx.lineTo(-17, -29);
      ctx.lineTo(-15, -20);
      ctx.lineTo(-5, -28);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPlayer() {
    if (player.invulnerable > 0 && Math.floor(time * 17) % 2 === 0) return;
    for (const t of player.trail) drawPlayerShape(t.x - camera, t.y, t.life / .24 * .25);
    drawPlayerShape(player.x - camera, player.y, 1);
  }

  function drawGoal() {
    const x = goal.x - camera;
    ctx.save();
    ctx.shadowBlur = 18;
    ctx.shadowColor = "#ffe77d";
    round(x, goal.y, 6, 150, 3, "#fff4ff");
    ctx.shadowBlur = 0;
    ctx.fillStyle = world().color;
    ctx.beginPath();
    ctx.moveTo(x + 6, goal.y + 4);
    ctx.lineTo(x + 67, goal.y + 22);
    ctx.lineTo(x + 6, goal.y + 40);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ffe77d";
    ctx.beginPath();
    ctx.arc(x + 3, goal.y - 4, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawEffects() {
    for (const p of particles) {
      ctx.save();
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      ctx.translate(p.x - camera, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    }
    for (const t of texts) {
      ctx.save();
      ctx.globalAlpha = clamp(t.life, 0, 1);
      ctx.fillStyle = t.color;
      ctx.font = "bold 17px Fredoka";
      ctx.textAlign = "center";
      ctx.fillText(t.text, t.x - camera, t.y);
      ctx.restore();
    }
  }

  function render() {
    ctx.clearRect(0, 0, W, H);
    drawBackground();
    ctx.save();
    if (shake > 0) ctx.translate(rand(-3, 3), rand(-3, 3));

    // Themed ground.
    ctx.fillStyle = world().theme === "ice" ? "#bdefff" :
      world().theme === "lava" ? "#8f3559" :
      world().theme === "neon" ? "#281149" : "#d96cb9";
    ctx.fillRect(0, 510, W, H - 510);

    if (world().theme === "lava") {
      ctx.fillStyle = "#ffb24b";
      for (let x = 0; x < W; x += 60) {
        ctx.fillRect(x - camera % 60, 510, 30, 3);
      }
    }

    for (const p of platforms) drawPlatform(p);
    for (const c of candies) if (!c.collected) drawCandy(c);
    for (const e of enemies) if (e.alive) drawEnemy(e);
    drawGoal();
    drawPlayer();
    drawEffects();

    ctx.restore();

    // Progress bar.
    round(20, H - 20, 180, 5, 3, "#180b3988");
    round(20, H - 20, 180 * clamp(player.x / goal.x, 0, 1), 5, 3, world().color);
    ctx.fillStyle = "#fff";
    ctx.font = "9px 'Space Mono'";
    ctx.fillText(world().name.toUpperCase(), 20, H - 28);
  }

  function frame(now) {
    const dt = Math.min((now - last) / 1000 || 0, .033);
    last = now;

    if (mode === "playing") {
      update(dt);
    } else {
      time += dt * .45;
      for (const p of particles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 400 * dt;
        p.rotation += p.spin * dt;
        p.life -= dt;
      }
      particles = particles.filter(p => p.life > 0);
    }

    render();
    requestAnimationFrame(frame);
  }

  window.addEventListener("keydown", e => {
    if ([" ", "ArrowUp", "ArrowLeft", "ArrowRight"].includes(e.key)) e.preventDefault();
    if (e.repeat && [" ", "ArrowUp", "w", "W", "Shift"].includes(e.key)) return;
    keys[e.key] = true;

    if ([" ", "ArrowUp", "w", "W"].includes(e.key)) jump();
    if (e.key === "Shift") dash();
    if (e.key === "Escape" && mode === "playing") pauseGame();
    if ((e.key === "r" || e.key === "R") && ["playing", "paused"].includes(mode)) startGame(worldIndex);
    if (e.key === "Enter" && mode === "menu") avatarMenu();
  });

  window.addEventListener("keyup", e => { keys[e.key] = false; });
  window.addEventListener("blur", () => {
    keys = {};
    if (mode === "playing") pauseGame();
  });

  function hold(id, key) {
    const el = $(id);
    const down = e => { e.preventDefault(); keys[key] = true; };
    const up = e => { e.preventDefault(); keys[key] = false; };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointerleave", up);
    el.addEventListener("pointercancel", up);
  }

  hold("leftBtn", "ArrowLeft");
  hold("rightBtn", "ArrowRight");
  $("jumpBtn").addEventListener("pointerdown", e => { e.preventDefault(); jump(); });
  $("dashBtn").addEventListener("pointerdown", e => { e.preventDefault(); dash(); });
  $("startBtn").addEventListener("click", avatarMenu);
  $("homeBtn").addEventListener("click", e => { e.preventDefault(); mainMenu(); });
  $("soundBtn").addEventListener("click", () => {
    soundOn = !soundOn;
    $("soundBtn").textContent = soundOn ? "♫" : "×";
    if (soundOn) playSound(650);
  });

  updateHUD();
  mainMenu();
  last = performance.now();
  requestAnimationFrame(frame);
})();
