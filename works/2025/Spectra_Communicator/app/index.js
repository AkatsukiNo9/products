/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// --- 画像データURI (非同期で設定されます) ---
let IMG_SPECTRA_CLOSE_URI;
let IMG_SPECTRA_OPEN_URI;


// --- DOM要素の取得 ---
const log = document.getElementById('log');
const form = document.getElementById('prompt-form');
const input = document.getElementById('prompt-input');
const characterImage = document.getElementById('character-image');
const promptCursor = document.getElementById('prompt-cursor');

// --- 初期設定 ---
let isMouthOpen = false;
let isGenerating = false;
let audioContext;
let audioInitialized = false;
let messages = [];
let messageIndex = 0;

input.placeholder = ' '; // for CSS :not(:placeholder-shown) selector

/**
 * Web Audio APIの初期化
 */
async function initAudio() {
    try {
        audioContext = new AudioContext();
        // ユーザーによるインタラクションがあるまで、コンテキストは 'suspended' 状態になる可能性がある
        audioInitialized = true;
    } catch (e) {
        console.error("Web Audio APIの初期化に失敗しました。", e);
        addStaticMessage('>', '警告: 音声の初期化に失敗しました。サウンドは無効になります。');
    }
}

/**
 * サウンドをプログラムで生成して再生する
 */
function playSound() {
    if (!audioInitialized) return;
    
    // ユーザー操作により停止されたコンテキストを再開
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    
    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    // --- 音の設定 ---
    const peakVolume = 0.2;     // 音量 (0.0 ~ 1.0)
    const attackTime = 0.005;   // 音の立ち上がり時間 (秒) - クリックノイズ防止
    const decayTime = 0.05;     // 音の減衰時間 (秒)
    const frequency = 880;      // 周波数 (Hz) - A5ノート (高めの音)

    // 発振器 (音源) の設定
    oscillator.type = 'triangle'; // 'sine', 'square', 'sawtooth', 'triangle'
    oscillator.frequency.setValueAtTime(frequency, now);

    // 音量エンベロープを設定してクリックノイズを防ぎ、自然な音にする
    gainNode.gain.setValueAtTime(0, now); // 再生開始時は音量0
    gainNode.gain.linearRampToValueAtTime(peakVolume, now + attackTime); // attackTimeかけて最大音量へ
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + attackTime + decayTime); // decayTimeかけて指数関数的に減衰

    // オーディオノードを接続: Oscillator -> Gain -> Destination (スピーカー)
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // 再生と、音が鳴り終わった後の停止をスケジュール
    oscillator.start(now);
    oscillator.stop(now + attackTime + decayTime + 0.01);
}

/**
 * テキストをタイプライター風に表示する関数
 * @param stream 模擬的なレスポンスストリーム
 * @param element テキストを表示するHTML要素
 */
async function typeWriter(stream, element) {
  element.innerHTML = '';
  isGenerating = true;
  input.disabled = true;
  promptCursor.style.display = 'none';

  for await (const chunk of stream) {
    const chunkText = chunk.text;
    for (const char of chunkText) {
      element.innerHTML += char;
      log.parentElement.scrollTop = log.parentElement.scrollHeight; // Scroll log panel
      
      isMouthOpen = !isMouthOpen;
      characterImage.src = isMouthOpen ? IMG_SPECTRA_OPEN_URI : IMG_SPECTRA_CLOSE_URI;

      playSound();

      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
  
  characterImage.src = IMG_SPECTRA_CLOSE_URI;
  isGenerating = false;
  input.disabled = false;
  promptCursor.style.display = 'inline-block';
  input.focus();
}

/**
 * ログに静的なメッセージを追加する
 * @param prefix メッセージのプレフィックス
 * @param message メッセージ内容
 */
function addStaticMessage(prefix, message) {
    const messageLine = document.createElement('div');
    messageLine.classList.add('message-line', 'system-message');
    messageLine.textContent = `${prefix} ${message}`;
    log.appendChild(messageLine);
}


/**
 * ユーザーまたはAIのメッセージコンテナをログに追加する
 * @param sender 'user' または 'gemini'
 * @param message ユーザーのメッセージ（ユーザーの場合のみ）
 * @returns メッセージ内容が表示されるdiv要素
 */
function addMessageContainer(sender, message) {
    const messageLine = document.createElement('div');
    messageLine.classList.add('message-line', `${sender}-message`);

    const prefix = document.createElement('span');
    prefix.classList.add('prefix');
    
    const contentDiv = document.createElement('div');
    contentDiv.classList.add('content');
    
    if (sender === 'user') {
      prefix.textContent = 'USER> ';
      contentDiv.textContent = message || '';
    } else { // gemini
      prefix.textContent = 'Spectra> ';
    }

    messageLine.appendChild(prefix);
    messageLine.appendChild(contentDiv);
    log.appendChild(messageLine);
    log.parentElement.scrollTop = log.parentElement.scrollHeight;
    return contentDiv;
}


async function main() {
  // 最初にキャラクター画像を読み込みます。これは初期化に必要です。
  try {
    const [closeResponse, openResponse] = await Promise.all([
      fetch('./src/face_close.txt'),
      fetch('./src/face_open.txt')
    ]);

    if (!closeResponse.ok || !openResponse.ok) {
      throw new Error(`HTTP error! Status: ${closeResponse.status} & ${openResponse.status}`);
    }

    const spectraCloseB64 = (await closeResponse.text()).trim();
    const spectraOpenB64 = (await openResponse.text()).trim();
    
    IMG_SPECTRA_CLOSE_URI = `data:image/png;base64,${spectraCloseB64}`;
    IMG_SPECTRA_OPEN_URI = `data:image/png;base64,${spectraOpenB64}`;

    // 読み込みが完了したので、初期のキャラクター画像を設定します
    characterImage.src = IMG_SPECTRA_CLOSE_URI;
  } catch(e) {
      console.error("キャラクター画像データの読み込みに失敗しました:", e);
      addStaticMessage('>', 'ERROR: Failed to load character images. App cannot start.');
      return; // 画像が読み込めない場合は実行を停止します
  }

  // Spectraのセリフファイルを読み込みます
  try {
    const response = await fetch('./src/message.txt');
    if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const text = await response.text();
    // 改行で分割し、空行は除外する
    messages = text.trim().split('\n').filter(line => line.trim() !== '');
  } catch (e) {
      console.error("メッセージファイルの読み込みに失敗しました:", e);
      addStaticMessage('>', 'ERROR: Failed to load message file. App cannot start.');
      return;
  }
  
  // アプリケーションの残りの部分の初期化を続行します
  // 音声の初期化を試みる
  await initAudio();
    
  // 初期メッセージ
  addStaticMessage('>', 'SYSTEM: WARNING: Multiple critical system failures detected.');
  addStaticMessage('>', 'SYSTEM: External communication relay... UNRESPONSIVE.');

  // フォーム送信時の処理
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const userMessage = input.value.trim();
    if (!userMessage || isGenerating) return;

    addMessageContainer('user', userMessage);
    input.value = '';

    // 用意されたメッセージがまだ残っている場合
    if (messageIndex < messages.length) {
      const spectraMessage = messages[messageIndex];
      messageIndex++;
      
      // ユーザーの入力後、1秒待機
      await new Promise(resolve => setTimeout(resolve, 1000));

      // typeWriter関数に渡すための非同期ジェネレータ
      async function* stringAsStream(text) {
        yield { text };
      }

      const stream = stringAsStream(spectraMessage);
      const geminiMessageDiv = addMessageContainer('gemini');
      await typeWriter(stream, geminiMessageDiv);
    }
    // メッセージがなくなったら、Spectraは応答しなくなる
  });
}

main();