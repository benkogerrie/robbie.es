const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const timeLeftEl = document.getElementById("timeLeft");
const distanceLeftEl = document.getElementById("distanceLeft");
const scoreValueEl = document.getElementById("scoreValue");
const highScoreValueEl = document.getElementById("highScoreValue");
const statusTextEl = document.getElementById("statusText");
const startButton = document.getElementById("startButton");

const GAME_TIME_SECONDS = 30;
const FINISH_TARGET_METERS = 4300;
const FINISH_REVEAL_METERS = 700;
const FINISH_REVEAL_SECONDS = 4;
const FINISH_GRACE_SECONDS = 6;
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
    y: canvas.height * 0.8,
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
  stars: [],
  finishLineY: -999,
  finishVisible: false,
  finishOvertime: 0
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
  distanceLeftEl.textContent = Math.max(0, Math.round(state.distanceTravelled)).toString();
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
  state.finishLineY = -999;
  state.finishVisible = false;
  state.finishOvertime = 0;

  state.player.x = canvas.width / 2;
  state.player.y = canvas.height * 0.8;
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
  const spawnY = 28;
  const pisteHalf = pisteHalfWidthAt(spawnY) - 16;
  const targetBias = Math.random() < 0.65;
  const targetX = targetBias
    ? state.player.x + (Math.random() * 2 - 1) * 80
    : canvas.width / 2 + (Math.random() * 2 - 1) * pisteHalf;
  const x = Math.max(
    canvas.width / 2 - pisteHalf,
    Math.min(canvas.width / 2 + pisteHalf, targetX)
  );
  const y = -40 - Math.random() * 80;
  const speed = 220 + Math.random() * 150;
  const drift = type === "skier" ? (Math.random() * 2 - 1) * 42 : (Math.random() * 2 - 1) * 14;
  state.obstacles.push({ x, y, size, speed, drift, type });
}

function finishGame(won) {
  state.running = false;
  state.won = won;
  state.lost = !won;
  if (won) {
    statusTextEl.textContent = "Finish!";
    state.score += Math.round(state.distanceTravelled * 0.32) + 500;
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

function pisteHalfWidthAt(y) {
  const top = canvas.width * 0.16;
  const bottom = canvas.width * 0.49;
  const t = Math.max(0, Math.min(1, y / canvas.height));
  return top + (bottom - top) * t;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
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

  const skierHalfWidth = 18;
  const pisteHalf = pisteHalfWidthAt(p.y) - skierHalfWidth;
  p.x = Math.max(canvas.width / 2 - pisteHalf, Math.min(canvas.width / 2 + pisteHalf, p.x));
  p.y = Math.max(canvas.height * 0.4, Math.min(canvas.height - 28, p.y));

  const speed = keys.Space ? p.boostSpeed : p.baseSpeed;
  const distanceGain = speed * dt * 0.9;
  state.distanceTravelled += distanceGain;
  state.score += distanceGain * 0.28;
  if (keys.Space) {
    state.score += distanceGain * 0.05;
  }

  state.timeLeft = Math.max(0, GAME_TIME_SECONDS - state.elapsed);
  const remainingMeters = Math.max(0, FINISH_TARGET_METERS - state.distanceTravelled);
  const revealByDistance = clamp01(1 - remainingMeters / FINISH_REVEAL_METERS);
  const revealByTime = clamp01(1 - state.timeLeft / FINISH_REVEAL_SECONDS);
  const revealProgress = Math.max(revealByDistance, revealByTime);

  state.finishVisible = revealProgress > 0;
  if (state.finishVisible) {
    state.finishLineY = -80 + revealProgress * (canvas.height + 90);
  }

  if (state.timeLeft > 0) {
    state.spawnTimer += dt;
  }
  if (state.timeLeft > 0 && state.spawnTimer > 0.23) {
    spawnObstacle();
    state.spawnTimer = 0;
  }

  for (const ob of state.obstacles) {
    ob.y += ob.speed * dt;
    ob.x += ob.drift * dt;
    const half = pisteHalfWidthAt(ob.y) - 12;
    const minX = canvas.width / 2 - half;
    const maxX = canvas.width / 2 + half;
    if (ob.x < minX || ob.x > maxX) {
      ob.drift *= -1;
      ob.x = Math.max(minX, Math.min(maxX, ob.x));
    }
  }
  state.obstacles = state.obstacles.filter((ob) => ob.y < canvas.height + 52);

  for (const ob of state.obstacles) {
    if (checkCollision(ob, p)) {
      p.falling = true;
      p.fallTimer = p.fallDuration;
      state.elapsed += 1.5;
      state.falls += 1;
      state.score = Math.max(0, state.score - 240);
      statusTextEl.textContent = "Oei! Gevallen...";
      soundCrash();
      break;
    }
  }

  if (state.finishVisible && !p.falling) {
    const finishHalf = pisteHalfWidthAt(Math.min(canvas.height, state.finishLineY)) * 0.6;
    const crossedLine = state.finishLineY >= p.y + 10;
    const insideGate = Math.abs(p.x - canvas.width / 2) < finishHalf - 14;
    if (crossedLine && insideGate) {
      finishGame(true);
      return;
    }
  }

  if (state.timeLeft <= 0) {
    state.finishOvertime += dt;
    statusTextEl.textContent = "Finish in zicht!";
    if (state.finishOvertime >= FINISH_GRACE_SECONDS) {
      finishGame(false);
      return;
    }
  }

  updateHud();
}

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height * 0.32);
  sky.addColorStop(0, "#9fd0ff");
  sky.addColorStop(1, "#dff1ff");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height * 0.34);

  ctx.fillStyle = "#edf7ff";
  ctx.fillRect(0, canvas.height * 0.34, canvas.width, canvas.height * 0.66);

  ctx.fillStyle = "#8ebee7";
  ctx.beginPath();
  ctx.moveTo(0, canvas.height * 0.34);
  ctx.lineTo(canvas.width * 0.2, canvas.height * 0.12);
  ctx.lineTo(canvas.width * 0.38, canvas.height * 0.34);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(canvas.width, canvas.height * 0.34);
  ctx.lineTo(canvas.width * 0.8, canvas.height * 0.11);
  ctx.lineTo(canvas.width * 0.62, canvas.height * 0.34);
  ctx.closePath();
  ctx.fill();

  const pisteTopHalf = pisteHalfWidthAt(0);
  const pisteBottomHalf = pisteHalfWidthAt(canvas.height);
  ctx.fillStyle = "#fdfefe";
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2 - pisteTopHalf, 0);
  ctx.lineTo(canvas.width / 2 + pisteTopHalf, 0);
  ctx.lineTo(canvas.width / 2 + pisteBottomHalf, canvas.height);
  ctx.lineTo(canvas.width / 2 - pisteBottomHalf, canvas.height);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "#a8d4f8";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2 - pisteTopHalf, 0);
  ctx.lineTo(canvas.width / 2 - pisteBottomHalf, canvas.height);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2 + pisteTopHalf, 0);
  ctx.lineTo(canvas.width / 2 + pisteBottomHalf, canvas.height);
  ctx.stroke();

  ctx.strokeStyle = "#c9e6fb";
  ctx.lineWidth = 2;
  for (let i = 0; i < 18; i += 1) {
    const y = (i * 52 + (state.elapsed * 260) % 52) % canvas.height;
    const t = y / canvas.height;
    const half = pisteHalfWidthAt(y) * 0.45;
    const center = canvas.width / 2;
    ctx.beginPath();
    ctx.moveTo(center - half, y);
    ctx.lineTo(center - half * 0.86, y + 30 + t * 20);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(center + half, y);
    ctx.lineTo(center + half * 0.86, y + 30 + t * 20);
    ctx.stroke();
  }

  const startY = 56;
  const startHalf = pisteHalfWidthAt(startY) * 0.72;
  ctx.fillStyle = "#d72843";
  ctx.fillRect(canvas.width / 2 - startHalf - 8, startY - 22, 10, 36);
  ctx.fillRect(canvas.width / 2 + startHalf - 2, startY - 22, 10, 36);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(canvas.width / 2 - startHalf + 2, startY - 18, startHalf * 2 - 4, 8);
  ctx.fillStyle = "#193a67";
  ctx.font = "bold 12px Courier New";
  ctx.textAlign = "center";
  ctx.fillText("START", canvas.width / 2, startY - 10);

  if (!state.finishVisible) return;

  const finishY = state.finishLineY;
  const finishHalf = pisteHalfWidthAt(Math.min(canvas.height, finishY)) * 0.6;
  ctx.fillStyle = "#2159aa";
  ctx.fillRect(canvas.width / 2 - finishHalf - 10, finishY - 46, 12, 62);
  ctx.fillRect(canvas.width / 2 + finishHalf - 2, finishY - 46, 12, 62);
  ctx.fillStyle = "#ffd24d";
  ctx.fillRect(canvas.width / 2 - finishHalf + 2, finishY - 42, finishHalf * 2 - 4, 10);
  ctx.fillStyle = "#1d2b44";
  ctx.font = "bold 13px Courier New";
  ctx.fillText("FINISH", canvas.width / 2, finishY - 34);

  ctx.strokeStyle = "#b6daf5";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2 - finishHalf + 8, finishY + 2);
  ctx.lineTo(canvas.width / 2 + finishHalf - 8, finishY + 2);
  ctx.stroke();

  if (finishY < canvas.height - 160) return;

  const crowdBaseY = canvas.height - 34;
  for (let i = 0; i < 16; i += 1) {
    const side = i % 2 === 0 ? -1 : 1;
    const row = Math.floor(i / 2);
    const xOffset = finishHalf + 38 + row * 16;
    const x = canvas.width / 2 + side * xOffset;
    const y = crowdBaseY - (row % 3) * 10;
    const shirt = ["#e04646", "#3d7be0", "#34a35c", "#f0b43a"][i % 4];
    ctx.fillStyle = "#ffe1bd";
    ctx.fillRect(x - 4, y - 14, 8, 6);
    ctx.fillStyle = shirt;
    ctx.fillRect(x - 5, y - 8, 10, 9);
    ctx.fillStyle = "#22324d";
    ctx.fillRect(x - 6, y + 1, 12, 3);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(x - 9, y - 2);
    ctx.lineTo(x + 9, y - 2);
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
  ctx.strokeStyle = "#9eb6c9";
  ctx.lineWidth = 2;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(ob.x, ob.y + 6, ob.size * 0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(ob.x, ob.y - 8, ob.size * 0.32, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
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

  ctx.fillStyle = p.falling ? "#f65c5c" : "#2d55d8";
  ctx.fillRect(-9, -15, 18, 20);
  ctx.fillStyle = "#ffec74";
  ctx.fillRect(-8, -26, 16, 4); // helm
  ctx.fillStyle = "#202020";
  ctx.fillRect(-5, -22, 10, 3); // bril
  ctx.fillStyle = "#ffd9b2";
  ctx.fillRect(-5, -19, 10, 4); // gezicht
  ctx.fillStyle = "#20388f";
  ctx.fillRect(-9, -3, 18, 3); // jas accent
  ctx.fillStyle = "#1f2740";
  ctx.fillRect(-8, 5, 6, 6); // linker been
  ctx.fillRect(2, 5, 6, 6); // rechter been
  ctx.fillStyle = "#2f2f2f";
  ctx.fillRect(-18, 10, 36, 3); // skis
  ctx.fillRect(-14, 13, 28, 2);
  ctx.fillStyle = "#7e5228";
  ctx.fillRect(-13, -12, 2, 22); // stok links
  ctx.fillRect(11, -12, 2, 22); // stok rechts

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
    const podiumBaseY = canvas.height * 0.86;
    ctx.fillStyle = "#7df79a";
    ctx.font = "bold 34px Courier New";
    ctx.fillText("Finish gehaald!", canvas.width / 2, canvas.height * 0.18);

    ctx.fillStyle = "#e4ecff";
    ctx.fillRect(canvas.width / 2 - 190, podiumBaseY - 90, 120, 90);
    ctx.fillRect(canvas.width / 2 - 60, podiumBaseY - 120, 120, 120);
    ctx.fillRect(canvas.width / 2 + 70, podiumBaseY - 70, 120, 70);
    ctx.fillStyle = "#202020";
    ctx.font = "bold 22px Courier New";
    ctx.fillText("2", canvas.width / 2 - 130, podiumBaseY - 104);
    ctx.fillText("1", canvas.width / 2, podiumBaseY - 134);
    ctx.fillText("3", canvas.width / 2 + 130, podiumBaseY - 84);
    ctx.fillStyle = "#ffd34d";
    ctx.font = "18px Courier New";
    ctx.fillText("Podium! Score: " + Math.round(state.score), canvas.width / 2, canvas.height * 0.95);
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
