/**
 * 反弹盾妖精（精英怪）
 * 拥有护盾，在护盾存在期间会反弹玩家的弹幕攻击
 */
import Enemy from '../Enemy.js';
import { TILE_SIZE } from '../../config/gameConfig.js';

export default class ShieldFairy extends Enemy {
  constructor(scene, x, y) {
    super(scene, x, y, 'slowFairy', {
      name: '护盾妖精',
      hp: 80,
      attack: 12,
      defense: 8,
      speed: 70,
      expReward: 30,
      detectionRange: 6,
      attackRange: 1
    });
    
    this.isElite = true;  // 精英怪标记
    this.shieldActive = true;  // 护盾状态
    this.shieldCooldown = 0;   // 护盾冷却
    this.shieldDuration = 3;   // 护盾持续回合
    this.shieldTimer = this.shieldDuration;
    
    // 护盾视觉效果
    this.shieldGraphic = null;
    this.createShieldVisual();
    
    // 给精灵添加精英标记（金色边框）
    this.sprite.setTint(0x88ccff);
  }
  
  createShieldVisual() {
    if (this.shieldGraphic) {
      try { this.shieldGraphic.destroy(); } catch (e) {}
    }
    
    if (!this.shieldActive) return;
    
    this.shieldGraphic = this.scene.add.graphics();
    this.shieldGraphic.lineStyle(2, 0x66ccff, 0.8);
    this.shieldGraphic.strokeCircle(0, 0, 18);
    this.shieldGraphic.setDepth(11);
    this.updateShieldPosition();
  }
  
  updateShieldPosition() {
    if (this.shieldGraphic && this.sprite) {
      this.shieldGraphic.setPosition(this.sprite.x, this.sprite.y);
    }
  }

  /**
   * AI 行动
   */
  async act(player) {
    if (!this.isAlive || !player.isAlive) return;
    
    // 更新护盾状态
    if (this.shieldActive) {
      this.shieldTimer--;
      if (this.shieldTimer <= 0) {
        this.shieldActive = false;
        this.shieldCooldown = 4;  // 4回合后恢复护盾
        if (this.shieldGraphic) {
          this.shieldGraphic.destroy();
          this.shieldGraphic = null;
        }
        this.scene.events.emit('showMessage', `${this.name}的护盾消失了！`);
      }
    } else {
      this.shieldCooldown--;
      if (this.shieldCooldown <= 0) {
        this.shieldActive = true;
        this.shieldTimer = this.shieldDuration;
        this.createShieldVisual();
        this.scene.events.emit('showMessage', `${this.name}重新展开了护盾！`);
      }
    }
    
    const distance = this.getDistanceTo(player);
    
    if (distance <= this.attackRange) {
      // 近战攻击
      await this.meleeAttack(player);
    } else if (distance <= this.detectionRange) {
      // 接近玩家
      await this.approach(player);
    } else {
      await this.idle();
    }
    
    this.updateShieldPosition();
  }
  
  /**
   * 近战攻击
   */
  async meleeAttack(player) {
    this.aiState = 'attack';
    
    // 攻击动画
    const originalX = this.sprite.x;
    const originalY = this.sprite.y;
    const direction = this.getDirectionTo(player);
    
    await new Promise(resolve => {
      this.scene.tweens.add({
        targets: this.sprite,
        x: originalX + direction.x * 8,
        y: originalY + direction.y * 8,
        duration: 80,
        yoyo: true,
        onComplete: resolve
      });
    });
    
    const damage = player.takeDamage(this.attack);
    this.scene.events.emit('showDamage', {
      x: player.sprite.x,
      y: player.sprite.y - 20,
      damage: damage,
      isHeal: false
    });
    this.scene.events.emit('showMessage', `${this.name}攻击了灵梦！造成 ${damage} 点伤害！`);
  }
  
  /**
   * 被攻击时检查护盾反弹
   * @returns {boolean} 是否反弹
   */
  shouldReflect() {
    return this.shieldActive;
  }
  
  /**
   * 重写受伤逻辑，护盾存在时减少伤害
   */
  takeDamage(rawDamage, source) {
    if (this.shieldActive) {
      // 护盾减少 50% 伤害
      rawDamage = Math.floor(rawDamage * 0.5);
      // 创建反弹视觉效果
      this.createReflectEffect();
    }
    return super.takeDamage(rawDamage, source);
  }
  
  createReflectEffect() {
    try {
      const g = this.scene.add.graphics();
      g.lineStyle(3, 0x66ccff, 1);
      g.strokeCircle(this.sprite.x, this.sprite.y, 24);
      g.setDepth(15);
      
      this.scene.tweens.add({
        targets: g,
        alpha: 0,
        scale: 1.5,
        duration: 300,
        onComplete: () => g.destroy()
      });
    } catch (e) {}
  }
  
  /**
   * 死亡时清理
   */
  die() {
    if (this.shieldGraphic) {
      try { this.shieldGraphic.destroy(); } catch (e) {}
    }
    super.die();
  }
  
  /**
   * 移动后更新护盾位置
   */
  moveTo(tileX, tileY, animate = true) {
    const result = super.moveTo(tileX, tileY, animate);
    // 延迟更新护盾位置
    setTimeout(() => this.updateShieldPosition(), 100);
    return result;
  }
}
