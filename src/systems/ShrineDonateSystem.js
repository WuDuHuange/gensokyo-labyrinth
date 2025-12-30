/**
 * 神社捐赠系统
 * 玩家可以在神社捐赠金币获得随机效果（赌博机制）
 */

// 捐赠配置
export const SHRINE_DONATE_CONFIG = {
  // 捐赠金额选项
  donations: [
    { amount: 10, name: '少量', luck: 0.3 },   // 30% 好结果
    { amount: 30, name: '中等', luck: 0.45 },  // 45% 好结果
    { amount: 100, name: '大量', luck: 0.65 }, // 65% 好结果
    { amount: 300, name: '巨额', luck: 0.85 }  // 85% 好结果
  ],
  
  // 可能的结果
  outcomes: {
    // 好结果
    good: [
      { id: 'heal_full', name: '神灵庇佑', description: '生命值完全恢复', weight: 20 },
      { id: 'heal_half', name: '神气加护', description: '恢复一半生命值', weight: 30 },
      { id: 'mp_restore', name: '灵力涌动', description: '灵力值完全恢复', weight: 25 },
      { id: 'buff_attack', name: '武运加持', description: '攻击力永久 +5', weight: 15 },
      { id: 'buff_defense', name: '守护加持', description: '防御力永久 +3', weight: 15 },
      { id: 'buff_maxhp', name: '生命祝福', description: '最大生命值永久 +15', weight: 12 },
      { id: 'buff_maxmp', name: '灵力祝福', description: '最大灵力永久 +8', weight: 12 },
      { id: 'gold_bonus', name: '财运亨通', description: '获得额外金币', weight: 10 },
      { id: 'random_talent', name: '神授技艺', description: '获得一个随机天赋', weight: 8 },
      { id: 'random_equip', name: '神赐宝物', description: '获得一件随机装备', weight: 6 }
    ],
    // 坏结果
    bad: [
      { id: 'damage', name: '神罚', description: '受到少量伤害', weight: 30 },
      { id: 'curse_slow', name: '迟缓诅咒', description: '速度暂时降低', weight: 20 },
      { id: 'mp_drain', name: '灵力流失', description: '损失一半灵力', weight: 25 },
      { id: 'nothing', name: '无事发生', description: '神明似乎没有注意到', weight: 40 }
    ]
  }
};

/**
 * 神社捐赠系统类
 */
export default class ShrineDonateSystem {
  constructor(scene, player) {
    this.scene = scene;
    this.player = player;
    
    // 每局游戏的捐赠次数（影响后续效果？）
    this.donationCount = 0;
    
    // 临时 debuff 效果
    this.activeDebuffs = [];
  }
  
  /**
   * 获取可用的捐赠选项
   */
  getDonationOptions() {
    const gold = this.scene.spellUpgradeSystem?.gold || 0;
    return SHRINE_DONATE_CONFIG.donations.map(d => ({
      ...d,
      canAfford: gold >= d.amount
    }));
  }
  
  /**
   * 进行捐赠
   */
  donate(donationIndex) {
    const options = SHRINE_DONATE_CONFIG.donations;
    if (donationIndex < 0 || donationIndex >= options.length) {
      return { success: false, message: '无效的捐赠选项' };
    }
    
    const donation = options[donationIndex];
    const upgradeSystem = this.scene.spellUpgradeSystem;
    
    if (!upgradeSystem || upgradeSystem.gold < donation.amount) {
      return { success: false, message: '金币不足！' };
    }
    
    // 扣除金币
    upgradeSystem.gold -= donation.amount;
    this.donationCount++;
    
    // 判定结果
    const isGood = Math.random() < donation.luck;
    const outcome = this.pickOutcome(isGood ? 'good' : 'bad');
    
    // 应用效果
    const result = this.applyOutcome(outcome, isGood);
    
    // 显示消息
    this.scene.events.emit('showMessage', `向神社捐赠了 ${donation.amount} 金币...`);
    setTimeout(() => {
      this.scene.events.emit('showMessage', `${outcome.name}！${outcome.description}`);
    }, 500);
    
    return {
      success: true,
      isGood: isGood,
      outcome: outcome,
      result: result
    };
  }
  
  /**
   * 从结果池中按权重随机选择
   */
  pickOutcome(type) {
    const pool = SHRINE_DONATE_CONFIG.outcomes[type];
    const total = pool.reduce((s, o) => s + o.weight, 0);
    let r = Math.random() * total;
    
    for (const outcome of pool) {
      r -= outcome.weight;
      if (r <= 0) return outcome;
    }
    
    return pool[pool.length - 1];
  }
  
  /**
   * 应用结果效果
   */
  applyOutcome(outcome, isGood) {
    const player = this.player;
    
    switch (outcome.id) {
      // 好结果
      case 'heal_full':
        player.hp = player.maxHp;
        return { healed: player.maxHp };
        
      case 'heal_half':
        const healAmount = Math.floor(player.maxHp / 2);
        player.hp = Math.min(player.hp + healAmount, player.maxHp);
        return { healed: healAmount };
        
      case 'mp_restore':
        player.mp = player.maxMp;
        return { mpRestored: player.maxMp };
        
      case 'buff_attack':
        player.attack += 5;
        player.baseAttack += 5;
        return { attackBonus: 5 };
        
      case 'buff_defense':
        player.defense += 3;
        player.baseDefense += 3;
        return { defenseBonus: 3 };
        
      case 'buff_maxhp':
        player.baseMaxHp += 15;
        player.maxHp += 15;
        player.hp += 15;
        return { maxHpBonus: 15 };
        
      case 'buff_maxmp':
        player.baseMaxMp += 8;
        player.maxMp += 8;
        player.mp += 8;
        return { maxMpBonus: 8 };
        
      case 'gold_bonus':
        const goldAmount = 30 + Math.floor(Math.random() * 71); // 30-100
        if (this.scene.spellUpgradeSystem) {
          this.scene.spellUpgradeSystem.gold += goldAmount;
        }
        return { goldGained: goldAmount };
        
      case 'random_talent':
        if (this.scene.talentSystem) {
          const talent = this.scene.talentSystem.acquireRandom();
          return { talent: talent };
        }
        return { talent: null };
        
      case 'random_equip':
        const equipIds = ['omamori_health', 'omamori_protection', 'magatama_power', 'ribbon_red'];
        const randomEquip = equipIds[Math.floor(Math.random() * equipIds.length)];
        player.addItem(randomEquip);
        return { equipment: randomEquip };
        
      // 坏结果
      case 'damage':
        const damage = 5 + Math.floor(Math.random() * 11); // 5-15
        player.hp = Math.max(1, player.hp - damage);
        this.scene.events.emit('showDamage', {
          x: player.sprite.x,
          y: player.sprite.y - 20,
          damage: damage,
          isHeal: false
        });
        return { damageTaken: damage };
        
      case 'curse_slow':
        // 临时减速（持续 20 回合）
        const slowAmount = 20;
        player.speed = Math.max(50, player.speed - slowAmount);
        this.activeDebuffs.push({
          type: 'slow',
          value: slowAmount,
          duration: 20
        });
        return { slowAmount: slowAmount, duration: 20 };
        
      case 'mp_drain':
        const mpLost = Math.floor(player.mp / 2);
        player.mp -= mpLost;
        return { mpLost: mpLost };
        
      case 'nothing':
      default:
        return {};
    }
  }
  
  /**
   * 回合结束时处理 debuff 持续时间
   */
  onTurnEnd() {
    const player = this.player;
    
    for (let i = this.activeDebuffs.length - 1; i >= 0; i--) {
      const debuff = this.activeDebuffs[i];
      debuff.duration--;
      
      if (debuff.duration <= 0) {
        // 移除 debuff 效果
        if (debuff.type === 'slow') {
          player.speed += debuff.value;
          this.scene.events.emit('showMessage', '迟缓诅咒解除了');
        }
        this.activeDebuffs.splice(i, 1);
      }
    }
  }
}
