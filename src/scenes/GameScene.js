/**
 * 主游戏场景
 * 
 * Superhot 重构：时间流逝系统 + 向量弹幕 + 擦弹机制
 */
import { TILE_SIZE, MAP_CONFIG, COLORS } from '../config/gameConfig.js';
import MapGenerator, { TileType } from '../systems/MapGenerator.js';
import ActionQueue from '../systems/ActionQueue.js';
import SpellCardSystem from '../systems/SpellCardSystem.js';
import FogOfWar from '../systems/FogOfWar.js';
import TalentSystem from '../systems/TalentSystem.js';
import EquipmentSystem from '../systems/EquipmentSystem.js';
import SpellUpgradeSystem from '../systems/SpellUpgradeSystem.js';
import ShrineDonateSystem from '../systems/ShrineDonateSystem.js';
import AudioManager from '../systems/AudioManager.js';
// Superhot 系统
import TimeScaleManager, { TimeState } from '../systems/TimeScaleManager.js';
import BulletManager from '../systems/BulletManager.js';
import GrazeSystem from '../systems/GrazeSystem.js';
import LastGaspSystem from '../systems/LastGaspSystem.js';
import ScreenEffects from '../effects/ScreenEffects.js';
import AudioEffects from '../effects/AudioEffects.js';

import Player from '../entities/Player.js';
import SlowFairy from '../entities/enemies/SlowFairy.js';
import NormalFairy from '../entities/enemies/NormalFairy.js';
import FastFairy from '../entities/enemies/FastFairy.js';
import DanmakuFairy from '../entities/enemies/DanmakuFairy.js';
import DemoBoss from '../entities/enemies/DemoBoss.js';
import ShieldFairy from '../entities/enemies/ShieldFairy.js';
import SummonerFairy from '../entities/enemies/SummonerFairy.js';
import Obstacle from '../entities/Obstacle.js';
import { SpikeTrap, TeleportTrap } from '../entities/Trap.js';
import ItemSystem from '../systems/ItemSystem.js';
import Door from '../entities/Door.js';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
    
    this.player = null;
    this.enemies = [];
    this.mapManager = null;
    this.mapData = null;
    this.actionQueue = null;
    this.spellCardSystem = null;
    
    this.isPlayerTurn = true;
    this.isProcessingTurn = false;
    this.floor = 1;
    
    // 地图图层
    this.floorLayer = null;
    this.wallLayer = null;
    
    // 结界系统
    this.barriers = [];
    
    // ========== Superhot 系统 ==========
    this.timeManager = null;      // 时间缩放管理器
    this.bulletManager = null;    // 向量弹幕管理器
    this.grazeSystem = null;      // 擦弹系统
    this.lastGaspSystem = null;   // 决死时刻系统
    this.screenEffects = null;    // 屏幕效果
    this.audioEffects = null;     // 音频效果
    // ===================================
    
    // 视角模式（不消耗行动）
    this.isFreeLookMode = false;
    this.freeLookTarget = { x: 0, y: 0 };
    // 连续行走按键保持状态
    this.heldMove = null; // {x, y} or null
    // 转向提示箭头
    this.aimArrow = null; // Phaser.GameObjects.Triangle
    // 场景内的门集合
    this.doors = [];
    // Boss 房相关
    this.bossRoom = null;
    this.bossEntity = null;
    this.bossRoomLocked = false; // 进入 boss 房后启用，阻止离开
    this.exitActive = true; // 默认 true（若存在 boss 房则会在生成时设为 false）
    this.exitSprite = null;
    
    // 战斗房系统
    this.currentCombatRoom = null; // 当前锁定的战斗房
    this.combatRoomLocked = false; // 是否在战斗房锁定状态
    this._combatBarrierGraphic = null;
    
    // 障碍物和陷阱
    this.obstacles = [];
    this.traps = [];
    
    // 天赋系统
    this.talentSystem = null;
    
    // 装备系统
    this.equipmentSystem = null;
    
    // 符卡升级系统
    this.spellUpgradeSystem = null;
    
    // 神社捐赠系统
    this.shrineDonateSystem = null;
    
    // 神社位置
    this.shrines = [];
    // 神社回程
    this.lastShrinePos = null;
    this.shrineReturnUsed = false; // 每层一次
    
    // 游戏是否已结束（防止重复调用gameOver/victory）
    this.isGameEnded = false;
  }

  createAimArrow() {
    if (this.aimArrow && this.aimArrow.scene) return; // already exists
    // upward-pointing triangle centered at (0,0)
    const size = 8; // 更小的尺寸
    // points: left-bottom, top, right-bottom (relative to origin)
    this.aimArrow = this.add.triangle(0, 0, -size, size, 0, -size, size, size, 0x00ffcc);
    this.aimArrow.setOrigin(0.5, 0.5); // 确保以中心为锚点，修正错位
    this.aimArrow.setDepth(20);
    this.aimArrow.setAlpha(0.95);
    this.aimArrow.setScale(1);

    // 添加轻微脉冲动画（缩放）以提高提示感
    // 存储 tween 引用以便在销毁时清理
    try {
      this.aimArrowPulseTween = this.tweens.add({
        targets: this.aimArrow,
        scale: { from: 1, to: 1.16 },
        duration: 600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    } catch (e) {
      // 在极少数环境下 tweens 可能抛错，忽略以保证不阻塞主流程
      this.aimArrowPulseTween = null;
    }
  }

  updateAimArrow(dx, dy) {
    if (!this.player || (!dx && !dy)) { this.destroyAimArrow(); return; }
    this.createAimArrow();

    // 动态计算偏移：考虑玩家与箭头的实际像素尺寸，确保箭头不会覆盖角色
    const playerHalf = Math.max(this.player.sprite.displayWidth || 0, this.player.sprite.displayHeight || 0) / 2 || (TILE_SIZE / 2);
    // aimArrow 可能刚创建，displayWidth/Height 在大多数情况下可用；回退使用默认 size
    const arrowHalf = Math.max(this.aimArrow.displayWidth || 0, this.aimArrow.displayHeight || 0) / 2 || 8;
    const padding = 4; // 角色与箭头之间额外间距
    const offset = Math.ceil(playerHalf + arrowHalf + padding);

    const px = this.player.sprite.x + dx * offset;
    const py = this.player.sprite.y + dy * offset;

    this.aimArrow.setPosition(px, py);

    // rotation: triangle initially points up (0,-1), compute angle to (dx,dy)
    const angle = Math.atan2(dy, dx) + Math.PI / 2;
    this.aimArrow.setRotation(angle);
  }

  destroyAimArrow() {
    if (this.aimArrow) {
      // 清理 tween
      try {
        if (this.aimArrowPulseTween) {
          this.aimArrowPulseTween.stop();
          this.aimArrowPulseTween = null;
        }
        // 保险起见，移除 scene 中与该对象关联的任何 tween
        this.tweens.killTweensOf(this.aimArrow);
      } catch (e) { /* ignore */ }

      try { this.aimArrow.destroy(); } catch (e) { /* ignore */ }
      this.aimArrow = null;
    }
  }

  create() {
    AudioManager.init(this);

    // ========== 初始化 Superhot 系统 ==========
    // 时间缩放管理器
    this.timeManager = new TimeScaleManager(this);
    this.timeManager.init();
    
    // 向量弹幕管理器
    this.bulletManager = new BulletManager(this);
    this.bulletManager.init();
    this.bulletManager.setTimeManager(this.timeManager);
    
    // 屏幕效果
    this.screenEffects = new ScreenEffects(this);
    this.screenEffects.init();
    
    // 音频效果
    this.audioEffects = new AudioEffects(this);
    this.audioEffects.init();
    // ==========================================

    // 初始化系统
    this.actionQueue = new ActionQueue();
    this.spellCardSystem = new SpellCardSystem(this);
    this.spellCardSystem.initialize();

    // 游戏内默认 BGM（道中）
    AudioManager.play('music_game', { volume: 0.5, loop: true, fade: 800 });
    
    // 生成地图
    this.generateMap();
    // 重置神社回程状态
    this.lastShrinePos = null;
    this.shrineReturnUsed = false;
    // 若存在 boss 房，则在击败 boss 之前关闭出口
    try {
      const hasBoss = this.mapData && this.mapData.rooms && this.mapData.rooms.some(r => r.type === 'boss');
      if (hasBoss) this.exitActive = false; else this.exitActive = true;
    } catch (e) { this.exitActive = true; }
    
    // 创建玩家
    this.createPlayer();
    
    // ========== 初始化擦弹和决死系统（需要玩家实例） ==========
    this.grazeSystem = new GrazeSystem(this);
    this.grazeSystem.init(this.player, this.bulletManager);
    
    this.lastGaspSystem = new LastGaspSystem(this);
    this.lastGaspSystem.init(this.player, this.timeManager, this.bulletManager);
    // =========================================================
    
    // 初始化天赋系统
    this.talentSystem = new TalentSystem(this, this.player);
    this.player.talentSystem = this.talentSystem;
    
    // 初始化装备系统
    this.equipmentSystem = new EquipmentSystem(this, this.player);
    this.player.equipmentSystem = this.equipmentSystem;
    
    // 初始化符卡升级系统
    this.spellUpgradeSystem = new SpellUpgradeSystem(this, this.player, this.spellCardSystem);
    this.player.spellUpgradeSystem = this.spellUpgradeSystem;
    
    // 初始化神社捐赠系统
    this.shrineDonateSystem = new ShrineDonateSystem(this, this.player);

    // 初始化道具系统（用于放置与拾取道具）
    this.itemSystem = new ItemSystem(this);
    // 在玩家附近放一个测试用的小瓶回复药
    try {
      const sx = this.player.tileX + 2;
      const sy = this.player.tileY;
      if (this.mapManager.isWalkable(sx, sy)) this.itemSystem.spawnItem(sx, sy, 'potion_small');
    } catch (e) {}

    // 初始化战争迷雾系统
    this.fog = new FogOfWar(this.mapData.width, this.mapData.height);
    // 可视半径（以格为单位），可根据玩家装备/技能动态调整
    this.fog.setVisionRadius(6);
    // 计算初始可见性（注意门会阻挡视线）
    this.fog.setBlockers(this.getVisionBlockers());
    this.fog.compute(this.mapData.tiles, this.player.tileX, this.player.tileY);
    // 将迷雾可视效果应用到主视图
    this.updateFogVisuals();
    
    // 生成敌人
    this.spawnEnemies();
    // 在各房间生成资源 / 宝箱
    try { this.spawnResources(); } catch (e) { /* ignore */ }
    // 生成障碍物和陷阱
    try { this.spawnObstaclesAndTraps(); } catch (e) { /* ignore */ }
    // 生成神社
    try { this.spawnShrines(); } catch (e) { /* ignore */ }
    
    // 设置摄像机
    this.setupCamera();
    
    // 设置输入
    this.setupInput();
    
    // 启动UI场景
    this.scene.launch('UIScene');
    
    // 淡入效果
    this.cameras.main.fadeIn(500);
    
    // 发送初始消息
    this.events.emit('showMessage', '欢迎来到幻想迷宫！找到幻想之门逃离这里！');
    
    // 更新UI
    this.updateUI();
  }

  /**
   * 在地图房间中放置资源或宝箱
   */
  spawnResources() {
    if (!this.mapData || !this.mapData.rooms || !this.itemSystem) return;
    for (const room of this.mapData.rooms) {
      if (!room || room.type === 'spawn' || room.type === 'exit') continue;

      // Boss 房处理
      if (room.type === 'boss') {
        try {
          // 标记并生成 Boss
          this.bossRoom = room;
          const bx = room.centerX;
          const by = room.centerY;
          const boss = new DemoBoss(this, bx, by);
          boss.room = room;
          boss.sprite.setDepth(12);
          this.enemies.push(boss);
          if (this.actionQueue) this.actionQueue.addEntity(boss);
          this.bossEntity = boss;

          // 在该房间所有入口放置门并锁定（在击败 boss 前无法打开）
          const doorPositions = this.findRoomEntrances(room);
          if (doorPositions && doorPositions.length) {
            for (const dp of doorPositions) {
              try {
                const d = new Door(this, dp.x, dp.y, 30);
                // Boss 门初始为打开状态，允许玩家进入；在玩家进入时会被 close() 并 locked
                try { d.open(); } catch (e) {}
                d.locked = false;
                this.doors.push(d);
              } catch (e) {}
            }
          }
        } catch (e) {}
        continue;
      }

      // 资源房（特殊房）放置较多资源并在入口放置一扇门
      if (room.type === 'resource') {
        // 在房间内部大量放置资源（随机 3~6 个）
        const rcount = this.mapManager.randomRange(3, 6);
        for (let i = 0; i < rcount; i++) {
          const rx = this.mapManager.randomRange(room.x + 1, room.x + room.width - 2);
          const ry = this.mapManager.randomRange(room.y + 1, room.y + room.height - 2);
          if (!this.mapManager.isWalkable(rx, ry)) continue;
          if (this.player && this.player.tileX === rx && this.player.tileY === ry) continue;
          if (this.enemies.some(e => e.tileX === rx && e.tileY === ry)) continue;
          const id = (Math.random() < 0.7) ? 'herb' : 'gold_coin';
          try { this.itemSystem.spawnItem(rx, ry, id); } catch (e) {}
        }

        // 在该房间的所有入口处放置门（若找到合适位置）
        const doorPositions = this.findRoomEntrances(room);
        if (doorPositions && doorPositions.length) {
          for (const dp of doorPositions) {
            try { const d = new Door(this, dp.x, dp.y, 18); this.doors.push(d); } catch (e) {}
          }
        }

        continue;
      }

      // 普通房间按照旧逻辑少量生成资源/箱子
      const roll = Math.random();
      if (roll < 0.35) continue; // 35% 概率空房

      const count = Math.random() < 0.6 ? 1 : 2;
      for (let i = 0; i < count; i++) {
        const rx = this.mapManager.randomRange(room.x + 1, room.x + room.width - 2);
        const ry = this.mapManager.randomRange(room.y + 1, room.y + room.height - 2);

        // 保证可通行且不在玩家/敌人位置
        if (!this.mapManager.isWalkable(rx, ry)) continue;
        if (this.player && this.player.tileX === rx && this.player.tileY === ry) continue;
        if (this.enemies.some(e => e.tileX === rx && e.tileY === ry)) continue;

        // 20% 宝箱，80% 资源
        if (Math.random() < 0.2) {
          try { this.itemSystem.spawnContainer(rx, ry, 'chest_wood'); } catch (e) {}
        } else {
          // 资源类型随机：草药或金币
          const r = Math.random();
          const id = (r < 0.6) ? 'herb' : 'gold_coin';
          try { this.itemSystem.spawnItem(rx, ry, id); } catch (e) {}
        }
      }
    }
  }

  /**
   * 生成障碍物和陷阱
   */
  spawnObstaclesAndTraps() {
    this.obstacles = [];
    this.traps = [];
    
    if (!this.mapData || !this.mapData.rooms) return;
    
    for (const room of this.mapData.rooms) {
      // 出生点和 boss 房不放陷阱
      if (room.type === 'spawn' || room.type === 'boss') continue;
      
      // 普通房间：随机放置1-2个障碍物
      const obstacleCount = Math.random() < 0.4 ? 0 : (Math.random() < 0.6 ? 1 : 2);
      for (let i = 0; i < obstacleCount; i++) {
        const pos = this.findEmptyPositionInRoom(room);
        if (pos) {
          const obstacle = new Obstacle(this, pos.x, pos.y);
          this.obstacles.push(obstacle);
        }
      }
      
      // 危险房间和战斗房间放置更多陷阱
      let trapCount = 0;
      if (room.type === 'danger') {
        trapCount = this.mapManager.randomRange(2, 4);
      } else if (room.type === 'combat') {
        trapCount = this.mapManager.randomRange(1, 2);
      } else {
        trapCount = Math.random() < 0.3 ? 1 : 0;
      }
      
      for (let i = 0; i < trapCount; i++) {
        const pos = this.findEmptyPositionInRoom(room);
        if (pos) {
          // 80% 地刺，20% 传送阵
          if (Math.random() < 0.8) {
            const spike = new SpikeTrap(this, pos.x, pos.y);
            this.traps.push(spike);
          } else {
            const portal = new TeleportTrap(this, pos.x, pos.y);
            this.traps.push(portal);
          }
        }
      }
    }
    
    // 在走廊中随机放置少量陷阱
    const corridorTraps = this.mapManager.randomRange(1, 3);
    for (let i = 0; i < corridorTraps; i++) {
      const pos = this.findEmptyCorridorPosition();
      if (pos) {
        const spike = new SpikeTrap(this, pos.x, pos.y);
        this.traps.push(spike);
      }
    }
  }
  
  /**
   * 在房间内找一个空位置
   */
  findEmptyPositionInRoom(room) {
    for (let attempt = 0; attempt < 20; attempt++) {
      const x = this.mapManager.randomRange(room.x + 1, room.x + room.width - 2);
      const y = this.mapManager.randomRange(room.y + 1, room.y + room.height - 2);
      
      if (!this.mapManager.isWalkable(x, y)) continue;
      if (this.player && this.player.tileX === x && this.player.tileY === y) continue;
      if (this.enemies.some(e => e.tileX === x && e.tileY === y)) continue;
      if (this.obstacles.some(o => o.tileX === x && o.tileY === y)) continue;
      if (this.traps.some(t => t.tileX === x && t.tileY === y)) continue;
      if (this.doors.some(d => d.tileX === x && d.tileY === y)) continue;
      // 不要放在道具上
      if (this.itemSystem && this.itemSystem.items.some(it => it.x === x && it.y === y)) continue;
      
      return { x, y };
    }
    return null;
  }
  
  /**
   * 生成神社
   */
  spawnShrines() {
    this.shrines = [];
    
    if (!this.mapData || !this.mapData.rooms) return;
    
    // 在资源房放置神社
    const resourceRooms = this.mapData.rooms.filter(r => r.type === 'resource');
    
    for (const room of resourceRooms) {
      // 在房间中心附近放置神社
      const centerX = Math.floor(room.x + room.width / 2);
      const centerY = Math.floor(room.y + room.height / 2);
      
      // 确保位置可通行
      if (!this.mapManager.isWalkable(centerX, centerY)) continue;
      
      // 创建神社精灵
      const shrine = {
        tileX: centerX,
        tileY: centerY,
        sprite: this.add.sprite(
          centerX * TILE_SIZE + TILE_SIZE / 2,
          centerY * TILE_SIZE + TILE_SIZE / 2,
          'shrine'
        ),
        usesLeft: 2,
        used: false // 兼容旧逻辑，usesLeft 为 0 时设为 true
      };
      shrine.sprite.setDepth(7);
      
      this.shrines.push(shrine);
    }
    
    // 如果没有资源房，在地图中随机放置一个神社
    if (this.shrines.length === 0) {
      const normalRooms = this.mapData.rooms.filter(r => r.type === 'normal');
      if (normalRooms.length > 0) {
        const room = normalRooms[Math.floor(Math.random() * normalRooms.length)];
        const pos = this.findEmptyPositionInRoom(room);
        if (pos) {
          const shrine = {
            tileX: pos.x,
            tileY: pos.y,
            sprite: this.add.sprite(
              pos.x * TILE_SIZE + TILE_SIZE / 2,
              pos.y * TILE_SIZE + TILE_SIZE / 2,
              'shrine'
            ),
            usesLeft: 2,
            used: false
          };
          shrine.sprite.setDepth(7);
          this.shrines.push(shrine);
        }
      }
    }
  }
  
  /**
   * 获取指定位置的神社
   */
  getShrineAt(x, y) {
    return this.shrines.find(s => s.tileX === x && s.tileY === y && (!s.used) && (s.usesLeft === undefined || s.usesLeft > 0));
  }
  
  /**
   * 与神社交互
   */
  interactWithShrine(shrine) {
    if (!shrine || shrine.used || (shrine.usesLeft !== undefined && shrine.usesLeft <= 0)) {
      this.events.emit('showMessage', '这座神社已经没有神力了...');
      return;
    }

    // 记录最近可返回的神社位置
    this.lastShrinePos = { x: shrine.tileX, y: shrine.tileY };
    
    // 显示捐赠菜单
    this.showShrineDonateMenu(shrine);
  }
  
  /**
   * 显示神社捐赠菜单
   */
  showShrineDonateMenu(shrine) {
    // 标记神社菜单正在显示，避免ESC冲突
    this._shrineMenuActive = true;
    
    const options = this.shrineDonateSystem.getDonationOptions();
    const gold = this.spellUpgradeSystem?.gold || 0;
    
    // 创建简易菜单
    const menuWidth = 280;
    const menuHeight = 200;
    const menuX = this.cameras.main.width / 2 - menuWidth / 2;
    const menuY = this.cameras.main.height / 2 - menuHeight / 2;
    
    // 背景
    const menuBg = this.add.graphics();
    menuBg.fillStyle(0x222233, 0.95);
    menuBg.fillRoundedRect(menuX, menuY, menuWidth, menuHeight, 10);
    menuBg.lineStyle(2, 0xff6b6b);
    menuBg.strokeRoundedRect(menuX, menuY, menuWidth, menuHeight, 10);
    menuBg.setScrollFactor(0);
    menuBg.setDepth(1000);
    
    // 标题
    const title = this.add.text(menuX + menuWidth / 2, menuY + 20, '博丽神社', {
      fontSize: '18px',
      fontFamily: 'Arial',
      color: '#ff6b6b'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1001);
    
    const goldText = this.add.text(menuX + menuWidth / 2, menuY + 45, `持有金币: ${gold}`, {
      fontSize: '14px',
      fontFamily: 'Arial',
      color: '#ffd700'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1001);
    
    // 创建选项
    const optionTexts = [];
    options.forEach((opt, idx) => {
      const optY = menuY + 75 + idx * 25;
      const color = opt.canAfford ? '#ffffff' : '#666666';
      const text = this.add.text(menuX + 20, optY, `${idx + 1}. ${opt.name}捐赠 (${opt.amount}金币)`, {
        fontSize: '14px',
        fontFamily: 'Arial',
        color: color
      }).setScrollFactor(0).setDepth(1001);
      optionTexts.push(text);
    });
    
    const usageText = this.add.text(menuX + 20, menuY + menuHeight - 50, `剩余次数: ${shrine.usesLeft ?? 1}`, {
      fontSize: '14px',
      fontFamily: 'Arial',
      color: '#88ff88'
    }).setScrollFactor(0).setDepth(1001);

    const cancelText = this.add.text(menuX + 20, menuY + menuHeight - 30, 'X. 离开', {
      fontSize: '14px',
      fontFamily: 'Arial',
      color: '#aaaaaa'
    }).setScrollFactor(0).setDepth(1001);
    
    // 处理输入
    const self = this;
    const cleanup = () => {
      self._shrineMenuActive = false; // 清除神社菜单标记
      menuBg.destroy();
      title.destroy();
      goldText.destroy();
      optionTexts.forEach(t => t.destroy());
      usageText.destroy();
      cancelText.destroy();
      self.input.keyboard.off('keydown', handleKey);
    };
    
    const handleKey = (event) => {
      const key = event.key.toLowerCase();
      
      // 使用X键关闭而不是ESC，避免与游戏菜单冲突
      if (key === 'x' || key === 'escape') {
        cleanup();
        return;
      }
      
      const idx = parseInt(key) - 1;
      if (idx >= 0 && idx < options.length) {
        if (options[idx].canAfford) {
          cleanup();
          const result = this.shrineDonateSystem.donate(idx);
          if (result.success) {
            if (shrine.usesLeft !== undefined) {
              shrine.usesLeft -= 1;
              if (shrine.usesLeft <= 0) {
                shrine.used = true;
                shrine.sprite.setTint(0x666666);
              } else {
                // 显示剩余次数提示
                this.events.emit('showMessage', `神社还可使用 ${shrine.usesLeft} 次`);
              }
            } else {
              shrine.used = true;
              shrine.sprite.setTint(0x666666);
            }
          }
          this.updateUI();
        } else {
          this.events.emit('showMessage', '金币不足！');
        }
      }
    };
    
    this.input.keyboard.on('keydown', handleKey);
  }

  /**
   * 在走廊中找一个空位置
   */
  findEmptyCorridorPosition() {
    for (let attempt = 0; attempt < 50; attempt++) {
      const x = this.mapManager.randomRange(1, this.mapData.width - 2);
      const y = this.mapManager.randomRange(1, this.mapData.height - 2);
      
      if (!this.mapManager.isWalkable(x, y)) continue;
      
      // 确保不在房间内
      const inRoom = this.mapData.rooms.some(r => 
        x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height
      );
      if (inRoom) continue;
      
      if (this.player && this.player.tileX === x && this.player.tileY === y) continue;
      if (this.obstacles.some(o => o.tileX === x && o.tileY === y)) continue;
      if (this.traps.some(t => t.tileX === x && t.tileY === y)) continue;
      
      return { x, y };
    }
    return null;
  }

  // 查找房间所有入口（返回房间内侧可放门的格子列表）
  findRoomEntrances(room) {
    const entrances = [];
    try {
      if (!room) return entrances;
      // 遍历房间边界上的格子，若该格可通行且其外侧邻格可通行则视为入口
      const minX = room.x;
      const maxX = room.x + room.width - 1;
      const minY = room.y;
      const maxY = room.y + room.height - 1;

      const checkAndAdd = (x, y, ox, oy) => {
        try {
          // 当前格为房间内侧格，外侧格为房间外侧通路
          if (!this.mapManager.isWalkable(x, y)) return;
          const outsideX = x + ox;
          const outsideY = y + oy;
          if (!this.mapManager.isWalkable(outsideX, outsideY)) return;
          // 确保 outside tile 不在同一房间内部
          if (outsideX >= room.x && outsideX < room.x + room.width && outsideY >= room.y && outsideY < room.y + room.height) return;
          // 避免重复添加（我们将门放在外侧格）
          if (!entrances.some(p => p.x === outsideX && p.y === outsideY)) entrances.push({ x: outsideX, y: outsideY });
        } catch (e) {}
      };

      // top edge (check outward -1 in y)
      for (let x = minX; x <= maxX; x++) checkAndAdd(x, minY, 0, -1);
      // bottom edge (outward +1 in y)
      for (let x = minX; x <= maxX; x++) checkAndAdd(x, maxY, 0, 1);
      // left edge (outward -1 in x)
      for (let y = minY; y <= maxY; y++) checkAndAdd(minX, y, -1, 0);
      // right edge (outward +1 in x)
      for (let y = minY; y <= maxY; y++) checkAndAdd(maxX, y, 1, 0);
    } catch (e) {}
    return entrances;
  }

  /**
   * 生成地图
   */
  generateMap() {
    this.mapManager = new MapGenerator(MAP_CONFIG.width, MAP_CONFIG.height);
    this.mapData = this.mapManager.generate();
    
    // 创建地图图层容器
    this.floorLayer = this.add.container(0, 0);
    this.wallLayer = this.add.container(0, 0);
    
    // 渲染地图
    this.renderMap();
  }

  /**
   * 渲染地图
   */
  renderMap() {
    const { tiles, width, height } = this.mapData;

    // 保存瓦片 sprite 引用，便于迷雾时调整可见性
    this.tileSprites = [];
    for (let y = 0; y < height; y++) {
      this.tileSprites[y] = new Array(width);
      for (let x = 0; x < width; x++) {
        const tileType = tiles[y][x];
        const posX = x * TILE_SIZE;
        const posY = y * TILE_SIZE;
        let spr = null;

        if (tileType === TileType.WALL) {
          spr = this.add.sprite(posX + TILE_SIZE / 2, posY + TILE_SIZE / 2, 'wall');
          this.wallLayer.add(spr);
        } else {
          // 地板（包括出口/出生点）
          spr = this.add.sprite(posX + TILE_SIZE / 2, posY + TILE_SIZE / 2, 'floor');
          this.floorLayer.add(spr);

          // 出口
          if (tileType === TileType.EXIT) {
            const exit = this.add.sprite(posX + TILE_SIZE / 2, posY + TILE_SIZE / 2, 'exit');
            exit.setDepth(1);
            this.floorLayer.add(exit);
            this.exitSprite = exit;
            // 出口默认闪烁，颜色由 exitActive 控制
            this.updateExitVisual();
            this.tweens.add({
              targets: exit,
              alpha: 0.6,
              duration: 800,
              yoyo: true,
              repeat: -1
            });
          }
        }

        if (spr) {
          spr.setOrigin(0.5, 0.5);
          this.tileSprites[y][x] = { sprite: spr, type: tileType };
        } else {
          this.tileSprites[y][x] = null;
        }
      }
    }

    // 设置深度
    this.floorLayer.setDepth(0);
    this.wallLayer.setDepth(1);
  }

  /**
   * 根据 fog 可见性调整主视图瓦片与实体的显隐/alpha
   */
  updateFogVisuals() {
    if (!this.fog || !this.tileSprites) return;
    const visible = this.fog.getVisible();
    const explored = this.fog.getExplored();
    const h = this.tileSprites.length;
    const w = this.tileSprites[0] ? this.tileSprites[0].length : 0;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const cell = this.tileSprites[y][x];
        if (!cell || !cell.sprite) continue;

        const isVisible = visible && visible[y] ? !!visible[y][x] : false;
        const isExplored = explored && explored[y] ? !!explored[y][x] : false;

        if (isVisible) {
          cell.sprite.setAlpha(1);
          cell.sprite.setVisible(true);
        } else if (isExplored) {
          cell.sprite.setAlpha(0.22);
          cell.sprite.setVisible(true);
        } else {
          // 未探索：隐藏或极暗
          cell.sprite.setAlpha(0);
          cell.sprite.setVisible(false);
        }
      }
    }

    // 实体（敌人）在不可见格子里隐藏
    if (this.enemies) {
      for (const e of this.enemies) {
        try {
          const tx = e.tileX, ty = e.tileY;
          const isVis = visible && visible[ty] ? !!visible[ty][tx] : false;
          e.sprite.setVisible(!!isVis && e.isAlive);
        } catch (ex) { /* ignore */ }
      }
    }

    // 地面道具/宝箱：仅在可见时显示
    try {
      if (this.itemSystem && this.itemSystem.items) {
        for (const it of this.itemSystem.items) {
          try {
            const tx = it.x, ty = it.y;
            const isVis = visible && visible[ty] ? !!visible[ty][tx] : false;
            if (it.sprite) it.sprite.setVisible(!!isVis);
          } catch (ex) { /* ignore per-item errors */ }
        }
      }
    } catch (e) { /* ignore */ }

    // 门：仅在可见时显示
    try {
      if (this.doors && this.doors.length) {
        for (const d of this.doors) {
          try {
            const tx = d.tileX, ty = d.tileY;
            const isVis = visible && visible[ty] ? !!visible[ty][tx] : false;
            if (d.sprite) d.sprite.setVisible(!!isVis && !d.isOpen);
          } catch (ex) {}
        }
      }
    } catch (e) {}
    
    // 障碍物：仅在可见或已探索时显示
    try {
      if (this.obstacles && this.obstacles.length) {
        for (const o of this.obstacles) {
          try {
            const tx = o.tileX, ty = o.tileY;
            const isVis = visible && visible[ty] ? !!visible[ty][tx] : false;
            const isExp = explored && explored[ty] ? !!explored[ty][tx] : false;
            if (o.sprite) {
              o.sprite.setVisible((isVis || isExp) && o.isAlive);
              o.sprite.setAlpha(isVis ? 1 : 0.3);
            }
          } catch (ex) {}
        }
      }
    } catch (e) {}
    
    // 陷阱：仅在可见时显示
    try {
      if (this.traps && this.traps.length) {
        for (const t of this.traps) {
          try {
            const tx = t.tileX, ty = t.tileY;
            const isVis = visible && visible[ty] ? !!visible[ty][tx] : false;
            if (t.setVisible) t.setVisible(isVis);
            else if (t.sprite) t.sprite.setVisible(isVis);
          } catch (ex) {}
        }
      }
    } catch (e) {}
    
    // 神社：仅在可见或已探索时显示
    try {
      if (this.shrines && this.shrines.length) {
        for (const s of this.shrines) {
          try {
            const tx = s.tileX, ty = s.tileY;
            const isVis = visible && visible[ty] ? !!visible[ty][tx] : false;
            const isExp = explored && explored[ty] ? !!explored[ty][tx] : false;
            if (s.sprite) {
              s.sprite.setVisible(isVis || isExp);
              s.sprite.setAlpha(isVis ? 1 : 0.4);
            }
          } catch (ex) {}
        }
      }
    } catch (e) {}

    // 玩家自己始终可见
    if (this.player && this.player.sprite) {
      this.player.sprite.setVisible(true);
    }

    // ========== 迷雾中的弹幕警告（半透明红色） ==========
    // 弹幕始终可见，但在迷雾中为警告色
    if (this.bulletManager && this.bulletManager.bullets) {
      for (const bullet of this.bulletManager.bullets) {
        if (!bullet || !bullet.active || !bullet.sprite) continue;
        
        // 计算弹幕所在格子
        const bx = Math.floor(bullet.x / TILE_SIZE);
        const by = Math.floor(bullet.y / TILE_SIZE);
        
        const isVis = visible && visible[by] ? !!visible[by][bx] : false;
        const isExp = explored && explored[by] ? !!explored[by][bx] : false;
        
        if (isVis) {
          // 完全可见
          bullet.sprite.setVisible(true);
          bullet.sprite.setAlpha(1);
          bullet.sprite.clearTint();
        } else if (isExp) {
          // 已探索但不可见：半透明红色警告
          bullet.sprite.setVisible(true);
          bullet.sprite.setAlpha(0.6);
          bullet.sprite.setTint(0xff4444);
        } else {
          // 未探索：暗红色提示（给予一点提示）
          bullet.sprite.setVisible(true);
          bullet.sprite.setAlpha(0.3);
          bullet.sprite.setTint(0xff0000);
        }
      }
    }
  }

  /**
   * 创建玩家
   */
  createPlayer() {
    const { spawnPoint } = this.mapData;
    this.player = new Player(this, spawnPoint.x, spawnPoint.y);
    this.player.sprite.setDepth(10);
    this.player.setSpellCardSystem(this.spellCardSystem);
    
    // 添加到行动队列
    this.actionQueue.addEntity(this.player);
  }

  /**
   * 生成敌人
   */
  spawnEnemies() {
    this.enemies = [];
    const { enemySpawnPoints } = this.mapData;
    
    // 普通敌人类型分布
    const normalEnemyTypes = [SlowFairy, NormalFairy, FastFairy, DanmakuFairy];
    const normalWeights = [0.3, 0.3, 0.2, 0.2];
    
    // 精英敌人类型
    const eliteTypes = [ShieldFairy, SummonerFairy];
    
    for (const spawnPoint of enemySpawnPoints) {
      const room = spawnPoint.room;
      let EnemyClass;
      let enemy;
      
      // 根据房间类型选择敌人
      if (room && room.type === 'danger') {
        // 危险房间：50% 概率生成精英，敌人属性增强
        if (Math.random() < 0.5) {
          EnemyClass = eliteTypes[Math.floor(Math.random() * eliteTypes.length)];
        } else {
          EnemyClass = this.weightedRandom(normalEnemyTypes, normalWeights);
        }
        enemy = new EnemyClass(this, spawnPoint.x, spawnPoint.y);
        // 危险房间敌人强化
        enemy.hp = Math.floor(enemy.hp * 1.5);
        enemy.maxHp = enemy.hp;
        enemy.attack = Math.floor(enemy.attack * 1.3);
        enemy.sprite.setTint(0xff8888);  // 红色标记
      } else if (room && room.type === 'combat') {
        // 战斗房间：30% 概率生成精英
        if (Math.random() < 0.3) {
          EnemyClass = eliteTypes[Math.floor(Math.random() * eliteTypes.length)];
        } else {
          EnemyClass = this.weightedRandom(normalEnemyTypes, normalWeights);
        }
        enemy = new EnemyClass(this, spawnPoint.x, spawnPoint.y);
      } else {
        // 普通房间
        EnemyClass = this.weightedRandom(normalEnemyTypes, normalWeights);
        enemy = new EnemyClass(this, spawnPoint.x, spawnPoint.y);
      }
      
      // 记录敌人所属房间
      try { enemy.room = room; } catch (e) {}
      enemy.sprite.setDepth(10);
      
      this.enemies.push(enemy);
      this.actionQueue.addEntity(enemy);
    }
    
    // 统计精英数量
    const eliteCount = this.enemies.filter(e => e.isElite).length;
    const dangerRooms = this.mapData.rooms.filter(r => r.type === 'danger').length;
    const combatRooms = this.mapData.rooms.filter(r => r.type === 'combat').length;
    
    this.events.emit('showMessage', `本层有 ${this.enemies.length} 个敌人（精英: ${eliteCount}），战斗房: ${combatRooms}，危险房: ${dangerRooms}`);
  }

  /**
   * 加权随机选择
   */
  weightedRandom(items, weights) {
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    let random = Math.random() * totalWeight;
    
    for (let i = 0; i < items.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return items[i];
      }
    }
    
    return items[items.length - 1];
  }

  /**
   * 设置摄像机
   */
  setupCamera() {
    const worldWidth = MAP_CONFIG.width * TILE_SIZE;
    const worldHeight = MAP_CONFIG.height * TILE_SIZE;
    
    // 设置世界边界
    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
    
    // 跟随玩家
    this.cameras.main.startFollow(this.player.sprite, true, 1, 1); // 取消平滑插值，避免初始缓慢放大感
    this.cameras.main.setLerp(1, 1);
    this.cameras.main.roundPixels = true;
    
    // 设置缩放
    this.cameras.main.setZoom(1);
  }

  /**
   * 设置输入
   */
  setupInput() {
    // 方向键
    this.cursors = this.input.keyboard.createCursorKeys();
    
    // WASD
    this.wasd = {
      W: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D)
    };
    
    // 符卡按键
    this.spellKeys = {
      Z: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z),
      X: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X),
      C: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.C)
    };
    
    // 原地狙击键（由 Space 换为 F，避免与符卡操作冲突）
    this.snipeKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F);
    
    // 自由视角键
    this.freeLookKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TAB);
    this.returnKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    
    // 转向键（不消耗行动）
    this.turnKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
    // 菜单键（暂停）
    this.menuKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
  }

  update(time, delta) {
    // ========== Superhot 系统更新 ==========
    // 更新时间管理器（使用实际 delta）
    if (this.timeManager) {
      this.timeManager.update(delta);
    }
    
    // 更新弹幕系统（使用实际 delta，内部会应用时间缩放）
    if (this.bulletManager) {
      this.bulletManager.update(delta);
      
      // 处理玩家子弹与敌人的碰撞
      if (this.enemies && this.enemies.length > 0) {
        const hits = this.bulletManager.checkEnemyCollision(this.enemies);
        for (const { bullet, enemy } of hits) {
          const damage = enemy.takeDamage(bullet.damage || 10);
          
          // 显示伤害数字
          this.events.emit('showDamage', {
            x: enemy.sprite.x,
            y: enemy.sprite.y - 20,
            damage: damage,
            isHeal: false
          });
          
          // 击杀效果
          if (!enemy.isAlive) {
            // 仅在 Boss 或精英怪时触发击杀时间冻结/闪屏
            const isBossOrElite = enemy.isBoss || enemy.isElite;
            if (isBossOrElite && this.timeManager) {
              this.timeManager.triggerKillFreeze();
            }

            // 移除敌人（内部会处理经验、掉落等）
            this.removeEnemy(enemy);
          }
        }
      }
    }
    
    // 更新擦弹系统并检测碰撞
    if (this.grazeSystem && this.player && this.player.isAlive) {
      const result = this.grazeSystem.update(delta);
      
      // 处理弹幕命中玩家
      if (result && result.hit) {
        const bullet = result.hit;
        
        // 跳过玩家自己的子弹（双重检查）
        if (bullet.isPlayerBullet) {
          this.bulletManager.recycleBullet(bullet);
          return;
        }
        
        const bulletDamage = bullet.damage || 10;
        
        // 检查是否会导致濒死（HP将归零）
        const willDie = this.player.hp - bulletDamage <= 0;
        
        if (willDie && this.lastGaspSystem && !this.lastGaspSystem.isInvincible() && !this.lastGaspSystem.isActive) {
          // 濒死状态，尝试触发决死时刻
          const triggered = this.lastGaspSystem.trigger(bullet);
          if (!triggered) {
            // 无法触发决死（MP不足等），直接死亡
            this.player.takeDamage(bulletDamage);
            this.bulletManager.recycleBullet(bullet);
          }
          // 如果触发成功，弹幕已在 trigger 中被停用
        } else if (!this.lastGaspSystem || !this.lastGaspSystem.isInvincible()) {
          // 不是濒死，直接受伤
          this.player.takeDamage(bulletDamage);
          this.bulletManager.recycleBullet(bullet);
        }
      }
    }
    
    // 更新决死时刻系统
    if (this.lastGaspSystem) {
      this.lastGaspSystem.update(delta);
    }
    
    // 更新屏幕效果
    if (this.screenEffects) {
      this.screenEffects.update(delta);
    }

    // ========== 自由移动系统更新 ==========
    if (this.player && this.player.isAlive) {
      // 检测方向键按住状态
      const upDown = this.cursors.up.isDown || this.wasd.W.isDown;
      const downDown = this.cursors.down.isDown || this.wasd.S.isDown;
      const leftDown = this.cursors.left.isDown || this.wasd.A.isDown;
      const rightDown = this.cursors.right.isDown || this.wasd.D.isDown;

      let dx = 0, dy = 0;
      if (upDown && !downDown) dy = -1;
      else if (downDown && !upDown) dy = 1;
      if (leftDown && !rightDown) dx = -1;
      else if (rightDown && !leftDown) dx = 1;

      // 如果有方向输入，开始/更新自由移动
      if (dx !== 0 || dy !== 0) {
        this.player.startFreeMove(dx, dy);
      } else {
        // 松开所有方向键，停止移动
        this.player.stopFreeMove();
      }

      // 更新自由移动（每帧）
      this.player.updateFreeMove(delta);
    }

    // 基于时间缩放的自动射击节奏
    const scaledDelta = this.timeManager ? this.timeManager.getScaledDelta(delta) : delta;
    if (this.player && this.player.isAlive && this.timeManager) {
      const state = this.timeManager.state;
      const canShoot = state === TimeState.ACTION || state === TimeState.SNIPE;
      if (canShoot) {
        this.player.updateFireTimer(scaledDelta, state === TimeState.SNIPE);
      }
    }
    // ==========================================
    
    if (!this.player || !this.player.isAlive) return;
    
    // 决死时刻中只允许符卡输入
    if (this.lastGaspSystem && this.lastGaspSystem.isInLastGasp()) {
      // 检测符卡键
      if (Phaser.Input.Keyboard.JustDown(this.spellKeys.Z) ||
          Phaser.Input.Keyboard.JustDown(this.spellKeys.X) ||
          Phaser.Input.Keyboard.JustDown(this.spellKeys.C)) {
        this.lastGaspSystem.tryDodge();
      }
      return;
    }
    
    // 处理自由视角模式
    if (this.handleFreeLookMode()) return;
    
    // 如果正在显示神社菜单，不处理菜单键
    if (this._shrineMenuActive) return;

    // 菜单开关（Esc）
    if (Phaser.Input.Keyboard.JustDown(this.menuKey)) {
      // 暂停当前场景并打开游戏内菜单（InGameMenu）
      this.scene.launch('InGameMenu');
      this.scene.pause();
      return;
    }

    // 快速回神社（每层一次）
    if (Phaser.Input.Keyboard.JustDown(this.returnKey)) {
      if (this.tryReturnToShrine()) return;
    }
    
    // 如果按住 Q（转向模式），在主角身边显示指向箭头
    if (this.turnKey && this.turnKey.isDown && this.player) {
      // 优先使用按键输入方向，否则使用玩家当前朝向
      const upDown = this.cursors.up.isDown || this.wasd.W.isDown;
      const downDown = this.cursors.down.isDown || this.wasd.S.isDown;
      const leftDown = this.cursors.left.isDown || this.wasd.A.isDown;
      const rightDown = this.cursors.right.isDown || this.wasd.D.isDown;

      let dx = 0, dy = 0;
      if (upDown && !downDown) dy = -1;
      else if (downDown && !upDown) dy = 1;
      if (leftDown && !rightDown) dx = -1;
      else if (rightDown && !leftDown) dx = 1;

      if (dx === 0 && dy === 0) {
        dx = this.player.facing.x;
        dy = this.player.facing.y;
      }

      this.updateAimArrow(dx, dy);
    } else {
      this.destroyAimArrow();
    }
    
    // 处理符卡等即时输入（移动已在上面处理）
    this.handlePlayerInput();
    
    // 敌人行动（使用 actionQueue 驱动）
    const actor = this.actionQueue.tick();
    if (actor && !actor.isPlayer && actor.isAlive) {
      // 敌人回合 - 并行处理所有可行动的敌人
      const actionable = this.actionQueue.getActionableEntities().filter(e => !e.isPlayer && e.isAlive);
      if (actionable.length <= 1) {
        this.processEnemyTurn(actor);
      } else {
        this.processEnemyBatch(actionable);
      }
    }
  }

  /**
   * 处理自由视角模式（不消耗行动）
   * @returns {boolean} 是否处于自由视角模式
   */
  handleFreeLookMode() {
    // TAB键切换自由视角模式
    if (Phaser.Input.Keyboard.JustDown(this.freeLookKey)) {
      this.isFreeLookMode = !this.isFreeLookMode;
      
      if (this.isFreeLookMode) {
        // 进入自由视角模式
        this.freeLookTarget.x = this.player.tileX * TILE_SIZE + TILE_SIZE / 2;
        this.freeLookTarget.y = this.player.tileY * TILE_SIZE + TILE_SIZE / 2;
        this.cameras.main.stopFollow();
        this.events.emit('showMessage', '自由视角模式 - 方向键移动视角，TAB/R返回');
      } else {
        // 退出自由视角模式
        this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1);
        this.events.emit('showMessage', '返回正常视角');
      }
      return true;
    }
    
    // R键快速返回玩家位置
    if (Phaser.Input.Keyboard.JustDown(this.returnKey) && this.isFreeLookMode) {
      this.isFreeLookMode = false;
      this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1);
      this.events.emit('showMessage', '返回正常视角');
      return true;
    }
    
    // 自由视角模式下的移动
    if (this.isFreeLookMode) {
      const lookSpeed = 8;
      
      if (this.cursors.up.isDown || this.wasd.W.isDown) {
        this.freeLookTarget.y -= lookSpeed;
      }
      if (this.cursors.down.isDown || this.wasd.S.isDown) {
        this.freeLookTarget.y += lookSpeed;
      }
      if (this.cursors.left.isDown || this.wasd.A.isDown) {
        this.freeLookTarget.x -= lookSpeed;
      }
      if (this.cursors.right.isDown || this.wasd.D.isDown) {
        this.freeLookTarget.x += lookSpeed;
      }
      
      // 限制在地图范围内
      const worldWidth = MAP_CONFIG.width * TILE_SIZE;
      const worldHeight = MAP_CONFIG.height * TILE_SIZE;
      this.freeLookTarget.x = Phaser.Math.Clamp(this.freeLookTarget.x, 0, worldWidth);
      this.freeLookTarget.y = Phaser.Math.Clamp(this.freeLookTarget.y, 0, worldHeight);
      
      // 平滑移动摄像机
      this.cameras.main.centerOn(this.freeLookTarget.x, this.freeLookTarget.y);
      
      return true;
    }
    
    return false;
  }

  /**
   * 处理玩家输入（符卡、狙击等非移动操作）
   * 移动已改为自由移动，在 update 中直接处理
   */
  handlePlayerInput() {
    let acted = false;
    
    // 符卡输入
    if (Phaser.Input.Keyboard.JustDown(this.spellKeys.Z)) {
      if (this.player.useSpellCard(0)) acted = true;
    } else if (Phaser.Input.Keyboard.JustDown(this.spellKeys.X)) {
      if (this.player.useSpellCard(1)) acted = true;
    } else if (Phaser.Input.Keyboard.JustDown(this.spellKeys.C)) {
      if (this.player.useSpellCard(2)) acted = true;
    }
    
    // 原地狙击（F键）
    if (Phaser.Input.Keyboard.JustDown(this.snipeKey)) {
      this.player.wait();
      acted = true;
    }

    if (acted) {
      this.endPlayerTurn();
    }

    return acted;
  }

  /**
   * 处理玩家移动
   */
  async processPlayerMove(dx, dy) {
    this.isProcessingTurn = true;
    
    const moved = await this.player.move(dx, dy);
    
    if (moved) {
      // 玩家移动后更新迷雾再结束回合/更新UI
      if (this.fog) {
        this.fog.setBlockers(this.getVisionBlockers());
        this.fog.compute(this.mapData.tiles, this.player.tileX, this.player.tileY);
        // 更新主视图和小地图
        this.updateFogVisuals();
      }
      // 检查是否进入 Boss 房并触发结界锁定
      try { this.checkEnterBossRoom(); } catch (e) {}
      // 检查是否进入战斗房并触发锁定
      try { this.checkEnterCombatRoom(); } catch (e) {}
      // 检查陷阱触发
      try { this.checkTraps(this.player); } catch (e) {}
      // 若陷阱致死，立即触发失败流程
      if (!this.player.isAlive) {
        this.gameOver();
        this.isProcessingTurn = false;
        return;
      }
      // 检查神社交互
      try {
        const shrine = this.getShrineAt(this.player.tileX, this.player.tileY);
        if (shrine) {
          this.interactWithShrine(shrine);
        }
      } catch (e) {}
      // 检查是否在当前位置有可拾取道具（加入背包）
      try {
        if (this.itemSystem) this.itemSystem.tryPickupAt(this.player.tileX, this.player.tileY, this.player);
      } catch (e) { /* ignore pickup errors */ }
      this.endPlayerTurn();
    }
    
    this.isProcessingTurn = false;
  }

  // 返回用于迷雾计算的阻挡点（闭合门和障碍物的位置）
  getVisionBlockers() {
    try {
      const b = [];
      // 闭合的门阻挡视线
      if (this.doors && this.doors.length > 0) {
        for (const d of this.doors) {
          try { if (d && !d.isOpen) b.push({ x: d.tileX, y: d.tileY }); } catch (e) {}
        }
      }
      // 障碍物阻挡视线
      if (this.obstacles && this.obstacles.length > 0) {
        for (const o of this.obstacles) {
          try { if (o && o.isAlive && o.blocksVision) b.push({ x: o.tileX, y: o.tileY }); } catch (e) {}
        }
      }
      return b;
    } catch (e) { return []; }
  }

  // 玩家进入 boss 房时触发结界：锁门并阻止离开
  checkEnterBossRoom() {
    try {
      if (!this.bossRoom || !this.bossEntity || !this.bossEntity.isAlive) return;
      const r = this.bossRoom;
      const px = this.player.tileX, py = this.player.tileY;
      const inside = (px >= r.x && px < r.x + r.width && py >= r.y && py < r.y + r.height);
      if (inside && !this.bossRoomLocked) {
        this.bossRoomLocked = true;
        
        // 触发 Boss UI 显示
        this.events.emit('bossEncounter', this.bossEntity);

        // 切换为 Boss BGM
        AudioManager.play('music_boss', { volume: 0.8, loop: true, fade: 900 });
        
        // 将房间所有门标记为 locked
        for (const d of this.doors) {
          try {
            if (d && d.tileX >= r.x - 1 && d.tileX <= r.x + r.width && d.tileY >= r.y - 1 && d.tileY <= r.y + r.height) {
              d.locked = true;
              try { d.close(); } catch (e) {}
            }
          } catch (e) {}
        }
        // 可视结界：在房间边缘绘制半透明圆或矩形
        try {
          const g = this.add.graphics();
          g.lineStyle(3, 0x99bbff, 0.9);
          g.fillStyle(0x3366ff, 0.12);
          const cx = r.centerX * TILE_SIZE + TILE_SIZE / 2;
          const cy = r.centerY * TILE_SIZE + TILE_SIZE / 2;
          const radius = Math.max(r.width, r.height) * TILE_SIZE / 1.6;
          g.fillCircle(cx, cy, radius);
          g.setDepth(30);
          this._bossBarrierGraphic = g;
          this.events.emit('showMessage', '周围出现了结界，无法离开房间，直到首领被击败。');
        } catch (e) {}
      }
    } catch (e) {}
  }

  // boss 被击败时的回调
  onBossDefeated(boss) {
    try {
      // 触发 Boss UI 隐藏
      this.events.emit('bossDefeated');
      
      this.bossEntity = null;
      this.bossRoomLocked = false;
      // 解锁房间门
      for (const d of this.doors) try { d.locked = false; try { d.open(); } catch (e) {} } catch (e) {}
      // 移除结界视觉
      try { if (this._bossBarrierGraphic) { this._bossBarrierGraphic.destroy(); this._bossBarrierGraphic = null; } } catch (e) {}
      // 激活出口
      this.exitActive = true;
      this.updateExitVisual();
      this.events.emit('showMessage', '首领被击败了！通往出口的门显现为绿色。');

      // 切回道中 BGM
      AudioManager.play('music_game', { volume: 0.5, loop: true, fade: 800 });
    } catch (e) {}
  }

  // 检查是否进入战斗房并触发锁定
  checkEnterCombatRoom() {
    try {
      if (this.combatRoomLocked || this.bossRoomLocked) return; // 已在战斗中
      if (!this.mapData || !this.mapData.rooms) return;
      
      const px = this.player.tileX, py = this.player.tileY;
      
      // 查找玩家所在的战斗房或危险房（未清理）
      for (const room of this.mapData.rooms) {
        if (room.type !== 'combat' && room.type !== 'danger') continue;
        if (room.cleared) continue; // 已清理过
        
        const inside = (px >= room.x && px < room.x + room.width && py >= room.y && py < room.y + room.height);
        if (inside) {
          this.lockCombatRoom(room);
          break;
        }
      }
    } catch (e) {}
  }
  
  // 锁定战斗房
  lockCombatRoom(room) {
    try {
      this.currentCombatRoom = room;
      this.combatRoomLocked = true;
      
      // 查找房间内的敌人数量
      const roomEnemies = this.enemies.filter(e => 
        e.isAlive && e.room === room
      );
      
      // 创建或关闭房间入口的门
      const doorPositions = this.findRoomEntrances(room);
      for (const dp of doorPositions) {
        // 检查是否已有门
        let existingDoor = this.doors.find(d => d.tileX === dp.x && d.tileY === dp.y);
        if (!existingDoor) {
          existingDoor = new Door(this, dp.x, dp.y, 20);
          this.doors.push(existingDoor);
        }
        existingDoor.locked = true;
        try { existingDoor.close(); } catch (e) {}
      }
      
      // 显示结界视觉
      const g = this.add.graphics();
      g.lineStyle(2, room.type === 'danger' ? 0xff4444 : 0xffaa44, 0.8);
      g.fillStyle(room.type === 'danger' ? 0xff0000 : 0xff6600, 0.08);
      const cx = room.centerX * TILE_SIZE + TILE_SIZE / 2;
      const cy = room.centerY * TILE_SIZE + TILE_SIZE / 2;
      const radius = Math.max(room.width, room.height) * TILE_SIZE / 1.8;
      g.fillCircle(cx, cy, radius);
      g.strokeCircle(cx, cy, radius);
      g.setDepth(29);
      this._combatBarrierGraphic = g;
      
      const roomName = room.type === 'danger' ? '危险房间' : '战斗房间';
      this.events.emit('showMessage', `进入${roomName}！消灭所有敌人后才能离开。（敌人数：${roomEnemies.length}）`);
    } catch (e) {}
  }
  
  // 检查战斗房是否已清理完毕
  checkCombatRoomCleared() {
    try {
      if (!this.combatRoomLocked || !this.currentCombatRoom) return;
      
      const room = this.currentCombatRoom;
      const remainingEnemies = this.enemies.filter(e => 
        e.isAlive && e.room === room
      );
      
      if (remainingEnemies.length === 0) {
        this.unlockCombatRoom();
      }
    } catch (e) {}
  }
  
  // 解锁战斗房
  unlockCombatRoom() {
    try {
      if (!this.currentCombatRoom) return;
      
      const room = this.currentCombatRoom;
      room.cleared = true;
      
      // 解锁并打开房间的门
      const doorPositions = this.findRoomEntrances(room);
      for (const dp of doorPositions) {
        const door = this.doors.find(d => d.tileX === dp.x && d.tileY === dp.y);
        if (door) {
          door.locked = false;
          try { door.open(); } catch (e) {}
        }
      }
      
      // 移除结界视觉
      try {
        if (this._combatBarrierGraphic) {
          this._combatBarrierGraphic.destroy();
          this._combatBarrierGraphic = null;
        }
      } catch (e) {}
      
      // 危险房间/战斗房掉落奖励
      if (room.type === 'danger') {
        try {
          const dropCount = this.mapManager.randomRange(3, 5);
          const lootTable = [
            { id: 'talent_book', weight: 3 },
            { id: 'chest_wood', weight: 2 },
            { id: 'gold_coin', weight: 4 },
            { id: 'potion_small', weight: 2 },
            { id: 'herb', weight: 1 }
          ];
          const pickWeighted = () => {
            const total = lootTable.reduce((s, it) => s + it.weight, 0);
            let r = Math.random() * total;
            for (const it of lootTable) {
              r -= it.weight;
              if (r <= 0) return it.id;
            }
            return lootTable[lootTable.length - 1].id;
          };
          for (let i = 0; i < dropCount; i++) {
            const rx = this.mapManager.randomRange(room.x + 1, room.x + room.width - 2);
            const ry = this.mapManager.randomRange(room.y + 1, room.y + room.height - 2);
            if (!this.mapManager.isWalkable(rx, ry)) continue;
            this.itemSystem.spawnItem(rx, ry, pickWeighted());
          }
          this.events.emit('showMessage', '危险房间已清理！获得了丰厚的奖励！');
        } catch (e) {}
        // 危险房保底：装备/特性
        this.dropGuaranteedReward(room.centerX, room.centerY, true);
      } else {
        try {
          const dropCount = this.mapManager.randomRange(1, 2);
          const loot = ['gold_coin', 'gold_coin', 'potion_small', 'herb', 'chest_wood'];
          for (let i = 0; i < dropCount; i++) {
            const rx = this.mapManager.randomRange(room.x + 1, room.x + room.width - 2);
            const ry = this.mapManager.randomRange(room.y + 1, room.y + room.height - 2);
            if (!this.mapManager.isWalkable(rx, ry)) continue;
            const itemId = loot[Math.floor(Math.random() * loot.length)];
            this.itemSystem.spawnItem(rx, ry, itemId);
          }
        } catch (e) {}
        // 战斗房保底：装备/特性
        this.dropGuaranteedReward(room.centerX, room.centerY, true);
        this.events.emit('showMessage', '战斗房间已清理，获得了战利品！');
      }
      
      this.currentCombatRoom = null;
      this.combatRoomLocked = false;
    } catch (e) {}
  }

  updateExitVisual() {
    try {
      if (!this.exitSprite) return;
      if (this.exitActive) {
        this.exitSprite.clearTint();
        this.exitSprite.setTint(0x66ff66);
      } else {
        this.exitSprite.clearTint();
        this.exitSprite.setTint(0x666666);
      }
    } catch (e) {}
  }

  // 在房间边界查找一个合适的入口格子（返回房间内侧坐标）
  findRoomEntrance(room) {
    try {
      // top
      for (let x = room.x; x < room.x + room.width; x++) {
        const y = room.y;
        if (this.mapManager.isWalkable(x, y) && this.mapManager.isWalkable(x, y - 1)) return { x, y };
      }
      // bottom
      for (let x = room.x; x < room.x + room.width; x++) {
        const y = room.y + room.height - 1;
        if (this.mapManager.isWalkable(x, y) && this.mapManager.isWalkable(x, y + 1)) return { x, y };
      }
      // left
      for (let y = room.y; y < room.y + room.height; y++) {
        const x = room.x;
        if (this.mapManager.isWalkable(x, y) && this.mapManager.isWalkable(x - 1, y)) return { x, y };
      }
      // right
      for (let y = room.y; y < room.y + room.height; y++) {
        const x = room.x + room.width - 1;
        if (this.mapManager.isWalkable(x, y) && this.mapManager.isWalkable(x + 1, y)) return { x, y };
      }
    } catch (e) {}
    return null;
  }

  getDoorAt(x, y) {
    if (!this.doors) return null;
    for (const d of this.doors) {
      try { if (d && d.tileX === x && d.tileY === y && !d.isOpen) return d; } catch (e) {}
    }
    return null;
  }

  /**
   * 结束玩家回合
   */
  endPlayerTurn() {
    this.player.onTurnEnd();
    this.spellCardSystem.reduceCooldowns();
    this.actionQueue.endAction(this.player);
    // 每当玩家回合结束，处理结界的持续效果（按回合计时、对范围内敌人造成伤害）
    if (this.processBarriers) this.processBarriers();
    // 天赋系统回合结束效果（如生命回复）
    if (this.talentSystem) this.talentSystem.onTurnEnd();
    // 装备系统回合结束效果（生命/灵力回复）
    if (this.equipmentSystem) this.equipmentSystem.onTurnEnd();
    // 神社诅咒 debuff 处理
    if (this.shrineDonateSystem) this.shrineDonateSystem.onTurnEnd();
    this.updateUI();
  }

  /**
   * 处理敌人回合
   */
  async processEnemyTurn(enemy) {
    this.isProcessingTurn = true;
    
    await enemy.act(this.player);
    this.actionQueue.endAction(enemy);
    
    // 检查玩家是否死亡
    if (!this.player.isAlive) {
      this.gameOver();
    }
    
    this.updateUI();
    this.isProcessingTurn = false;
  }

  /**
   * 并行处理一批敌人的行为（不改变伤害/死亡逻辑）
   * @param {Array<Entity>} enemies
   */
  async processEnemyBatch(enemies) {
    this.isProcessingTurn = true;

    // 启动所有敌人的 act()（返回 promise），并并行等待
    const promises = enemies.map(e => e.act(this.player));

    try {
      await Promise.all(promises);
    } catch (e) {
      // 若个别行为抛出错误，记录但继续处理
      console.error('Error during enemy batch actions', e);
    }

    // 所有行为完成后统一结束它们的行动并更新 UI
    for (const e of enemies.slice()) {
      // 如果敌人在行动中死亡，removeEnemy 内会调用 actionQueue.removeEntity
      this.actionQueue.endAction(e);
    }

    // 检查玩家死亡
    if (!this.player.isAlive) {
      this.gameOver();
    }

    this.updateUI();
    this.isProcessingTurn = false;
  }
  

  /**
   * 检查是否可以移动到指定位置
   */
  canMoveTo(x, y) {
    // 不可出界或墙体
    if (!this.mapManager.isWalkable(x, y)) return false;
    // 如果有未打开的门在该格，阻挡移动
    try {
      const door = this.getDoorAt(x, y);
      if (door && !door.isOpen) return false;
    } catch (e) {}
    // 若处于 boss 房结界中，禁止从房间内移动到外侧格
    try {
      if (this.bossRoomLocked && this.bossRoom && this.player) {
        const r = this.bossRoom;
        const px = this.player.tileX, py = this.player.tileY;
        const insideNow = (px >= r.x && px < r.x + r.width && py >= r.y && py < r.y + r.height);
        const targetInside = (x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height);
        if (insideNow && !targetInside) return false;
      }
    } catch (e) {}
    // 若处于战斗房锁定中，禁止从房间内移动到外侧
    try {
      if (this.combatRoomLocked && this.currentCombatRoom && this.player) {
        const r = this.currentCombatRoom;
        const px = this.player.tileX, py = this.player.tileY;
        const insideNow = (px >= r.x && px < r.x + r.width && py >= r.y && py < r.y + r.height);
        const targetInside = (x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height);
        if (insideNow && !targetInside) return false;
      }
    } catch (e) {}
    // 障碍物阻挡移动
    try {
      const obstacle = this.getObstacleAt(x, y);
      if (obstacle && obstacle.isAlive && obstacle.blocksMovement) return false;
    } catch (e) {}
    return true;
  }
  
  /**
   * 检查陷阱触发
   */
  checkTraps(entity) {
    if (!this.traps || !entity) return;
    for (const trap of this.traps) {
      trap.checkTrigger(entity);
    }
  }

  /**
   * 快速回神社（每层一次）
   */
  tryReturnToShrine() {
    try {
      if (this.shrineReturnUsed) {
        this.events.emit('showMessage', '本层回神社已使用。');
        return false;
      }
      if (this.combatRoomLocked || this.bossRoomLocked) {
        this.events.emit('showMessage', '战斗/首领房间中无法回神社！');
        return false;
      }

      const target = this.lastShrinePos || (this.shrines && this.shrines[0] ? { x: this.shrines[0].tileX, y: this.shrines[0].tileY } : null);
      if (!target) {
        this.events.emit('showMessage', '本层没有可用的神社。');
        return false;
      }

      this.isProcessingTurn = true;
      const doTeleport = async () => {
        await this.player.moveTo(target.x, target.y, false);
        // 更新迷雾
        if (this.fog) {
          this.fog.setBlockers(this.getVisionBlockers());
          this.fog.compute(this.mapData.tiles, this.player.tileX, this.player.tileY);
          this.updateFogVisuals();
        }
        // 回到神社后触发神社交互（不自动消费）
        try {
          const shrine = this.getShrineAt(target.x, target.y);
          if (shrine) this.interactWithShrine(shrine);
        } catch (e) {}

        this.shrineReturnUsed = true;
        this.events.emit('showMessage', '已返回神社（本层次数已用完）。');
        this.endPlayerTurn();
        this.isProcessingTurn = false;
      };

      doTeleport();
      return true;
    } catch (e) {
      this.isProcessingTurn = false;
      return false;
    }
  }
  
  /**
   * 获取指定位置的障碍物
   */
  getObstacleAt(x, y) {
    return this.obstacles?.find(o => o.tileX === x && o.tileY === y && o.isAlive);
  }

  /**
   * 获取指定位置的敌人
   */
  getEnemyAt(x, y) {
    return this.enemies.find(e => e.isAlive && e.tileX === x && e.tileY === y);
  }

  /**
   * 获取指定像素位置的敌人（用于自由移动碰撞检测）
   */
  getEnemyAtPixel(pixelX, pixelY) {
    const checkRadius = TILE_SIZE * 0.4; // 碰撞半径
    for (const enemy of this.enemies) {
      if (!enemy.isAlive) continue;
      const dx = pixelX - enemy.pixelX;
      const dy = pixelY - enemy.pixelY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < checkRadius + enemy.hitboxRadius) {
        return enemy;
      }
    }
    return null;
  }

  /**
   * 获取指定位置列表中的所有敌人
   */
  getEnemiesInPositions(positions) {
    return this.enemies.filter(e => {
      if (!e.isAlive) return false;
      return positions.some(pos => pos.x === e.tileX && pos.y === e.tileY);
    });
  }

  /**
   * 移除敌人
   */
  removeEnemy(enemy) {
    this.actionQueue.removeEntity(enemy);
    const index = this.enemies.indexOf(enemy);
    if (index !== -1) {
      this.enemies.splice(index, 1);
    }
    // 精英怪保底掉落装备/特性
    try {
      if (enemy && enemy.isElite) {
        this.dropGuaranteedReward(enemy.tileX, enemy.tileY, true);
      }
    } catch (e) {}
    // 天赋击杀效果（如吸血恢复）
    if (this.talentSystem) {
      try { this.talentSystem.onKillEnemy(); } catch (e) {}
    }
    // 装备击杀效果（如吸血恢复）
    if (this.equipmentSystem) {
      try { this.equipmentSystem.onKillEnemy(); } catch (e) {}
    }
    // 检查战斗房是否已清理
    try { this.checkCombatRoomCleared(); } catch (e) {}
  }

  // 选择保底奖励（倾向装备或特性）
  pickGuaranteedReward(preferEquipment = false) {
    const equipPool = ['omamori_health', 'omamori_protection', 'magatama_power', 'ribbon_red'];
    const talentId = 'talent_book';
    const roll = Math.random();
    const equipChance = preferEquipment ? 0.7 : 0.55;
    if (roll < equipChance) {
      return equipPool[Math.floor(Math.random() * equipPool.length)];
    }
    return talentId;
  }

  // 在附近安全位置生成保底奖励
  dropGuaranteedReward(centerX, centerY, preferEquipment = false) {
    if (!this.itemSystem) return;
    const itemId = this.pickGuaranteedReward(preferEquipment);
    if (!itemId) return;
    let pos = null;
    try {
      const found = this.itemSystem.findDropPositions(centerX, centerY, 1, 4);
      pos = found && found[0] ? found[0] : null;
    } catch (e) { pos = null; }
    if (!pos) pos = { x: centerX, y: centerY };
    try { this.itemSystem.spawnItem(pos.x, pos.y, itemId); } catch (e) {}
  }

  /**
   * 检查是否到达出口
   */
  checkExit() {
    const { exitPoint } = this.mapData;
    if (this.player.tileX === exitPoint.x && this.player.tileY === exitPoint.y) {
      if (this.exitActive) this.victory();
      else this.events.emit('showMessage', '出口被封印，无法离开！');
    }
  }

  /**
   * 获取范围内的敌人
   */
  getEnemiesInRange(centerX, centerY, range) {
    return this.enemies.filter(e => {
      if (!e.isAlive) return false;
      const distance = Math.abs(e.tileX - centerX) + Math.abs(e.tileY - centerY);
      return distance <= range;
    });
  }

  /**
   * 添加结界
   */
  addBarrier(barrierData) {
    this.barriers.push(barrierData);
  }

  /**
   * 处理结界效果（每回合检测）
   */
  processBarriers() {
    const toRemove = [];
    
    for (const barrier of this.barriers) {
      // 检查敌人是否在结界范围内
      for (const enemy of this.enemies) {
        if (!enemy.isAlive) continue;
        
        const distance = Math.abs(enemy.tileX - barrier.x) + Math.abs(enemy.tileY - barrier.y);
        if (distance <= barrier.radius) {
          // 造成伤害
          const damage = enemy.takeDamage(barrier.damage);
          this.events.emit('showMessage', `结界对 ${enemy.name} 造成 ${damage} 点伤害！`);
          
          if (!enemy.isAlive) {
            this.removeEnemy(enemy);
          }
        }
      }
      
      // 减少持续时间，并触发“按回合”的视觉脉冲（与之前基于真实时间的 repeat 区别）
      barrier.duration--;

      // 每回合触发一次视觉脉冲（旋转符文 + barrier 透明闪烁）
      try {
        if (barrier.runes) {
          this.tweens.add({ targets: barrier.runes, angle: '+=360', duration: 500 });
        }
        if (barrier.graphics) {
          this.tweens.add({ targets: barrier.graphics, alpha: 0.45, duration: 250, yoyo: true });
        }
      } catch (e) { /* ignore tween errors */ }

      if (barrier.duration <= 0) {
        toRemove.push(barrier);
      }
    }
    
    // 移除过期结界
    for (const barrier of toRemove) {
      const index = this.barriers.indexOf(barrier);
      if (index !== -1) {
        this.barriers.splice(index, 1);
      }

      // 销毁视觉对象
      try { if (barrier.graphics && barrier.graphics.destroy) barrier.graphics.destroy(); } catch (e) {}
      try { if (barrier.runes && barrier.runes.destroy) barrier.runes.destroy(); } catch (e) {}
      try { if (barrier.pulseTimer && barrier.pulseTimer.remove) barrier.pulseTimer.remove(false); } catch (e) {}
    }
  }

  /**
   * 更新UI
   */
  updateUI() {
    this.events.emit('updateStats', {
      hp: this.player.hp,
      maxHp: this.player.maxHp,
      mp: this.player.mp,
      maxMp: this.player.maxMp,
      floor: this.floor,
      turn: this.actionQueue.getTurnCount()
    });
    
    // 更新小地图（包含迷雾数据）
    this.events.emit('updateMinimap', {
      mapData: this.mapData,
      player: this.player,
      enemies: this.enemies,
      exitPoint: this.mapData.exitPoint,
      fog: this.fog ? { explored: this.fog.getExplored(), visible: this.fog.getVisible() } : null,
      items: this.itemSystem ? (this.itemSystem.items.map(it => ({ id: it.id, x: it.x, y: it.y }))) : [],
      doors: this.doors ? this.doors.map(d => ({ x: d.tileX, y: d.tileY, isOpen: !!d.isOpen })) : []
    });
  }

  /**
   * 游戏胜利
   */
  victory() {
    // 防止重复调用
    if (this.isGameEnded) return;
    this.isGameEnded = true;
    this.isProcessingTurn = true;
    
    this.events.emit('showMessage', '🎉 找到了幻想之门！成功逃离迷宫！');
    
    // 显示胜利画面
    const self = this;
    this.time.delayedCall(1500, () => {
      try {
        AudioManager.stop({ fade: 600 });
        self.cameras.main.fadeOut(1000, 0, 0, 0);
        self.cameras.main.once('camerafadeoutcomplete', () => {
          try { self.scene.stop('UIScene'); } catch (e) {}
          try { self.scene.stop('InGameMenu'); } catch (e) {}
          try { self.scene.stop(); } catch (e) {}
          self.scene.start('MenuScene');
        });
      } catch (e) {
        // 如果淡出失败，直接跳转
        try { self.scene.stop('UIScene'); } catch (e2) {}
        try { self.scene.stop('InGameMenu'); } catch (e2) {}
        try { self.scene.stop(); } catch (e2) {}
        self.scene.start('MenuScene');
      }
    });
  }

  /**
   * 游戏失败
   */
  gameOver() {
    // 防止重复调用
    if (this.isGameEnded) return;
    this.isGameEnded = true;
    this.isProcessingTurn = true;
    
    this.events.emit('showMessage', '💀 灵梦倒下了...');
    
    // 显示失败画面
    const self = this;
    this.time.delayedCall(1500, () => {
      try {
        AudioManager.stop({ fade: 600 });
        self.cameras.main.fadeOut(1000, 0, 0, 0);
        self.cameras.main.once('camerafadeoutcomplete', () => {
          try { self.scene.stop('UIScene'); } catch (e) {}
          try { self.scene.stop('InGameMenu'); } catch (e) {}
          try { self.scene.stop(); } catch (e) {}
          self.scene.start('MenuScene');
        });
      } catch (e) {
        // 如果淡出失败，直接跳转
        try { self.scene.stop('UIScene'); } catch (e2) {}
        try { self.scene.stop('InGameMenu'); } catch (e2) {}
        try { self.scene.stop(); } catch (e2) {}
        self.scene.start('MenuScene');
      }
    });
  }

  /**
   * 获取方向名称
   * @param {number} dx 
   * @param {number} dy 
   * @returns {string}
   */
  getDirectionName(dx, dy) {
    const directions = {
      '0,-1': '↑ 上',
      '0,1': '↓ 下',
      '-1,0': '← 左',
      '1,0': '→ 右',
      '-1,-1': '↖ 左上',
      '1,-1': '↗ 右上',
      '-1,1': '↙ 左下',
      '1,1': '↘ 右下'
    };
    return directions[`${dx},${dy}`] || '未知';
  }
}
