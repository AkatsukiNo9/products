/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const imageLoader = document.getElementById('imageLoader');
const gridSizeSlider = document.getElementById('gridSize');
const gridSizeNumber = document.getElementById('gridSizeNumber');
const gridSizeValue = document.getElementById('gridSizeValue');
const downloadBtn = document.getElementById('downloadBtn');
const canvas = document.getElementById('canvas');
const canvasPlaceholder = document.getElementById('canvasPlaceholder');
const fileNameSpan = document.getElementById('fileName');
const originalImageView = document.getElementById('originalImageView');
const previews = document.getElementById('previews');
const ctx = canvas.getContext('2d');

let originalImage = null;
let gridSize = 16;

/**
 * 画像とグリッドをCanvasに描画します。
 */
function drawImageAndGrid() {
  if (!originalImage || !ctx) {
    return;
  }

  // Canvasのサイズを画像のサイズに合わせる
  canvas.width = originalImage.width;
  canvas.height = originalImage.height;

  // 描画前にクリア
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 元画像を描画
  ctx.drawImage(originalImage, 0, 0);

  // グリッドを描画
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.lineWidth = 1;

  // 縦線
  for (let x = gridSize; x < canvas.width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }

  // 横線
  for (let y = gridSize; y < canvas.height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
}

// 画像ファイルが選択されたときの処理
imageLoader.addEventListener('change', (event) => {
  const files = event.target.files;
  if (!files || files.length === 0) {
    return;
  }

  const file = files[0];
  const reader = new FileReader();

  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      originalImage = img;
      
      // 元画像のプレビューを設定
      originalImageView.src = img.src;

      // プレビューを表示し、プレースホルダーを非表示に
      previews.style.display = 'flex';
      canvasPlaceholder.style.display = 'none';

      drawImageAndGrid();
      downloadBtn.disabled = false; // ダウンロードボタンを有効化
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

// グリッド間隔のスライダーが操作されたときの処理
gridSizeSlider.addEventListener('input', (event) => {
  const newSize = parseInt(event.target.value, 10);
  gridSize = newSize;
  gridSizeValue.textContent = newSize.toString();
  gridSizeNumber.value = newSize.toString();
  drawImageAndGrid();
});

// グリッド間隔の数値入力が操作されたときの処理
gridSizeNumber.addEventListener('input', (event) => {
    const input = event.target;
    const newSize = parseInt(input.value, 10);
    const min = parseInt(input.min, 10);
    const max = parseInt(input.max, 10);

    if (!isNaN(newSize) && newSize >= min && newSize <= max) {
        gridSize = newSize;
        gridSizeValue.textContent = newSize.toString();
        gridSizeSlider.value = newSize.toString();
        drawImageAndGrid();
    }
});

// 数値入力からフォーカスが外れたときに値を範囲内に補正する
gridSizeNumber.addEventListener('change', (event) => {
    const input = event.target;
    let newSize = parseInt(input.value, 10);
    const min = parseInt(input.min, 10);
    const max = parseInt(input.max, 10);

    if (isNaN(newSize) || newSize < min) {
        newSize = min;
    } else if (newSize > max) {
        newSize = max;
    }

    if (parseInt(input.value, 10) !== newSize) {
      input.value = newSize.toString();
      // inputイベントを発火させて、スライダーや描画を更新
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
});


// ダウンロードボタンがクリックされたときの処理
downloadBtn.addEventListener('click', () => {
  if (!originalImage) return;

  const link = document.createElement('a');
  // 元のファイル名に `_grid` を付けてダウンロードファイル名とする
  const originalFileName = fileNameSpan.textContent || 'image';
  const extensionIndex = originalFileName.lastIndexOf('.');
  const baseName = extensionIndex !== -1 ? originalFileName.substring(0, extensionIndex) : originalFileName;
  const extension = extensionIndex !== -1 ? originalFileName.substring(extensionIndex) : '.png';

  link.download = `${baseName}_grid${extension}`;
  link.href = canvas.toDataURL('image/png');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
});

export {};
