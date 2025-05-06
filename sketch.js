// --- Setup Variables ---
let state = "questions";
let answers = [0, 0, 0];
let currentQuestion = 0;
let startTime;

let moodColor, moodName, moodDesc, moodKey;
let flowField = [];
let particles = [];
let cols, rows;
let inc = 0.1;
let scl = 20;
let auroraGraphics;
let auroraOffset = 0;
let lexendFont;
let handImage;
let whisperWords = ["breathe", "stillness", "peace", "present", "accept", "let go", "calm", "flow", "here", "now", "ease", "quiet", "observe", "soft", "drift", "silence"];
let whispers = [];
let auraRadius = 150;
let ambientTracks = {};
let handX = 0;
let handY = 0;
let handDetected = false;
let video;
let handPoseNet;
let handZ = 0;
let finalAlpha = 0;
let showHistory = false;
let handStartTime = null;
let muteButton;
let isMuted = false;
let questions = [];
let showSplash = true;
let splashStartTime;
let questionPool = [
  { text: "How are you feeling about your day?", options: ["Energized", "Meh", "Drained"] },
  { text: "When you think about the future, you feel:", options: ["Excited", "Neutral", "Anxious"] },
  { text: "What would you rather be doing?", options: ["Dancing", "Sleeping", "Plotting revenge"] },
  { text: "Right now, you are mostly:", options: ["Inspired", "Distracted", "Tired"] },
  { text: "If your brain was a weather system:", options: ["Clear skies", "Foggy", "Lightning storm"] },
  { text: "What energy are you bringing today?", options: ["Magnetic", "Muted", "Chaotic"] },
  { text: "In your core, you're feeling:", options: ["Centered", "Indecisive", "Restless"] },
  { text: "Emotionally, you're closest to:", options: ["Joy", "Flatline", "Static"] },
  { text: "Today, your spirit animal is:", options: ["Golden retriever", "Sloth", "Wasp"] }
];

function preload() {
  soundFormats('mp3', 'm4a', 'ogg');
  lexendFont = loadFont("Lexend-VariableFont_wght.ttf");
  handImage = loadImage("hand.svg");

  function tryLoadSound(file) {
    try {
      return loadSound(file);
    } catch (e) {
      console.warn("Missing sound file:", file);
      return null;
    }
  }

  ambientTracks = {
    red: [tryLoadSound("red.mp3")],
    green: [tryLoadSound("green.mp3")],
    brown: [tryLoadSound("brown.mp3")],
    bluegreen: [tryLoadSound("bluegreen.m4a")],
    black: [tryLoadSound("black.m4a")],
    pink: [tryLoadSound("Pink.m4a")]
  };
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  textFont(lexendFont);
  textAlign(CENTER, CENTER);

  cols = floor(width / scl);
  rows = floor(height / scl);
  flowField = new Array(cols * rows);
  for (let i = 0; i < 1000; i++) {
    particles[i] = new Particle();
  }

  auroraGraphics = createGraphics(width, height);
  auroraGraphics.colorMode(HSB, 360, 100, 100, 100);
  auroraGraphics.noStroke();

  muteButton = createButton("🔊 Mute");
  muteButton.position(20, 20);
  muteButton.mousePressed(toggleMute);

  questions = shuffle(questionPool).slice(0, 3);
  chooseMood();

  userStartAudio();

  // Restore camera setup properly
  video = createCapture(VIDEO);
  video.size(width, height);
  video.hide();
handPoseNet = ml5.handpose(video, () => console.log("Handpose ready"));
handPoseNet.on("predict", results => {
  if (results.length > 0) {
    let hand = results[0].landmarks[9];  // Index finger MCP
    handX = width - hand[0];
    handY = hand[1];
    handZ = hand[2];  // This is your depth value
    handDetected = true;
  } else {
    handDetected = false;
  }
});
  splashStartTime = millis();
  // Play one random valid track at startup
  let allTracks = Object.values(ambientTracks).flat().filter(track => track);
  let startupTrack = random(allTracks);
  if (startupTrack && !startupTrack.isPlaying()) {
    startupTrack.setVolume(isMuted ? 0 : 1);
    startupTrack.loop();
  }

  for (let i = 0; i < 120; i++) {
    whispers.push({
      word: random(whisperWords),
      x: random(width),
      y: random(height),
      alpha: random(40, 70),
      speed: random(0.15, 0.4),
      size: random(12, 24)
    });
  }
}

function draw() {
  background(0, 30);

  if (showSplash) {
    drawSplashScreen();
    return;
  }

  drawAurora();

  if (state === "questions") displayQuestion();
  else if (state === "handPrompt") displayHandReadingPrompt();
  else if (state === "animating") animateMood();
  else if (state === "result") displayResult();

  if (showHistory) displayHistory();
  drawWhispers();
}
function drawSplashScreen() {
  background(0);
  drawAurora();

  let elapsed = millis() - splashStartTime;
  let alpha = constrain(map(elapsed, 0, 1500, 0, 255), 0, 255);
  let scaleSize = constrain(map(elapsed, 0, 1500, 0.5, 1), 0.5, 1);

  push();
  translate(width / 2, height / 2 - 40);
  scale(scaleSize);
  textAlign(CENTER, CENTER);
  textFont(lexendFont);
  textSize(72);
  fill(255, alpha);
  text("The Mood Screen", 0, 0);
  pop();

  textSize(20);
  fill(200, alpha);
  text("Click anywhere to begin", width / 2, height / 2 + 40);
}
function mousePressed() {
  if (showSplash) {
    showSplash = false;
    userStartAudio();
    playAmbientTrack(); // ensures music restarts after splash
    return;
  }

  if (state === "questions") {
    for (let i = 0; i < 3; i++) {
      let btnY = height / 2 + i * 80;
      if (mouseX > width / 2 - 120 && mouseX < width / 2 + 120 &&
          mouseY > btnY - 30 && mouseY < btnY + 30) {
        answers[currentQuestion] = 2 - i;
        currentQuestion++;
        if (currentQuestion >= questions.length) {
          chooseMood();
          state = "handPrompt";
          startTime = millis();
          finalAlpha = 0;
        }
      }
    }
  } else if (state === "result") {
    saveCanvas('MoodReading_' + moodKey, 'png');
    resetMoodSession();
  }
}

class Particle {
  constructor() {
    this.pos = createVector(random(width), random(height));
    this.vel = createVector(0, 0);
    this.acc = createVector(0, 0);
    this.maxSpeed = 2;
    this.prevPos = this.pos.copy();
  }

  update() {
    this.vel.add(this.acc);
    this.vel.limit(this.maxSpeed);
    this.pos.add(this.vel);
    this.acc.mult(0);

    if (this.pos.x > width) this.pos.x = 0;
    if (this.pos.x < 0) this.pos.x = width;
    if (this.pos.y > height) this.pos.y = 0;
    if (this.pos.y < 0) this.pos.y = height;

    this.prevPos = this.pos.copy();
  }

  applyForce(force) {
    this.acc.add(force);
  }

  follow(vectors) {
    let x = floor(this.pos.x / scl);
    let y = floor(this.pos.y / scl);
    let index = x + y * cols;
    let force = vectors[index];
    if (force) this.applyForce(force);
  }

  show() {
    stroke(255, 5);
    strokeWeight(1);
    line(this.pos.x, this.pos.y, this.prevPos.x, this.prevPos.y);
  }
}

function toggleMute() {
  isMuted = !isMuted;
  muteButton.html(isMuted ? "🔇 Unmute" : "🔊 Mute");
  Object.values(ambientTracks).forEach(trackList => {
    trackList.forEach(track => {
      if (track) {
        track.setVolume(isMuted ? 0 : 1);
      }
    });
  });
}

// Updated playAmbientTrack to prevent overlapping tracks and ensure continuous playback

function playAmbientTrack() {
  // Stop all currently playing tracks first
  Object.values(ambientTracks).forEach(trackList => {
    trackList.forEach(track => {
      if (track && track.isPlaying()) {
        track.stop();
      }
    });
  });

  let validTracks = ambientTracks[moodKey] ? ambientTracks[moodKey].filter(track => track) : [];

  if (validTracks.length > 0) {
    let nextTrack = random(validTracks);
    if (nextTrack && !nextTrack.isPlaying()) {
      nextTrack.setVolume(isMuted ? 0 : 1);
      nextTrack.loop();
    }
  } else {
    // Fallback: play any available track
    let fallback = Object.values(ambientTracks).flat().filter(track => track);
    if (fallback.length > 0) {
      let randomTrack = random(fallback);
      if (randomTrack && !randomTrack.isPlaying()) {
        randomTrack.setVolume(isMuted ? 0 : 1);
        randomTrack.loop();
      }
    }
  }
}


function drawAurora() {
  auroraGraphics.clear();
  let waveCount = 5;
  auroraOffset += 0.004;

  for (let i = 0; i < waveCount; i++) {
    let baseY = height / 3 + i * 40;
    for (let j = 0; j < 4; j++) {
      let alpha = map(j, 0, 3, 6, 12);
      let offset = j * 6;
      auroraGraphics.beginShape();
      for (let x = 0; x <= width; x += 8) {
        let y = baseY + offset + sin(x * 0.015 + i + auroraOffset * 3) * (30 + j * 3);
        let hue = (frameCount * 0.2 + x * 0.2 + i * 60) % 360;
        auroraGraphics.fill(hue, 80, 90, alpha);
        auroraGraphics.vertex(x, y);
      }
      auroraGraphics.vertex(width, height);
      auroraGraphics.vertex(0, height);
      auroraGraphics.endShape(CLOSE);
    }
  }

  push();
  resetMatrix();
  blendMode(BLEND);
  imageMode(CORNER);
  tint(255, 180);
  image(auroraGraphics, 0, 0, width, height);
  pop();
}

// Enhanced whisper visuals for more zen-like, graceful motion

// Enhanced whisper visuals for more zen-like, graceful motion

function drawWhispers() {
  for (let i = 0; i < whispers.length; i++) {
    let w = whispers[i];

    // Update position with drifting motion
    w.x += sin(frameCount * 0.01 + i) * 0.3;
    w.y += cos(frameCount * 0.008 + i * 0.5) * 0.2;

    // Ease alpha using sine wave
    let fadeAlpha = w.alpha * (0.5 + 0.5 * sin(frameCount * 0.01 + i));

    fill(255, fadeAlpha);  // Smooth pulse effect
    textSize(w.size);
    text(w.word, w.x, w.y);

    // Reset if it drifts offscreen
    if (w.y < -30 || w.x < -50 || w.x > width + 50) {
      whispers[i] = {
        word: random(whisperWords),
        x: random(width),
        y: height + random(60),
        alpha: random(20, 40),
        speed: random(0.05, 0.15),
        size: random(14, 22)
      };
    }
  }
}
// Whisper initialization already dense from previous edit (50 entries)

// Whisper initialization already dense from previous edit (50 entries)


function displayQuestion() {
  background(0, 60);
  fill(255);
  textSize(28);
  text(questions[currentQuestion].text, width / 2, height / 3);

  for (let i = 0; i < 3; i++) {
    let btnY = height / 2 + i * 80;
    let isHover = mouseX > width / 2 - 120 && mouseX < width / 2 + 120 &&
                  mouseY > btnY - 30 && mouseY < btnY + 30;
    if (isHover) {
      fill(255, 80);
      stroke(255);
      strokeWeight(1);
    } else {
      noStroke();
      fill(255, 30);
    }
    rect(width / 2 - 120, btnY - 30, 240, 60, 10);
    fill(255);
    noStroke();
    textSize(20);
    text(questions[currentQuestion].options[i], width / 2, btnY);
  }
  fill(180);
  textSize(14);
  text("Press 'H' to view your mood history", width / 2, height - 40);
}

function chooseMood() {
  const weights = {
    violet: 0, blue: 0, bluegreen: 0, green: 0,
    yellow: 0, gray: 0, black: 0, red: 0, pink: 0, brown: 0
  };

  for (let i = 0; i < answers.length; i++) {
    if (answers[i] === 2) weights.violet += 1;
    if (answers[i] === 1) weights.green += 1;
    if (answers[i] === 0) weights.gray += 1;
    weights[random(["pink", "bluegreen", "red", "yellow", "brown"])] += 0.5;
  }

  let topMood = Object.keys(weights).reduce((a, b) => weights[a] > weights[b] ? a : b);
  moodKey = topMood;
  moodName = {
    violet: "Happy", blue: "Calm", bluegreen: "Balanced", green: "Neutral",
    yellow: "Unsettled", gray: "Strained", black: "Overloaded", red: "Intense",
    pink: "Mixed", brown: "Frustrated"
  }[topMood];
  moodDesc = {
    violet: "Romantic, passionate.", blue: "Relaxed, peaceful.", bluegreen: "Somewhat relaxed, calm.",
    green: "Normal, average, active.", yellow: "Tense, excited, nervous.", gray: "Very nervous, anxious, foggy.",
    black: "Stressed, angry, overwhelmed.", red: "Passionate, excited, strong emotions.",
    pink: "Uncertain, infatuated, moody.", brown: "Nervous, anxious, cool."
  }[topMood];
  moodColor = getColorFromName(topMood);

  let log = JSON.parse(localStorage.getItem("moodLog")) || [];
  log.push({ date: new Date().toISOString(), mood: topMood });
  localStorage.setItem("moodLog", JSON.stringify(log));
}

function getColorFromName(name) {
  return {
    violet: color(138, 43, 226), blue: color(30, 144, 255), bluegreen: color(70, 200, 180),
    green: color(0, 255, 127), yellow: color(255, 215, 0), gray: color(169, 169, 169),
    black: color(30, 30, 30), red: color(255, 0, 0), pink: color(255, 105, 180), brown: color(139, 69, 19)
  }[name];
}
// Full code with all helpers is already included above...
// Appending the final missing pieces for complete functionality:

// Updated animateMood countdown to 5 seconds

function animateMood() {
  let elapsed = millis() - startTime;
  let remaining = 5 - floor(elapsed / 1000); // countdown from 5 seconds

  noStroke();
  for (let i = 0; i < 120; i++) {
    let angle = frameCount * 0.01 + i;
    let x = width / 2 + sin(angle * 1.5) * 300 * noise(i * 0.1, frameCount * 0.01);
    let y = height / 2 + cos(angle * 1.2) * 300 * noise(i * 0.1 + 5, frameCount * 0.01);
    let hue = (frameCount + i * 3) % 360;
    fill(color(`hsb(${hue}, 100%, 100%)`), 10);
    ellipse(x, y, 180 + sin(angle * 2 + i) * 40);
  }

  let yoff = 0;
  for (let y = 0; y < rows; y++) {
    let xoff = 0;
    for (let x = 0; x < cols; x++) {
      let index = x + y * cols;
      let angle = noise(xoff, yoff, frameCount * 0.002) * TWO_PI * 4;
      let v = p5.Vector.fromAngle(angle);
      v.setMag(1);
      flowField[index] = v;
      xoff += inc;
    }
    yoff += inc;
  }

  blendMode(ADD);
  for (let i = 0; i < particles.length; i++) {
    particles[i].follow(flowField);
    particles[i].update();
    let hue = (frameCount + i * 5) % 360;
    stroke(color(`hsb(${hue}, 100%, 100%)`), 10);
    strokeWeight(1.2);
    line(particles[i].pos.x, particles[i].pos.y, particles[i].prevPos.x, particles[i].prevPos.y);
  }
  blendMode(BLEND);

  if (handDetected && handImage) {
  push();
  imageMode(CENTER);
  let depthScale = map(handZ || 0, -80, 80, 1.2, 0.6, true);
  let pulse = sin(frameCount * 0.1) * 20;
  let size = 380 * depthScale + pulse;
  tint(255, 200 + sin(frameCount * 0.1) * 40);
  image(handImage, width / 2, height / 2, size, size);
  pop();
}

  fill(255);
  textSize(20);
  text("Calibrating your aura... " + remaining, width / 2, height - 40);

  if (elapsed > 4500 && elapsed <= 5000) {
    fill(0, map(elapsed, 4500, 5000, 0, 255));
    rect(0, 0, width, height);
  }

  if (elapsed > 5000) {
    state = "result";
  }
}


function displayHandReadingPrompt() {
  background(0, 50);
  fill(255);
  textSize(28);
  textAlign(CENTER, CENTER);
  
  let centerX = width / 2;
  let centerY = height / 2;

  text("Raise your hand to the screen\nto begin your aura reading", centerX, centerY - 120);

  if (handImage && !handDetected) {
    imageMode(CENTER);

    let depthScale = map(handZ || 0, -80, 80, 1.2, 0.6, true);
    let pulse = sin(frameCount * 0.05) * 30;
    let glowAlpha = 180 + pulse;
    let handSize = 360 * depthScale + pulse;

    push();
    tint(255, glowAlpha);
    // Glowing rainbow particle ring
push();
translate(centerX, centerY + 40);
noFill();
let ringRadius = 240 + sin(frameCount * 0.05) * 10;
for (let i = 0; i < 300; i++) {
  let angle = TWO_PI * i / 300;
  let offset = sin(frameCount * 0.05 + i * 0.2) * 15;
  let x = (ringRadius + offset) * cos(angle);
  let y = (ringRadius + offset) * sin(angle);
  let hue = (angle * 180 / PI + frameCount * 2) % 360;
  stroke(color(`hsb(${hue}, 100%, 100%)`), 160);
  strokeWeight(5.5);
  point(x, y);
}
pop();
    image(handImage, centerX, centerY + 40, handSize, handSize);
    pop();
  }

  if (handDetected) {
    if (!handStartTime) {
      handStartTime = millis();
    } else if (millis() - handStartTime > 1200) {
      state = "animating";
      startTime = millis();
      finalAlpha = 0;
      playAmbientTrack();
    }
  } else {
    handStartTime = null;
  }
}

// Full code including icon and mood label rendering
// ... (rest of the code remains unchanged above)

function displayResult() {
  background(0, 20);
  let pulse = 200 + sin(frameCount * 0.02) * 30;
  noStroke();
  fill(moodColor.levels[0], moodColor.levels[1], moodColor.levels[2], 25);
  ellipse(width / 2, height / 2, pulse * 2, pulse * 2);

  for (let i = 0; i < 30; i++) {
    let alpha = map(i, 0, 30, 8, 1);
    let size = pulse + i * 10;
    fill(moodColor.levels[0], moodColor.levels[1], moodColor.levels[2], alpha);
    ellipse(width / 2, height / 2, size * 2);
  }

  push();
  textSize(64);
  textAlign(CENTER, CENTER);
  fill(moodColor.levels[0], moodColor.levels[1], moodColor.levels[2], 12);
  for (let i = 0; i < 3; i++) {
    let yOffset = -100 + i * 100 + sin(frameCount * 0.01 + i) * 5;
    text(moodName + "…", width / 2, height / 2 + yOffset);
  }
  pop();

  // Render icon
  push();
  textAlign(CENTER, CENTER);
  textFont("Material Symbols Outlined");
  textSize(100);
  fill(moodColor);
  text(getMoodIcon(moodKey), width / 2, height / 2 - 120);
  pop();

  // Render mood name (back in)
  push();
  textAlign(CENTER, CENTER);
  textFont(lexendFont);
  textSize(60);
  fill(255);
  text(moodName, width / 2, height / 2);
  pop();

  finalAlpha = min(finalAlpha + 2, 255);
  let pulseSize = 64 + sin(frameCount * 0.05) * 4;

  push();
  textAlign(CENTER, CENTER);
  textFont(lexendFont);
  fill(255, finalAlpha);
  textSize(22);
  text(moodDesc, width / 2, height / 2 + 60);
  textSize(16);
  fill(200, finalAlpha);
  text("Click to save and read again", width / 2, height - 40);
  pop();

  push();
  translate(width / 2, height / 2);
  rotate(frameCount * 0.001);
  stroke(moodColor);
  strokeWeight(1);
  noFill();

  let points = 14 + answers[0] * 4;
  let radius = 180 + answers[1] * 40;
  let rotations = 8 + answers[2];
  let angleStep = TWO_PI / points;

  beginShape();
  for (let i = 0; i < points * rotations; i++) {
    let angle = i * angleStep;
    let r = radius + sin(i * 0.5 + frameCount * 0.01) * 20;
    let x = r * cos(angle);
    let y = r * sin(angle);
    vertex(x, y);
  }
  endShape(CLOSE);

  strokeWeight(0.3);
  ellipse(0, 0, radius * 3);
  pop();
}



function getMoodIcon(mood) {
  switch (mood) {
    case "violet": return "auto_awesome";
    case "blue": return "water_drop";
    case "bluegreen": return "spa";
    case "green": return "self_improvement";
    case "yellow": return "light_mode";
    case "gray": return "cloud";
    case "black": return "bolt";
    case "red": return "whatshot";
    case "pink": return "favorite";
    case "brown": return "thunderstorm";
    default: return "psychology";
  }
}

function displayHistory() {
  let log = JSON.parse(localStorage.getItem("moodLog")) || [];
  fill(0, 200);
  rect(50, 50, width - 100, height - 100, 10);

  fill(255);
  textSize(20);
  textAlign(LEFT, TOP);
  text("Mood History:", 70, 70);

  textSize(16);
  for (let i = 0; i < log.length; i++) {
    let entry = log[i];
    text(`${new Date(entry.date).toLocaleString()} - ${entry.mood}`, 70, 100 + i * 20);
  }
}

function resetMoodSession() {
  currentQuestion = 0;
  answers = [0, 0, 0];
  questions = shuffle(questionPool).slice(0, 3);
  state = "questions";
}
