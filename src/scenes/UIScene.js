/**
 * UI场景 - 显示游戏HUD
 */
import { PLAYER_CONFIG } from '../config/gameConfig.js';
import { TileType } from '../systems/MapGenerator.js';

export default class UIScene extends Phaser.Scene {
  constructor() {
    super({ key: 'UIScene' });
    this.playerStats = null;
  }

  create() {
    // 初始化玩家数据显示
    this.createHUD();
    
    // 监听游戏场景的事件
    const gameScene = this.scene.get('GameScene');
    
    gameScene.events.on('updateStats', (stats) => {
      this.updateStats(stats);
    });

    gameScene.events.on('showMessage', (message) => {
      this.showMessage(message);
    });

    gameScene.events.on('showDamage', (data) => {
      this.showDamageNumber(data);
    });
    // 打开符卡切换菜单的事件（由 MenuScene 或其他触发）
    gameScene.events.on('openSpellMenu', () => {
      this.openSpellMenuOverlay();
    });
  }

  createHUD() {
    const padding = 10;
    
    // 背景面板
    const hudBg = this.add.graphics();
    hudBg.fillStyle(0x000000, 0.7);
    hudBg.fillRoundedRect(padding, padding, 200, 120, 8);

    // 角色名
    this.add.text(padding + 10, padding + 10, '博丽灵梦', {
      fontSize: '16px',
      fontFamily: 'Arial',
      color: '#e94560'
    });

    // HP条背景
    this.add.graphics()
      .fillStyle(0x333333)
      .fillRect(padding + 10, padding + 35, 180, 16);

    // HP条
    this.hpBar = this.add.graphics();
    this.updateHPBar(PLAYER_CONFIG.maxHp, PLAYER_CONFIG.maxHp);

    // HP文字
    this.hpText = this.add.text(padding + 100, padding + 37, `${PLAYER_CONFIG.maxHp}/${PLAYER_CONFIG.maxHp}`, {
      fontSize: '12px',
      fontFamily: 'Arial',
      color: '#ffffff'
    }).setOrigin(0.5, 0);

    // MP条背景
    this.add.graphics()
      .fillStyle(0x333333)
      .fillRect(padding + 10, padding + 58, 180, 16);

    // MP条
    this.mpBar = this.add.graphics();
    this.updateMPBar(PLAYER_CONFIG.maxMp, PLAYER_CONFIG.maxMp);

    // MP文字
    this.mpText = this.add.text(padding + 100, padding + 60, `${PLAYER_CONFIG.maxMp}/${PLAYER_CONFIG.maxMp}`, {
      fontSize: '12px',
      fontFamily: 'Arial',
      color: '#ffffff'
    }).setOrigin(0.5, 0);

    // 层数显示
    this.floorText = this.add.text(padding + 10, padding + 85, '迷宫 1层', {
      fontSize: '14px',
      fontFamily: 'Arial',
      color: '#ffffff'
    });

    // 回合数显示
    this.turnText = this.add.text(padding + 120, padding + 85, '回合: 0', {
      fontSize: '14px',
      fontFamily: 'Arial',
      color: '#aaaaaa'
    });

    // 地面物品提示（当玩家周围或当前位置有物品时显示）
    this.groundItemText = this.add.text(padding + 10, padding + 105, '', {
      fontSize: '12px',
      fontFamily: 'Arial',
      color: '#fff2b0'
    });

    // 符卡显示
    this.createSpellCardUI();

    // 小地图（右上角）
    this.createMinimap();

    // 消息日志（底部）
    this.createMessageLog();
  }

  createSpellCardUI() {
    const width = this.cameras.main.width;
    const padding = 10;

    // 符卡面板背景
    const spellBg = this.add.graphics();
    spellBg.fillStyle(0x000000, 0.7);
    spellBg.fillRoundedRect(width - 210, padding, 200, 95, 8);

    // 快捷槽显示（Z/X/C）及对应符卡名/冷却显示（会在 updateSpellUI 刷新）
    this.spellSlotTexts = [];
    this.spellSlotCd = [];
    const slotX = width - 200;
    const baseY = padding + 8;
    const slotLabels = ['Z', 'X', 'C'];
    for (let i = 0; i < 3; i++) {
      this.spellSlotTexts[i] = this.add.text(slotX, baseY + i * 28, `[${slotLabels[i]}] -`, { fontSize: '11px', fontFamily: 'Arial', color: '#ffffff' });
      this.spellSlotCd[i] = this.add.text(slotX, baseY + 12 + i * 28, '', { fontSize: '9px', fontFamily: 'Arial', color: '#aaaaaa' });
    }

    // 初始化显示
    this.updateSpellUI();
  }

  updateSpellUI() {
    const game = this.scene.get('GameScene');
    if (!game || !game.spellCardSystem || !game.player) return;
    const status = game.spellCardSystem.getStatus();
    for (let i = 0; i < 3; i++) {
      const mappedIndex = (game.player.quickSlots && game.player.quickSlots[i] !== undefined) ? game.player.quickSlots[i] : i;
      const s = status[mappedIndex] || { name: '未知', mpCost: 0, cooldown: 0, maxCooldown: 0 };
      this.spellSlotTexts[i].setText(`[${['Z','X','C'][i]}] ${s.name}`);
      this.spellSlotCd[i].setText(s.cooldown > 0 ? `CD:${s.cooldown}` : `MP:${s.mpCost}`);
    }
  }

  openSpellMenuOverlay() {
    const game = this.scene.get('GameScene');
    if (!game || !game.spellCardSystem) return;

    // 若已存在覆盖层，移除
    try { if (this.spellMenuContainer) { this.spellMenuContainer.destroy(true); this.spellMenuContainer = null; } } catch (e) {}

    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    const container = this.add.container(0,0);
    const overlay = this.add.rectangle(0,0,width*2,height*2,0x000000,0.6).setOrigin(0);
    container.add(overlay);

    const boxW = 480, boxH = 360;
    const box = this.add.rectangle(width/2, height/2, boxW, boxH, 0x0f0f16, 1.0);
    box.setStrokeStyle(2, 0xffffff, 0.12);
    container.add(box);

    const title = this.add.text(width/2, height/2 - boxH/2 + 24, '符卡配置', { fontSize: '20px', color: '#ffffff' }).setOrigin(0.5);
    container.add(title);

    const spells = game.spellCardSystem.getStatus();
    // 显示所有可用符卡，并为每个符卡添加 3 个按钮分配到槽位
    for (let si = 0; si < spells.length; si++) {
      const s = spells[si];
      const y = height/2 - boxH/2 + 64 + si * 36;
      const nameTxt = this.add.text(width/2 - 160, y, s.name, { fontSize: '16px', color: '#ffffff' }).setOrigin(0,0.5);
      container.add(nameTxt);

      // 创建三个小按钮（Z/X/C）用于分配
      const labels = ['Z','X','C'];
      for (let slot = 0; slot < 3; slot++) {
        const btn = this.add.text(width/2 + (slot*60) - 20, y, labels[slot], { fontSize: '14px', color: '#ffffff', backgroundColor: '#222222' }).setOrigin(0.5).setInteractive();
        btn.on('pointerover', () => { try { btn.setStyle({ backgroundColor: '#335533', color: '#88ff88' }); } catch(e) {} });
        btn.on('pointerout', () => { try { btn.setStyle({ backgroundColor: '#222222', color: '#ffffff' }); } catch(e) {} });
        (function(sIndex, slotIndex, selfRef) {
          btn.on('pointerdown', function() {
            try { game.player.setQuickSlot(slotIndex, sIndex); } catch (e) {}
            // 更新 HUD 显示
            selfRef.updateSpellUI();
          });
        })(si, slot, this);
        container.add(btn);
      }
    }

    const close = this.add.text(width/2, height/2 + boxH/2 - 30, '返回', { fontSize: '18px', color: '#aaffaa' }).setOrigin(0.5).setInteractive();
    close.on('pointerdown', () => { try { container.destroy(true); this.spellMenuContainer = null; } catch(e) {} });
    container.add(close);

    this.spellMenuContainer = container;
  }

  createMinimap() {
    const width = this.cameras.main.width;
    const minimapSize = 150;
    const padding = 10;
    
    // 小地图位置
    this.minimapX = width - minimapSize - padding;
    this.minimapY = 115;
    this.minimapSize = minimapSize;

    // 小地图背景（保存为实例属性以便拖拽）
    this.minimapBg = this.add.graphics();
    this.minimapBg.fillStyle(0x000000, 0.8);
    this.minimapBg.fillRoundedRect(this.minimapX, this.minimapY - 15, minimapSize, minimapSize + 15, 8);

    // 标题（保存引用以便更新位置）
    this.minimapTitle = this.add.text(this.minimapX + minimapSize / 2, this.minimapY - 10, '小地图 [TAB查看]', {
      fontSize: '9px',
      fontFamily: 'Arial',
      color: '#888888'
    }).setOrigin(0.5, 0);

    // 小地图绘制图形
    this.minimapGraphics = this.add.graphics();
    
    // 获取游戏场景引用
    const gameScene = this.scene.get('GameScene');
    
    // 保存最后一次小地图数据以便拖动时重绘
    this._lastMinimapData = null;
    // 监听小地图更新事件
    gameScene.events.on('updateMinimap', (data) => {
      this._lastMinimapData = data;
      this.drawMinimap(data);
    });

    // 使小地图背景可交互并可拖拽
    try {
      this.minimapBg.setInteractive(new Phaser.Geom.Rectangle(this.minimapX, this.minimapY - 15, minimapSize, minimapSize + 15), Phaser.Geom.Rectangle.Contains);
      this.input.setDraggable(this.minimapBg);

      this.input.on('dragstart', (pointer, gameObject) => {
        if (gameObject !== this.minimapBg) return;
        this._minimapDragOffsetX = pointer.x - this.minimapX;
        this._minimapDragOffsetY = pointer.y - this.minimapY;
      });

      this.input.on('drag', (pointer, gameObject) => {
        if (gameObject !== this.minimapBg) return;
        const camW = this.cameras.main.width;
        const camH = this.cameras.main.height;
        let nx = pointer.x - this._minimapDragOffsetX;
        let ny = pointer.y - this._minimapDragOffsetY;
        // 边界约束
        nx = Phaser.Math.Clamp(nx, 0, camW - minimapSize);
        ny = Phaser.Math.Clamp(ny, 20, camH - minimapSize);
        this.minimapX = nx;
        this.minimapY = ny;

        // 重新绘制背景与标题位置
        this.minimapBg.clear();
        this.minimapBg.fillStyle(0x000000, 0.8);
        this.minimapBg.fillRoundedRect(this.minimapX, this.minimapY - 15, minimapSize, minimapSize + 15, 8);
        this.minimapTitle.setPosition(this.minimapX + minimapSize / 2, this.minimapY - 10);

        // 重新设置 interactive 区域（因为位置改变）
        try { this.minimapBg.input.hitArea.setTo(this.minimapX, this.minimapY - 15, minimapSize, minimapSize + 15); } catch (e) {}

        // 重新绘制小地图内容
        if (this._lastMinimapData) this.drawMinimap(this._lastMinimapData);
      });
    } catch (e) {
      // 如果运行环境不支持交互（极少数情况），忽略拖拽功能
    }
  }

  /**
   * 绘制小地图
   */
  drawMinimap(data) {
    if (!this.minimapGraphics) return;
    
    this.minimapGraphics.clear();
    
    const { mapData, player, enemies, exitPoint } = data;
    if (!mapData || !player) return;
    
    const mapWidth = mapData.width;
    const mapHeight = mapData.height;
    
    // 计算缩放比例
    const scale = (this.minimapSize - 10) / Math.max(mapWidth, mapHeight);
    const offsetX = this.minimapX + 5;
    const offsetY = this.minimapY + 5;
    
    // 使用迷雾信息绘制瓦片：只显示已探索的地板，当前可见用亮色，已探索但不可见用暗色
    const fog = data.fog || null;
    for (let y = 0; y < mapHeight; y++) {
      for (let x = 0; x < mapWidth; x++) {
        const tile = (mapData.tiles[y] && mapData.tiles[y][x]) ? mapData.tiles[y][x] : TileType.WALL;
        if (tile !== TileType.FLOOR && tile !== TileType.SPAWN && tile !== TileType.EXIT) continue;

        const explored = fog && fog.explored && fog.explored[y] ? !!fog.explored[y][x] : true;
        const visible = fog && fog.visible && fog.visible[y] ? !!fog.visible[y][x] : true;

        if (!explored) continue; // 未探索则不绘制

        if (visible) this.minimapGraphics.fillStyle(0x6b88ff, 1); // 可见：亮蓝色（走廊/房间）
        else this.minimapGraphics.fillStyle(0x2b2b3b, 1); // 已探索但不可见：暗色

        this.minimapGraphics.fillRect(
          offsetX + x * scale,
          offsetY + y * scale,
          Math.max(1, scale),
          Math.max(1, scale)
        );
      }
    }
    
    // 绘制出口（遵循迷雾：仅在已探索时显示，可见时更亮）
    if (exitPoint) {
      const ex = exitPoint.x;
      const ey = exitPoint.y;
      const exploredExit = fog && fog.explored && fog.explored[ey] ? !!fog.explored[ey][ex] : true;
      const visibleExit = fog && fog.visible && fog.visible[ey] ? !!fog.visible[ey][ex] : true;
      if (exploredExit) {
        this.minimapGraphics.fillStyle(visibleExit ? 0x00ff88 : 0x007a44, 1);
        this.minimapGraphics.fillRect(
          offsetX + ex * scale - 2,
          offsetY + ey * scale - 2,
          4,
          4
        );
      }
    }

    // 绘制敌人（仅在当前可见时显示，迷雾遮挡敌人）
    if (enemies) {
      this.minimapGraphics.fillStyle(0xff6666, 1);
      for (const enemy of enemies) {
        try {
          const ex = enemy.tileX;
          const ey = enemy.tileY;
          const isVis = fog && fog.visible && fog.visible[ey] ? !!fog.visible[ey][ex] : true;
          if (enemy.isAlive && isVis) {
            this.minimapGraphics.fillRect(
              offsetX + ex * scale - 1,
              offsetY + ey * scale - 1,
              2,
              2
            );
          }
        } catch (e) {
          // ignore invalid enemy data
        }
      }
    }
    
    // 绘制地面物品（仅在当前可见时显示）
    if (data.items) {
      this.minimapGraphics.fillStyle(0xffdd44, 1);
      for (const it of data.items) {
        try {
          const ix = it.x;
          const iy = it.y;
          const isVis = fog && fog.visible && fog.visible[iy] ? !!fog.visible[iy][ix] : true;
          if (!isVis) continue;
          this.minimapGraphics.fillRect(
            offsetX + ix * scale - 1,
            offsetY + iy * scale - 1,
            2,
            2
          );
        } catch (e) {}
      }
    }
    
    // 绘制门（仅绘制未开的门，使用特殊颜色）
    if (data.doors) {
      this.minimapGraphics.fillStyle(0xff66cc, 1); // 粉色表示未开门
      for (const door of data.doors) {
        try {
          if (door.isOpen) continue;
          const dx = door.x, dy = door.y;
          const isVis = fog && fog.visible && fog.visible[dy] ? !!fog.visible[dy][dx] : true;
          // 仅在该门所在格可见或已探索时显示小标记
          const explored = fog && fog.explored && fog.explored[dy] ? !!fog.explored[dy][dx] : true;
          if (!explored) continue;
          // 如果不可见但已探索，画暗色；如果可见画亮色
          if (!isVis) this.minimapGraphics.fillStyle(0x8b3b5a, 1);
          else this.minimapGraphics.fillStyle(0xff66cc, 1);
          this.minimapGraphics.fillRect(
            offsetX + dx * scale - 1,
            offsetY + dy * scale - 1,
            2,
            2
          );
        } catch (e) {}
      }
    }
    
    // 绘制玩家（最后绘制，确保在最上层）
    this.minimapGraphics.fillStyle(0xffff00, 1);
    this.minimapGraphics.fillRect(
      offsetX + player.tileX * scale - 2,
      offsetY + player.tileY * scale - 2,
      4,
      4
    );

    // 更新地面物品 HUD 提示（检测玩家所在格及四周格）
    try {
      let nearby = [];
      if (data.items) {
        for (const it of data.items) {
          const dx = Math.abs(it.x - player.tileX);
          const dy = Math.abs(it.y - player.tileY);
          if (dx + dy <= 2) {
            // 附近 2 格内列为提示
            nearby.push(it);
          }
        }
      }

      if (nearby.length === 0) {
        this.groundItemText.setText('');
      } else {
        // 简短计数提示
        this.groundItemText.setText(`地上物品: ${nearby.length} 件（按移动拾取）`);
      }
    } catch (e) { /* ignore */ }
  }

  createMessageLog() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    const padding = 10;

    // 消息日志背景
    const logBg = this.add.graphics();
    logBg.fillStyle(0x000000, 0.7);
    logBg.fillRoundedRect(padding, height - 80, width - padding * 2, 70, 8);

    // 消息文字容器
    this.messageTexts = [];
    for (let i = 0; i < 3; i++) {
      const text = this.add.text(padding + 10, height - 70 + i * 20, '', {
        fontSize: '12px',
        fontFamily: 'Arial',
        color: '#cccccc'
      });
      this.messageTexts.push(text);
    }

    this.messages = [];
  }

  updateHPBar(current, max) {
    this.hpBar.clear();
    this.hpBar.fillStyle(0xe94560);
    this.hpBar.fillRect(20, 45, 180 * (current / max), 16);
  }

  updateMPBar(current, max) {
    this.mpBar.clear();
    this.mpBar.fillStyle(0x6b9fff);
    this.mpBar.fillRect(20, 68, 180 * (current / max), 16);
  }

  updateStats(stats) {
    // 更新HP
    this.updateHPBar(stats.hp, stats.maxHp);
    this.hpText.setText(`${stats.hp}/${stats.maxHp}`);

    // 更新MP
    this.updateMPBar(stats.mp, stats.maxMp);
    this.mpText.setText(`${stats.mp}/${stats.maxMp}`);

    // 更新层数
    if (stats.floor !== undefined) {
      this.floorText.setText(`迷宫 ${stats.floor}层`);
    }

    // 更新回合数
    if (stats.turn !== undefined) {
      this.turnText.setText(`回合: ${stats.turn}`);
    }
  }

  showMessage(message) {
    // 添加新消息
    this.messages.unshift(message);
    if (this.messages.length > 3) {
      this.messages.pop();
    }

    // 更新显示
    for (let i = 0; i < this.messageTexts.length; i++) {
      if (i < this.messages.length) {
        this.messageTexts[i].setText(this.messages[i]);
        this.messageTexts[i].setAlpha(1 - i * 0.3);
      } else {
        this.messageTexts[i].setText('');
      }
    }
  }

  showDamageNumber(data) {
    const { x, y, damage, isHeal } = data;

    // 把 GameScene 的世界坐标转换为 UI 场景坐标（考虑摄像机滚动）
    let screenX = x;
    let screenY = y;
    const gameScene = this.scene.get('GameScene');
    if (gameScene && gameScene.cameras && gameScene.cameras.main) {
      const cam = gameScene.cameras.main;
      screenX = x - cam.worldView.x;
      screenY = y - cam.worldView.y;
    }

    const color = isHeal ? '#00ff00' : '#ff0000';
    const prefix = isHeal ? '+' : '-';

    if (!this._damageTexts) this._damageTexts = [];

    const damageText = this.add.text(screenX, screenY, `${prefix}${damage}`, {
      fontSize: '16px',
      fontFamily: 'Arial',
      color: color,
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5);

    this._damageTexts.push(damageText);

    // 让数字先轻微上弹然后缓慢消失（更舒适的节奏）
    const tween = this.tweens.add({
      targets: damageText,
      y: screenY - 40,
      alpha: 0,
      duration: 1400,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        try {
          const idx = this._damageTexts.indexOf(damageText);
          if (idx !== -1) this._damageTexts.splice(idx, 1);
        } catch (e) {}
        try { damageText.destroy(); } catch (e) {}
      }
    });

    // 保险回退：若 tween 被中断或未执行，在稍后确保销毁
    this.time.delayedCall(1600, () => {
      try {
        if (damageText && damageText.active) {
          try {
            const idx = this._damageTexts.indexOf(damageText);
            if (idx !== -1) this._damageTexts.splice(idx, 1);
          } catch (e) {}
          damageText.destroy();
        }
      } catch (e) {}
    });
  }
}
