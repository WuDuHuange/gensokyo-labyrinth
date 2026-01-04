/**
 * 快速妖精
 * 速度快 + 随机散射弹幕
 */
import Enemy from '../Enemy.js';
import { ENEMY_CONFIG } from '../../config/gameConfig.js';
import { BulletPattern } from '../../systems/BulletManager.js';

export default class FastFairy extends Enemy {
  constructor(scene, x, y) {
    super(scene, x, y, 'fastFairy', {
      name: ENEMY_CONFIG.fastFairy.name,
      hp: ENEMY_CONFIG.fastFairy.hp,
      attack: ENEMY_CONFIG.fastFairy.attack,
      defense: ENEMY_CONFIG.fastFairy.defense,
      speed: ENEMY_CONFIG.fastFairy.speed,
      expReward: ENEMY_CONFIG.fastFairy.expReward,
      detectionRange: 10,
      attackRange: 1,
      // 向量弹幕配置 - 随机散射
      danmakuEnabled: true,
      danmakuPattern: BulletPattern.RANDOM,
      danmakuSpeed: 120,
      danmakuCount: 4,
      danmakuCooldown: 3,
      danmakuRange: 4,
      danmakuDamage: 6
    });
  }

  /**
   * 快速妖精：移动优先，偶尔随机射击
   */
  async act(player) {
    if (!this.isAlive || !player.isAlive) return;

    const distance = this.getDistanceTo(player);

    // 冷却递减
    if (this.currentCooldown > 0) {
      this.currentCooldown--;
    }

    // 近战优先
    if (distance <= 1) {
      await this.attackPlayer(player);
      return;
    }

    // 在范围内：先移动再射击（移动时射击）
    if (distance <= this.detectionRange) {
      await this.chasePlayer(player);
      
      // 移动后射击
      if (distance <= this.danmakuRange && this.currentCooldown <= 0) {
        this.fireDanmaku(player);
      }
      return;
    }

    await this.idle();
  }
}
