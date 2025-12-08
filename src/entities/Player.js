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
    
    // 灵力值（MP）
    this.maxMp = PLAYER_CONFIG.maxMp;
    this.mp = this.maxMp;
    this.mpRegen = PLAYER_CONFIG.mpRegen;
    
    // 朝向（用于符卡释放）
    this.facing = { x: 0, y: 1 }; // 默认朝下
    
    // 符卡系统引用（由GameScene设置）
    this.spellCardSystem = null;
  }

  /**
   * 设置符卡系统
   * @param {SpellCardSystem} system 
   */
  setSpellCardSystem(system) {
    this.spellCardSystem = system;
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
   * 移动玩家
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
      return false;
    }
    
    // 检查是否有敌人
    const enemy = this.scene.getEnemyAt(newX, newY);
    if (enemy) {
      // 攻击敌人
      await this.attackEnemy(enemy);
      return true;
    }
    
    // 移动
    await this.moveTo(newX, newY);
    
    // 检查是否到达出口
    this.scene.checkExit();
    
    return true;
  }

  /**
   * 攻击敌人
   * @param {Enemy} enemy 
   */
  async attackEnemy(enemy) {
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
    
    // 造成伤害
    const damage = enemy.takeDamage(this.attack);
    
    // 显示伤害数字
    this.scene.events.emit('showDamage', {
      x: enemy.sprite.x,
      y: enemy.sprite.y - 20,
      damage: damage,
      isHeal: false
    });
    
    // 显示消息
    if (enemy.isAlive) {
      this.scene.events.emit('showMessage', `对 ${enemy.name} 造成 ${damage} 点伤害！`);
    } else {
      this.scene.events.emit('showMessage', `击败了 ${enemy.name}！`);
      this.scene.removeEnemy(enemy);
    }
  }

  /**
   * 使用符卡
   * @param {number} index - 符卡索引
   * @returns {boolean} 是否成功使用
   */
  useSpellCard(index) {
    if (!this.spellCardSystem) return false;
    
    const spellCard = this.spellCardSystem.getSpellCard(index);
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
    
    // 根据符卡类型使用
    let result;
    if (spellCard.type === 'bounce') {
      // 反弹型符卡使用朝向
      result = spellCard.use(this, this.facing);
    } else if (spellCard.type === 'barrier') {
      // 结界型符卡放置在前方
      result = spellCard.use(this, this.facing);
    } else if (spellCard.type === 'homing') {
      // 追踪型符卡自动寻敌
      result = spellCard.use(this);
      
      // 追踪型特殊处理
      if (result && result.noTarget) {
        // 没有目标，返还灵力
        this.mp += spellCard.mpCost;
        return false;
      }
      
      // 追踪型直接对目标造成伤害
      if (result && result.isHoming && result.targets) {
        const damagePerHit = result.damage;
        const hitCounts = {};
        
        // 统计每个敌人被命中次数
        for (let i = 0; i < result.hitCount; i++) {
          const target = result.targets[i % result.targets.length];
          hitCounts[target.name] = (hitCounts[target.name] || 0) + 1;
        }
        
        // 对每个目标造成伤害
        for (const enemy of result.targets) {
          const hits = hitCounts[enemy.name] || 1;
          const totalDamage = enemy.takeDamage(damagePerHit * hits);
          
          this.scene.events.emit('showDamage', {
            x: enemy.sprite.x,
            y: enemy.sprite.y - 20,
            damage: totalDamage,
            isHeal: false
          });
          
          if (!enemy.isAlive) {
            this.scene.events.emit('showMessage', `${enemy.name} 被追踪弹击败！`);
            this.scene.removeEnemy(enemy);
          }
        }
      }
    }
    
    // 处理位置伤害（反弹型）
    if (result && result.positions && result.positions.length > 0 && !result.isHoming) {
      this.processSpellCardDamage(result);
    }
    
    // 进入冷却
    spellCard.startCooldown();
    
    // 显示消息
    this.scene.events.emit('showMessage', `使用了 ${spellCard.name}！`);
    
    return true;
  }

  /**
   * 处理符卡伤害
   * @param {Object} result 
   */
  processSpellCardDamage(result) {
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
  }

  /**
   * 等待（跳过回合）
   */
  wait() {
    this.scene.events.emit('showMessage', '灵梦原地待命...');
  }

  /**
   * 回合结束时的恢复
   */
  onTurnEnd() {
    // 恢复灵力
    this.mp = Math.min(this.maxMp, this.mp + this.mpRegen);
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
