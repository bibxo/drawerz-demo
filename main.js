const canvas = document.getElementById('draw-canvas');
const ctx = canvas.getContext('2d');
const intensitySlider = document.getElementById('jiggle-intensity');
const speedSlider = document.getElementById('jiggle-speed');
const thicknessSlider = document.getElementById('thickness-intensity');

let drawing = false;
let currentStroke = [];
let vectorStrokes = [];
let jiggleIntensity = parseFloat(intensitySlider.value);
let jiggleSpeed = parseFloat(speedSlider.value);
let thicknessIntensity = parseFloat(thicknessSlider.value);

//drawing logic

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  drawing = true;
  currentStroke = [getCanvasPos(e)];
});

canvas.addEventListener('pointermove', (e) => {
  e.preventDefault();
  if (!drawing) return;
  const pos = getCanvasPos(e);
  currentStroke.push(pos);
  draw();
});

canvas.addEventListener('pointerup', (e) => {
  e.preventDefault();
  if (!drawing) return;
  drawing = false;
  if (currentStroke.length > 1) {
    const vector = vectorizeStroke(currentStroke);
    vectorStrokes.push({ points: vector, phase: Math.random() * 1000 });
  }
  currentStroke = [];
  draw();
});

canvas.addEventListener('pointerleave', (e) => {
  e.preventDefault();
  if (drawing) {
    drawing = false;
    if (currentStroke.length > 1) {
      const vector = vectorizeStroke(currentStroke);
      vectorStrokes.push({ points: vector, phase: Math.random() * 1000 });
    }
    currentStroke = [];
    draw();
  }
});

function getCanvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (canvas.width / rect.width),
    y: (e.clientY - rect.top) * (canvas.height / rect.height)
  };
}

function vectorizeStroke(stroke) {
  const totalLen = strokeLength(stroke);

  const numPoints = Math.max(30, Math.min(300, Math.floor(totalLen / 5)));
  if (stroke.length <= numPoints) return stroke;
  const segment = totalLen / (numPoints - 1);
  let resampled = [stroke[0]];
  let d = 0, i = 1, prev = stroke[0];
  for (let ptIdx = 1; ptIdx < numPoints - 1; ptIdx++) {
    let target = segment * ptIdx;
    while (i < stroke.length && d + dist(prev, stroke[i]) < target) {
      d += dist(prev, stroke[i]);
      prev = stroke[i];
      i++;
    }
    if (i >= stroke.length) break;
    const remain = target - d;
    const dir = {
      x: stroke[i].x - prev.x,
      y: stroke[i].y - prev.y
    };
    const len = dist(prev, stroke[i]);
    const frac = remain / len;
    resampled.push({
      x: prev.x + dir.x * frac,
      y: prev.y + dir.y * frac
    });
  }
  resampled.push(stroke[stroke.length - 1]);
  return resampled;
}

function strokeLength(stroke) {
  let len = 0;
  for (let i = 1; i < stroke.length; i++) {
    len += dist(stroke[i - 1], stroke[i]);
  }
  return len;
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// juggle
function draw() {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (currentStroke.length > 1) {
    ctx.save();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(currentStroke[0].x, currentStroke[0].y);
    for (let pt of currentStroke) {
      ctx.lineTo(pt.x, pt.y);
    }
    ctx.stroke();
    ctx.restore();
  }

  for (let stroke of vectorStrokes) {
    drawRotationStroke(stroke);
    if (thicknessIntensity > 0) {
      drawThicknessStroke(stroke);
    }
  }
}

function drawJigglyStroke(stroke) {
  ctx.save();
  ctx.strokeStyle = '#ffb300';
  ctx.lineWidth = 3;
  ctx.beginPath();
  let t = performance.now() / (1000 / jiggleSpeed) + stroke.phase;
  for (let i = 0; i < stroke.points.length; i++) {
    const pt = stroke.points[i];
    const angle = t + i * 0.6;
    const r = jiggleIntensity * (0.5 + 0.5 * Math.sin(angle * 1.3 + i));
    const dx = Math.cos(angle) * r;
    const dy = Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(pt.x + dx, pt.y + dy);
    else ctx.lineTo(pt.x + dx, pt.y + dy);
  }
  ctx.stroke();
  ctx.restore();
}

function drawRotationStroke(stroke) {
  ctx.save();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  let t = performance.now() / (1000 / jiggleSpeed) + stroke.phase;
  for (let i = 0; i < stroke.points.length; i++) {
    const pt = stroke.points[i];
    const angle = t + i * 0.6;
    const r = jiggleIntensity * (0.5 + 0.5 * Math.sin(angle * 1.3 + i));
    const dx = Math.cos(angle) * r;
    const dy = Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(pt.x + dx, pt.y + dy);
    else ctx.lineTo(pt.x + dx, pt.y + dy);
  }
  ctx.stroke();
  ctx.restore();
}

function drawThicknessStroke(stroke) {
  ctx.save();
  ctx.strokeStyle = '#000000';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  let t = performance.now() / (1000 / jiggleSpeed) + stroke.phase;
  const thickness = 3 + thicknessIntensity * Math.sin(t);
  ctx.lineWidth = thickness;
  ctx.beginPath();
  for (let i = 0; i < stroke.points.length; i++) {
    const pt = stroke.points[i];
    if (i === 0) ctx.moveTo(pt.x, pt.y);
    else ctx.lineTo(pt.x, pt.y);
  }
  ctx.stroke();
  ctx.restore();
}

let mediaRecorder;
let recordedChunks = [];

function exportToMP4() {
  recordedChunks = [];
  const stream = canvas.captureStream(30); // 30 fps
  mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) {
      recordedChunks.push(e.data);
    }
  };
  mediaRecorder.onstop = () => {
    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'jiggly_vectorizer_export.webm';
    a.click();
    URL.revokeObjectURL(url);
  };
  mediaRecorder.start();
  let frameCount = 0;
  const totalFrames = 150;
  const renderFrame = () => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    draw();
    frameCount++;
    if (frameCount < totalFrames) {
      requestAnimationFrame(renderFrame);
    } else {
      mediaRecorder.stop();
    }
  };

  setTimeout(() => {
    requestAnimationFrame(renderFrame);
  }, 100);
}

//controls
intensitySlider.addEventListener('input', () => {
  jiggleIntensity = parseFloat(intensitySlider.value);
});
thicknessSlider.addEventListener('input', () => {
  thicknessIntensity = parseFloat(thicknessSlider.value);
});
speedSlider.addEventListener('input', () => {
  jiggleSpeed = parseFloat(speedSlider.value);
});

document.getElementById('export-button').addEventListener('click', exportToMP4);

function animate() {
  draw();
  requestAnimationFrame(animate);
}

animate(); 
