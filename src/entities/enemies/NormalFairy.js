/**
 * 普通妖精
 * 使用向量弹幕系统 - 自机狙（单发朝玩家）
 */
import Enemy from '../Enemy.js';
import { ENEMY_CONFIG } from '../../config/gameConfig.js';
import { BulletPattern } from '../../systems/BulletManager.js';

export default class NormalFairy extends Enemy {
  constructor(scene, x, y) {
    super(scene, x, y, 'normalFairy', {
      name: ENEMY_CONFIG.normalFairy.name,
      hp: ENEMY_CONFIG.normalFairy.hp,
      attack: ENEMY_CONFIG.normalFairy.attack,
      defense: ENEMY_CONFIG.normalFairy.defense,
      speed: ENEMY_CONFIG.normalFairy.speed,
      expReward: ENEMY_CONFIG.normalFairy.expReward,
      detectionRange: 8,
      attackRange: 4,
      // 向量弹幕配置
      danmakuEnabled: true,
      danmakuPattern: BulletPattern.AIMED,
      danmakuSpeed: 80,
      danmakuCount: 1,
      danmakuCooldown: 2,
      danmakuRange: 5,
      danmakuDamage: 8
    });
  }

  /**
   * 重写AI行动
   * 普通妖精：追击 + 远程自机狙
   */
  async act(player) {
    if (!this.isAlive || !player.isAlive) return;

    const distance = this.getDistanceTo(player);

    // 冷却递减
    if (this.currentCooldown > 0) {
      this.currentCooldown--;
    }

    // 在攻击范围内优先近战
    if (distance <= 1) {
      await this.attackPlayer(player);
      return;
    }

    // 在弹幕射程内发射自机狙
    if (distance <= this.danmakuRange && this.currentCooldown <= 0) {
      // 下回合预警
      if (this.currentCooldown === 1) {
        this.showChargingEffect();
      }
      this.fireDanmaku(player);
      return;
    }

    // 追击
    if (distance <= this.detectionRange) {
      await this.chasePlayer(player);
      return;
    }

    await this.idle();
  }
}
