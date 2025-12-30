/**
 * 符卡升级系统
 * 使用金币强化符卡效果
 */

// 升级配置
export const SPELL_UPGRADE_CONFIG = {
  // 每个符卡的升级效果
  meigyokuAnki: {
    maxLevel: 5,
    // 每级升级需要的金币
    costs: [50, 100, 200, 350, 500],
    // 每级的效果加成
    bonuses: [
      { damageMult: 1.0, mpCostMult: 1.0, cooldownReduction: 0 },  // Lv1 基础
      { damageMult: 1.15, mpCostMult: 1.0, cooldownReduction: 0 }, // Lv2
      { damageMult: 1.3, mpCostMult: 0.95, cooldownReduction: 0 }, // Lv3
      { damageMult: 1.5, mpCostMult: 0.9, cooldownReduction: 1 },  // Lv4
      { damageMult: 1.75, mpCostMult: 0.85, cooldownReduction: 1 } // Lv5
    ]
  },
  hakureiMusubi: {
    maxLevel: 5,
    costs: [40, 80, 150, 280, 450],
    bonuses: [
      { damageMult: 1.0, mpCostMult: 1.0, rangeMult: 1.0 },
      { damageMult: 1.1, mpCostMult: 1.0, rangeMult: 1.0 },
      { damageMult: 1.25, mpCostMult: 0.95, rangeMult: 1.2 },
      { damageMult: 1.4, mpCostMult: 0.9, rangeMult: 1.4 },
      { damageMult: 1.6, mpCostMult: 0.85, rangeMult: 1.6 }
    ]
  },
  musouFuuin: {
    maxLevel: 5,
    costs: [60, 120, 220, 400, 600],
    bonuses: [
      { damageMult: 1.0, mpCostMult: 1.0, cooldownReduction: 0 },
      { damageMult: 1.2, mpCostMult: 1.0, cooldownReduction: 0 },
      { damageMult: 1.4, mpCostMult: 0.95, cooldownReduction: 1 },
      { damageMult: 1.6, mpCostMult: 0.9, cooldownReduction: 1 },
      { damageMult: 2.0, mpCostMult: 0.8, cooldownReduction: 2 }
    ]
  }
};

/**
 * 符卡升级系统类
 */
export default class SpellUpgradeSystem {
  constructor(scene, player, spellCardSystem) {
    this.scene = scene;
    this.player = player;
    this.spellCardSystem = spellCardSystem;
    
    // 各符卡等级
    this.levels = {
      meigyokuAnki: 1,
      hakureiMusubi: 1,
      musouFuuin: 1
    };
    
    // 玩家金币
    this.gold = 0;
  }
  
  /**
   * 增加金币
   */
  addGold(amount) {
    this.gold += amount;
    this.scene.events.emit('showMessage', `获得 ${amount} 金币（总计: ${this.gold}）`);
  }
  
  /**
   * 获取符卡当前等级
   */
  getLevel(spellKey) {
    return this.levels[spellKey] || 1;
  }
  
  /**
   * 获取升级所需金币
   */
  getUpgradeCost(spellKey) {
    const config = SPELL_UPGRADE_CONFIG[spellKey];
    if (!config) return -1;
    
    const level = this.levels[spellKey] || 1;
    if (level >= config.maxLevel) return -1; // 已满级
    
    return config.costs[level - 1] || -1;
  }
  
  /**
   * 获取符卡当前加成
   */
  getBonus(spellKey) {
    const config = SPELL_UPGRADE_CONFIG[spellKey];
    if (!config) return { damageMult: 1, mpCostMult: 1, cooldownReduction: 0 };
    
    const level = this.levels[spellKey] || 1;
    return config.bonuses[level - 1] || config.bonuses[0];
  }
  
  /**
   * 检查是否可以升级
   */
  canUpgrade(spellKey) {
    const cost = this.getUpgradeCost(spellKey);
    if (cost < 0) return false;
    return this.gold >= cost;
  }
  
  /**
   * 升级符卡
   */
  upgrade(spellKey) {
    const config = SPELL_UPGRADE_CONFIG[spellKey];
    if (!config) {
      this.scene.events.emit('showMessage', '无效的符卡！');
      return false;
    }
    
    const level = this.levels[spellKey] || 1;
    if (level >= config.maxLevel) {
      this.scene.events.emit('showMessage', '该符卡已达最高等级！');
      return false;
    }
    
    const cost = this.getUpgradeCost(spellKey);
    if (this.gold < cost) {
      this.scene.events.emit('showMessage', `金币不足！需要 ${cost} 金币`);
      return false;
    }
    
    // 扣除金币
    this.gold -= cost;
    
    // 提升等级
    this.levels[spellKey] = level + 1;
    
    // 获取对应的符卡名称
    const spellNames = {
      meigyokuAnki: '梦境暗器',
      hakureiMusubi: '博丽结界',
      musouFuuin: '梦想封印'
    };
    
    const newBonus = this.getBonus(spellKey);
    this.scene.events.emit('showMessage', 
      `「${spellNames[spellKey]}」升级至 Lv.${level + 1}！伤害 x${newBonus.damageMult.toFixed(2)}`);
    
    // 更新符卡系统中的实际属性
    this.applyBonusToSpell(spellKey);
    
    return true;
  }
  
  /**
   * 应用加成到符卡
   */
  applyBonusToSpell(spellKey) {
    if (!this.spellCardSystem) return;
    
    const bonus = this.getBonus(spellKey);
    
    // 查找对应的符卡实例
    const spellCards = this.spellCardSystem.spellCards;
    for (const spell of spellCards) {
      // 根据符卡名称匹配
      if (spellKey === 'meigyokuAnki' && spell.name === '梦境暗器') {
        spell._upgradeBonus = bonus;
      } else if (spellKey === 'hakureiMusubi' && spell.name === '博丽结界') {
        spell._upgradeBonus = bonus;
      } else if (spellKey === 'musouFuuin' && spell.name === '梦想封印') {
        spell._upgradeBonus = bonus;
      }
    }
  }
  
  /**
   * 应用所有加成（游戏开始时调用）
   */
  applyAllBonuses() {
    for (const key of Object.keys(this.levels)) {
      this.applyBonusToSpell(key);
    }
  }
  
  /**
   * 获取升级界面数据
   */
  getUpgradeMenuData() {
    const data = [];
    const spellNames = {
      meigyokuAnki: '梦境暗器',
      hakureiMusubi: '博丽结界',
      musouFuuin: '梦想封印'
    };
    
    for (const key of Object.keys(SPELL_UPGRADE_CONFIG)) {
      const config = SPELL_UPGRADE_CONFIG[key];
      const level = this.levels[key] || 1;
      const cost = this.getUpgradeCost(key);
      const bonus = this.getBonus(key);
      
      data.push({
        key: key,
        name: spellNames[key],
        level: level,
        maxLevel: config.maxLevel,
        cost: cost,
        canUpgrade: this.canUpgrade(key),
        bonus: bonus
      });
    }
    
    return data;
  }
}
