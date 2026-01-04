/**
 * 实体基类
 * 所有游戏对象的基类
 * 
 * Superhot 重构：支持平滑移动和实时 Hitbox
 */
import { TILE_SIZE } from '../config/gameConfig.js';
import { SPRITE_CONFIG, getSpriteScale, getSpriteConfig } from '../config/spriteConfig.js';
import { TIME_CONFIG } from '../systems/TimeScaleManager.js';

export default class Entity {
  constructor(scene, x, y, texture, config = {}) {
    this.scene = scene;
    this.tileX = x;
    this.tileY = y;
    this.textureName = texture;
    
    // 获取精灵配置
    const useCustomSprite = SPRITE_CONFIG.useCustomSprite;
    const spriteConfig = getSpriteConfig(texture);
    const scale = useCustomSprite ? getSpriteScale(texture) : 1;
    const offsetY = useCustomSprite ? (spriteConfig.offsetY || 0) : 0;
    
    // 计算精灵位置（考虑原点偏移）
    const baseX = x * TILE_SIZE + TILE_SIZE / 2;
    const baseY = y * TILE_SIZE + TILE_SIZE / 2 + offsetY;
    
    // 创建精灵
    this.sprite = scene.add.sprite(baseX, baseY, texture);
    
    // 应用自定义精灵配置
    if (useCustomSprite) {
      this.sprite.setScale(scale);
      this.sprite.setOrigin(spriteConfig.originX, spriteConfig.originY);
    }
    
    // 保存偏移量用于移动计算
    this.spriteOffsetY = offsetY;
    
    // ========== Superhot: 实时位置与 Hitbox ==========
    // 像素坐标（实时位置，用于碰撞检测）
    this.pixelX = baseX;
    this.pixelY = baseY;
    
    // Hitbox 半径（用于弹幕碰撞）
    this.hitboxRadius = config.hitboxRadius || 8;
    
    // 是否正在移动中（平滑补间期间）
    this.isMoving = false;
    
    // 移动起点和终点（用于插值）
    this.moveStartX = baseX;
    this.moveStartY = baseY;
    this.moveEndX = baseX;
    this.moveEndY = baseY;
    this.moveProgress = 0; // 0 ~ 1
    this.moveDuration = TIME_CONFIG.MOVE_DURATION;
    
    // 当前移动 tween 引用
    this.moveTween = null;
    
    // 呼吸/跳动动画
    this.breatheTween = null;
    // ================================================
    
    // 基础属性
    this.name = config.name || 'Entity';
    this.maxHp = config.hp || 100;
    this.hp = this.maxHp;
    this.attack = config.attack || 10;
    this.defense = config.defense || 0;
    this.speed = config.speed || 100;
    
    // 行动点数（用于行动队列）
    this.actionPoints = 0;
    
    // 状态
    this.isAlive = true;
    this.isPlayer = false;
    
    // 启动呼吸动画
    this.startBreatheAnimation();
  }
  
  /**
   * 启动呼吸/跳动动画（静止时更明显）
   */
  startBreatheAnimation() {
    if (this.breatheTween) return;
    
    try {
      this.breatheTween = this.scene.tweens.add({
        targets: this.sprite,
        scaleY: { from: this.sprite.scaleY, to: this.sprite.scaleY * 1.02 },
        duration: 800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    } catch (e) {}
  }
  
  /**
   * 停止呼吸动画
   */
  stopBreatheAnimation() {
    if (this.breatheTween) {
      try {
        this.breatheTween.stop();
        this.breatheTween = null;
      } catch (e) {}
    }
  }

  /**
   * 移动到指定瓦片位置（Superhot 重构：平滑补间 + 实时 Hitbox）
   * @param {number} tileX 
   * @param {number} tileY 
   * @param {boolean} animate - 是否使用动画
   * @returns {Promise}
   */
  moveTo(tileX, tileY, animate = true) {
    return new Promise((resolve) => {
      // 保存起点
      this.moveStartX = this.pixelX;
      this.moveStartY = this.pixelY;
      
      // 计算终点
      const targetX = tileX * TILE_SIZE + TILE_SIZE / 2;
      const targetY = tileY * TILE_SIZE + TILE_SIZE / 2 + this.spriteOffsetY;
      
      this.moveEndX = targetX;
      this.moveEndY = targetY;
      
      // 更新逻辑坐标（立即）
      this.tileX = tileX;
      this.tileY = tileY;
      
      if (animate) {
        this.isMoving = true;
        this.moveProgress = 0;
        
        // 使用 Superhot 风格的移动时长（玩家更长以便观察）
        const duration = this.isPlayer ? this.moveDuration : Math.min(this.moveDuration * 0.3, 60);
        
        // 取消之前的移动 tween
        if (this.moveTween) {
          try { this.moveTween.stop(); } catch (e) {}
        }
        
        this.moveTween = this.scene.tweens.add({
          targets: this,
          moveProgress: 1,
          duration: duration,
          ease: 'Quad.easeOut',
          onUpdate: () => {
            // 实时更新像素位置和精灵位置
            this.pixelX = Phaser.Math.Linear(this.moveStartX, this.moveEndX, this.moveProgress);
            this.pixelY = Phaser.Math.Linear(this.moveStartY, this.moveEndY, this.moveProgress);
            this.sprite.setPosition(this.pixelX, this.pixelY);
          },
          onComplete: () => {
            this.isMoving = false;
            this.pixelX = targetX;
            this.pixelY = targetY;
            this.sprite.setPosition(targetX, targetY);
            this.moveTween = null;
            resolve();
          }
        });
      } else {
        // 瞬移
        this.pixelX = targetX;
        this.pixelY = targetY;
        this.sprite.setPosition(targetX, targetY);
        this.isMoving = false;
        resolve();
      }
    });
  }
  
  /**
   * 获取当前 Hitbox 中心位置（像素坐标）
   * 用于弹幕碰撞检测
   */
  getHitboxCenter() {
    return { x: this.pixelX, y: this.pixelY };
  }
  
  /**
   * 检测与弹幕的碰撞
   * @param {number} bulletX 
   * @param {number} bulletY 
   * @param {number} bulletRadius 
   * @returns {boolean}
   */
  checkBulletCollision(bulletX, bulletY, bulletRadius) {
    const dx = bulletX - this.pixelX;
    const dy = bulletY - this.pixelY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return dist < (this.hitboxRadius + bulletRadius);
  }

  /**
   * 受到伤害
   * @param {number} damage 
   * @returns {number} 实际受到的伤害
   */
  takeDamage(damage) {
    const actualDamage = Math.max(1, damage - this.defense);
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
   * 恢复生命值
   * @param {number} amount 
   */
  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  /**
   * 死亡处理
   */
  die() {
    this.isAlive = false;
    
    // 死亡动画
    this.scene.tweens.add({
      targets: this.sprite,
      alpha: 0,
      scale: 0.5,
      duration: 300,
      onComplete: () => {
        this.sprite.destroy();
      }
    });
  }

  /**
   * 获取到目标的距离（曼哈顿距离）
   * @param {Entity} target 
   * @returns {number}
   */
  getDistanceTo(target) {
    return Math.abs(this.tileX - target.tileX) + Math.abs(this.tileY - target.tileY);
  }

  /**
   * 获取到目标的方向
   * @param {Entity} target 
   * @returns {{x: number, y: number}}
   */
  getDirectionTo(target) {
    const dx = target.tileX - this.tileX;
    const dy = target.tileY - this.tileY;
    
    return {
      x: dx === 0 ? 0 : (dx > 0 ? 1 : -1),
      y: dy === 0 ? 0 : (dy > 0 ? 1 : -1)
    };
  }

  /**
   * 销毁实体
   */
  destroy() {
    if (this.sprite) {
      this.sprite.destroy();
    }
  }
}
