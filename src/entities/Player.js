/**
 * 玩家类 - 博丽灵梦
 */
import Entity from './Entity.js';
import { PLAYER_CONFIG, TILE_SIZE } from '../config/gameConfig.js';

export default class Player extends Entity {
  constructor(scene, x, y) {
    super(scene, x, y, 'player', {
      name: '博丽灵梦',
      hp: PLAYER_CONFIG.maxHp,
      attack: PLAYER_CONFIG.attack,
      defense: PLAYER_CONFIG.defense,
      speed: PLAYER_CONFIG.speed
    });

    this.isPlayer = true;

    // 基础属性（用于天赋系统加成计算）
    this.baseMaxHp = PLAYER_CONFIG.maxHp;
    this.baseMaxMp = PLAYER_CONFIG.maxMp;
    this.baseSpeed = PLAYER_CONFIG.speed;
    this.baseAttack = PLAYER_CONFIG.attack;
    this.baseDefense = PLAYER_CONFIG.defense;

    // 灵力值（MP）
    this.maxMp = PLAYER_CONFIG.maxMp;
    this.mp = this.maxMp;
    this.mpRegen = PLAYER_CONFIG.mpRegen;

    // 朝向（用于符卡释放）
    this.facing = { x: 0, y: 1 }; // 默认朝下

    // 符卡系统引用（由GameScene设置）
    this.spellCardSystem = null;

    // 天赋系统引用（由GameScene设置）
    this.talentSystem = null;

    // 快捷符卡槽（存放 spellCardSystem.spellCards 的索引）
    this.quickSlots = [0, 1, 2];

    // 背包（道具 id 列表）
    this.inventory = [];

    // 射击节奏（时间缩放友好）
    this.fireCooldown = 0;
    this.fireInterval = 320;      // 普通移动时的射击间隔(ms)
    this.snipeInterval = 180;     // 狙击时的射击间隔(ms)

    // ========== 自由移动系统 ==========
    this.moveSpeed = 160;         // 像素/秒 移动速度
    this.velocity = { x: 0, y: 0 }; // 当前速度向量
    this.isMovingFree = false;    // 是否正在自由移动

    // ========== 位移技能（冲刺/闪现） ==========
    this.dashCooldown = 0;       // 当前冷却（ms），<=0 表示准备就绪
    this.dashCooldownMax = 2200; // 冷却时长（ms）
    this.dashRangeTiles = 3;     // 最大位移格数
    this.dashInvulnerable = false; // dash 时是否短暂无敌（目前未启用）

    // 碰撞伤害冷却（防止连续受伤）
    this.collisionCooldown = 0;  // ms
    this.collisionCooldownMax = 500; // 碰撞后 500ms 内不再受伤

    // 创建判定点显示（擦弹系统用）
    this.createHitboxIndicator();
  }

  /**
   * 获取判定点位置（在精灵视觉中心）
   */
  getHitboxCenter() {
    const sprite = this.sprite;
    if (!sprite) return { x: this.pixelX, y: this.pixelY };
    // 判定点在精灵的视觉中心（考虑原点在底部中心的情况）
    // 精灵原点通常是 (0.5, 1)，所以中心要往上偏移半个高度
    const centerX = sprite.x;
    const centerY = sprite.y - (sprite.displayHeight || 32) * 0.5;
    return { x: centerX, y: centerY };
  }

  /**
   * 自动锁定最近敌人，返回射击方向（没有则保持原朝向）
   */
  getAutoAimDirection(maxRange = 8) {
    let nearest = null;
    let nearestDist = Infinity;

    for (const enemy of this.scene.enemies) {
      if (!enemy || !enemy.isAlive) continue;
      const dist = Math.abs(enemy.tileX - this.tileX) + Math.abs(enemy.tileY - this.tileY);
      if (dist < nearestDist && dist <= maxRange) {
        nearest = enemy;
        nearestDist = dist;
      }
    }

    if (nearest) {
      const dx = Math.sign(nearest.tileX - this.tileX) || 0;
      const dy = Math.sign(nearest.tileY - this.tileY) || 0;
      // 避免 (0,0) 方向
      return { x: dx === 0 && dy === 0 ? this.facing.x : dx, y: dx === 0 && dy === 0 ? this.facing.y : dy, target: nearest };
    }

    return { x: this.facing.x, y: this.facing.y, target: null };
  }

  /**
   * 创建判定点指示器（显示在角色中心）
   */
  createHitboxIndicator() {
    const center = this.getHitboxCenter();
    // 小红点表示实际判定点
    this.hitboxIndicator = this.scene.add.circle(center.x, center.y, 4, 0xff0000, 0.8);
    this.hitboxIndicator.setDepth(this.sprite.depth + 1);
    // 外圈表示擦弹范围
    this.grazeRing = this.scene.add.circle(center.x, center.y, 16, 0xffff00, 0);
    this.grazeRing.setStrokeStyle(1, 0xffff00, 0.4);
    this.grazeRing.setDepth(this.sprite.depth + 1);
  }

  /**
   * 更新判定点位置
   */
  updateHitboxIndicator() {
    const center = this.getHitboxCenter();
    if (this.hitboxIndicator) {
      this.hitboxIndicator.setPosition(center.x, center.y);
    }
    if (this.grazeRing) {
      this.grazeRing.setPosition(center.x, center.y);
    }
  }

  /**
   * 将道具加入背包（不会自动使用）
   * @param {string} itemId
   */
  addItem(itemId) {
    this.inventory.push(itemId);
  }

  /**
   * 使用背包内道具（通过场景的 ItemSystem 处理效果）
   * @param {number} index
   */
  useItem(index) {
    if (!this.scene || !this.scene.itemSystem) return false;
    return this.scene.itemSystem.useItem(this, index);
  }

  /**
   * 设置符卡系统
   * @param {SpellCardSystem} system
   */
  setSpellCardSystem(system) {
    this.spellCardSystem = system;
  }

  /**
   * 受到伤害（重写以应用天赋防御加成）
   * @param {number} damage
   * @returns {number} 实际受到的伤害
   */
  takeDamage(damage) {
    const effectiveDefense = this.getEffectiveDefense();
    const actualDamage = Math.max(1, damage - effectiveDefense);
    this.hp -= actualDamage;

    // 受击视觉效果
    this.scene.tweens.add({
      targets: this.sprite,
      tint: 0xff0000,
      duration: 100,
      yoyo: true,
      onComplete: () => {
        this.sprite.clearTint();
      }
    });

    if (this.hp <= 0) {
      this.hp = 0;
      this.die();
    }

    return actualDamage;
  }

  /**
   * 设置朝向（不消耗行动）
   * @param {number} dx
   * @param {number} dy
   */
  setFacing(dx, dy) {
    if (dx !== 0 || dy !== 0) {
      this.facing = { x: dx, y: dy };
    }
  }

  /**
   * 开始自由移动（按住方向键时调用）
   * @param {number} dx - X方向 (-1, 0, 1)
   * @param {number} dy - Y方向 (-1, 0, 1)
   */
  startFreeMove(dx, dy) {
    if (dx === 0 && dy === 0) {
      this.stopFreeMove();
      return;
    }

    // 更新朝向
    this.facing = { x: dx, y: dy };

    // 归一化斜向移动速度
    const length = Math.sqrt(dx * dx + dy * dy);
    this.velocity.x = (dx / length) * this.moveSpeed;
    this.velocity.y = (dy / length) * this.moveSpeed;
    this.isMovingFree = true;

    // 通知时间管理器开始行动（持续移动期间保持 ACTION 状态）
    if (this.scene.timeManager && !this._freeMovingAction) {
      this.scene.timeManager.startAction();
      this._freeMovingAction = true;
    }
  }

  /**
   * 停止自由移动（松开方向键时调用）
   */
  stopFreeMove() {
    this.velocity.x = 0;
    this.velocity.y = 0;
    this.isMovingFree = false;

    // 通知时间管理器结束行动
    if (this.scene.timeManager && this._freeMovingAction) {
      this.scene.timeManager.endAction();
      this._freeMovingAction = false;
    }
  }

  /**
   * 自由移动更新（每帧调用）
   * @param {number} delta - 帧间隔(ms)
   */
  updateFreeMove(delta) {
    if (!this.isMovingFree) return;
    if (!this.isAlive) return;

    const dt = delta / 1000; // 转换为秒
    
    // 计算新位置
    let newPixelX = this.pixelX + this.velocity.x * dt;
    let newPixelY = this.pixelY + this.velocity.y * dt;

    // 碰撞检测：检查新位置对应的 tile 是否可通行
    const newTileX = Math.floor(newPixelX / TILE_SIZE);
    const newTileY = Math.floor(newPixelY / TILE_SIZE);

    // 检查水平方向碰撞
    const testTileX = Math.floor((this.pixelX + this.velocity.x * dt) / TILE_SIZE);
    if (!this.scene.canMoveTo(testTileX, this.tileY)) {
      // 水平方向撞墙，停止水平移动
      newPixelX = this.pixelX;
      // 尝试开门
      this.tryOpenDoorAt(testTileX, this.tileY);
    }

    // 检查垂直方向碰撞
    const testTileY = Math.floor((this.pixelY + this.velocity.y * dt) / TILE_SIZE);
    if (!this.scene.canMoveTo(this.tileX, testTileY)) {
      // 垂直方向撞墙，停止垂直移动
      newPixelY = this.pixelY;
      // 尝试开门
      this.tryOpenDoorAt(this.tileX, testTileY);
    }

    // 检查对角碰撞
    const finalTileX = Math.floor(newPixelX / TILE_SIZE);
    const finalTileY = Math.floor(newPixelY / TILE_SIZE);
    if (!this.scene.canMoveTo(finalTileX, finalTileY)) {
      // 对角方向不可通行，保持原位置
      if (this.scene.canMoveTo(finalTileX, this.tileY)) {
        newPixelY = this.pixelY; // 只允许水平移动
      } else if (this.scene.canMoveTo(this.tileX, finalTileY)) {
        newPixelX = this.pixelX; // 只允许垂直移动
      } else {
        newPixelX = this.pixelX;
        newPixelY = this.pixelY;
      }
    }

    // 检查是否碰到敌人
    const enemyAtPos = this.scene.getEnemyAtPixel ? 
      this.scene.getEnemyAtPixel(newPixelX, newPixelY) :
      this.scene.getEnemyAt(Math.floor(newPixelX / TILE_SIZE), Math.floor(newPixelY / TILE_SIZE));
    
    if (enemyAtPos) {
      // 冲刺时直接穿过敌人
      if (this.isDashing) {
        // 不阻挡，继续移动
      } else {
        // 普通移动碰到敌人：受伤 + 弹开（有冷却）
        if (this.collisionCooldown <= 0) {
          const collisionDamage = Math.max(1, Math.floor((enemyAtPos.attack || 5) * 0.2));
          this.takeDamage(collisionDamage);
          this.scene.events.emit('showMessage', `撞到了 ${enemyAtPos.name}！`);
          this.collisionCooldown = this.collisionCooldownMax;
        }
        // 不更新位置，保持原地
        return;
      }
    }

    // 更新位置
    this.pixelX = newPixelX;
    this.pixelY = newPixelY;
    this.sprite.setPosition(this.pixelX, this.pixelY);

    // 更新判定点显示
    this.updateHitboxIndicator();

    // 更新 tile 坐标
    const oldTileX = this.tileX;
    const oldTileY = this.tileY;
    this.tileX = Math.floor(this.pixelX / TILE_SIZE);
    this.tileY = Math.floor(this.pixelY / TILE_SIZE);

    // 如果 tile 改变了，触发相关检查
    if (oldTileX !== this.tileX || oldTileY !== this.tileY) {
      // 更新迷雾
      if (this.scene.fog) {
        this.scene.fog.setBlockers(this.scene.getVisionBlockers());
        this.scene.fog.compute(this.scene.mapData.tiles, this.tileX, this.tileY);
        this.scene.updateFogVisuals();
      }
      // 检查出口
      this.scene.checkExit();
      // 检查陷阱
      try { this.scene.checkTraps(this); } catch (e) {}
      // 检查 Boss 房
      try { this.scene.checkEnterBossRoom(); } catch (e) {}
      // 检查战斗房
      try { this.scene.checkEnterCombatRoom(); } catch (e) {}
      // 检查道具拾取
      try {
        if (this.scene.itemSystem) {
          this.scene.itemSystem.tryPickupAt(this.tileX, this.tileY, this);
        }
      } catch (e) {}
      // 检查神社交互
      try {
        const shrine = this.scene.getShrineAt(this.tileX, this.tileY);
        if (shrine) {
          this.scene.interactWithShrine(shrine);
        }
      } catch (e) {}
    }
  }

  /**
   * 更新技能冷却（每帧调用）
   * @param {number} delta ms
   */
  updateSkills(delta) {
    if (this.dashCooldown > 0) {
      this.dashCooldown = Math.max(0, this.dashCooldown - delta);
    }
    if (this.collisionCooldown > 0) {
      this.collisionCooldown = Math.max(0, this.collisionCooldown - delta);
    }
  }

  /**
   * 主动触发位移技能（空格键触发）
   * 将玩家沿朝向瞬移到最近的可通行格，最多移动 dashRangeTiles
   */
  async tryDash() {
    if (!this.isAlive) return false;
    if (this.dashCooldown > 0) return false; // 未就绪
    if (this.isDashing) return false; // 防止重复冲刺

    // 在冲刺开始时保存当前朝向（防止移动改变方向影响特效）
    const dashDirX = this.facing.x || 0;
    const dashDirY = this.facing.y || 0;
    if (dashDirX === 0 && dashDirY === 0) return false;

    // 冲刺前停止自由移动（避免冲突）
    if (this.isMovingFree) {
      this.stopFreeMove();
    }

    const maxSteps = this.dashRangeTiles;
    let targetTileX = this.tileX;
    let targetTileY = this.tileY;
    let found = false;

    // 沿朝向逐格查找最后一个可通行格（冲刺可以穿过敌人）
    for (let step = 1; step <= maxSteps; step++) {
      const tx = this.tileX + dashDirX * step;
      const ty = this.tileY + dashDirY * step;
      if (!this.scene.canMoveTo(tx, ty)) break;
      // 冲刺可以穿过敌人，不再检查敌人
      targetTileX = tx;
      targetTileY = ty;
      found = true;
    }

    if (!found) return false;

    // 扣冷却
    this.dashCooldown = this.dashCooldownMax;

    // 开始冲刺标记（用于避免冲刺造成伤害）
    this.isDashing = true;

    // 小位移动画目标
    const targetX = targetTileX * TILE_SIZE + TILE_SIZE / 2;
    const targetY = targetTileY * TILE_SIZE + TILE_SIZE / 2 + this.spriteOffsetY;

    // 起点残影
    if (this.scene.screenEffects) {
      this.scene.screenEffects.createAfterImage(this.sprite, 0.7, 280);
    }
    try { if (this.scene.sound) this.scene.sound.play('sfx_dash', { volume: 0.25 }); } catch (e) {}

    // 用于 onUpdate 的帧计数器
    let frameCount = 0;

    await new Promise(resolve => {
      try {
        this.scene.tweens.add({
          targets: this.sprite,
          x: targetX,
          y: targetY,
          duration: 140, // 稍长一点让轨迹更明显
          ease: 'Quad.easeOut',
          onUpdate: () => {
            frameCount++;
            // 每帧都生成粒子（轨迹点）
            if (this.scene.screenEffects) {
              const px = this.sprite.x + (Math.random() - 0.5) * 6;
              const py = this.sprite.y + (Math.random() - 0.5) * 6;
              const p = this.scene.add.circle(px, py, 4 + Math.random() * 3, 0xaaddff, 0.9);
              p.setDepth((this.sprite.depth || 10) - 1);
              p.setBlendMode(Phaser.BlendModes.ADD);
              this.scene.tweens.add({
                targets: p,
                alpha: 0,
                scale: 0.3,
                duration: 200 + Math.random() * 100,
                ease: 'Quad.easeOut',
                onComplete: () => { try { p.destroy(); } catch (e) {} }
              });
            }
            // 每 2 帧生成一个残影
            if (frameCount % 2 === 0 && this.scene.screenEffects) {
              this.scene.screenEffects.createAfterImage(this.sprite, 0.6, 200);
            }
          },
          onComplete: resolve
        });
      } catch (e) { // 若 tween 失败则直接瞬移
        this.sprite.setPosition(targetX, targetY);
        resolve();
      }
    });

    // 更新玩家像素与 tile 坐标
    this.pixelX = targetX;
    this.pixelY = targetY;
    this.tileX = targetTileX;
    this.tileY = targetTileY;
    this.sprite.setPosition(this.pixelX, this.pixelY);
    this.updateHitboxIndicator();

    // 触发踩踏/拾取/陷阱等逻辑
    try { if (this.scene.itemSystem) this.scene.itemSystem.tryPickupAt(this.tileX, this.tileY, this); } catch (e) {}
    try { this.scene.checkTraps(this); } catch (e) {}
    try { this.scene.checkEnterBossRoom(); } catch (e) {}
    try { this.scene.checkEnterCombatRoom(); } catch (e) {}

    // 终点残影
    if (this.scene.screenEffects) {
      this.scene.screenEffects.createAfterImage(this.sprite, 0.7, 280);
    }

    // 结束冲刺标记（稍后清除以避免与冲刺动画重叠触发）
    this.scene.time.delayedCall(80, () => {
      this.isDashing = false;
    });

    return true;
  }

  /**
   * 尝试打开指定位置的门
   */
  tryOpenDoorAt(tileX, tileY) {
    try {
      const door = this.scene.getDoorAt(tileX, tileY);
      if (door && !door.isOpen) {
        if (door.locked) {
          this.scene.events.emit('showMessage', '这扇门被锁住了！');
        } else {
          door.openByTouch();
        }
      }
    } catch (e) {}
  }

  /**
   * 旧版格子移动（保留用于兼容某些特殊情况如瞬步穿透）
   * @param {number} dx - X方向偏移
   * @param {number} dy - Y方向偏移
   * @returns {Promise<boolean>} 是否成功移动
   */
  async move(dx, dy) {
    const newX = this.tileX + dx;
    const newY = this.tileY + dy;

    // 更新朝向
    if (dx !== 0 || dy !== 0) {
      this.facing = { x: dx, y: dy };
    }

    // 检查是否可以移动
    if (!this.scene.canMoveTo(newX, newY)) {
      this.tryOpenDoorAt(newX, newY);
      return false;
    }

    // 检查是否有敌人（瞬步撞击）
    const enemy = this.scene.getEnemyAt(newX, newY);
    if (enemy) {
      await this.dashBash(enemy, dx, dy);
      return true;
    }

    // 通知时间管理器开始行动
    if (this.scene.timeManager) {
      this.scene.timeManager.startAction();
    }

    // 平滑移动
    await this.moveTo(newX, newY);

    // 通知时间管理器结束行动
    if (this.scene.timeManager) {
      this.scene.timeManager.endAction();
    }

    // 检查是否到达出口
    this.scene.checkExit();

    return true;
  }

  /**
   * 撞击敌人：玩家受到小额伤害并弹回
   */
  async dashBash(enemy, dx, dy) {
    // 如果处于技能冲刺期间，忽略碰撞
    if (this.isDashing) {
      return;
    }

    // 记录起点
    const startX = this.sprite.x;
    const startY = this.sprite.y;

    // 受到小额碰撞伤害（敌人攻击力的 20%，最少 1 点）
    const collisionDamage = Math.max(1, Math.floor((enemy.attack || 5) * 0.2));
    this.takeDamage(collisionDamage);

    // 显示碰撞提示
    this.scene.events.emit('showMessage', `撞到了 ${enemy.name}！受到 ${collisionDamage} 点伤害`);

    // 弹回动画
    await new Promise(resolve => {
      this.scene.tweens.add({
        targets: this.sprite,
        x: startX - dx * 8,
        y: startY - dy * 8,
        duration: 80,
        yoyo: true,
        onComplete: resolve
      });
    });
  }

  /**
   * 自动射击（移动时自动发射）
   */
  autoFire() {
    if (!this.scene.bulletManager) return;

    // 找到最近的敌人
    let nearestEnemy = null;
    let nearestDist = Infinity;

    for (const enemy of this.scene.enemies) {
      if (!enemy.isAlive) continue;
      const dist = this.getDistanceTo(enemy);
      if (dist < nearestDist && dist <= 8) { // 8格射程
        nearestDist = dist;
        nearestEnemy = enemy;
      }
    }

    // 发射方向
    let targetX, targetY;
    if (nearestEnemy) {
      targetX = nearestEnemy.pixelX;
      targetY = nearestEnemy.pixelY;
    } else {
      // 朝面朝方向发射
      targetX = this.pixelX + this.facing.x * 100;
      targetY = this.pixelY + this.facing.y * 100;
    }

    // 发射御札
    this.scene.bulletManager.fireAimed(
      this.pixelX,
      this.pixelY,
      targetX,
      targetY,
      200, // 玩家子弹速度更快
      {
        damage: Math.floor(this.getEffectiveAttack() * 0.5),
        texture: 'bullet_player',
        isPlayerBullet: true
      }
    );

    // 播放射击音效
    try {
      if (this.scene.sound) {
        this.scene.sound.play('sfx_shoot', { volume: 0.2 });
      }
    } catch (e) {}
  }

  /**
   * 原地狙击（按住等待键时持续射击）
   */
  snipeFire() {
    // 通知时间管理器进入狙击模式
    if (this.scene.timeManager) {
      this.scene.timeManager.startSnipe();
    }

    // 聚焦射击：重置冷却并立即开火
    this.resetFireCooldown();
    this.autoFire();
  }

  /**
   * 结束狙击模式
   */
  endSnipe() {
    if (this.scene.timeManager) {
      this.scene.timeManager.endSnipe();
    }
  }

  /**
   * 依据时间流逝的射击节奏（不再按每步必射）
   * @param {number} scaledDelta - 经过时间缩放后的 delta(ms)
   * @param {boolean} isSnipe - 是否处于狙击模式
   */
  updateFireTimer(scaledDelta, isSnipe = false) {
    this.fireCooldown -= scaledDelta;
    if (this.fireCooldown <= 0) {
      this.fireCooldown = isSnipe ? this.snipeInterval : this.fireInterval;
      this.autoFire();
    }
  }

  /**
   * 重置射击冷却（用于进入狙击或需要立即开火时）
   */
  resetFireCooldown() {
    this.fireCooldown = 0;
  }

  /**
   * 获取经天赋和装备加成后的实际攻击力
   */
  getEffectiveAttack() {
    let value = this.attack;
    // 天赋加成
    if (this.talentSystem) {
      value = this.talentSystem.getAttack(value);
    }
    // 装备加成
    if (this.equipmentSystem) {
      value += this.equipmentSystem.bonuses.attackFlat;
    }
    return value;
  }

  /**
   * 获取经天赋和装备加成后的实际防御力
   */
  getEffectiveDefense() {
    let value = this.defense;
    // 天赋加成
    if (this.talentSystem) {
      value = this.talentSystem.getDefense(value);
    }
    // 装备加成
    if (this.equipmentSystem) {
      value += this.equipmentSystem.bonuses.defenseFlat;
    }
    return value;
  }

  /**
   * 获取综合暴击率
   */
  getCritChance() {
    let chance = 0;
    if (this.talentSystem) {
      chance += this.talentSystem.bonuses.critChance;
    }
    if (this.equipmentSystem) {
      chance += this.equipmentSystem.bonuses.critChance;
    }
    return chance;
  }

  /**
   * 攻击敌人
   * @param {Enemy} enemy
   */
  async attackEnemy(enemy) {
    let startedAction = false;
    if (this.scene.timeManager) {
      this.scene.timeManager.startAction();
      startedAction = true;
    }

    // 检查是否试图攻击Boss房内的Boss但玩家不在Boss房内
    try {
      if (enemy.isBoss && this.scene.bossRoom && !this.scene.bossRoomLocked) {
        const r = this.scene.bossRoom;
        const px = this.tileX, py = this.tileY;
        const playerInside = (px >= r.x && px < r.x + r.width && py >= r.y && py < r.y + r.height);
        if (!playerInside) {
          this.scene.events.emit('showMessage', '需要进入房间才能攻击首领！');
          if (startedAction && this.scene.timeManager) {
            this.scene.timeManager.endAction();
          }
          return;
        }
      }
    } catch (e) {}

    // 攻击动画 - 向敌人方向冲刺
    const dx = enemy.tileX - this.tileX;
    const dy = enemy.tileY - this.tileY;

    await new Promise(resolve => {
      this.scene.tweens.add({
        targets: this.sprite,
        x: this.sprite.x + dx * 8,
        y: this.sprite.y + dy * 8,
        duration: 50,
        yoyo: true,
        onComplete: resolve
      });
    });

    // 计算伤害（应用天赋+装备加成和暴击）
    let attackValue = this.getEffectiveAttack();
    let isCrit = false;
    const critChance = this.getCritChance();
    if (critChance > 0 && Math.random() < critChance) {
      attackValue = Math.floor(attackValue * 1.5);
      isCrit = true;
    }

    const damage = enemy.takeDamage(attackValue);

    // 显示伤害数字
    this.scene.events.emit('showDamage', {
      x: enemy.sprite.x,
      y: enemy.sprite.y - 20,
      damage: damage,
      isHeal: false,
      isCrit: isCrit
    });

    // 显示消息
    if (enemy.isAlive) {
      const critMsg = isCrit ? '暴击！' : '';
      this.scene.events.emit('showMessage', `${critMsg}对 ${enemy.name} 造成 ${damage} 点伤害！`);
    } else {
      this.scene.events.emit('showMessage', `击败了 ${enemy.name}！`);
      this.scene.removeEnemy(enemy);
    }

    if (startedAction && this.scene.timeManager) {
      this.scene.timeManager.endAction();
    }
  }

  /**
   * 使用符卡
   * @param {number} index - 符卡索引
   * @returns {boolean} 是否成功使用
   */
  useSpellCard(index) {
    if (!this.spellCardSystem) return false;
    // 使用快捷槽映射到实际的 spellCards 索引
    const mappedIndex = (this.quickSlots && this.quickSlots[index] !== undefined) ? this.quickSlots[index] : index;
    const spellCard = this.spellCardSystem.getSpellCard(mappedIndex);
    if (!spellCard) return false;

    // 检查是否可以使用
    if (!spellCard.canUse(this.mp)) {
      if (this.mp < spellCard.mpCost) {
        this.scene.events.emit('showMessage', '灵力不足！');
      } else {
        this.scene.events.emit('showMessage', `${spellCard.name} 正在冷却中...`);
      }
      return false;
    }

    // 消耗灵力
    this.mp -= spellCard.mpCost;

    // 自动瞄准最近敌人方向（若有）
    const aim = this.getAutoAimDirection(spellCard.range || 8);

    // 根据符卡类型使用
    let result;
    if (spellCard.type === 'bounce') {
      // 反弹型符卡使用朝向
      result = spellCard.use(this, { x: aim.x, y: aim.y });
    } else if (spellCard.type === 'barrier') {
      // 结界型符卡放置在前方
      result = spellCard.use(this, { x: aim.x, y: aim.y });
    } else if (spellCard.type === 'homing') {
      // 追踪型符卡自动寻敌
      result = spellCard.use(this);

      // 追踪型特殊处理
      if (result && result.noTarget) {
        // 没有目标，返还灵力
        this.mp += spellCard.mpCost;
        return false;
      }
    }

    // 处理位置伤害（非穿透/非追踪类由 Player 立即判定）
    if (result && result.positions && result.positions.length > 0 && !result.isHoming && !result.piercing) {
      this.processSpellCardDamage(result);
    }

    // 进入冷却
    spellCard.startCooldown();

    // 显示消息
    this.scene.events.emit('showMessage', `使用了 ${spellCard.name}！`);

    return true;
  }

  /**
   * 设置快捷槽的映射：将槽 slotIndex 指向 spellIndex（spellCardSystem 的索引）
   */
  setQuickSlot(slotIndex, spellIndex) {
    if (!this.quickSlots) this.quickSlots = [0,1,2];
    if (slotIndex < 0 || slotIndex >= this.quickSlots.length) return false;
    this.quickSlots[slotIndex] = spellIndex;
    return true;
  }

  /**
   * 处理符卡伤害
   * @param {Object} result
   */
  processSpellCardDamage(result) {
    // 如果是穿透/反弹类符卡，按照命中次数叠加伤害
    if (result.piercing) {
      const posKey = p => `${p.x},${p.y}`;
      const hitCounts = {};
      for (const p of result.positions) {
        const k = posKey(p);
        hitCounts[k] = (hitCounts[k] || 0) + 1;
      }

      for (const enemy of this.scene.enemies.slice()) {
        if (!enemy.isAlive) continue;
        const k = `${enemy.tileX},${enemy.tileY}`;
        const hits = hitCounts[k] || 0;
        if (hits <= 0) continue;

        const totalDamage = enemy.takeDamage(result.damage * hits);

        this.scene.events.emit('showDamage', {
          x: enemy.sprite.x,
          y: enemy.sprite.y - 20,
          damage: totalDamage,
          isHeal: false
        });

        if (!enemy.isAlive) {
          this.scene.events.emit('showMessage', `${enemy.name} 被符卡击败！`);
          this.scene.removeEnemy(enemy);
        }
      }

      // 同时检查障碍物
      try {
        for (const pos of result.positions) {
          const obstacle = this.scene.getObstacleAt(pos.x, pos.y);
          if (obstacle && obstacle.isAlive) {
            obstacle.takeDamage(result.damage);
          }
        }
      } catch (e) {}
    } else {
      const enemies = this.scene.getEnemiesInPositions(result.positions);

      for (const enemy of enemies) {
        const damage = enemy.takeDamage(result.damage);

        this.scene.events.emit('showDamage', {
          x: enemy.sprite.x,
          y: enemy.sprite.y - 20,
          damage: damage,
          isHeal: false
        });

        if (!enemy.isAlive) {
          this.scene.events.emit('showMessage', `${enemy.name} 被符卡击败！`);
          this.scene.removeEnemy(enemy);
        }
      }

      // 同时检查障碍物
      try {
        for (const pos of result.positions) {
          const obstacle = this.scene.getObstacleAt(pos.x, pos.y);
          if (obstacle && obstacle.isAlive) {
            obstacle.takeDamage(result.damage);
          }
        }
      } catch (e) {}
    }
  }

  /**
   * 等待（跳过回合） - 改为狙击模式：原地射击
   */
  wait() {
    // 通知时间管理器开始狙击
    if (this.scene.timeManager) {
      this.scene.timeManager.startSnipe();
    }

    // 狙击射击：立即一发，并让冷却归零以持续按节奏射击
    this.resetFireCooldown();
    this.autoFire();

    // 通知时间管理器结束狙击
    if (this.scene.timeManager) {
      this.scene.timeManager.endSnipe();
    }

    this.scene.events.emit('showMessage', '灵梦原地狙击！');
  }

  /**
   * 回合结束时的恢复
   */
  onTurnEnd() {
    // 恢复灵力
    this.mp = Math.min(this.maxMp, this.mp + this.mpRegen);
  }

  /**
   * 获取实时灵力回复速率（每秒），叠加装备/天赋加成
   */
  getEffectiveMpRegenPerSec() {
    let regen = this.mpRegen || 0;
    const equipBonus = this.equipmentSystem ? this.equipmentSystem.bonuses || {} : {};
    const talentBonus = this.talentSystem ? this.talentSystem.bonuses || {} : {};

    if (talentBonus.mpRegenMult) regen *= talentBonus.mpRegenMult;
    if (equipBonus.mpRegenMult) regen *= equipBonus.mpRegenMult;
    if (equipBonus.mpRegen) regen += equipBonus.mpRegen;

    return regen;
  }

  /**
   * 获取玩家状态
   * @returns {Object}
   */
  getStats() {
    return {
      hp: this.hp,
      maxHp: this.maxHp,
      mp: this.mp,
      maxMp: this.maxMp,
      attack: this.attack,
      defense: this.defense,
      speed: this.speed,
      position: { x: this.tileX, y: this.tileY }
    };
  }
}
