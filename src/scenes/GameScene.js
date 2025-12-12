/**
 * 主游戏场景
 */
import { TILE_SIZE, MAP_CONFIG, COLORS } from '../config/gameConfig.js';
import MapGenerator, { TileType } from '../systems/MapGenerator.js';
import ActionQueue from '../systems/ActionQueue.js';
import SpellCardSystem from '../systems/SpellCardSystem.js';
import FogOfWar from '../systems/FogOfWar.js';
import Player from '../entities/Player.js';
import SlowFairy from '../entities/enemies/SlowFairy.js';
import NormalFairy from '../entities/enemies/NormalFairy.js';
import FastFairy from '../entities/enemies/FastFairy.js';
import DanmakuFairy from '../entities/enemies/DanmakuFairy.js';
import ItemSystem from '../systems/ItemSystem.js';

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
    
    // 视角模式（不消耗行动）
    this.isFreeLookMode = false;
    this.freeLookTarget = { x: 0, y: 0 };
    // 连续行走按键保持状态
    this.heldMove = null; // {x, y} or null
    // 转向提示箭头
    this.aimArrow = null; // Phaser.GameObjects.Triangle
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
    // 初始化系统
    this.actionQueue = new ActionQueue();
    this.spellCardSystem = new SpellCardSystem(this);
    this.spellCardSystem.initialize();
    
    // 生成地图
    this.generateMap();
    
    // 创建玩家
    this.createPlayer();

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
    // 计算初始可见性
    this.fog.compute(this.mapData.tiles, this.player.tileX, this.player.tileY);
    // 将迷雾可视效果应用到主视图
    this.updateFogVisuals();
    
    // 生成敌人
    this.spawnEnemies();
    
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
            // 出口闪烁动画
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

    // 玩家自己始终可见
    if (this.player && this.player.sprite) {
      this.player.sprite.setVisible(true);
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
    
    // 敌人类型分布
    const enemyTypes = [SlowFairy, NormalFairy, FastFairy, DanmakuFairy];
    const weights = [0.3, 0.3, 0.2, 0.2]; // 各类型权重
    
    for (const spawnPoint of enemySpawnPoints) {
      // 随机选择敌人类型
      const EnemyClass = this.weightedRandom(enemyTypes, weights);
      const enemy = new EnemyClass(this, spawnPoint.x, spawnPoint.y);
      // 记录敌人所属房间，供 AI 决策使用
      try { enemy.room = spawnPoint.room; } catch (e) {}
      enemy.sprite.setDepth(10);
      
      this.enemies.push(enemy);
      this.actionQueue.addEntity(enemy);
    }
    
    this.events.emit('showMessage', `本层有 ${this.enemies.length} 个敌人！`);
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
    this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1);
    
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
    
    // 等待键
    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    
    // 自由视角键
    this.freeLookKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TAB);
    this.returnKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    
    // 转向键（不消耗行动）
    this.turnKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
    // 菜单键（暂停）
    this.menuKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
  }

  update() {
    if (this.isProcessingTurn) return;
    if (!this.player || !this.player.isAlive) return;
    
    // 处理自由视角模式
    if (this.handleFreeLookMode()) return;

    // 菜单开关（Esc）
    if (Phaser.Input.Keyboard.JustDown(this.menuKey)) {
      // 暂停当前场景并打开游戏内菜单（InGameMenu）
      this.scene.launch('InGameMenu');
      this.scene.pause();
      return;
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
    
    // 获取当前行动者
    const actor = this.actionQueue.tick();
    
    if (!actor) return;
    
    if (actor.isPlayer) {
      // 玩家回合 - 先处理快捷按键/按下触发的即时操作
      const acted = this.handlePlayerInput();

      // 如果本帧没有产生其他行动，并且存在按住的方向，则自动移动（连续行走）
      // 但当处于转向（Q）模式时不要自动移动
      if (!acted && !this.isProcessingTurn && this.heldMove && !this.turnKey.isDown) {
        this.processPlayerMove(this.heldMove.x, this.heldMove.y);
      }
    } else {
      // 敌人回合 - 并行处理所有可行动的敌人（以减少串行等待）
      const actionable = this.actionQueue.getActionableEntities().filter(e => !e.isPlayer && e.isAlive);
      if (actionable.length <= 1) {
        // 只有一个敌人可行动，保持原有行为
        this.processEnemyTurn(actor);
      } else {
        // 批量并行执行敌人行为（不改变各自内部的伤害/死亡逻辑）
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
   * 处理玩家输入
   */
  // 返回值：若本次输入触发了行动（移动/使用符卡/等待等）则返回 true
  handlePlayerInput() {
    let dx = 0;
    let dy = 0;
    let acted = false;
    
    // 检测是否按住Q键（转向模式，不消耗行动）
    const isTurnMode = this.turnKey.isDown;
    
    // 八向移动输入 - 支持按下持续（isDown）与即时触发（JustDown）
    const upDown = this.cursors.up.isDown || this.wasd.W.isDown;
    const downDown = this.cursors.down.isDown || this.wasd.S.isDown;
    const leftDown = this.cursors.left.isDown || this.wasd.A.isDown;
    const rightDown = this.cursors.right.isDown || this.wasd.D.isDown;

    const upPressed = Phaser.Input.Keyboard.JustDown(this.cursors.up) || Phaser.Input.Keyboard.JustDown(this.wasd.W);
    const downPressed = Phaser.Input.Keyboard.JustDown(this.cursors.down) || Phaser.Input.Keyboard.JustDown(this.wasd.S);
    const leftPressed = Phaser.Input.Keyboard.JustDown(this.cursors.left) || Phaser.Input.Keyboard.JustDown(this.wasd.A);
    const rightPressed = Phaser.Input.Keyboard.JustDown(this.cursors.right) || Phaser.Input.Keyboard.JustDown(this.wasd.D);
    
    // 计算方向
    // 优先使用即时触发（JustDown）来获得响应性
    if (upPressed) dy = -1;
    else if (downPressed) dy = 1;
    if (leftPressed) dx = -1;
    else if (rightPressed) dx = 1;

    // 若没有即时按下但存在按住（长按），将 heldMove 设置为持续方向（但不立即执行移动）
    if (!upPressed && !downPressed && !leftPressed && !rightPressed) {
      if (upDown || downDown || leftDown || rightDown) {
        const holdDx = leftDown ? -1 : (rightDown ? 1 : 0);
        const holdDy = upDown ? -1 : (downDown ? 1 : 0);
        // 仅在非转向模式时记录 heldMove，转向模式应只改变朝向而不移动
        if (!isTurnMode) {
          this.heldMove = (holdDx !== 0 || holdDy !== 0) ? { x: holdDx, y: holdDy } : null;
        } else {
          this.heldMove = null;
        }
      } else {
        this.heldMove = null;
      }
    } else {
      // 有即时按键触发，清除 heldMove（按下瞬间优先立即移动）
      this.heldMove = null;
    }
    
    // 如果是转向模式（按住Q），只转向不移动
    if (isTurnMode && (dx !== 0 || dy !== 0)) {
      this.player.setFacing(dx, dy);
      this.events.emit('showMessage', `转向: ${this.getDirectionName(dx, dy)}`);
      return false; // 不消耗行动
    }
    
    // 符卡输入
    if (Phaser.Input.Keyboard.JustDown(this.spellKeys.Z)) {
      if (this.player.useSpellCard(0)) acted = true;
    } else if (Phaser.Input.Keyboard.JustDown(this.spellKeys.X)) {
      if (this.player.useSpellCard(1)) acted = true;
    } else if (Phaser.Input.Keyboard.JustDown(this.spellKeys.C)) {
      if (this.player.useSpellCard(2)) acted = true;
    }
    
    // 等待
    if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      this.player.wait();
      acted = true;
      this.heldMove = null;
    }
    
    // 移动（即时按键触发）
    if (dx !== 0 || dy !== 0) {
      this.processPlayerMove(dx, dy);
      acted = true;
    } else if (acted) {
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
        this.fog.compute(this.mapData.tiles, this.player.tileX, this.player.tileY);
        // 更新主视图和小地图
        this.updateFogVisuals();
      }
      // 检查是否在当前位置有可拾取道具
      try {
        if (this.itemSystem) await this.itemSystem.tryPickupAt(this.player.tileX, this.player.tileY, this.player);
      } catch (e) { /* ignore pickup errors */ }
      this.endPlayerTurn();
    }
    
    this.isProcessingTurn = false;
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
    return this.mapManager.isWalkable(x, y);
  }

  /**
   * 获取指定位置的敌人
   */
  getEnemyAt(x, y) {
    return this.enemies.find(e => e.isAlive && e.tileX === x && e.tileY === y);
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
  }

  /**
   * 检查是否到达出口
   */
  checkExit() {
    const { exitPoint } = this.mapData;
    if (this.player.tileX === exitPoint.x && this.player.tileY === exitPoint.y) {
      this.victory();
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
      fog: this.fog ? { explored: this.fog.getExplored(), visible: this.fog.getVisible() } : null
    });
  }

  /**
   * 游戏胜利
   */
  victory() {
    this.isProcessingTurn = true;
    
    this.events.emit('showMessage', '🎉 找到了幻想之门！成功逃离迷宫！');
    
    // 显示胜利画面
    this.time.delayedCall(1500, () => {
      this.cameras.main.fadeOut(1000, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.stop('UIScene');
        this.scene.start('MenuScene');
      });
    });
  }

  /**
   * 游戏失败
   */
  gameOver() {
    this.isProcessingTurn = true;
    
    this.events.emit('showMessage', '💀 灵梦倒下了...');
    
    // 显示失败画面
    this.time.delayedCall(1500, () => {
      this.cameras.main.fadeOut(1000, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.stop('UIScene');
        this.scene.start('MenuScene');
      });
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
