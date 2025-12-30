/**
 * 装备系统
 * 玩家可以装备御守、勾玉等饰品获得属性加成
 */

// 装备配置
export const EQUIPMENT_CONFIG = {
  // 御守类（防御向）
  omamori_health: {
    id: 'omamori_health',
    name: '健康御守',
    description: '最大生命值 +30',
    type: 'accessory',
    slot: 'accessory',
    rarity: 'common',
    sprite: 'omamori',
    effect: { maxHpFlat: 30 }
  },
  omamori_protection: {
    id: 'omamori_protection',
    name: '守护御守',
    description: '防御力 +8',
    type: 'accessory',
    slot: 'accessory',
    rarity: 'common',
    sprite: 'omamori',
    effect: { defenseFlat: 8 }
  },
  omamori_luck: {
    id: 'omamori_luck',
    name: '幸运御守',
    description: '暴击率 +8%',
    type: 'accessory',
    slot: 'accessory',
    rarity: 'rare',
    sprite: 'omamori_gold',
    effect: { critChance: 0.08 }
  },
  
  // 勾玉类（攻击向）
  magatama_power: {
    id: 'magatama_power',
    name: '力之勾玉',
    description: '攻击力 +10',
    type: 'accessory',
    slot: 'accessory',
    rarity: 'common',
    sprite: 'magatama',
    effect: { attackFlat: 10 }
  },
  magatama_spirit: {
    id: 'magatama_spirit',
    name: '灵之勾玉',
    description: '最大灵力 +15，灵力回复速度 +25%',
    type: 'accessory',
    slot: 'accessory',
    rarity: 'rare',
    sprite: 'magatama_blue',
    effect: { maxMpFlat: 15, mpRegenMult: 1.25 }
  },
  magatama_life: {
    id: 'magatama_life',
    name: '命之勾玉',
    description: '击杀敌人时恢复 8 点生命',
    type: 'accessory',
    slot: 'accessory',
    rarity: 'rare',
    sprite: 'magatama_red',
    effect: { killHeal: 8 }
  },
  
  // 特殊饰品
  ribbon_red: {
    id: 'ribbon_red',
    name: '红色缎带',
    description: '速度 +15',
    type: 'accessory',
    slot: 'accessory',
    rarity: 'common',
    sprite: 'ribbon',
    effect: { speedFlat: 15 }
  },
  hakurei_orb: {
    id: 'hakurei_orb',
    name: '博丽之珠',
    description: '攻击力 +5，防御力 +5，灵力上限 +10',
    type: 'accessory',
    slot: 'accessory',
    rarity: 'epic',
    sprite: 'orb',
    effect: { attackFlat: 5, defenseFlat: 5, maxMpFlat: 10 }
  },
  yin_yang_orb: {
    id: 'yin_yang_orb',
    name: '阴阳玉',
    description: '每回合恢复 2 点生命和 1 点灵力',
    type: 'accessory',
    slot: 'accessory',
    rarity: 'epic',
    sprite: 'orb_yinyang',
    effect: { hpRegen: 2, mpRegen: 1 }
  }
};

/**
 * 装备系统类
 */
export default class EquipmentSystem {
  constructor(scene, player) {
    this.scene = scene;
    this.player = player;
    
    // 装备槽（可扩展）
    this.slots = {
      accessory1: null, // 饰品槽1
      accessory2: null  // 饰品槽2
    };
    
    // 计算后的加成值
    this.bonuses = {
      attackFlat: 0,
      defenseFlat: 0,
      maxHpFlat: 0,
      maxMpFlat: 0,
      speedFlat: 0,
      hpRegen: 0,
      mpRegen: 0,
      mpRegenMult: 1.0,
      killHeal: 0,
      critChance: 0
    };
  }
  
  /**
   * 装备一件物品到指定槽位
   * @param {string} equipId - 装备 ID
   * @param {string} slotKey - 槽位键（accessory1, accessory2）
   * @returns {string|null} 被替换的装备 ID（如果有）
   */
  equip(equipId, slotKey = null) {
    const config = EQUIPMENT_CONFIG[equipId];
    if (!config) {
      this.scene.events.emit('showMessage', '无效的装备！');
      return null;
    }
    
    // 自动选择空槽位
    if (!slotKey) {
      if (config.slot === 'accessory') {
        if (!this.slots.accessory1) slotKey = 'accessory1';
        else if (!this.slots.accessory2) slotKey = 'accessory2';
        else slotKey = 'accessory1'; // 都满了，替换第一个
      }
    }
    
    // 检查槽位是否存在
    if (!(slotKey in this.slots)) {
      this.scene.events.emit('showMessage', '无效的装备槽位！');
      return null;
    }
    
    // 替换旧装备
    const oldEquipId = this.slots[slotKey];
    this.slots[slotKey] = equipId;
    
    // 重新计算加成
    this.recalculateBonuses();
    
    // 应用到玩家
    this.updatePlayerStats();
    
    // 显示消息
    if (oldEquipId) {
      const oldConfig = EQUIPMENT_CONFIG[oldEquipId];
      this.scene.events.emit('showMessage', `装备了「${config.name}」，卸下了「${oldConfig?.name || oldEquipId}」`);
    } else {
      this.scene.events.emit('showMessage', `装备了「${config.name}」- ${config.description}`);
    }
    
    return oldEquipId;
  }
  
  /**
   * 卸下指定槽位的装备
   */
  unequip(slotKey) {
    if (!(slotKey in this.slots) || !this.slots[slotKey]) {
      return null;
    }
    
    const equipId = this.slots[slotKey];
    const config = EQUIPMENT_CONFIG[equipId];
    this.slots[slotKey] = null;
    
    // 重新计算加成
    this.recalculateBonuses();
    this.updatePlayerStats();
    
    this.scene.events.emit('showMessage', `卸下了「${config?.name || equipId}」`);
    return equipId;
  }
  
  /**
   * 重新计算所有装备加成
   */
  recalculateBonuses() {
    // 重置
    this.bonuses = {
      attackFlat: 0,
      defenseFlat: 0,
      maxHpFlat: 0,
      maxMpFlat: 0,
      speedFlat: 0,
      hpRegen: 0,
      mpRegen: 0,
      mpRegenMult: 1.0,
      killHeal: 0,
      critChance: 0
    };
    
    // 累加所有已装备物品的效果
    for (const slotKey in this.slots) {
      const equipId = this.slots[slotKey];
      if (!equipId) continue;
      
      const config = EQUIPMENT_CONFIG[equipId];
      if (!config || !config.effect) continue;
      
      const eff = config.effect;
      if (eff.attackFlat) this.bonuses.attackFlat += eff.attackFlat;
      if (eff.defenseFlat) this.bonuses.defenseFlat += eff.defenseFlat;
      if (eff.maxHpFlat) this.bonuses.maxHpFlat += eff.maxHpFlat;
      if (eff.maxMpFlat) this.bonuses.maxMpFlat += eff.maxMpFlat;
      if (eff.speedFlat) this.bonuses.speedFlat += eff.speedFlat;
      if (eff.hpRegen) this.bonuses.hpRegen += eff.hpRegen;
      if (eff.mpRegen) this.bonuses.mpRegen += eff.mpRegen;
      if (eff.mpRegenMult) this.bonuses.mpRegenMult *= eff.mpRegenMult;
      if (eff.killHeal) this.bonuses.killHeal += eff.killHeal;
      if (eff.critChance) this.bonuses.critChance += eff.critChance;
    }
  }
  
  /**
   * 更新玩家属性
   */
  updatePlayerStats() {
    if (!this.player) return;
    
    // 获取天赋系统的加成作为基础
    const talentBonuses = this.player.talentSystem?.bonuses || {
      maxHpFlat: 0, maxMpFlat: 0, speedFlat: 0
    };
    
    // 计算最终属性
    const oldMaxHp = this.player.maxHp;
    this.player.maxHp = this.player.baseMaxHp + talentBonuses.maxHpFlat + this.bonuses.maxHpFlat;
    if (this.player.maxHp > oldMaxHp) {
      this.player.hp += (this.player.maxHp - oldMaxHp);
    }
    this.player.hp = Math.min(this.player.hp, this.player.maxHp);
    
    // 更新灵力
    if (this.player.maxMp !== undefined) {
      const oldMaxMp = this.player.maxMp;
      this.player.maxMp = this.player.baseMaxMp + talentBonuses.maxMpFlat + this.bonuses.maxMpFlat;
      if (this.player.maxMp > oldMaxMp) {
        this.player.mp += (this.player.maxMp - oldMaxMp);
      }
      this.player.mp = Math.min(this.player.mp, this.player.maxMp);
    }
    
    // 更新速度
    this.player.speed = this.player.baseSpeed + talentBonuses.speedFlat + this.bonuses.speedFlat;
  }
  
  /**
   * 回合结束时触发（生命/灵力回复）
   */
  onTurnEnd() {
    // 生命回复
    if (this.bonuses.hpRegen > 0 && this.player.hp < this.player.maxHp) {
      this.player.hp = Math.min(this.player.hp + this.bonuses.hpRegen, this.player.maxHp);
    }
    // 灵力回复
    if (this.bonuses.mpRegen > 0 && this.player.mp < this.player.maxMp) {
      this.player.mp = Math.min(this.player.mp + this.bonuses.mpRegen, this.player.maxMp);
    }
  }
  
  /**
   * 击杀敌人时触发
   */
  onKillEnemy() {
    if (this.bonuses.killHeal > 0) {
      const heal = this.bonuses.killHeal;
      this.player.hp = Math.min(this.player.hp + heal, this.player.maxHp);
      this.scene.events.emit('showDamage', {
        x: this.player.sprite.x,
        y: this.player.sprite.y - 20,
        damage: heal,
        isHeal: true
      });
    }
  }
  
  /**
   * 获取装备列表描述
   */
  getEquipmentDescriptions() {
    const result = [];
    for (const slotKey in this.slots) {
      const equipId = this.slots[slotKey];
      if (equipId) {
        const config = EQUIPMENT_CONFIG[equipId];
        result.push(`${slotKey}: ${config?.name || equipId}`);
      } else {
        result.push(`${slotKey}: 空`);
      }
    }
    return result;
  }
}
