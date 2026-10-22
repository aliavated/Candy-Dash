(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const $ = id => document.getElementById(id);
  const W = 1100, H = 620;

  const ui = {
    overlay: $("overlay"),
    score: $("score"),
    candy: $("candyCount"),
    lives: $("lives"),
    best: $("bestScore"),
    status: $("statusText"),
    toast: $("toast")
  };

  let mode = "menu";
  let soundOn = true;
  let audio = null;
  let last = 0;
  let time = 0;
  let camera = 0;
  let score = 0;
  let candyCount = 0;
  let lives = 3;
  let best = 0;
  let toastTime = 0;
  let shake = 0;
  let levelWidth = 4100;
  let particles = [];
  let floatingTexts = [];
  let stars = [];
  let platforms = [];
  let candies = [];
  let enemies = [];
  let decorations = [];
  let keys = {};
  let goal = null;

  try {
    best = Number(localStorage.getItem("candyDashBestV2")) || 0;
  } catch (_) {}

  const player = {
    x: 80, y: 300, w: 33, h: 47,
    vx: 0, vy: 0,
    face: 1,
    grounded: false,
    jumps: 0,
    dashTime: 0,
    dashCooldown: 0,
    invulnerable: 0,
    animation: 0,
    squash: 0,
    trail: []
  };

  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const lerp = (a, b, t) => a + (b - a) * t;

  function roundedRect(x, y, w, h, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
  }

  function sound(freq = 600, duration = 0.09, type = "sine") {
    if (!soundOn) return;

    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === "suspended") audio.resume();

      const oscillator = audio.createOscillator();
      const gain = audio.createGain();

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(freq, audio.currentTime);
      gain.gain.setValueAtTime(0.045, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.001, audio.currentTime + duration
      );

      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.start();
      oscillator.stop(audio.currentTime + duration);
    } catch (_) {}
  }

  function burst(x, y, color, amount = 14, power = 200) {
    for (let i = 0; i < amount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = rand(power * 0.25, power);

      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: rand(0.3, 0.8),
        maxLife: 0.8,
        size: rand(2, 6),
        color,
        shape: Math.random() > 0.5 ? "circle" : "square",
        spin: rand(-8, 8),
        rotation: rand(0, 6)
      });
    }
  }

  function floatingText(x, y, text, color = "#ffffff") {
    floatingTexts.push({ x, y, text, color, life: 1 });
  }

  function notify(message) {
    ui.toast.textContent = message;
    ui.toast.classList.add("show");
    toastTime = 1.4;
  }

  function updateHUD() {
    ui.score.textContent = String(score).padStart(6, "0");
    ui.candy.textContent = String(candyCount).padStart(2, "0");
    ui.lives.textContent = lives > 0 ? "♥ ".repeat(lives).trim() : "0";
    ui.best.textContent = String(best).padStart(6, "0");
  }

  function platform(x, y, w, type = "pink") {
    platforms.push({
      x, y, w, h: 27, type,
      glow: rand(0, 6),
      decorations: Array.from(
        { length: Math.floor(w / 38) },
        (_, i) => ({
          x: i * 38 + rand(5, 20),
          color: ["#ffb0de", "#ffe88a", "#8cf6ff", "#c7a2ff"][
            Math.floor(rand(0, 4))
          ]
        })
      )
    });
  }

  function candy(x, y, type = "lollipop") {
    candies.push({
      x, y,
      type,
      r: type === "star" ? 14 : 12,
      phase: rand(0, Math.PI * 2),
      collected: false
    });
  }

  function enemy(x, y, min, max, speed = 65, type = "jelly") {
    enemies.push({
      x, y, w: 35, h: 32,
      min, max, speed,
      direction: Math.random() > 0.5 ? 1 : -1,
      type,
      alive: true,
      phase: rand(0, 6)
    });
  }

  function buildLevel() {
    platforms = [];
    candies = [];
    enemies = [];
    decorations = [];
    goal = null;

    // Floating, layered candy landscape.
    platform(0, 510, 460, "pink");
    platform(505, 448, 150, "purple");
    platform(704, 382, 155, "cyan");
    platform(907, 475, 315, "pink");
    platform(1270, 419, 160, "purple");
    platform(1485, 350, 165, "cyan");
    platform(1710, 465, 360, "pink");
    platform(2120, 420, 160, "purple");
    platform(2330, 350, 160, "cyan");
    platform(2540, 465, 350, "pink");
    platform(2940, 402, 170, "purple");
    platform(3165, 337, 160, "cyan");
    platform(3380, 448, 350, "pink");
    platform(3750, 395, 200, "purple");
    platform(3970, 470, 200, "pink");

    // Collectibles arranged into intentional trails.
    const groups = [
      [155, 435, 5, 37], [325, 400, 4, 35],
      [535, 397, 3, 34], [725, 332, 4, 30],
      [920, 425, 6, 39], [1110, 410, 4, 36],
      [1290, 365, 4, 34], [1510, 295, 4, 34],
      [1745, 414, 7, 38], [1930, 395, 4, 38],
      [2135, 368, 4, 34], [2340, 300, 4, 32],
      [2570, 414, 7, 37], [2770, 395, 3, 35],
      [2970, 350, 4, 34], [3180, 285, 4, 30],
      [3400, 398, 7, 37], [3590, 370, 3, 36],
      [3770, 345, 4, 34], [3990, 420, 5, 35]
    ];

    groups.forEach(([x, y, count, gap], index) => {
      for (let i = 0; i < count; i++) {
        candy(x + i * gap, y - Math.sin(i / Math.max(1, count - 1) * Math.PI) * 25,
          i === Math.floor(count / 2) && index % 3 === 1 ? "star" : "lollipop");
      }
    });

    // Extra airborne candy trails.
    for (let x = 1000; x < 3900; x += 340) {
      candy(x, rand(235, 315), "star");
    }

    enemy(980, 443, 920, 1190, 65);
    enemy(1815, 433, 1750, 2020, 80);
    enemy(2630, 433, 2580, 2840, 85);
    enemy(3450, 416, 3410, 3670, 72);
    enemy(3800, 363, 3770, 3920, 60, "gumdrop");

    goal = { x: 4050, y: 345, w: 45, h: 125 };

    // Distant sparkles and candy decorations.
    for (let i = 0; i < 180; i++) {
      decorations.push({
        x: rand(0, levelWidth),
        y: rand(35, 360),
        size: rand(1, 3.5),
        phase: rand(0, 6),
        color: Math.random() > 0.5 ? "#ffffff" : "#ff91d0"
      });
    }

    stars = Array.from({ length: 60 }, () => ({
      x: rand(0, W),
      y: rand(0, 390),
      size: rand(0.5, 2),
      phase: rand(0, 6)
    }));
  }

  function resetGame() {
    buildLevel();

    player.x = 80;
    player.y = 370;
    player.vx = 0;
    player.vy = 0;
    player.face = 1;
    player.grounded = false;
    player.jumps = 0;
    player.dashTime = 0;
    player.dashCooldown = 0;
    player.invulnerable = 0;
    player.animation = 0;
    player.squash = 0;
    player.trail = [];

    camera = 0;
    score = 0;
    candyCount = 0;
    lives = 3;
    particles = [];
    floatingTexts = [];
    shake = 0;
    time = 0;

    updateHUD();
  }

  function setStatus(text) {
    ui.status.textContent = text;
  }

  function showMenu(title, description, buttons, eyebrow = "SUGAR VALLEY") {
    ui.overlay.innerHTML = `
      <div class="menu-panel">
        <div class="eyebrow"><span class="live-dot"></span>${eyebrow}</div>
        <h1 class="hero-title">${title}</h1>
        <p class="hero-description">${description}</p>
        <div class="menu-stats">
          <div><span>WORLD</span><strong>01 <i>/ 05</i></strong></div>
          <div><span>DIFFICULTY</span><strong class="easy">SWEET</strong></div>
          <div><span>BEST SCORE</span><strong>${String(best).padStart(6, "0")}</strong></div>
        </div>
        <div class="dynamic-actions"></div>
        <div class="menu-footer">
          <span>DESIGNED FOR THE SUGAR-OBSESSED</span>
          <span>EST. 2026</span>
        </div>
      </div>
    `;

    const actions = ui.overlay.querySelector(".dynamic-actions");

    buttons.forEach((button, index) => {
      const element = document.createElement("button");
      element.className = index === 0 ? "primary-button" : "secondary-button";
      element.innerHTML = index === 0
        ? `<span>${button.label}</span><span class="button-arrow">↗</span>`
        : `${button.label}<span>＋</span>`;
      element.addEventListener("click", button.action);
      actions.appendChild(element);
    });

    ui.overlay.classList.remove("hidden");
  }

  function startGame() {
    resetGame();
    mode = "playing";
    ui.overlay.classList.add("hidden");
    setStatus("RUN IN PROGRESS");
    sound(520, 0.1);
    last = performance.now();
  }

  function openInstructions() {
    mode = "instructions";
    showMenu("HOW TO<br><span>PLAY</span>",
      "Move with A/D or the arrow keys. Press SPACE to jump and press it again in midair for a double jump. Hold SHIFT to dash through the air. Collect pink lollipops for 10 points and golden stars for 50. Stomp enemies from above to earn 100 bonus points. You have three lives. Reach the finish flag to win.",
      [
        { label: "LET'S PLAY", action: startGame },
        { label: "BACK TO MENU", action: mainMenu }
      ],
      "YOUR MISSION / 001"
    );
  }

  function mainMenu() {
    mode = "menu";
    setStatus("READY TO PLAY");
    showMenu("CANDY<br><span>DASH<span class='title-star'>✳</span></span>",
      "A little chaos. A lot of sugar.<br>Your sweetest adventure starts here.",
      [
        { label: "START YOUR ADVENTURE", action: startGame },
        { label: "HOW TO PLAY", action: openInstructions }
      ]
    );
  }

  function pauseGame() {
    if (mode === "playing") {
      mode = "paused";
      setStatus("RUN PAUSED");
      showMenu("TAKE A<br><span>BREAK</span>",
        "The candy kingdom can wait. Your adventure is paused.",
        [
          { label: "CONTINUE RUNNING", action: () => {
            mode = "playing";
            ui.overlay.classList.add("hidden");
            setStatus("RUN IN PROGRESS");
            last = performance.now();
          }},
          { label: "RESTART RUN", action: startGame },
          { label: "MAIN MENU", action: mainMenu }
        ],
        "PAUSE / SYSTEM HALTED"
      );
    } else if (mode === "paused") {
      mode = "playing";
      ui.overlay.classList.add("hidden");
      setStatus("RUN IN PROGRESS");
      last = performance.now();
    }
  }

  function finishGame(won) {
    if (mode !== "playing") return;

    mode = won ? "won" : "over";

    if (won) {
      score += 250;
      burst(player.x, player.y, "#ffe77d", 65, 390);
      sound(780, 0.25);
      setStatus("LEVEL COMPLETE");
    } else {
      sound(180, 0.3, "triangle");
      setStatus("RUN ENDED");
    }

    if (score > best) {
      best = score;
      try {
        localStorage.setItem("candyDashBestV2", String(best));
      } catch (_) {}
    }

    updateHUD();

    showMenu(
      won ? "SUGAR<br><span>LEGEND!</span>" : "ONE MORE<br><span>TRY?</span>",
      won
        ? `You conquered Sugar Valley! You collected ${candyCount} candies and scored ${score} points, including your 250-point finish bonus.`
        : `The kingdom got the better of you this time. You scored ${score} points and collected ${candyCount} candies. Your next run starts whenever you're ready.`,
      [
        { label: "PLAY AGAIN", action: startGame },
        { label: "MAIN MENU", action: mainMenu }
      ],
      won ? "MISSION COMPLETE / 100%" : "MISSION FAILED / RETRY AVAILABLE"
    );
  }

  function jump() {
    if (mode !== "playing" || player.jumps >= 2) return;

    player.vy = player.jumps === 0 ? -650 : -585;
    player.jumps++;
    player.grounded = false;
    player.squash = -0.25;

    burst(
      player.x + player.w / 2,
      player.y + player.h,
      player.jumps === 1 ? "#ff9bd3" : "#8cf6ff",
      7, 100
    );

    sound(player.jumps === 1 ? 420 : 650, 0.08);
  }

  function dash() {
    if (mode !== "playing" || player.dashCooldown > 0) return;

    player.dashTime = 0.19;
    player.dashCooldown = 0.95;
    player.vx = player.face * 790;
    player.vy *= 0.35;

    burst(
      player.x + player.w / 2,
      player.y + player.h / 2,
      "#ff7bce", 12, 240
    );

    sound(270, 0.13, "sawtooth");
    notify("SUGAR RUSH!");
  }

  function damage() {
    if (player.invulnerable > 0 || mode !== "playing") return;

    lives--;
    player.invulnerable = 1.35;
    player.vy = -340;
    player.vx = -player.face * 260;
    player.squash = 0.3;
    shake = 0.3;

    burst(
      player.x + player.w / 2,
      player.y + player.h / 2,
      "#ff3eaa", 24, 300
    );

    sound(155, 0.18, "sawtooth");
    updateHUD();
    notify(lives > 0 ? "OUCH! WATCH YOUR STEP" : "OUT OF LIVES!");

    if (lives <= 0) finishGame(false);
  }

  function overlaps(a, b) {
    return a.x < b.x + b.w &&
      a.x + a.w > b.x &&
      a.y < b.y + b.h &&
      a.y + a.h > b.y;
  }

  function update(dt) {
    time += dt;

    if (toastTime > 0) {
      toastTime -= dt;
      if (toastTime <= 0) ui.toast.classList.remove("show");
    }

    if (shake > 0) shake -= dt;

    player.animation += dt * (Math.abs(player.vx) > 30 ? 12 : 4);
    player.invulnerable = Math.max(0, player.invulnerable - dt);
    player.dashCooldown = Math.max(0, player.dashCooldown - dt);
    player.dashTime = Math.max(0, player.dashTime - dt);
    player.squash = lerp(player.squash, 0, Math.min(1, dt * 9));

    const left = keys.a || keys.A || keys.ArrowLeft;
    const right = keys.d || keys.D || keys.ArrowRight;

    if (player.dashTime <= 0) {
      if (left) {
        player.vx -= 1500 * dt;
        player.face = -1;
      }

      if (right) {
        player.vx += 1500 * dt;
        player.face = 1;
      }

      if (!left && !right) {
        player.vx *= Math.pow(0.0007, dt);
      }

      player.vx = clamp(player.vx, -315, 315);
    }

    const oldY = player.y;
    const oldBottom = player.y + player.h;

    player.vy += 1580 * dt;
    player.vy = Math.min(player.vy, 920);

    player.x += player.vx * dt;
    player.y += player.vy * dt;

    player.x = clamp(player.x, 0, levelWidth - player.w);
    player.grounded = false;

    // One-way platform collision.
    for (const p of platforms) {
      if (
        player.x + player.w > p.x &&
        player.x < p.x + p.w &&
        oldBottom <= p.y + 10 &&
        player.y + player.h >= p.y &&
        player.vy >= 0
      ) {
        player.y = p.y - player.h;
        player.vy = 0;
        player.grounded = true;
        player.jumps = 0;
      }
    }

    if (player.y > H + 180) {
      damage();
      if (mode === "playing") {
        player.x = Math.max(70, player.x - 100);
        player.y = 300;
        player.vy = -100;
      }
    }

    // Dash afterimages.
    if (player.dashTime > 0) {
      player.trail.push({
        x: player.x, y: player.y, life: 0.28
      });
    }

    player.trail.forEach(t => t.life -= dt);
    player.trail = player.trail.filter(t => t.life > 0);

    // Collectible collision.
    for (const c of candies) {
      if (c.collected) continue;

      const dx = player.x + player.w / 2 - c.x;
      const dy = player.y + player.h / 2 - c.y;
      const radius = c.r + 20;

      if (dx * dx + dy * dy < radius * radius) {
        c.collected = true;

        const points = c.type === "star" ? 50 : 10;
        score += points;
        candyCount++;

        const color = c.type === "star" ? "#ffe77d" : "#ff64bb";

        burst(c.x, c.y, color, c.type === "star" ? 20 : 12, 210);
        floatingText(c.x, c.y - 10, `+${points}`, color);
        sound(c.type === "star" ? 920 : 650, 0.06);
        updateHUD();

        if (c.type === "star") notify("GOLDEN STAR +50");
      }
    }

    // Enemy movement and stomp detection.
    for (const e of enemies) {
      if (!e.alive) continue;

      e.phase += dt * 7;
      e.x += e.direction * e.speed * dt;

      if (e.x < e.min || e.x + e.w > e.max) {
        e.direction *= -1;
      }

      const playerBox = {
        x: player.x + 5,
        y: player.y + 4,
        w: player.w - 10,
        h: player.h - 5
      };

      if (overlaps(playerBox, e)) {
        if (player.vy > 70 && oldBottom < e.y + 18) {
          e.alive = false;
          player.vy = -435;
          player.squash = -0.22;
          score += 100;

          burst(e.x + e.w / 2, e.y + 12, "#ff91d0", 22, 280);
          floatingText(e.x, e.y, "+100 STOMP", "#ffe77d");
          sound(760, 0.12);
          updateHUD();
          notify("MONSTER STOMP +100");
        } else {
          damage();
        }
      }
    }

    // The goal triggers the level-completion state.
    if (goal && overlaps(player, goal)) {
      finishGame(true);
    }

    // Smooth camera tracking.
    const targetCamera = clamp(player.x - W * 0.35, 0, levelWidth - W);
    camera = lerp(camera, targetCamera, Math.min(1, dt * 5));

    // Particle physics.
    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 430 * dt;
      p.rotation += p.spin * dt;
      p.life -= dt;
    }
    particles = particles.filter(p => p.life > 0);

    for (const f of floatingTexts) {
      f.y -= 38 * dt;
      f.life -= dt;
    }
    floatingTexts = floatingTexts.filter(f => f.life > 0);
  }

  // -------------------------------------------------------
  // WORLD RENDERING
  // -------------------------------------------------------

  function drawBackground() {
    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, "#21103e");
    gradient.addColorStop(0.4, "#563080");
    gradient.addColorStop(0.78, "#f38bc9");
    gradient.addColorStop(1, "#ffd6eb");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);

    // Moon-like candy planet.
    const planetX = 825 - camera * 0.04;
    const planetY = 150;

    ctx.save();
    ctx.shadowBlur = 48;
    ctx.shadowColor = "#ff8acb";
    ctx.fillStyle = "#ffb7e2";
    ctx.beginPath();
    ctx.arc(planetX, planetY, 58, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = "#ff90ce";
    ctx.beginPath();
    ctx.arc(planetX + 20, planetY - 20, 17, 0, Math.PI * 2);
    ctx.arc(planetX - 25, planetY + 19, 12, 0, Math.PI * 2);
    ctx.fill();

    // Twinkling stars.
    for (const s of stars) {
      const alpha = 0.35 + Math.sin(time * 2 + s.phase) * 0.35;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(s.x, s.y, s.size, s.size);
    }
    ctx.globalAlpha = 1;

    // Parallax candy mountains.
    for (let layer = 0; layer < 3; layer++) {
      const speed = 0.12 + layer * 0.11;
      const base = 380 + layer * 45;
      const colors = ["#633d92", "#9560b9", "#dc88c7"];

      ctx.fillStyle = colors[layer];
      ctx.beginPath();
      ctx.moveTo(0, H);

      for (let x = -200; x <= W + 220; x += 12) {
        const worldX = x + camera * speed;
        const y = base
          - Math.sin(worldX * 0.003 + layer) * 45
          - Math.sin(worldX * 0.008) * 15;

        ctx.lineTo(x, y);
      }

      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fill();
    }

    // Giant lollipop decorations in the distance.
    for (let i = 0; i < 10; i++) {
      const worldX = i * 460 + 130;
      const x = worldX - camera * 0.25;

      if (x < -100 || x > W + 100) continue;

      const y = 325 + Math.sin(i * 2) * 20;

      ctx.strokeStyle = "#fff1fa99";
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(x, y + 22);
      ctx.lineTo(x, y + 140);
      ctx.stroke();

      ctx.save();
      ctx.shadowBlur = 22;
      ctx.shadowColor = "#ff75c9";
      ctx.fillStyle = ["#ff6cb9", "#b98bff", "#76e9ff"][i % 3];
      ctx.beginPath();
      ctx.arc(x, y, 36, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.strokeStyle = "#ffffffbb";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(x, y, 25, time * 0.1, time * 0.1 + Math.PI * 1.5);
      ctx.stroke();
    }

    // Tiny sparkling candy dust.
    for (const d of decorations) {
      const x = d.x - camera * 0.38;
      if (x < -5 || x > W + 5) continue;

      const alpha = 0.25 + Math.sin(time * 2.5 + d.phase) * 0.22;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = d.color;
      ctx.fillRect(x, d.y, d.size, d.size);
    }

    ctx.globalAlpha = 1;
  }

  function drawCandyGround() {
    const gradient = ctx.createLinearGradient(0, 490, 0, H);
    gradient.addColorStop(0, "#ff9cd8");
    gradient.addColorStop(0.15, "#ff74c5");
    gradient.addColorStop(1, "#c64da8");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 500, W, H - 500);

    // Shiny icing ripples.
    ctx.strokeStyle = "#ffe8fa8c";
    ctx.lineWidth = 3;

    for (let i = 0; i < 10; i++) {
      const x = ((i * 150 - camera * 0.65) % (W + 150) + W + 150) % (W + 150);

      ctx.beginPath();
      ctx.moveTo(x, 530);
      ctx.bezierCurveTo(x + 25, 510, x + 55, 550, x + 80, 530);
      ctx.stroke();
    }

    // Candy sprinkles.
    for (let i = 0; i < 85; i++) {
      const x = ((i * 71 - camera * 0.8) % (W + 80) + W + 80) % (W + 80);
      const y = 550 + (i * 31) % 55;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((i % 3) * 0.7);
      ctx.fillStyle = ["#fff3b0", "#bdfcff", "#ffdcf1", "#cdb2ff"][i % 4];
      roundedRect(-4, -1.5, 8, 3, 2, ctx.fillStyle);
      ctx.restore();
    }
  }

  function drawPlatform(p) {
    const x = p.x - camera;
    const y = p.y;

    if (x + p.w < -30 || x > W + 30) return;

    const palettes = {
      pink: ["#ff75c6", "#b82b8c", "#ffb6e1"],
      purple: ["#b58aff", "#6138a7", "#ddc8ff"],
      cyan: ["#73efff", "#258eae", "#c2fbff"]
    };

    const colors = palettes[p.type] || palettes.pink;

    ctx.save();

    // Under-platform shadow.
    ctx.fillStyle = "#31154b55";
    ctx.beginPath();
    ctx.roundRect(x + 3, y + 12, p.w, p.h, 8);
    ctx.fill();

    // Glowing icing lip.
    ctx.shadowBlur = 17;
    ctx.shadowColor = colors[0];
    roundedRect(x, y, p.w, p.h, 9, colors[1]);
    ctx.shadowBlur = 0;

    roundedRect(x, y - 8, p.w, 17, 8, colors[0]);
    roundedRect(x + 4, y - 5, p.w - 8, 4, 2, colors[2]);

    // Colorful sprinkles on the icing.
    for (const d of p.decorations) {
      if (d.x > p.w - 5) continue;
      roundedRect(x + d.x, y - 4, 9, 3, 2, d.color);
    }

    // Chocolate wafer crosshatch.
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y + 10, p.w, p.h - 10);
    ctx.clip();

    ctx.strokeStyle = "#4a1c6655";
    ctx.lineWidth = 2;

    for (let dx = -p.h; dx < p.w + p.h; dx += 22) {
      ctx.beginPath();
      ctx.moveTo(x + dx, y + 8);
      ctx.lineTo(x + dx + p.h, y + p.h + 10);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x + dx, y + p.h + 10);
      ctx.lineTo(x + dx + p.h, y + 8);
      ctx.stroke();
    }

    ctx.restore();
    ctx.restore();
  }

  function drawLollipop(c) {
    const x = c.x - camera;
    const bob = Math.sin(time * 3 + c.phase) * 5;
    const y = c.y + bob;

    if (x < -40 || x > W + 40) return;

    ctx.save();

    if (c.type === "star") {
      ctx.shadowBlur = 24;
      ctx.shadowColor = "#ffe77d";
      ctx.translate(x, y);
      ctx.rotate(Math.sin(time * 1.5 + c.phase) * 0.12);

      ctx.fillStyle = "#ffe77d";
      ctx.strokeStyle = "#fff8d5";
      ctx.lineWidth = 2.5;
      ctx.beginPath();

      for (let i = 0; i < 10; i++) {
        const angle = -Math.PI / 2 + i * Math.PI / 5;
        const radius = i % 2 === 0 ? 15 : 7;

        const sx = Math.cos(angle) * radius;
        const sy = Math.sin(angle) * radius;

        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }

      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(-3, -5, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.shadowBlur = 16;
      ctx.shadowColor = "#ff49b8";

      ctx.strokeStyle = "#fff1fc";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x, y + 6);
      ctx.lineTo(x, y + 26);
      ctx.stroke();

      ctx.fillStyle = "#fff1fc";
      ctx.beginPath();
      ctx.arc(x, y, 12, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#ff4cb2";
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#ffb4de";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(x, y, 6, time + c.phase, time + c.phase + Math.PI * 1.5);
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(x - 3, y - 4, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  // -------------------------------------------------------
  // CHARACTER AND ENEMIES
  // -------------------------------------------------------

  function drawPlayerShape(x, y, facing = 1, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x + player.w / 2, y + player.h / 2);
    ctx.scale(facing, 1);

    const run = player.grounded
      ? Math.sin(player.animation) * 5
      : -2;

    // Shadow.
    ctx.fillStyle = "#2a123e42";
    ctx.beginPath();
    ctx.ellipse(0, 27, 17, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Hair ponytail.
    ctx.fillStyle = "#562347";
    ctx.beginPath();
    ctx.ellipse(-15, -12, 9, 12, -0.6, 0, Math.PI * 2);
    ctx.fill();

    // Legs and boots.
    ctx.strokeStyle = "#6732ac";
    ctx.lineWidth = 7;
    ctx.lineCap = "round";

    ctx.beginPath();
    ctx.moveTo(-7, 13);
    ctx.lineTo(-9 + run, 22);
    ctx.moveTo(7, 13);
    ctx.lineTo(9 - run, 22);
    ctx.stroke();

    roundedRect(-18 + run, 18, 15, 7, 4, "#ff4caa");
    roundedRect(4 - run, 18, 15, 7, 4, "#ff4caa");

    // Main hoodie.
    roundedRect(-15, -8, 30, 25, 9, "#ff3eaa");
    roundedRect(-8, -3, 16, 15, 5, "#ff9bd1");

    // Hood details.
    ctx.strokeStyle = "#ffcae7";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -1, 7, 0.2, Math.PI - 0.2);
    ctx.stroke();

    // Face.
    ctx.fillStyle = "#ffc99e";
    ctx.beginPath();
    ctx.ellipse(2, -12, 13, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    // Hair fringe.
    ctx.fillStyle = "#562347";
    ctx.beginPath();
    ctx.arc(0, -17, 14, Math.PI, Math.PI * 2);
    ctx.quadraticCurveTo(13, -20, 12, -10);
    ctx.quadraticCurveTo(4, -17, -2, -11);
    ctx.quadraticCurveTo(-9, -6, -11, -14);
    ctx.fill();

    // Eyes.
    ctx.fillStyle = "#442039";
    ctx.beginPath();
    ctx.ellipse(-3, -12, 1.8, 2.7, 0, 0, Math.PI * 2);
    ctx.ellipse(7, -12, 1.8, 2.7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Smile.
    ctx.strokeStyle = "#b94e6e";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(2, -7, 4, 0.15, Math.PI - 0.15);
    ctx.stroke();

    // Hair bow.
    ctx.fillStyle = "#ff3eaa";
    ctx.beginPath();
    ctx.moveTo(-10, -23);
    ctx.lineTo(-18, -31);
    ctx.lineTo(-17, -21);
    ctx.lineTo(-7, -30);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  function drawPlayer() {
    if (player.invulnerable > 0 && Math.floor(time * 18) % 2 === 0) {
      return;
    }

    for (const trail of player.trail) {
      const alpha = trail.life / 0.28;
      drawPlayerShape(
        trail.x - camera,
        trail.y,
        player.face,
        alpha * 0.28
      );
    }

    drawPlayerShape(
      player.x - camera,
      player.y,
      player.face,
      1
    );
  }

  function drawEnemy(e) {
    const x = e.x - camera;
    const bounce = Math.sin(e.phase) * 3;
    const y = e.y + bounce;

    ctx.save();

    ctx.shadowBlur = 15;
    ctx.shadowColor = e.type === "gumdrop" ? "#a981ff" : "#ff53b8";

    // Jelly body.
    ctx.fillStyle = e.type === "gumdrop" ? "#a57aff" : "#e84b9d";
    ctx.beginPath();
    ctx.moveTo(x, y + 30);
    ctx.bezierCurveTo(x - 4, y + 15, x + 2, y + 2, x + 17, y + 2);
    ctx.bezierCurveTo(x + 33, y + 2, x + 38, y + 16, x + 35, y + 30);
    ctx.quadraticCurveTo(x + 18, y + 39, x, y + 30);
    ctx.fill();

    ctx.shadowBlur = 0;

    // Icing and sprinkles.
    roundedRect(x + 2, y + 8, 31, 9, 5, "#ffcaeb");

    for (let i = 0; i < 4; i++) {
      ctx.save();
      ctx.translate(x + 6 + i * 8, y + 11);
      ctx.rotate(i * 0.4);
      roundedRect(-2, -1, 4, 2, 1,
        ["#ffe77d", "#8cf6ff", "#ffffff", "#bda0ff"][i]);
      ctx.restore();
    }

    // Eyes.
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(x + 11, y + 22, 5, 0, Math.PI * 2);
    ctx.arc(x + 24, y + 22, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#29103d";
    ctx.beginPath();
    ctx.arc(x + 12, y + 23, 2.5, 0, Math.PI * 2);
    ctx.arc(x + 23, y + 23, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Mischievous mouth.
    ctx.strokeStyle = "#521944";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 13, y + 29);
    ctx.lineTo(x + 17, y + 31);
    ctx.lineTo(x + 23, y + 28);
    ctx.stroke();

    ctx.restore();
  }

  function drawGoal() {
    if (!goal) return;

    const x = goal.x - camera;
    const y = goal.y;

    ctx.save();

    ctx.shadowBlur = 20;
    ctx.shadowColor = "#ffe77d";

    ctx.fillStyle = "#fff6ff";
    roundedRect(x + 18, y, 7, 155, 3, "#fff6ff");

    ctx.shadowBlur = 0;

    ctx.fillStyle = "#ff3eaa";
    ctx.beginPath();
    ctx.moveTo(x + 25, y + 4);
    ctx.lineTo(x + 91, y + 22);
    ctx.lineTo(x + 25, y + 42);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#ffe77d";
    ctx.beginPath();
    ctx.arc(x + 21, y - 3, 11, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 11px Fredoka";
    ctx.fillText("FINISH", x - 2, y - 15);

    ctx.restore();
  }

  function drawEffects() {
    for (const p of particles) {
      ctx.save();

      ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
      ctx.translate(p.x - camera, p.y);
      ctx.rotate(p.rotation);

      ctx.fillStyle = p.color;

      if (p.shape === "square") {
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    for (const f of floatingTexts) {
      ctx.save();
      ctx.globalAlpha = clamp(f.life, 0, 1);
      ctx.fillStyle = f.color;
      ctx.textAlign = "center";
      ctx.font = "bold 17px Fredoka";
      ctx.shadowBlur = 10;
      ctx.shadowColor = f.color;
      ctx.fillText(f.text, f.x - camera, f.y);
      ctx.restore();
    }
  }

  function drawProgress() {
    const x = 22, y = H - 23, width = 180;

    roundedRect(x, y, width, 5, 3, "#180b3988");
    roundedRect(
      x, y,
      width * clamp(player.x / goal.x, 0, 1),
      5, 3, "#ff55b7"
    );

    ctx.fillStyle = "#fff";
    ctx.font = "9px 'Space Mono'";
    ctx.fillText("SUGAR VALLEY", x, y - 9);

    if (player.dashCooldown > 0) {
      const dx = W - 130;
      const ready = 1 - player.dashCooldown / 0.95;

      roundedRect(dx, y, 108, 5, 3, "#180b3988");
      roundedRect(dx, y, 108 * ready, 5, 3, "#83f5ff");

      ctx.fillStyle = "#fff";
      ctx.textAlign = "right";
      ctx.fillText(ready >= 1 ? "DASH READY" : "DASH CHARGING", W - 22, y - 9);
      ctx.textAlign = "left";
    }
  }

  function render() {
    ctx.clearRect(0, 0, W, H);

    drawBackground();

    ctx.save();

    if (shake > 0) {
      ctx.translate(rand(-4, 4), rand(-3, 3));
    }

    drawCandyGround();

    for (const p of platforms) drawPlatform(p);
    for (const c of candies) {
      if (!c.collected) drawLollipop(c);
    }
    for (const e of enemies) {
      if (e.alive) drawEnemy(e);
    }

    drawGoal();
    drawPlayer();
    drawEffects();

    ctx.restore();

    drawProgress();
  }

  // -------------------------------------------------------
  // INPUT
  // -------------------------------------------------------

  window.addEventListener("keydown", event => {
    const key = event.key;

    if ([" ", "ArrowUp", "ArrowLeft", "ArrowRight", "ArrowDown"].includes(key)) {
      event.preventDefault();
    }

    if (event.repeat && [" ", "ArrowUp", "w", "W", "Shift"].includes(key)) {
      return;
    }

    keys[key] = true;

    if (key === " " || key === "ArrowUp" || key === "w" || key === "W") {
      jump();
    }

    if (key === "Shift") dash();
    if (key === "Escape") pauseGame();

    if ((key === "r" || key === "R") && mode !== "menu" && mode !== "instructions") {
      startGame();
    }

    if (key === "Enter" && mode === "menu") {
      startGame();
    }
  });

  window.addEventListener("keyup", event => {
    keys[event.key] = false;
  });

  window.addEventListener("blur", () => {
    keys = {};
    if (mode === "playing") pauseGame();
  });

  function holdButton(id, key) {
    const button = $(id);

    const down = event => {
      event.preventDefault();
      keys[key] = true;
    };

    const up = event => {
      event.preventDefault();
      keys[key] = false;
    };

    button.addEventListener("pointerdown", down);
    button.addEventListener("pointerup", up);
    button.addEventListener("pointerleave", up);
    button.addEventListener("pointercancel", up);
  }

  holdButton("leftBtn", "ArrowLeft");
  holdButton("rightBtn", "ArrowRight");

  $("jumpBtn").addEventListener("pointerdown", event => {
    event.preventDefault();
    jump();
  });

  $("dashBtn").addEventListener("pointerdown", event => {
    event.preventDefault();
    dash();
  });

  $("playBtn").addEventListener("click", startGame);
  $("howBtn").addEventListener("click", openInstructions);
  $("pauseBtn").addEventListener("click", pauseGame);

  $("soundBtn").addEventListener("click", () => {
    soundOn = !soundOn;
    $("soundIcon").textContent = soundOn ? "♫" : "×";
    if (soundOn) sound(650, 0.07);
  });

  // -------------------------------------------------------
  // MAIN LOOP
  // -------------------------------------------------------

  function frame(now) {
    const dt = Math.min((now - last) / 1000 || 0, 0.033);
    last = now;

    if (mode === "playing") {
      update(dt);
    } else {
      time += dt * 0.45;

      if (toastTime > 0) {
        toastTime -= dt;
        if (toastTime <= 0) ui.toast.classList.remove("show");
      }

      for (const p of particles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 430 * dt;
        p.rotation += p.spin * dt;
        p.life -= dt;
      }

      particles = particles.filter(p => p.life > 0);
    }

    render();
    requestAnimationFrame(frame);
  }

  resetGame();
  mainMenu();
  last = performance.now();
  requestAnimationFrame(frame);
})();
