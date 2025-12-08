/**
 * 实体基类
 * 所有游戏对象的基类
 */
import { TILE_SIZE } from '../config/gameConfig.js';

export default class Entity {
  constructor(scene, x, y, texture, config = {}) {
    this.scene = scene;
    this.tileX = x;
    this.tileY = y;
    
    // 创建精灵
    this.sprite = scene.add.sprite(
      x * TILE_SIZE + TILE_SIZE / 2,
      y * TILE_SIZE + TILE_SIZE / 2,
      texture
    );
    
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
  }

  /**
   * 移动到指定瓦片位置
   * @param {number} tileX 
   * @param {number} tileY 
   * @param {boolean} animate - 是否使用动画
   * @returns {Promise}
   */
  moveTo(tileX, tileY, animate = true) {
    return new Promise((resolve) => {
      this.tileX = tileX;
      this.tileY = tileY;
      
      const targetX = tileX * TILE_SIZE + TILE_SIZE / 2;
      const targetY = tileY * TILE_SIZE + TILE_SIZE / 2;
      
      if (animate) {
        // 玩家移动稍慢一点，敌人移动更快
        const duration = this.isPlayer ? 80 : 15;
        this.scene.tweens.add({
          targets: this.sprite,
          x: targetX,
          y: targetY,
          duration: duration,
          ease: 'Linear',
          onComplete: () => resolve()
        });
      } else {
        this.sprite.setPosition(targetX, targetY);
        resolve();
      }
    });
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
