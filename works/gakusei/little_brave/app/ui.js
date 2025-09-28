/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Player } from './player.js';
import { Boss } from './boss.js';

export function drawHeartForHP(context, x, y, size) {
    const k = size / 16; // Scale factor for heart drawing
    context.beginPath();
    // Start at bottom point
    context.moveTo(x + 8*k, y + 15*k); 
    // Left curve
    context.bezierCurveTo(x + 8*k, y + 13*k, x + 0*k, y + 8*k, x + 0*k, y + 5*k);
    // Top-left curve to top-middle point
    context.bezierCurveTo(x + 0*k, y + 2*k, x + 3*k, y + 0*k, x + 8*k, y + 3*k);
    // Top-right curve to top-right point
    context.bezierCurveTo(x + 13*k, y + 0*k, x + 16*k, y + 2*k, x + 16*k, y + 5*k);
    // Right curve back to bottom point
    context.bezierCurveTo(x + 16*k, y + 8*k, x + 8*k, y + 13*k, x + 8*k, y + 15*k);
    context.closePath();
}

export function drawPlayerHP(context, player, gameConfig) {
    if (!player || !gameConfig) return;

    const heartXStart = gameConfig.HEART_PADDING;
    const heartY = gameConfig.HEART_PADDING;

    for (let i = 0; i < player.maxHp; i++) {
        const currentHeartX = heartXStart + i * (gameConfig.HEART_SIZE + gameConfig.HEART_PADDING);
        context.save();
        context.fillStyle = (i < player.currentHp) ? gameConfig.HEART_COLOR_FULL : gameConfig.HEART_COLOR_EMPTY;
        context.strokeStyle = gameConfig.HEART_COLOR_STROKE;
        context.lineWidth = Math.max(1, gameConfig.HEART_SIZE / 16); // Ensure lineWidth is at least 1
        
        drawHeartForHP(context, currentHeartX, heartY, gameConfig.HEART_SIZE);
        
        context.fill();
        context.stroke();
        context.restore();
    }
}

export function drawPlayerRupees(context, player, gameConfig) {
  if (!player || !gameConfig) return;

  const rupeeIconSize = gameConfig.HEART_SIZE * 0.8;
  const xPos = gameConfig.HEART_PADDING;
  const yPos = gameConfig.HEART_PADDING * 2 + gameConfig.HEART_SIZE;

  // Draw Rupee Icon (simple circle)
  context.fillStyle = gameConfig.RUPEE_COLOR;
  context.strokeStyle = 'rgba(0,0,0,0.5)';
  context.lineWidth = 2;
  context.beginPath();
  context.arc(xPos + rupeeIconSize / 2, yPos + rupeeIconSize / 2, rupeeIconSize / 2, 0, Math.PI * 2);
  context.fill();
  context.stroke();

  // Draw Rupee Count
  context.fillStyle = 'white';
  context.font = '18px sans-serif';
  context.textAlign = 'left';
  context.textBaseline = 'middle';
  context.fillText(`: ${player.rupees}`, xPos + rupeeIconSize + 5, yPos + rupeeIconSize / 2);
}

function drawPotionIcon(context, x, y, size) {
    context.save();
    // Flask body
    context.fillStyle = 'rgba(255, 182, 193, 0.8)'; // Light pink glass
    context.beginPath();
    context.arc(x + size / 2, y + size * 0.65, size * 0.35, 0, Math.PI * 2);
    context.fill();

    // Flask neck
    context.fillRect(x + size * 0.35, y + size * 0.2, size * 0.3, size * 0.3);
    
    // Liquid
    context.fillStyle = '#FF0000'; // Red potion
    context.beginPath();
    context.arc(x + size / 2, y + size * 0.65, size * 0.3, 0, Math.PI * 2);
    context.fill();

    context.restore();
}

export function drawPlayerInventory(context, player, gameConfig) {
    if (!player || !gameConfig) return;

    const potionCount = player.inventory.get('potion') || 0;
    if (potionCount === 0) return;

    const iconSize = gameConfig.HEART_SIZE;
    const xPos = gameConfig.HEART_PADDING;
    const yPos = gameConfig.HEART_PADDING * 3 + gameConfig.HEART_SIZE * 2 - 5;

    drawPotionIcon(context, xPos, yPos, iconSize);

    // Draw Potion Count
    context.fillStyle = 'white';
    context.font = 'bold 18px sans-serif';
    context.textAlign = 'left';
    context.textBaseline = 'middle';
    context.fillText(`: ${potionCount}`, xPos + iconSize + 5, yPos + iconSize / 2);

    // Draw Use Key Hint
    context.font = '14px sans-serif';
    context.strokeStyle = 'black';
    context.lineWidth = 3;
    context.strokeText('[Q]', xPos + iconSize / 2, yPos + iconSize + 10);
    context.fillStyle = 'white';
    context.textAlign = 'center';
    context.fillText('[Q]', xPos + iconSize / 2, yPos + iconSize + 10);
}


export function drawCurrentRoomName(context, roomId, player, gameConfig) {
    if (!roomId || !player || !gameConfig) return;

    const heartXStart = gameConfig.HEART_PADDING;
    const yPos = gameConfig.HEART_PADDING + gameConfig.HEART_SIZE / 2;

    // Calculate the X position for the text to start just after the last heart.
    const startX = heartXStart + player.maxHp * (gameConfig.HEART_SIZE + gameConfig.HEART_PADDING);

    context.fillStyle = 'white';
    context.font = '16px sans-serif';
    context.textAlign = 'left';
    context.textBaseline = 'middle';
    
    context.fillText(`場所: ${roomId}`, startX, yPos);
}

export function drawBossHP(context, bosses, derivedConstants) {
    if (!bosses || bosses.length === 0) return;

    bosses.forEach((boss, index) => {
        if (boss.isDead) return;

        const barWidth = derivedConstants.CANVAS_WIDTH * 0.6;
        const barHeight = 20;
        const barX = (derivedConstants.CANVAS_WIDTH - barWidth) / 2;
        const barY = derivedConstants.CANVAS_HEIGHT - barHeight - 15 - (index * (barHeight + 5));

        const hpRatio = boss.hp / boss.maxHp;

        // Background
        context.fillStyle = '#333';
        context.fillRect(barX, barY, barWidth, barHeight);
        context.globalAlpha = 0.8;

        // Health
        const hpColor = boss.phase === 2 ? boss.stats.enragedColor : boss.stats.hpBarColor;
        context.fillStyle = hpColor;
        context.fillRect(barX, barY, barWidth * hpRatio, barHeight);
        context.globalAlpha = 1.0;

        // Border
        context.strokeStyle = 'white';
        context.lineWidth = 2;
        context.strokeRect(barX, barY, barWidth, barHeight);

        // Text
        context.fillStyle = 'white';
        context.font = '16px sans-serif';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(boss.name, derivedConstants.CANVAS_WIDTH / 2, barY + barHeight / 2);
    });
}

export function drawDialogBox(context, name, text, gameConfig, derivedConstants) {
    const boxHeight = 120;
    const boxY = derivedConstants.CANVAS_HEIGHT - boxHeight - 10;
    const boxX = 10;
    const boxWidth = derivedConstants.CANVAS_WIDTH - 20;

    // Draw the box
    context.fillStyle = gameConfig.DIALOG_BOX_COLOR;
    context.fillRect(boxX, boxY, boxWidth, boxHeight);
    context.strokeStyle = 'white';
    context.lineWidth = 2;
    context.strokeRect(boxX, boxY, boxWidth, boxHeight);

    const padding = 15;
    
    // Draw the name
    context.fillStyle = gameConfig.DIALOG_NAME_COLOR;
    context.font = `bold ${gameConfig.DIALOG_FONT_SIZE}px sans-serif`;
    context.textAlign = 'left';
    context.textBaseline = 'top';
    context.fillText(`${name}:`, boxX + padding, boxY + padding);
    
    // Draw the text
    context.fillStyle = gameConfig.DIALOG_TEXT_COLOR;
    context.font = `${gameConfig.DIALOG_FONT_SIZE}px sans-serif`;
    const textX = boxX + padding;
    const textY = boxY + padding + gameConfig.DIALOG_FONT_SIZE + 10; // Line height for name + spacing

    // Basic word wrapping
    const maxWidth = boxWidth - padding * 2;
    const words = text.split(' ');
    let line = '';
    let currentY = textY;

    for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = context.measureText(testLine);
        const testWidth = metrics.width;
        if (testWidth > maxWidth && n > 0) {
            context.fillText(line, textX, currentY);
            line = words[n] + ' ';
            currentY += gameConfig.DIALOG_FONT_SIZE + 5; // Line height
        } else {
            line = testLine;
        }
    }
    context.fillText(line, textX, currentY);

    // Draw continue indicator
    context.fillText('▼', boxWidth - padding, boxY + boxHeight - padding - 10);
}

export function drawShopMenu(context, player, items, selectionIndex, gameConfig, derivedConstants) {
  const boxWidth = derivedConstants.CANVAS_WIDTH * 0.8;
  const boxHeight = derivedConstants.CANVAS_HEIGHT * 0.7;
  const boxX = (derivedConstants.CANVAS_WIDTH - boxWidth) / 2;
  const boxY = (derivedConstants.CANVAS_HEIGHT - boxHeight) / 2;
  const padding = 20;
  
  // Draw main box
  context.fillStyle = gameConfig.SHOP_BOX_COLOR;
  context.fillRect(boxX, boxY, boxWidth, boxHeight);
  context.strokeStyle = 'white';
  context.lineWidth = 2;
  context.strokeRect(boxX, boxY, boxWidth, boxHeight);

  // Title
  context.fillStyle = gameConfig.SHOP_TEXT_COLOR;
  context.font = 'bold 24px sans-serif';
  context.textAlign = 'center';
  context.fillText('ようこそ！', derivedConstants.CANVAS_WIDTH / 2, boxY + padding + 10);

  // Player Rupees
  context.textAlign = 'right';
  context.font = '18px sans-serif';
  context.fillText(`所持ルピー: ${player.rupees}`, boxX + boxWidth - padding, boxY + padding + 10);

  // Items
  const itemStartY = boxY + 70;
  const lineHeight = 40;
  context.font = '20px sans-serif';
  

  items.forEach((item, index) => {
    const itemY = itemStartY + index * lineHeight;
    const itemTextX = boxX + padding + 20;
    
    const isAvailable = item.isAvailable(player);
    const canAfford = player.rupees >= item.price;

    context.textAlign = 'left';
    // Draw selection cursor
    if (index === selectionIndex) {
      context.fillStyle = gameConfig.SHOP_HIGHLIGHT_COLOR;
      context.fillText('>', boxX + padding, itemY);
    }
    
    // Draw item name
    context.fillStyle = isAvailable ? gameConfig.SHOP_TEXT_COLOR : '#888888'; // Grey out if unavailable
    context.fillText(item.name, itemTextX, itemY);

    // Draw price
    context.textAlign = 'right';
    if (!isAvailable) {
        context.fillStyle = '#888888'; // Grey
    } else if (!canAfford) {
        context.fillStyle = '#FF5555'; // Red
    } else {
        context.fillStyle = gameConfig.SHOP_PRICE_COLOR;
    }
    context.fillText(`${item.price} R`, boxX + boxWidth - padding, itemY);
  });

  // Instructions
  context.fillStyle = gameConfig.SHOP_TEXT_COLOR;
  context.textAlign = 'center';
  context.font = '16px sans-serif';
  context.fillText('↑↓: 選択, E: 購入, Esc: 閉じる', derivedConstants.CANVAS_WIDTH / 2, boxY + boxHeight - padding);
}

export function drawArenaUI(context, currentWave, totalWaves, derivedConstants) {
    context.fillStyle = 'white';
    context.font = 'bold 24px sans-serif';
    context.textAlign = 'center';
    context.strokeStyle = 'black';
    context.lineWidth = 4;

    const text = `ウェーブ: ${currentWave} / ${totalWaves}`;
    const x = derivedConstants.CANVAS_WIDTH / 2;
    const y = 30;

    context.strokeText(text, x, y);
    context.fillText(text, x, y);
}

export function drawArenaTransition(context, wave, timer, derivedConstants) {
    context.fillStyle = 'rgba(0, 0, 0, 0.5)';
    context.fillRect(0, 0, derivedConstants.CANVAS_WIDTH, derivedConstants.CANVAS_HEIGHT);

    context.fillStyle = 'white';
    context.font = 'bold 36px sans-serif';
    context.textAlign = 'center';

    if (wave > 1) {
        context.fillText(`ウェーブ ${wave - 1} クリア!`, derivedConstants.CANVAS_WIDTH / 2, derivedConstants.CANVAS_HEIGHT / 2 - 40);
    }
    
    context.font = '28px sans-serif';
    context.fillText(`次のウェーブまで ${Math.ceil(timer / 1000)}...`, derivedConstants.CANVAS_WIDTH / 2, derivedConstants.CANVAS_HEIGHT / 2 + 20);
}

export function drawArenaComplete(context, reward, derivedConstants) {
    context.fillStyle = 'rgba(0, 100, 200, 0.7)';
    context.fillRect(0, 0, derivedConstants.CANVAS_WIDTH, derivedConstants.CANVAS_HEIGHT);

    context.fillStyle = '#FFFF00';
    context.font = 'bold 48px sans-serif';
    context.textAlign = 'center';
    context.fillText('アリーナ制覇!', derivedConstants.CANVAS_WIDTH / 2, derivedConstants.CANVAS_HEIGHT / 2 - 40);

    context.fillStyle = 'white';
    context.font = '24px sans-serif';
    context.fillText(`報酬: ${reward} ルピー`, derivedConstants.CANVAS_WIDTH / 2, derivedConstants.CANVAS_HEIGHT / 2 + 20);
}