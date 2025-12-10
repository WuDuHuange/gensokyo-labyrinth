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

    // 符卡1 - 明珠暗投（反弹）
    this.add.text(width - 200, padding + 8, '[Z] 明珠暗投', {
      fontSize: '11px',
      fontFamily: 'Arial',
      color: '#ffff6b'
    });
    this.spell1CostText = this.add.text(width - 200, padding + 22, 'MP:30 反弹', {
      fontSize: '9px',
      fontFamily: 'Arial',
      color: '#aaaaaa'
    });

    // 符卡2 - 封魔阵（结界）
    this.add.text(width - 200, padding + 38, '[X] 封魔阵', {
      fontSize: '11px',
      fontFamily: 'Arial',
      color: '#ff6b6b'
    });
    this.spell2CostText = this.add.text(width - 200, padding + 52, 'MP:25 结界', {
      fontSize: '9px',
      fontFamily: 'Arial',
      color: '#aaaaaa'
    });

    // 符卡3 - 梦想妙珠（追踪）
    this.add.text(width - 200, padding + 68, '[C] 梦想妙珠', {
      fontSize: '11px',
      fontFamily: 'Arial',
      color: '#6bffff'
    });
    this.spell3CostText = this.add.text(width - 200, padding + 82, 'MP:35 追踪', {
      fontSize: '9px',
      fontFamily: 'Arial',
      color: '#aaaaaa'
    });
  }

  createMinimap() {
    const width = this.cameras.main.width;
    const minimapSize = 150;
    const padding = 10;
    
    // 小地图位置
    this.minimapX = width - minimapSize - padding;
    this.minimapY = 115;
    this.minimapSize = minimapSize;

    // 小地图背景
    const minimapBg = this.add.graphics();
    minimapBg.fillStyle(0x000000, 0.8);
    minimapBg.fillRoundedRect(this.minimapX, this.minimapY - 15, minimapSize, minimapSize + 15, 8);
    
    // 标题
    this.add.text(this.minimapX + minimapSize / 2, this.minimapY - 10, '小地图 [TAB查看]', {
      fontSize: '9px',
      fontFamily: 'Arial',
      color: '#888888'
    }).setOrigin(0.5, 0);

    // 小地图绘制图形
    this.minimapGraphics = this.add.graphics();
    
    // 获取游戏场景引用
    const gameScene = this.scene.get('GameScene');
    
    // 监听小地图更新事件
    gameScene.events.on('updateMinimap', (data) => {
      this.drawMinimap(data);
    });
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
    
    // 绘制玩家（最后绘制，确保在最上层）
    this.minimapGraphics.fillStyle(0xffff00, 1);
    this.minimapGraphics.fillRect(
      offsetX + player.tileX * scale - 2,
      offsetY + player.tileY * scale - 2,
      4,
      4
    );
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
