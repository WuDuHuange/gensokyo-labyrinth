/**
 * 敌人基类
 * 支持向量弹幕发射
 */
import Entity from './Entity.js';
import { TILE_SIZE } from '../config/gameConfig.js';
import { BulletPattern, BULLET_CONFIG } from '../systems/BulletManager.js';

export default class Enemy extends Entity {
  constructor(scene, x, y, texture, config) {
    super(scene, x, y, texture, config);
    
    this.isPlayer = false;
    this.aiState = 'idle'; // idle, chase, attack, retreat
    this.detectionRange = config.detectionRange || 8;
    this.attackRange = config.attackRange || 1;
    this.expReward = config.expReward || 10;
    this.roomDetectThreshold = config.roomDetectThreshold || 2;
    // 是否已锁定（开始追逐/攻击玩家），锁定后允许离开房间追击
    this.lockedOnPlayer = false;
    
    // ===== 向量弹幕系统配置 =====
    this.danmakuEnabled = config.danmakuEnabled || false;
    this.danmakuPattern = config.danmakuPattern || BulletPattern.AIMED;
    this.danmakuSpeed = config.danmakuSpeed || BULLET_CONFIG.BASE_SPEED;
    this.danmakuCount = config.danmakuCount || 3;
    this.danmakuSpread = config.danmakuSpread || Math.PI / 4; // 扇形角度
    this.danmakuCooldown = config.danmakuCooldown || 2; // 射击冷却（回合）
    this.danmakuRange = config.danmakuRange || 5; // 射程（格子）
    this.danmakuDamage = config.danmakuDamage || Math.floor((config.attack || 10) * 0.6);
    this.currentCooldown = 0;
    this.isCharging = false; // 是否正在充能

    // 自由移动参数（像素移动，完全脱离格子步进）
    this.moveSpeed = config.moveSpeed || this.speed || 100; // 像素/秒
    this.moveTarget = null; // { x, y } 像素坐标
  }

  /**
   * AI行动
   * @param {Player} player 
   */
  async act(player) {
    if (!this.isAlive || !player.isAlive) return;
    
    // 如果该敌人有绑定的房间信息，则要求玩家先接近房间才会触发索敌/追逐
    const ROOM_DETECT_THRESHOLD = this.roomDetectThreshold || 2;
    if (this.room) {
      const px = player.tileX;
      const py = player.tileY;
      const rx1 = this.room.x - ROOM_DETECT_THRESHOLD;
      const ry1 = this.room.y - ROOM_DETECT_THRESHOLD;
      const rx2 = this.room.x + this.room.width - 1 + ROOM_DETECT_THRESHOLD;
      const ry2 = this.room.y + this.room.height - 1 + ROOM_DETECT_THRESHOLD;

      // 计算玩家到房间边界的曼哈顿距离（如果在扩展矩形内则为 0）
      let dx = 0;
      if (px < rx1) dx = rx1 - px;
      else if (px > rx2) dx = px - rx2;
      let dy = 0;
      if (py < ry1) dy = ry1 - py;
      else if (py > ry2) dy = py - ry2;
      const distToRoom = dx + dy;

      if (distToRoom > ROOM_DETECT_THRESHOLD) {
        // 玩家离房间太远，保持或巡逻而不主动追逐
        // 注意：不要在玩家短暂离开房间时立即解除锁定，已锁定的敌人应继续追击以防被卡位。
        await this.idle();
        return;
      }
    }

    const distance = this.getDistanceTo(player);

    // 进入检测距离视为锁定开始，可以离开房间追击
    if (distance <= this.detectionRange) {
      this.lockedOnPlayer = true;
    } else if (distance > this.detectionRange * 3) {
      // 只有当玩家远离到检测范围的三倍时，才解除锁定，使玩家不能轻易通过退回房间卡位
      this.lockedOnPlayer = false;
    }

    // 根据距离决定行为
    if (distance <= this.attackRange) {
      // 在攻击范围内，攻击玩家
      await this.attackPlayer(player);
    } else if (distance <= this.detectionRange) {
      // 在检测范围内，追逐玩家
      await this.chasePlayer(player);
    } else {
      // 超出范围，随机移动或待命
      await this.idle();
    }
  }
  /**
   * 攻击玩家
   * @param {Player} player 
   */
  async attackPlayer(player) {
    this.aiState = 'attack';
    // 攻击前先停下
    this.stopMovement();

    // 攻击动画（短冲）
    const dx = player.tileX - this.tileX;
    const dy = player.tileY - this.tileY;
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

    // 造成伤害
    const damage = player.takeDamage(this.attack);

    // 显示伤害数字
    this.scene.events.emit('showDamage', {
      x: player.sprite.x,
      y: player.sprite.y - 20,
      damage: damage,
      isHeal: false
    });

    this.scene.events.emit('showMessage', `${this.name} 攻击灵梦，造成 ${damage} 点伤害！`);
  }


  /**
   * 追逐玩家
   * @param {Player} player 
   */
  async chasePlayer(player) {
    this.aiState = 'chase';
    
    // 直接朝向玩家像素位置；若存在路径finder则使用下一节点的像素中心作为引导
    const path = this.scene.findPath ? this.scene.findPath(this.tileX, this.tileY, player.tileX, player.tileY) : null;
    if (path && path.length > 1) {
      const next = path[1];
      this.setMoveTargetPixel(next.x * TILE_SIZE + TILE_SIZE / 2, next.y * TILE_SIZE + TILE_SIZE / 2 + this.spriteOffsetY);
      return;
    }

    // 无路径时直接朝玩家像素位置追击
    this.setMoveTargetPixel(player.pixelX, player.pixelY);
  }

  /**
   * 沿路径逐步移动（包含起点，需 >=2 才有移动）
   */
  async moveAlongPath(path) {
    if (!path || path.length < 2) return;
    // 跳过第 0 个（当前格）
    for (let i = 1; i < path.length; i++) {
      const step = path[i];
      this.setMoveTargetPixel(step.x * TILE_SIZE + TILE_SIZE / 2, step.y * TILE_SIZE + TILE_SIZE / 2 + this.spriteOffsetY);
    }
  }

  /**
   * 获取可能的移动选项，按优先级排序
   * @param {Player} player 
   * @returns {Array}
   */
  /**
   * 获取可能的移动选项，按优先级排序
   * 可选参数：restrictToRoom - 是否限制返回仅在所属房间内的移动
   */
  // 基于格子的旧逻辑已废弃，改为像素级移动
  getPossibleMoves() { return []; }

  /**
   * 设置移动目标（像素坐标）
   */
  setMoveTargetPixel(x, y) {
    this.moveTarget = { x, y };
  }

  /**
   * 停止移动
   */
  stopMovement() {
    this.moveTarget = null;
  }

  /**
   * 自由移动更新（每帧）
   * @param {number} delta - 毫秒
   */
  updateFreeMove(delta) {
    if (!this.moveTarget || !this.isAlive) return;

    const dt = delta / 1000;
    // 根据 AI 状态决定实时目标（实现决策/运动分离）
    let targetPixelX = this.moveTarget.x;
    let targetPixelY = this.moveTarget.y;

    try {
      const player = this.scene && this.scene.player;
      if (player && player.isAlive) {
        if (this.aiState === 'chase' || this.aiState === 'approach') {
          // 持续追踪玩家像素位置
          targetPixelX = player.pixelX;
          targetPixelY = player.pixelY;
        } else if (this.aiState === 'retreat') {
          // 远离玩家一个小偏移量（朝相反方向移动）
          const vx = this.pixelX - player.pixelX;
          const vy = this.pixelY - player.pixelY;
          const vlen = Math.max(0.001, Math.sqrt(vx*vx + vy*vy));
          const awayDist = TILE_SIZE * 1.2;
          targetPixelX = this.pixelX + (vx / vlen) * awayDist;
          targetPixelY = this.pixelY + (vy / vlen) * awayDist;
        }
      }
    } catch (e) {}

    const dx = targetPixelX - this.pixelX;
    const dy = targetPixelY - this.pixelY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 1) {
      // 抵达
      this.pixelX = targetPixelX;
      this.pixelY = targetPixelY;
      this.tileX = Math.floor(this.pixelX / TILE_SIZE);
      this.tileY = Math.floor(this.pixelY / TILE_SIZE);
      this.sprite.setPosition(this.pixelX, this.pixelY);
      this.stopMovement();
      return;
    }

    const step = this.moveSpeed * dt;
    const ratio = step >= dist ? 1 : step / dist;
    const nextX = this.pixelX + dx * ratio;
    const nextY = this.pixelY + dy * ratio;

    const nextTileX = Math.floor(nextX / TILE_SIZE);
    const nextTileY = Math.floor(nextY / TILE_SIZE);

    // 碰撞与敌人占位检查
    const blocked = !this.scene.canMoveTo(nextTileX, nextTileY);
    const enemyBlocking = this.scene.getEnemyAt(nextTileX, nextTileY);
    if (blocked || (enemyBlocking && enemyBlocking !== this)) {
      this.stopMovement();
      return;
    }

    this.pixelX = nextX;
    this.pixelY = nextY;
    this.tileX = nextTileX;
    this.tileY = nextTileY;
    this.sprite.setPosition(this.pixelX, this.pixelY);
  }

  /**
   * 空闲行为
   */
  async idle() {
    this.aiState = 'idle';
    
    // 30%概率随机移动
    if (Math.random() < 0.3) {
      const directions = [
        { x: 0, y: -1 },
        { x: 0, y: 1 },
        { x: -1, y: 0 },
        { x: 1, y: 0 }
      ];
      
      // 随机打乱方向
      directions.sort(() => Math.random() - 0.5);
      
      for (const dir of directions) {
        const newX = this.tileX + dir.x;
        const newY = this.tileY + dir.y;
        // 如果未锁定玩家且有所属房间信息，则不允许走出房间
        if (!this.lockedOnPlayer && this.room) {
          if (newX < this.room.x || newX >= this.room.x + this.room.width || newY < this.room.y || newY >= this.room.y + this.room.height) {
            continue;
          }
        }

        if (this.scene.canMoveTo(newX, newY) && !this.scene.getEnemyAt(newX, newY)) {
          this.setMoveTargetPixel(newX * TILE_SIZE + TILE_SIZE / 2, newY * TILE_SIZE + TILE_SIZE / 2 + this.spriteOffsetY);
          break;
        }
      }
    }
  }

  // ===== 向量弹幕系统方法 =====

  /**
   * 获取到玩家的角度
   */
  getAngleToPlayer(player) {
    const dx = player.pixelX - this.pixelX;
    const dy = player.pixelY - this.pixelY;
    return Math.atan2(dy, dx);
  }

  /**
   * 检查玩家是否在弹幕射程内
   */
  isPlayerInDanmakuRange(player) {
    const distance = this.getDistanceTo(player);
    return distance <= this.danmakuRange;
  }

  /**
   * 发射向量弹幕
   */
  fireDanmaku(player) {
    const bulletManager = this.scene.bulletManager;
    if (!bulletManager) return;

    const baseAngle = this.getAngleToPlayer(player);
    const bulletConfig = {
      damage: this.danmakuDamage,
      owner: this
    };

    switch (this.danmakuPattern) {
      case BulletPattern.AIMED:
        bulletManager.fireAimed(
          this.pixelX, this.pixelY,
          player.pixelX, player.pixelY,
          this.danmakuSpeed,
          bulletConfig
        );
        break;

      case BulletPattern.SPREAD:
        bulletManager.fireSpread(
          this.pixelX, this.pixelY,
          baseAngle,
          this.danmakuCount,
          this.danmakuSpread,
          this.danmakuSpeed,
          bulletConfig
        );
        break;

      case BulletPattern.RING:
        bulletManager.fireRing(
          this.pixelX, this.pixelY,
          this.danmakuCount,
          this.danmakuSpeed,
          bulletConfig
        );
        break;

      case BulletPattern.SPIRAL:
        bulletManager.fireSpiral(
          this.pixelX, this.pixelY,
          this.danmakuCount,
          this.danmakuSpeed,
          0.5, // 角速度
          bulletConfig
        );
        break;

      case BulletPattern.RANDOM:
        for (let i = 0; i < this.danmakuCount; i++) {
          const randomAngle = Math.random() * Math.PI * 2;
          bulletManager.fire(
            this.pixelX, this.pixelY,
            randomAngle,
            this.danmakuSpeed * (0.8 + Math.random() * 0.4),
            bulletConfig
          );
        }
        break;

      default:
        bulletManager.fireAimed(
          this.pixelX, this.pixelY,
          player.pixelX, player.pixelY,
          this.danmakuSpeed,
          bulletConfig
        );
    }

    // 射击视觉效果
    this.showShootEffect();
    
    // 重置冷却
    this.currentCooldown = this.danmakuCooldown;
  }

  /**
   * 显示射击视觉效果
   */
  showShootEffect() {
    try {
      // 闪光
      this.scene.tweens.add({
        targets: this.sprite,
        alpha: { from: 1, to: 0.6 },
        duration: 50,
        yoyo: true
      });

      // 枪口闪光
      const flash = this.scene.add.circle(this.pixelX, this.pixelY, 12, 0xff6666, 0.8);
      flash.setDepth(this.sprite.depth + 1);

      this.scene.tweens.add({
        targets: flash,
        alpha: 0,
        scale: 2,
        duration: 100,
        onComplete: () => flash.destroy()
      });
    } catch (e) {
      // 忽略效果错误
    }
  }

  /**
   * 显示充能提示
   */
  showChargingEffect() {
    if (this.isCharging) return;
    this.isCharging = true;

    try {
      // 红色闪烁警告
      this.scene.tweens.add({
        targets: this.sprite,
        tint: { from: 0xffffff, to: 0xff4444 },
        duration: 200,
        yoyo: true,
        repeat: 2,
        onComplete: () => {
          if (this.sprite) {
            this.sprite.clearTint();
          }
          this.isCharging = false;
        }
      });

      // 显示警告线
      if (this.scene.player) {
        const warningLine = this.scene.add.graphics();
        warningLine.lineStyle(2, 0xff4444, 0.4);
        warningLine.lineBetween(
          this.pixelX, this.pixelY,
          this.scene.player.pixelX, this.scene.player.pixelY
        );
        warningLine.setDepth(5);

        this.scene.tweens.add({
          targets: warningLine,
          alpha: 0,
          duration: 400,
          onComplete: () => warningLine.destroy()
        });
      }
    } catch (e) {
      this.isCharging = false;
    }
  }

  /**
   * 死亡时释放殉爆弹幕
   */
  die() {
    this.stopMovement();
    // 如果启用弹幕，死亡时放出小规模扩散弹
    if (this.danmakuEnabled && this.scene.bulletManager) {
      this.scene.bulletManager.fireRing(
        this.pixelX, this.pixelY,
        4, // 4发
        this.danmakuSpeed * 0.5,
        { damage: Math.floor(this.danmakuDamage * 0.3), owner: null }
      );
    }

    // 调用父类
    super.die();
  }
}
