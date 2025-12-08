/**
 * 主游戏场景
 */
import { TILE_SIZE, MAP_CONFIG, COLORS } from '../config/gameConfig.js';
import MapGenerator, { TileType } from '../systems/MapGenerator.js';
import ActionQueue from '../systems/ActionQueue.js';
import SpellCardSystem from '../systems/SpellCardSystem.js';
import Player from '../entities/Player.js';
import SlowFairy from '../entities/enemies/SlowFairy.js';
import NormalFairy from '../entities/enemies/NormalFairy.js';
import FastFairy from '../entities/enemies/FastFairy.js';
import DanmakuFairy from '../entities/enemies/DanmakuFairy.js';

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
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tileType = tiles[y][x];
        const posX = x * TILE_SIZE;
        const posY = y * TILE_SIZE;
        
        if (tileType === TileType.WALL) {
          const wall = this.add.sprite(posX + TILE_SIZE / 2, posY + TILE_SIZE / 2, 'wall');
          this.wallLayer.add(wall);
        } else {
          // 地板
          const floor = this.add.sprite(posX + TILE_SIZE / 2, posY + TILE_SIZE / 2, 'floor');
          this.floorLayer.add(floor);
          
          // 出口
          if (tileType === TileType.EXIT) {
            const exit = this.add.sprite(posX + TILE_SIZE / 2, posY + TILE_SIZE / 2, 'exit');
            exit.setDepth(1);
            
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
      }
    }
    
    // 设置深度
    this.floorLayer.setDepth(0);
    this.wallLayer.setDepth(1);
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
  }

  update() {
    if (this.isProcessingTurn) return;
    if (!this.player || !this.player.isAlive) return;
    
    // 处理自由视角模式
    if (this.handleFreeLookMode()) return;
    
    // 获取当前行动者
    const actor = this.actionQueue.tick();
    
    if (!actor) return;
    
    if (actor.isPlayer) {
      // 玩家回合 - 等待输入
      this.handlePlayerInput();
    } else {
      // 敌人回合 - 自动行动
      this.processEnemyTurn(actor);
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
  handlePlayerInput() {
    let dx = 0;
    let dy = 0;
    let acted = false;
    
    // 检测是否按住Q键（转向模式，不消耗行动）
    const isTurnMode = this.turnKey.isDown;
    
    // 八向移动输入 - 同时检测多个方向键
    const upPressed = Phaser.Input.Keyboard.JustDown(this.cursors.up) || Phaser.Input.Keyboard.JustDown(this.wasd.W);
    const downPressed = Phaser.Input.Keyboard.JustDown(this.cursors.down) || Phaser.Input.Keyboard.JustDown(this.wasd.S);
    const leftPressed = Phaser.Input.Keyboard.JustDown(this.cursors.left) || Phaser.Input.Keyboard.JustDown(this.wasd.A);
    const rightPressed = Phaser.Input.Keyboard.JustDown(this.cursors.right) || Phaser.Input.Keyboard.JustDown(this.wasd.D);
    
    // 计算方向
    if (upPressed) dy = -1;
    if (downPressed) dy = 1;
    if (leftPressed) dx = -1;
    if (rightPressed) dx = 1;
    
    // 如果是转向模式（按住Q），只转向不移动
    if (isTurnMode && (dx !== 0 || dy !== 0)) {
      this.player.setFacing(dx, dy);
      this.events.emit('showMessage', `转向: ${this.getDirectionName(dx, dy)}`);
      return; // 不消耗行动
    }
    
    // 符卡输入
    if (Phaser.Input.Keyboard.JustDown(this.spellKeys.Z)) {
      if (this.player.useSpellCard(0)) {
        acted = true;
      }
    } else if (Phaser.Input.Keyboard.JustDown(this.spellKeys.X)) {
      if (this.player.useSpellCard(1)) {
        acted = true;
      }
    } else if (Phaser.Input.Keyboard.JustDown(this.spellKeys.C)) {
      if (this.player.useSpellCard(2)) {
        acted = true;
      }
    }
    
    // 等待
    if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      this.player.wait();
      acted = true;
    }
    
    // 移动
    if (dx !== 0 || dy !== 0) {
      this.processPlayerMove(dx, dy);
    } else if (acted) {
      this.endPlayerTurn();
    }
  }

  /**
   * 处理玩家移动
   */
  async processPlayerMove(dx, dy) {
    this.isProcessingTurn = true;
    
    const moved = await this.player.move(dx, dy);
    
    if (moved) {
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
      
      // 减少持续时间
      barrier.duration--;
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
    
    // 更新小地图
    this.events.emit('updateMinimap', {
      mapData: this.mapData,
      player: this.player,
      enemies: this.enemies,
      exitPoint: this.mapData.exitPoint
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
