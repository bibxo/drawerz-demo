const canvas = document.getElementById('draw-canvas');
const ctx = canvas.getContext('2d');
const intensitySlider = document.getElementById('jiggle-intensity');
const speedSlider = document.getElementById('jiggle-speed');
const thicknessSlider = document.getElementById('thickness-intensity');
const colorPicker = document.getElementById('stroke-color');
const strokeSizeSlider = document.getElementById('stroke-size');

let drawing = false;
let currentStroke = [];
let vectorStrokes = [];
let jiggleIntensity = parseFloat(intensitySlider.value);
let jiggleSpeed = parseFloat(speedSlider.value);
let thicknessIntensity = parseFloat(thicknessSlider.value);
let isEraser = false;
let currentColor = colorPicker.value;
let currentStrokeSize = parseFloat(strokeSizeSlider.value);

// History management
let history = [];
let historyIndex = -1;
const maxHistory = 50;

let pointerPos = { x: null, y: null };
let showPointer = false;

let animationFrameId = null;
let isExporting = false;

function saveToHistory() {
  // Remove any future states if we're not at the end of history
  history = history.slice(0, historyIndex + 1);
  
  // Add current state to history
  history.push(JSON.stringify(vectorStrokes));
  historyIndex++;
  
  // Limit history size
  if (history.length > maxHistory) {
    history.shift();
    historyIndex--;
  }
  
  // Update button states
  updateUndoRedoButtons();
}

function updateUndoRedoButtons() {
  document.getElementById('undo-button').disabled = historyIndex <= 0;
  document.getElementById('redo-button').disabled = historyIndex >= history.length - 1;
}

function undo() {
  if (historyIndex > 0) {
    historyIndex--;
    vectorStrokes = JSON.parse(history[historyIndex]);
    updateUndoRedoButtons();
    draw();
  }
}

function redo() {
  if (historyIndex < history.length - 1) {
    historyIndex++;
    vectorStrokes = JSON.parse(history[historyIndex]);
    updateUndoRedoButtons();
    draw();
  }
}

// Initialize history with empty state
saveToHistory();

//drawing logic

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  drawing = true;
  currentStroke = [getCanvasPos(e)];
});

canvas.addEventListener('pointermove', (e) => {
  e.preventDefault();
  if (!drawing) {
    const rect = canvas.getBoundingClientRect();
    pointerPos.x = (e.clientX - rect.left) * (canvas.width / rect.width);
    pointerPos.y = (e.clientY - rect.top) * (canvas.height / rect.height);
    showPointer = true;
    draw();
  } else {
  const pos = getCanvasPos(e);
  currentStroke.push(pos);
  draw();
  }
});

canvas.addEventListener('pointerup', (e) => {
  e.preventDefault();
  if (!drawing) return;
  drawing = false;
  if (currentStroke.length > 1) {
    const vector = vectorizeStroke(currentStroke);
    if (isEraser) {
      vectorStrokes = vectorStrokes.filter(stroke => {
        return !strokesIntersect(stroke.points, vector);
      });
    } else {
      vectorStrokes.push({ 
        points: vector, 
        phase: Math.random() * 1000,
        color: currentColor,
        size: currentStrokeSize
      });
    }
    saveToHistory();
  }
  currentStroke = [];
  draw();
});

canvas.addEventListener('pointerleave', (e) => {
  e.preventDefault();
  showPointer = false;
  if (drawing) {
    drawing = false;
    if (currentStroke.length > 1) {
      const vector = vectorizeStroke(currentStroke);
      vectorStrokes.push({ points: vector, phase: Math.random() * 1000, color: currentColor, size: currentStrokeSize });
    }
    currentStroke = [];
    draw();
  } else {
    draw();
  }
});

canvas.addEventListener('pointerenter', (e) => {
  showPointer = true;
  draw();
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

function strokesIntersect(stroke1, stroke2) {
  const threshold = 10;
  for (let pt1 of stroke1) {
    for (let pt2 of stroke2) {
      if (dist(pt1, pt2) < threshold) {
        return true;
      }
    }
  }
  return false;
}

// juggle
function draw() {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (currentStroke.length > 1) {
    ctx.save();
    ctx.strokeStyle = isEraser ? '#ff0000' : currentColor;
    ctx.lineWidth = currentStrokeSize;
    ctx.beginPath();
    ctx.moveTo(currentStroke[0].x, currentStroke[0].y);
    for (let pt of currentStroke) {
      ctx.lineTo(pt.x, pt.y);
    }
    ctx.stroke();
    ctx.restore();
  }

  for (let stroke of vectorStrokes) {
  ctx.save();
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.size;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
  ctx.beginPath();
    
  let t = performance.now() / (1000 / jiggleSpeed) + stroke.phase;
    
  for (let i = 0; i < stroke.points.length; i++) {
    const pt = stroke.points[i];
      
      // Rotation effect
    const angle = t + i * 0.6;
    const r = jiggleIntensity * (0.5 + 0.5 * Math.sin(angle * 1.3 + i));
    const dx = Math.cos(angle) * r;
    const dy = Math.sin(angle) * r;
      
      // Float effect (slower frequencies)
      const floatX = Math.sin(t * 0.2 + i * 0.1) * floatIntensity;
      const floatY = Math.cos(t * 0.15 + i * 0.08) * floatIntensity;
      
      // Combine both effects
      const finalX = pt.x + dx + floatX;
      const finalY = pt.y + dy + floatY;
      
      if (i === 0) ctx.moveTo(finalX, finalY);
      else ctx.lineTo(finalX, finalY);
    }
    
  ctx.stroke();
    
    // Add thickness effect if enabled
    if (thicknessIntensity > 0) {
      drawThicknessStroke(stroke);
    }
    
  ctx.restore();
}

  // Draw custom pointer if in pen mode and pointer is on canvas
  if (showPointer && !isEraser && pointerPos.x !== null && pointerPos.y !== null) {
  ctx.save();
  ctx.beginPath();
    ctx.arc(pointerPos.x, pointerPos.y, currentStrokeSize / 2, 0, 2 * Math.PI);
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.7;
    ctx.shadowColor = currentColor;
    ctx.shadowBlur = 2;
  ctx.stroke();
  ctx.restore();
  }
}

function drawThicknessStroke(stroke) {
  ctx.save();
  ctx.strokeStyle = stroke.color;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  let t = performance.now() / (1000 / jiggleSpeed) + stroke.phase;
  const thickness = stroke.size + thicknessIntensity * Math.sin(t);
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

// Add float intensity variable
let floatIntensity = 5;

//controls
intensitySlider.addEventListener('input', () => {
  jiggleIntensity = parseFloat(intensitySlider.value);
});
thicknessSlider.addEventListener('input', () => {
  thicknessIntensity = parseFloat(thicknessSlider.value);
});
document.getElementById('float-intensity').addEventListener('input', (e) => {
  floatIntensity = parseFloat(e.target.value);
});
speedSlider.addEventListener('input', () => {
  jiggleSpeed = parseFloat(speedSlider.value);
});

function animate() {
  if (!isExporting) {
    draw();
  }
  animationFrameId = requestAnimationFrame(animate);
}

// Start animation loop
animate();

// Initialize mode toggle button
const modeToggleButton = document.getElementById('mode-toggle');
const modeToggleIcon = modeToggleButton.querySelector('i');
modeToggleIcon.className = 'fas fa-eraser';  // Start with eraser icon since we're in pen mode
modeToggleButton.style.backgroundColor = '#7b5cff';

document.getElementById('mode-toggle').addEventListener('click', toggleMode);

// Add keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey) { // metaKey for Mac support
    if (e.key === 'z') {
      e.preventDefault();
      if (e.shiftKey) {
        redo();
      } else {
        undo();
      }
    } else if (e.key === 'y') {
      e.preventDefault();
      redo();
    }
  } else {
    // Pen/Eraser shortcuts
    if (e.key.toLowerCase() === 'p') {
      e.preventDefault();
      if (isEraser) {
        toggleMode();
      }
    } else if (e.key.toLowerCase() === 'e') {
      e.preventDefault();
      if (!isEraser) {
        toggleMode();
      }
    }
  }
});

// Extract mode toggle logic into a separate function
function toggleMode() {
  isEraser = !isEraser;
  const button = document.getElementById('mode-toggle');
  const icon = button.querySelector('i');
  if (isEraser) {
    icon.className = 'fas fa-pen';
    button.style.backgroundColor = '#ff0000';
  } else {
    icon.className = 'fas fa-eraser';
    button.style.backgroundColor = '#7b5cff';
  }
}

// Add button event listeners
document.getElementById('undo-button').addEventListener('click', undo);
document.getElementById('redo-button').addEventListener('click', redo);

// Add color picker event listener
colorPicker.addEventListener('input', (e) => {
  currentColor = e.target.value;
});

// Add stroke size event listener
strokeSizeSlider.addEventListener('input', (e) => {
  currentStrokeSize = parseFloat(e.target.value);
});

// --- Export Dialog ---
const exportDialog = document.getElementById('export-dialog');
const exportQuality = document.getElementById('export-quality');
const exportCancel = document.getElementById('export-cancel');
const exportConfirm = document.getElementById('export-confirm');

function showExportDialog() {
  exportDialog.classList.add('active');
}

function hideExportDialog() {
  exportDialog.classList.remove('active');
}

exportCancel.addEventListener('click', hideExportDialog);

exportConfirm.addEventListener('click', () => {
  const quality = exportQuality.value;
  
  // Get bitrate based on quality
  const bitrates = {
    high: 2500000,    // 2.5 Mbps
    medium: 1500000,  // 1.5 Mbps
    low: 1000000      // 1 Mbps
  };
  
  const bitrate = bitrates[quality];
  
  // Start export with fixed 5-second duration and WebM format
  exportAnimation(bitrate);
  hideExportDialog();
});

document.getElementById('export-button').addEventListener('click', showExportDialog);

function exportAnimation(bitrate) {
  const button = document.getElementById('export-button');
  const originalText = button.textContent;
  button.textContent = 'Exporting...';
  button.disabled = true;
  isExporting = true;

  try {
    // Create a hidden canvas for rendering
    const renderCanvas = document.createElement('canvas');
    renderCanvas.width = canvas.width;
    renderCanvas.height = canvas.height;
    const renderCtx = renderCanvas.getContext('2d');

    // Check format support
    const supportedMimeTypes = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm'
    ];

    let selectedMimeType = null;
    for (const mime of supportedMimeTypes) {
      if (MediaRecorder.isTypeSupported(mime)) {
        selectedMimeType = mime;
        break;
      }
    }

    if (!selectedMimeType) {
      throw new Error('WebM format is not supported in your browser');
    }

    const stream = renderCanvas.captureStream(30); // 30fps
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: selectedMimeType,
      videoBitsPerSecond: bitrate
    });

    const chunks = [];
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunks.push(e.data);
      }
    };

    mediaRecorder.onstop = () => {
      try {
        const blob = new Blob(chunks, { type: selectedMimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'drawerz_animation.webm';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      button.textContent = originalText;
      button.disabled = false;
        isExporting = false;
      } catch (error) {
        console.error('Error creating download:', error);
        alert('Error creating the video file. Please try a different quality setting.');
        button.textContent = originalText;
        button.disabled = false;
        isExporting = false;
      }
    };

    mediaRecorder.onerror = (error) => {
      console.error('MediaRecorder error:', error);
      alert('Error during recording. Please try a different quality setting.');
      button.textContent = originalText;
      button.disabled = false;
      isExporting = false;
    };

    // Render frames
    let frameCount = 0;
    const totalFrames = 5 * 30; // 5 seconds at 30fps
    let lastFrameTime = performance.now();

    function renderExportFrame() {
      if (frameCount >= totalFrames) {
        mediaRecorder.stop();
        return;
      }

      const currentTime = performance.now();
      const deltaTime = currentTime - lastFrameTime;
      lastFrameTime = currentTime;

      // Clear render canvas
      renderCtx.fillStyle = '#ffffff';
      renderCtx.fillRect(0, 0, renderCanvas.width, renderCanvas.height);

      // Render all strokes with animation
      for (let stroke of vectorStrokes) {
        renderCtx.save();
        renderCtx.strokeStyle = stroke.color;
        renderCtx.lineWidth = stroke.size;
        renderCtx.lineJoin = 'round';
        renderCtx.lineCap = 'round';
        renderCtx.beginPath();
        
        let t = (frameCount / 30) * jiggleSpeed + stroke.phase;
        
        for (let i = 0; i < stroke.points.length; i++) {
          const pt = stroke.points[i];
          
          // Rotation effect
          const angle = t + i * 0.6;
          const r = jiggleIntensity * (0.5 + 0.5 * Math.sin(angle * 1.3 + i));
          const dx = Math.cos(angle) * r;
          const dy = Math.sin(angle) * r;
          
          // Float effect
          const floatX = Math.sin(t * 0.2 + i * 0.1) * floatIntensity;
          const floatY = Math.cos(t * 0.15 + i * 0.08) * floatIntensity;
          
          const finalX = pt.x + dx + floatX;
          const finalY = pt.y + dy + floatY;
          
          if (i === 0) renderCtx.moveTo(finalX, finalY);
          else renderCtx.lineTo(finalX, finalY);
        }
        
        renderCtx.stroke();
        
        // Add thickness effect if enabled
        if (thicknessIntensity > 0) {
          renderThicknessStroke(renderCtx, stroke, t);
        }
        
        renderCtx.restore();
      }

      frameCount++;
      requestAnimationFrame(renderExportFrame);
    }

    function renderThicknessStroke(ctx, stroke, t) {
      ctx.save();
      ctx.strokeStyle = stroke.color;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      const thickness = stroke.size + thicknessIntensity * Math.sin(t);
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

    // Start recording and rendering
    mediaRecorder.start();
    renderExportFrame();

  } catch (error) {
    console.error('Error in export:', error);
    alert('Error starting export: ' + error.message);
    button.textContent = originalText;
    button.disabled = false;
    isExporting = false;
  }
} 