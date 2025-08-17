/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// DOM要素の取得
const imageLoader = document.getElementById('imageLoader');
const fileNameSpan = document.getElementById('fileName');

const pixelSizeSlider = document.getElementById('pixelSize');
const pixelSizeInput = document.getElementById('pixelSizeInput');
const pixelSizeValue = document.getElementById('pixelSizeValue');

const peakThresholdSlider = document.getElementById('peakThreshold');
const peakThresholdInput = document.getElementById('peakThresholdInput');
const peakThresholdValue = document.getElementById('peakThresholdValue');

const zoomSlider = document.getElementById('zoomSlider');
const zoomInput = document.getElementById('zoomInput');
const zoomValue = document.getElementById('zoomValue');

const downloadBtn = document.getElementById('downloadBtn');

const previews = document.getElementById('previews');
const canvasPlaceholder = document.getElementById('canvasPlaceholder');

const originalImageView = document.getElementById('originalImageView');
const originalWithGridCanvas = document.getElementById('originalWithGridCanvas');
const originalWithGridImageContainer = document.getElementById('original-with-grid-image-container');
const originalWithGridCtx = originalWithGridCanvas.getContext('2d');

const corrXPeriod = document.getElementById('corrXPeriod');
const corrYPeriod = document.getElementById('corrYPeriod');


// --- 状態管理と定数 ---
let originalImage = null;
let pixelSize = 16; // デフォルト値
let gridOffset = { x: 0, y: 0 }; // グリッドの描画開始オフセット
let peakDetectionThreshold = 0.19; // ピーク検出の閾値
let zoomLevel = 1.0; // ズームレベル

// スライダーの初期設定
pixelSizeSlider.min = '2';
pixelSizeSlider.max = '32';
pixelSizeSlider.value = pixelSize.toString();
pixelSizeInput.min = '2';
pixelSizeInput.max = '32';
pixelSizeInput.value = pixelSize.toString();
pixelSizeValue.textContent = pixelSize.toString();

peakThresholdSlider.value = peakDetectionThreshold.toString();
peakThresholdInput.value = peakDetectionThreshold.toString();
peakThresholdValue.textContent = peakDetectionThreshold.toFixed(2);


/**
 * 画像から最適なグリッドサイズとオフセットを自己相関解析を用いて推定する
 * This method analyzes the image as a whole to find periodic patterns,
 * making it robust and deterministic.
 * @param {HTMLImageElement} img
 * @param {number} maxSize 許容される最大のグリッドサイズ
 * @param {number} peakThreshold ピーク検出の閾値
 * @returns {{size: number, offset: {x: number, y: number}, corrX: number[], corrY: number[], sizeX: (number|null), sizeY: (number|null)}|null} 推定されたグリッドサイズ、オフセット、およびデバッグ用の相関データ
 */
function findOptimalGridSize(img, maxSize, peakThreshold) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  const w = img.width;
  const h = img.height;
  canvas.width = w;
  canvas.height = h;
  ctx.drawImage(img, 0, 0);

  let imageData;
  try {
    imageData = ctx.getImageData(0, 0, w, h);
  } catch (e) {
    console.error("getImageDataに失敗しました:", e);
    return null;
  }
  const data = imageData.data;

  // --- Step 1: Preprocessing: Simplified Edge Detection for Pixel Art ---
  // ラプラシアンフィルタを、ドット絵に適した単純な隣接ピクセル差分に変更
  const grayscale = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    grayscale[i] = 0.299 * r + 0.587 * g + 0.114 * b; // 輝度計算
  }
  
  const edgeData = new Float32Array(w * h).fill(0);
  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) {
      const idx = y * w + x;
      const horizontalDiff = Math.abs(grayscale[idx] - grayscale[idx + 1]);
      const verticalDiff = Math.abs(grayscale[idx] - grayscale[idx + w]);
      // 水平と垂直のエッジ（色の境界）を検出
      edgeData[idx] = horizontalDiff + verticalDiff;
    }
  }

  // --- Step 2: Autocorrelation ---
  const calculateAutocorrelation = (isVertical) => {
    const maxShift = isVertical ? Math.floor(h / 2) : Math.floor(w / 2);
    const correlation = new Array(maxShift).fill(0);
    
    for (let shift = 1; shift < maxShift; shift++) {
      let sum = 0;
      if (isVertical) {
        for (let y = 0; y < h - shift; y++) {
          for (let x = 0; x < w; x++) {
            const idx1 = y * w + x;
            const idx2 = (y + shift) * w + x;
            sum += edgeData[idx1] * edgeData[idx2];
          }
        }
      } else { // Horizontal
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w - shift; x++) {
            const idx1 = y * w + x;
            const idx2 = y * w + (x + shift);
            sum += edgeData[idx1] * edgeData[idx2];
          }
        }
      }
      correlation[shift] = sum;
    }
    return correlation;
  };

  const corrX_raw = calculateAutocorrelation(false);
  const corrY_raw = calculateAutocorrelation(true);

  const normalize = (corr) => {
      if (corr.length === 0) return [];
      const maxVal = Math.max(...corr);
      if (maxVal > 0) {
          return corr.map(v => v / maxVal);
      }
      return corr;
  }
  
  const corrX = normalize(corrX_raw);
  const corrY = normalize(corrY_raw);

  // --- Step 3 & 4: Find Peaks with Sub-pixel Precision and Harmonic Averaging ---
  const findPeak = (corr, minSize, maxSize, threshold) => {
    if (corr.length < 3 || Math.max(...corr) <= 0) return null;

    // Step 1: 閾値を超えるすべてのピーク候補を収集
    const peaks = [];
    for (let i = Math.ceil(minSize); i < corr.length - 1; i++) {
        if (corr[i] > corr[i - 1] && corr[i] > corr[i + 1]) { // ローカル最大値か？
            if (corr[i] > threshold) {
                peaks.push({ index: i, value: corr[i] });
            }
        }
    }

    if (peaks.length > 0) {
        // Step 2: 最初のピークを基本周期の推定値とする
        const basePeakIndex = peaks[0].index;

        // Step 3 & 4: 高調波を検証し、逆算した基本周期を「重み付け」平均化する
        const harmonicTolerance = 0.15; // 15%の許容誤差
        const weightedPeriods = [];

        for (const peak of peaks) {
            const harmonicRatio = peak.index / basePeakIndex;
            const nearestHarmonic = Math.round(harmonicRatio);

            if (nearestHarmonic > 0 && Math.abs(harmonicRatio - nearestHarmonic) < harmonicTolerance) {
                // このピークは高調波である可能性が高い
                // サブピクセル補間でピーク位置を精密化
                const p = peak.index;
                const y1 = corr[p - 1];
                const y2 = corr[p];
                const y3 = corr[p + 1];
                const denominator = 2 * (y1 - 2 * y2 + y3);
                
                let precisePeakIndex = p;
                if (denominator < 0) { // 極大値であることを確認
                    const offset = (y1 - y3) / denominator;
                    if (Math.abs(offset) <= 1) { // 大きな補間エラーを避ける
                        precisePeakIndex = p + offset;
                    }
                }
                
                // この高調波から基本周期を逆算し、重み（ピークの強度）と共に保存
                const derivedPeriod = precisePeakIndex / nearestHarmonic;
                weightedPeriods.push({ period: derivedPeriod, weight: peak.value });
            }
        }

        if (weightedPeriods.length > 0) {
            // Step 5: 逆算された基本周期の「加重平均」を返す
            let totalPeriodWeight = 0;
            let totalWeight = 0;
            for(const item of weightedPeriods) {
                totalPeriodWeight += item.period * item.weight;
                totalWeight += item.weight;
            }
            if (totalWeight > 0) {
                return totalPeriodWeight / totalWeight;
            }
        }
    }
    
    // フォールバック: 有意なピークがない場合、範囲内で最も高いピークを探す
    let bestPeakIndex = -1;
    let maxPeakValue = 0;
    const searchLimit = Math.min(corr.length - 1, Math.ceil(maxSize * 1.5));
    for (let i = Math.ceil(minSize); i < searchLimit; i++) {
         if (corr[i] > corr[i - 1] && corr[i] > corr[i + 1]) {
             if (corr[i] > maxPeakValue) {
                 maxPeakValue = corr[i];
                 bestPeakIndex = i;
             }
         }
    }
    
    if (bestPeakIndex === -1 || bestPeakIndex === 0 || bestPeakIndex >= corr.length - 1) return null;

    // フォールバック時のサブピクセル補間
    const p = bestPeakIndex;
    const y1 = corr[p - 1];
    const y2 = corr[p];
    const y3 = corr[p + 1];
    
    const denominator = 2 * (y1 - 2 * y2 + y3);
    if (denominator >= 0) return p;
    
    const offset = (y1 - y3) / denominator;
    if (Math.abs(offset) > 1) return p;
    
    return p + offset;
  };

  const minGridSize = parseInt(pixelSizeSlider.min, 10) || 2;
  const sizeX = findPeak(corrX, minGridSize, maxSize, peakThreshold);
  const sizeY = findPeak(corrY, minGridSize, maxSize, peakThreshold);
  
  // --- Step 5: Finalize Size ---
  let finalSize;
  if (sizeX && sizeY) {
    finalSize = (sizeX + sizeY) / 2;
  } else if (sizeX) {
    finalSize = sizeX;
  } else if (sizeY) {
    finalSize = sizeY;
  } else {
    console.warn("Could not detect a periodic grid structure.");
    return { size: 0, offset: {x: 0, y: 0}, corrX, corrY, sizeX, sizeY };
  }

  if (finalSize < minGridSize || finalSize > maxSize) {
    console.warn(`Detected size ${finalSize} is out of bounds [${minGridSize}, ${maxSize}].`);
     return { size: 0, offset: {x: 0, y: 0}, corrX, corrY, sizeX, sizeY };
  }
  
  // --- Step 6: Find Offset (Disabled) ---
  // ユーザーの要望によりオフセット計算を無効化。グリッドは常に原点から開始します。
  const finalOffset = { x: 0, y: 0 };

  return { size: finalSize, offset: finalOffset, corrX, corrY, sizeX, sizeY };
}


/**
 * 自己相関グラフを描画する
 * @param {string} canvasId 描画対象のcanvasのID
 * @param {number[]} data 描画する相関データ
 * @param {number | null} peakX 検出されたピークのX座標
 */
function drawCorrelationGraph(canvasId, data, peakX) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  const padding = { top: 20, right: 20, bottom: 20, left: 20 };

  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, w, h);

  if (!data || data.length === 0) {
    ctx.fillStyle = '#888';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('相関データがありません', w / 2, h / 2);
    return;
  }

  const maxVal = Math.max(...data);
  if (maxVal <= 0) {
    ctx.fillStyle = '#888';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('相関が検出されませんでした', w / 2, h / 2);
    return;
  }

  const graphWidth = w - padding.left - padding.right;
  const graphHeight = h - padding.top - padding.bottom;

  const xScale = graphWidth / (data.length - 1);
  const yScale = graphHeight / maxVal;

  // Draw graph line
  ctx.beginPath();
  ctx.strokeStyle = '#4a90e2'; // Canvas context cannot parse CSS variables like 'var(--primary-color)'
  ctx.lineWidth = 2;
  ctx.moveTo(padding.left, h - padding.bottom - data[0] * yScale);
  for (let i = 1; i < data.length; i++) {
    ctx.lineTo(padding.left + i * xScale, h - padding.bottom - data[i] * yScale);
  }
  ctx.stroke();

  // Draw detected peak line
  if (peakX !== null && peakX >= 0 && peakX < data.length) {
      const peakCanvasX = padding.left + peakX * xScale;
      ctx.beginPath();
      ctx.strokeStyle = 'red';
      ctx.lineWidth = 1;
      ctx.moveTo(peakCanvasX, padding.top);
      ctx.lineTo(peakCanvasX, h - padding.bottom);
      ctx.stroke();

      // Draw peak label
      ctx.fillStyle = 'red';
      ctx.textAlign = 'center';
      ctx.fillText(peakX.toFixed(3), peakCanvasX, padding.top - 5);
  }
}

/**
 * グリッドサイズを自動設定し、UIと描画を更新する
 */
function autoSetGridSize() {
  if (!originalImage) return;
  
  const debugContainer = document.getElementById('debugGraphsContainer');
  debugContainer.style.display = 'block';

  const maxAllowedSize = parseInt(pixelSizeSlider.max, 10);
  const optimalResult = findOptimalGridSize(originalImage, maxAllowedSize, peakDetectionThreshold);

  // 常にグラフを描画してデバッグしやすくする
  if (optimalResult) {
      drawCorrelationGraph('corrXGraph', optimalResult.corrX, optimalResult.sizeX);
      drawCorrelationGraph('corrYGraph', optimalResult.corrY, optimalResult.sizeY);

      if (corrXPeriod) {
          corrXPeriod.textContent = optimalResult.sizeX 
              ? `基本周期: ${optimalResult.sizeX.toFixed(3)}px`
              : '基本周期: 検出不可';
      }
      if (corrYPeriod) {
          corrYPeriod.textContent = optimalResult.sizeY
              ? `基本周期: ${optimalResult.sizeY.toFixed(3)}px`
              : '基本周期: 検出不可';
      }
  } else {
      // findOptimalGridSizeがnullを返した場合（canvasエラーなど）
      drawCorrelationGraph('corrXGraph', [], null);
      drawCorrelationGraph('corrYGraph', [], null);
      if (corrXPeriod) corrXPeriod.textContent = '基本周期: エラー';
      if (corrYPeriod) corrYPeriod.textContent = '基本周期: エラー';
      return;
  }
  
  if (optimalResult.size > 0) {
    pixelSize = optimalResult.size;
    gridOffset = optimalResult.offset;
    const sizeStr = optimalResult.size.toFixed(3);
    pixelSizeSlider.value = sizeStr;
    pixelSizeInput.value = sizeStr;
    pixelSizeValue.textContent = sizeStr;
  } else {
    // 失敗した場合
    const defaultSize = Math.min(16, maxAllowedSize);
    pixelSize = defaultSize;
    gridOffset = { x: 0, y: 0 };
    pixelSizeSlider.value = defaultSize.toString();
    pixelSizeInput.value = defaultSize.toString();
    pixelSizeValue.textContent = defaultSize.toString();
  }
  
  drawImageWithGrid(); // 計算結果を元にグリッドを再描画
}

/**
 * 指定されたコンテキストにグリッド線を描画する
 * @param {CanvasRenderingContext2D} ctx 描画対象の2Dコンテキスト
 * @param {number} w キャンバスの幅
 * @param {number} h キャンバスの高さ
 * @param {number} size グリッドのサイズ
 * @param {{x: number, y: number}} offset グリッドのオフセット
 */
function drawGrid(ctx, w, h, size, offset) {
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.lineWidth = 1;

  for (let x = offset.x; x < w; x += size) {
    ctx.beginPath();
    ctx.moveTo(x - 0.5, 0);
    ctx.lineTo(x - 0.5, h);
    ctx.stroke();
  }

  for (let y = offset.y; y < h; y += size) {
    ctx.beginPath();
    ctx.moveTo(0, y - 0.5);
    ctx.lineTo(w, y - 0.5);
    ctx.stroke();
  }
}

/**
 * 元画像にグリッドを描画する処理
 */
function drawImageWithGrid() {
  if (!originalImage || !originalWithGridCtx) return;

  const w = originalImage.width;
  const h = originalImage.height;

  // Set canvas dimensions based on zoom level. This also clears the canvas.
  originalWithGridCanvas.width = w * zoomLevel;
  originalWithGridCanvas.height = h * zoomLevel;
  
  // Disable anti-aliasing to keep pixels sharp when scaling
  originalWithGridCtx.imageSmoothingEnabled = false;

  // pixelSize が 0 以下にならないようにガード
  if (pixelSize <= 0) return;

  // ===== Render image and grid with zoom =====
  originalWithGridCtx.save();
  originalWithGridCtx.scale(zoomLevel, zoomLevel);
  
  originalWithGridCtx.drawImage(originalImage, 0, 0, w, h);
  drawGrid(originalWithGridCtx, w, h, pixelSize, gridOffset);
  
  originalWithGridCtx.restore();

  // Show the preview container
  originalWithGridImageContainer.style.display = 'flex';
  downloadBtn.disabled = false;
}


// ===== イベントリスナー =====

// 画像ファイル選択
imageLoader.addEventListener('change', (event) => {
  const files = event.target.files;
  if (!files || files.length === 0) return;

  const file = files[0];
  const reader = new FileReader();

  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      originalImage = img;
      originalImageView.src = img.src;
      originalImageView.style.aspectRatio = `${img.width} / ${img.height}`;

      previews.style.display = 'flex';
      canvasPlaceholder.style.display = 'none';
      
      // Reset zoom to 100% for new image
      zoomLevel = 1.0;
      zoomSlider.value = '1';
      zoomInput.value = '1';
      zoomValue.textContent = '100';
      
      // グリッドサイズを自動設定 & 描画
      autoSetGridSize();
      
      pixelSizeSlider.disabled = false;
      pixelSizeInput.disabled = false;
      peakThresholdSlider.disabled = false;
      peakThresholdInput.disabled = false;
      zoomSlider.disabled = false;
      zoomInput.disabled = false;
      
      fileNameSpan.textContent = file.name;
    };
    img.onerror = () => {
        alert('画像の読み込みに失敗しました。');
        fileNameSpan.textContent = '読み込みエラー';
    }
    img.src = e.target?.result;
  };
  
  reader.readAsDataURL(file);
});

// グリッドサイズ変更時にリアルタイムで再描画する (スライダー)
pixelSizeSlider.addEventListener('input', (event) => {
  const newSize = parseFloat(event.target.value);
  pixelSize = newSize;
  const sizeStr = newSize.toFixed(3);
  pixelSizeValue.textContent = sizeStr;
  pixelSizeInput.value = sizeStr;
  
  // 手動変更時はオフセットをリセット
  gridOffset = { x: 0, y: 0 };
  
  if (originalImage) {
      drawImageWithGrid();
  }
});

// グリッドサイズ変更時にリアルタイムで再描画する (数値入力)
pixelSizeInput.addEventListener('input', (event) => {
    const newSize = parseFloat(event.target.value);
    if (isNaN(newSize)) return;

    pixelSize = newSize;
    const sizeStr = newSize.toFixed(3);
    pixelSizeValue.textContent = sizeStr;
    pixelSizeSlider.value = newSize.toString();

    // 手動変更時はオフセットをリセット
    gridOffset = { x: 0, y: 0 };

    if (originalImage) {
        drawImageWithGrid();
    }
});

// ピーク閾値変更時にリアルタイムで再計算・再描画する (スライダー)
peakThresholdSlider.addEventListener('input', (event) => {
  const newThreshold = parseFloat(event.target.value);
  peakDetectionThreshold = newThreshold;
  const thresholdStr = newThreshold.toFixed(2);
  peakThresholdValue.textContent = thresholdStr;
  peakThresholdInput.value = newThreshold.toString();
  
  if (originalImage) {
      autoSetGridSize(); // 再計算と再描画
  }
});

// ピーク閾値変更時にリアルタイムで再計算・再描画する (数値入力)
peakThresholdInput.addEventListener('input', (event) => {
    const newThreshold = parseFloat(event.target.value);
    if (isNaN(newThreshold)) return;

    peakDetectionThreshold = newThreshold;
    const thresholdStr = newThreshold.toFixed(2);
    peakThresholdValue.textContent = thresholdStr;
    peakThresholdSlider.value = newThreshold.toString();

    if (originalImage) {
        autoSetGridSize(); // 再計算と再描画
    }
});

// --- Zoom Controls ---
const handleZoomUpdate = (newZoom) => {
    zoomLevel = newZoom;
    const zoomPercent = Math.round(newZoom * 100);
    zoomValue.textContent = zoomPercent.toString();
    zoomSlider.value = newZoom.toString();
    zoomInput.value = newZoom.toString();

    if (originalImage) {
        drawImageWithGrid();
    }
};

zoomSlider.addEventListener('input', (event) => {
    const newZoom = parseFloat(event.target.value);
    handleZoomUpdate(newZoom);
});

zoomInput.addEventListener('input', (event) => {
    const newZoom = parseFloat(event.target.value);
    const min = parseFloat(zoomInput.min);
    const max = parseFloat(zoomInput.max);
    if (isNaN(newZoom) || newZoom < min || newZoom > max) return;
    handleZoomUpdate(newZoom);
});

// ダウンロードボタン
downloadBtn.addEventListener('click', () => {
  if (!originalImage) return;

  // Create an off-screen canvas to render the image at its original size
  const downloadCanvas = document.createElement('canvas');
  const downloadCtx = downloadCanvas.getContext('2d');
  if (!downloadCtx) {
    alert('ダウンロード用画像の生成に失敗しました。');
    return;
  }

  const w = originalImage.width;
  const h = originalImage.height;
  downloadCanvas.width = w;
  downloadCanvas.height = h;

  // Draw the original image and the grid on the off-screen canvas
  downloadCtx.drawImage(originalImage, 0, 0, w, h);
  drawGrid(downloadCtx, w, h, pixelSize, gridOffset);

  // Trigger the download from the off-screen canvas
  const link = document.createElement('a');
  const originalFileName = fileNameSpan.textContent || 'image';
  const extensionIndex = originalFileName.lastIndexOf('.');
  const baseName = extensionIndex !== -1 ? originalFileName.substring(0, extensionIndex) : originalFileName;
  const extension = extensionIndex !== -1 ? originalFileName.substring(extensionIndex) : '.png';

  link.download = `${baseName}_grid${extension}`;
  link.href = downloadCanvas.toDataURL('image/png');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
});