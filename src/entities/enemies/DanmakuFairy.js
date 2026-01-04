/**
 * 弹幕妖精
 * 使用向量弹幕系统发射扇形弹幕
 */
import Enemy from '../Enemy.js';
import { ENEMY_CONFIG, TILE_SIZE } from '../../config/gameConfig.js';
import { BulletPattern } from '../../systems/BulletManager.js';

export default class DanmakuFairy extends Enemy {
  constructor(scene, x, y) {
    super(scene, x, y, 'danmakuFairy', {
      name: ENEMY_CONFIG.danmakuFairy.name,
      hp: ENEMY_CONFIG.danmakuFairy.hp,
      attack: ENEMY_CONFIG.danmakuFairy.attack,
      defense: ENEMY_CONFIG.danmakuFairy.defense,
      speed: ENEMY_CONFIG.danmakuFairy.speed,
      expReward: ENEMY_CONFIG.danmakuFairy.expReward,
      detectionRange: 8,
      attackRange: 5,  // 远程攻击范围
      // 向量弹幕配置
      danmakuEnabled: true,
      danmakuPattern: BulletPattern.SPREAD,
      danmakuSpeed: 100,
      danmakuCount: 5,
      danmakuSpread: Math.PI / 3, // 60度扇形
      danmakuCooldown: 2,
      danmakuRange: 6,
      danmakuDamage: 12
    });
    
    this.preferredDistance = 3; // 保持与玩家的理想距离
  }

  /**
   * 重写AI行动
   * 弹幕妖精的行为：
   * 1. 优先保持安全距离
   * 2. 在射程内发射扇形弹幕
   * 3. 太近时后退
   */
  async act(player) {
    if (!this.isAlive || !player.isAlive) return;
    
    const distance = this.getDistanceTo(player);
    
    // 冷却递减
    if (this.currentCooldown > 0) {
      this.currentCooldown--;
    }
    
    // 下回合将可以射击，显示充能提示
    if (this.currentCooldown === 1 && distance <= this.danmakuRange) {
      this.showChargingEffect();
    }
    
    if (distance < 2) {
      // 太近了，后退
      await this.retreat(player);
    } else if (distance <= this.danmakuRange && this.currentCooldown <= 0) {
      // 在射程内且冷却完毕，发射弹幕
      this.fireDanmaku(player);
      this.scene.events.emit('showMessage', `${this.name} 发射了扇形弹幕！`);
    } else if (distance > this.danmakuRange && distance <= this.detectionRange) {
      // 不在射程但在检测范围，接近
      await this.approach(player);
    } else {
      await this.idle();
    }
  }

  /**
   * 后退远离玩家
   */
  async retreat(player) {
    this.aiState = 'retreat';
    
    const direction = this.getDirectionTo(player);
    
    // 尝试反方向移动
    const retreatDirs = [
      { x: -direction.x, y: -direction.y },
      { x: -direction.x, y: 0 },
      { x: 0, y: -direction.y }
    ];
    
    for (const dir of retreatDirs) {
      if (dir.x === 0 && dir.y === 0) continue;
      
      const newX = this.tileX + dir.x;
      const newY = this.tileY + dir.y;
      
      if (this.scene.canMoveTo(newX, newY) && !this.scene.getEnemyAt(newX, newY)) {
        await this.moveTo(newX, newY);
        return;
      }
    }
    
    // 无法后退，原地射击
    if (this.currentCooldown <= 0) {
      this.fireDanmaku(player);
    }
  }

  /**
   * 接近玩家到射程
   */
  async approach(player) {
    await this.chasePlayer(player);
  }

  /**
   * 死亡时释放大规模扩散弹
   */
  die() {
    // 死亡殉爆：圆环弹幕
    if (this.scene.bulletManager) {
      this.scene.bulletManager.fireRing(
        this.pixelX, this.pixelY,
        8, // 8发
        this.danmakuSpeed * 0.6,
        { damage: 6, owner: null }
      );
    }
    
    super.die();
  }
}
