const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const timeLeftEl = document.getElementById("timeLeft");
const distanceLeftEl = document.getElementById("distanceLeft");
const scoreValueEl = document.getElementById("scoreValue");
const highScoreValueEl = document.getElementById("highScoreValue");
const statusTextEl = document.getElementById("statusText");
const startButton = document.getElementById("startButton");

const GAME_TIME_SECONDS = 30;
const COURSE_DISTANCE = 1000;
const HIGH_SCORE_KEY = "robbie-ski-highscore-v1";

const keys = {
  ArrowLeft: false,
  ArrowRight: false,
  ArrowUp: false,
  ArrowDown: false,
  Space: false
};

const state = {
  running: false,
  won: false,
  lost: false,
  timeLeft: GAME_TIME_SECONDS,
  distanceTravelled: 0,
  elapsed: 0,
  score: 0,
  highScore: 0,
  falls: 0,
  player: {
    x: canvas.width / 2,
    y: canvas.height * 0.76,
    baseSpeed: 160,
    boostSpeed: 260,
    lateralSpeed: 210,
    verticalAdjust: 90,
    falling: false,
    fallTimer: 0,
    fallDuration: 1.1
  },
  obstacles: [],
  spawnTimer: 0,
  stars: []
};

let audioCtx = null;

function initStars() {
  state.stars = [];
  for (let i = 0; i < 20; i += 1) {
    state.stars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * (canvas.height * 0.32),
      r: 1 + Math.random() * 2
    });
  }
}

function safeNumber(raw, fallback = 0) {
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function loadHighScore() {
  const raw = localStorage.getItem(HIGH_SCORE_KEY);
  state.highScore = Math.max(0, Math.floor(safeNumber(raw, 0)));
  highScoreValueEl.textContent = state.highScore.toString();
}

function saveHighScore() {
  localStorage.setItem(HIGH_SCORE_KEY, state.highScore.toString());
}

function ensureAudio() {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}

function beep(freq, duration, type, volume = 0.05) {
  if (!audioCtx) return;
  const oscillator = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  oscillator.type = type;
  oscillator.frequency.value = freq;
  gain.gain.value = volume;
  oscillator.connect(gain);
  gain.connect(audioCtx.destination);
  oscillator.start();
  oscillator.stop(audioCtx.currentTime + duration);
}

function soundCrash() {
  beep(120, 0.12, "sawtooth", 0.08);
  setTimeout(() => beep(80, 0.15, "square", 0.07), 80);
}

function soundWin() {
  beep(420, 0.1, "square", 0.06);
  setTimeout(() => beep(560, 0.1, "square", 0.06), 110);
  setTimeout(() => beep(740, 0.16, "triangle", 0.07), 220);
}

function soundLose() {
  beep(260, 0.12, "triangle", 0.06);
  setTimeout(() => beep(200, 0.14, "triangle", 0.06), 120);
  setTimeout(() => beep(140, 0.16, "triangle", 0.07), 240);
}

function soundBoost() {
  beep(680, 0.03, "square", 0.03);
}

function updateHud() {
  timeLeftEl.textContent = state.timeLeft.toFixed(1);
  distanceLeftEl.textContent = Math.max(
    0,
    Math.round(COURSE_DISTANCE - state.distanceTravelled)
  ).toString();
  scoreValueEl.textContent = Math.max(0, Math.round(state.score)).toString();
  highScoreValueEl.textContent = state.highScore.toString();
}

function resetGame() {
  ensureAudio();
  state.running = true;
  state.won = false;
  state.lost = false;
  state.timeLeft = GAME_TIME_SECONDS;
  state.distanceTravelled = 0;
  state.elapsed = 0;
  state.score = 0;
  state.falls = 0;
  state.spawnTimer = 0;
  state.obstacles = [];

  state.player.x = canvas.width / 2;
  state.player.y = canvas.height * 0.76;
  state.player.falling = false;
  state.player.fallTimer = 0;

  statusTextEl.textContent = "SKI!";
  startButton.textContent = "Opnieuw";
  updateHud();
}

function spawnObstacle() {
  const types = ["tree", "skier", "snowman"];
  const type = types[Math.floor(Math.random() * types.length)];
  const size = type === "tree" ? 22 : type === "skier" ? 20 : 18;
  const lanePadding = 24;
  const x = lanePadding + Math.random() * (canvas.width - lanePadding * 2);
  const y = -40 - Math.random() * 80;
  const speed = 170 + Math.random() * 95;
  state.obstacles.push({ x, y, size, speed, type });
}

function finishGame(won) {
  state.running = false;
  state.won = won;
  state.lost = !won;
  if (won) {
    statusTextEl.textContent = "Gewonnen!";
    state.score += Math.round(state.timeLeft * 24) + 1000;
    soundWin();
  } else {
    statusTextEl.textContent = "Te laat!";
    state.score = Math.max(0, state.score - 200);
    soundLose();
  }
  state.score = Math.max(0, Math.round(state.score));
  if (state.score > state.highScore) {
    state.highScore = state.score;
    saveHighScore();
  }
  updateHud();
}

function checkCollision(ob, p) {
  const dx = Math.abs(ob.x - p.x);
  const dy = Math.abs(ob.y - p.y);
  return dx < ob.size * 0.72 && dy < ob.size * 0.78;
}

function update(dt) {
  if (!state.running) return;

  const p = state.player;
  state.elapsed += dt;

  if (p.falling) {
    p.fallTimer -= dt;
    if (p.fallTimer <= 0) {
      p.falling = false;
      statusTextEl.textContent = "Door!";
    }
    updateHud();
    return;
  }

  if (keys.ArrowLeft) p.x -= p.lateralSpeed * dt;
  if (keys.ArrowRight) p.x += p.lateralSpeed * dt;
  if (keys.ArrowUp) p.y -= p.verticalAdjust * dt;
  if (keys.ArrowDown) p.y += p.verticalAdjust * dt;

  p.x = Math.max(16, Math.min(canvas.width - 16, p.x));
  p.y = Math.max(canvas.height * 0.44, Math.min(canvas.height - 28, p.y));

  const speed = keys.Space ? p.boostSpeed : p.baseSpeed;
  const distanceGain = speed * dt * 0.9;
  state.distanceTravelled += distanceGain;
  state.score += distanceGain * 0.28;
  if (keys.Space) {
    state.score += distanceGain * 0.05;
  }

  state.timeLeft = Math.max(0, GAME_TIME_SECONDS - state.elapsed);
  if (state.timeLeft <= 0) {
    finishGame(false);
    return;
  }

  if (state.distanceTravelled >= COURSE_DISTANCE) {
    finishGame(true);
    return;
  }

  state.spawnTimer += dt;
  if (state.spawnTimer > 0.42) {
    spawnObstacle();
    state.spawnTimer = 0;
  }

  for (const ob of state.obstacles) {
    ob.y += ob.speed * dt;
  }
  state.obstacles = state.obstacles.filter((ob) => ob.y < canvas.height + 52);

  for (const ob of state.obstacles) {
    if (checkCollision(ob, p)) {
      p.falling = true;
      p.fallTimer = p.fallDuration;
      state.elapsed += 1.5;
      state.falls += 1;
      state.score = Math.max(0, state.score - 160);
      statusTextEl.textContent = "Oei! Gevallen...";
      soundCrash();
      break;
    }
  }

  updateHud();
}

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, "#d7ebff");
  sky.addColorStop(0.32, "#eaf5ff");
  sky.addColorStop(0.33, "#f5fbff");
  sky.addColorStop(1, "#f0f7ff");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#bfdfff";
  ctx.beginPath();
  ctx.moveTo(0, 255);
  ctx.lineTo(100, 120);
  ctx.lineTo(190, 255);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(canvas.width, 250);
  ctx.lineTo(canvas.width - 110, 108);
  ctx.lineTo(canvas.width - 220, 250);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#e6f3ff";
  ctx.beginPath();
  ctx.moveTo(90, 0);
  ctx.lineTo(24, canvas.height);
  ctx.lineTo(0, canvas.height);
  ctx.lineTo(0, 0);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(canvas.width - 90, 0);
  ctx.lineTo(canvas.width - 18, canvas.height);
  ctx.lineTo(canvas.width, canvas.height);
  ctx.lineTo(canvas.width, 0);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  for (const star of state.stars) {
    const blink = 0.7 + Math.sin(state.elapsed * 2 + star.x) * 0.3;
    ctx.globalAlpha = blink;
    ctx.fillRect(star.x, star.y, star.r, star.r);
  }
  ctx.globalAlpha = 1;

  ctx.strokeStyle = "#c2dfff";
  ctx.lineWidth = 2;
  for (let i = 0; i < 13; i += 1) {
    const y = (i * 66 + (state.elapsed * 180) % 66) % canvas.height;
    ctx.beginPath();
    ctx.moveTo(canvas.width * 0.35, y);
    ctx.lineTo(canvas.width * 0.31, y + 40);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(canvas.width * 0.65, y);
    ctx.lineTo(canvas.width * 0.69, y + 40);
    ctx.stroke();
  }
}

function drawTree(ob) {
  ctx.fillStyle = "#1f6b36";
  ctx.fillRect(ob.x - 2, ob.y + ob.size * 0.4, 4, 10);
  ctx.fillStyle = "#2f8f47";
  ctx.beginPath();
  ctx.moveTo(ob.x, ob.y - ob.size);
  ctx.lineTo(ob.x - ob.size * 0.65, ob.y + ob.size * 0.1);
  ctx.lineTo(ob.x + ob.size * 0.65, ob.y + ob.size * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#39a657";
  ctx.fillRect(ob.x - 4, ob.y - ob.size * 0.35, 8, 6);
}

function drawSnowman(ob) {
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(ob.x, ob.y + 6, ob.size * 0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(ob.x, ob.y - 8, ob.size * 0.32, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ff8f31";
  ctx.fillRect(ob.x + 1, ob.y - 9, 5, 2);
  ctx.fillStyle = "#222";
  ctx.fillRect(ob.x - 3, ob.y - 12, 2, 2);
  ctx.fillRect(ob.x + 1, ob.y - 12, 2, 2);
}

function drawOtherSkier(ob) {
  ctx.fillStyle = "#d63e4d";
  ctx.fillRect(ob.x - 6, ob.y - 13, 12, 17);
  ctx.fillStyle = "#ffdcb2";
  ctx.fillRect(ob.x - 5, ob.y - 20, 10, 7);
  ctx.fillStyle = "#25364e";
  ctx.fillRect(ob.x - 10, ob.y + 4, 20, 3);
  ctx.fillStyle = "#1e1e1e";
  ctx.fillRect(ob.x - 7, ob.y - 24, 14, 3);
}

function drawPlayer() {
  const p = state.player;
  const tilt = keys.ArrowLeft ? -0.25 : keys.ArrowRight ? 0.25 : 0;
  const wobble = Math.sin(state.elapsed * 16) * 0.03;

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.falling ? Math.sin(state.elapsed * 30) * 0.75 : tilt + wobble);

  ctx.fillStyle = p.falling ? "#f65c5c" : "#3557d6";
  ctx.fillRect(-9, -15, 18, 22);
  ctx.fillStyle = "#243e9e";
  ctx.fillRect(-9, -2, 18, 3);
  ctx.fillStyle = "#ffd9b2";
  ctx.fillRect(-6, -23, 12, 8);
  ctx.fillStyle = "#1c1c1c";
  ctx.fillRect(-8, -26, 16, 3);
  ctx.fillStyle = "#2f2f2f";
  ctx.fillRect(-16, 8, 32, 3);

  if (keys.Space && state.running && !p.falling) {
    ctx.fillStyle = "#ffd34d";
    ctx.fillRect(-12, 13, 24, 3);
    ctx.fillStyle = "#fff39f";
    ctx.fillRect(-10, 16, 20, 2);
  }

  ctx.restore();
}

function drawObstacles() {
  for (const ob of state.obstacles) {
    if (ob.type === "tree") drawTree(ob);
    if (ob.type === "snowman") drawSnowman(ob);
    if (ob.type === "skier") drawOtherSkier(ob);
  }
}

function drawOverlay() {
  if (state.running) return;
  ctx.fillStyle = "rgba(6, 12, 26, 0.75)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = "center";

  if (!state.won && !state.lost) {
    ctx.fillStyle = "#fff";
    ctx.font = "bold 26px Courier New";
    ctx.fillText("Robbie Ski Sprint", canvas.width / 2, canvas.height / 2 - 18);
    ctx.font = "18px Courier New";
    ctx.fillText("Klik op Start ronde", canvas.width / 2, canvas.height / 2 + 20);
    return;
  }

  if (state.won) {
    ctx.fillStyle = "#7df79a";
    ctx.font = "bold 34px Courier New";
    ctx.fillText("Finish gehaald!", canvas.width / 2, 100);

    ctx.fillStyle = "#e4ecff";
    ctx.fillRect(canvas.width / 2 - 120, 460, 80, 120);
    ctx.fillRect(canvas.width / 2 - 30, 430, 80, 150);
    ctx.fillRect(canvas.width / 2 + 60, 490, 80, 90);
    ctx.fillStyle = "#202020";
    ctx.font = "bold 22px Courier New";
    ctx.fillText("2", canvas.width / 2 - 80, 445);
    ctx.fillText("1", canvas.width / 2 + 10, 415);
    ctx.fillText("3", canvas.width / 2 + 100, 475);
    ctx.fillStyle = "#ffd34d";
    ctx.font = "18px Courier New";
    ctx.fillText("Podium! Score: " + Math.round(state.score), canvas.width / 2, 620);
  } else {
    ctx.fillStyle = "#ff8f8f";
    ctx.font = "bold 34px Courier New";
    ctx.fillText("Niet gehaald", canvas.width / 2, canvas.height / 2 - 22);
    ctx.fillStyle = "#fff";
    ctx.font = "18px Courier New";
    ctx.fillText("Score: " + Math.round(state.score), canvas.width / 2, canvas.height / 2 + 14);
    ctx.fillText("Probeer nog een ronde", canvas.width / 2, canvas.height / 2 + 44);
  }
}

function render() {
  drawBackground();
  drawObstacles();
  drawPlayer();
  drawOverlay();
}

let previousTime = performance.now();
let boostSoundCooldown = 0;

function gameLoop(now) {
  const dt = Math.min(0.032, (now - previousTime) / 1000);
  previousTime = now;

  if (keys.Space && state.running && !state.player.falling) {
    boostSoundCooldown -= dt;
    if (boostSoundCooldown <= 0) {
      soundBoost();
      boostSoundCooldown = 0.09;
    }
  } else {
    boostSoundCooldown = 0;
  }

  update(dt);
  render();
  requestAnimationFrame(gameLoop);
}

function setKeyState(event, isDown) {
  if (event.code in keys) {
    event.preventDefault();
    keys[event.code] = isDown;
  }
}

window.addEventListener("keydown", (e) => setKeyState(e, true));
window.addEventListener("keyup", (e) => setKeyState(e, false));
startButton.addEventListener("click", resetGame);

initStars();
loadHighScore();
updateHud();
requestAnimationFrame(gameLoop);
