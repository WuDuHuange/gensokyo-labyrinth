/**
 * 被动天赋系统
 * 玩家在探索中获得的随机增益效果
 */

// 天赋配置
export const TALENT_CONFIG = {
  // 攻击类
  power_boost: {
    id: 'power_boost',
    name: '力量强化',
    description: '攻击力 +15%',
    type: 'attack',
    rarity: 'common',
    effect: { attackMult: 1.15 }
  },
  critical_eye: {
    id: 'critical_eye',
    name: '锐利之眼',
    description: '攻击力 +8，暴击率 +10%',
    type: 'attack',
    rarity: 'rare',
    effect: { attackFlat: 8, critChance: 0.10 }
  },
  
  // 防御类
  iron_skin: {
    id: 'iron_skin',
    name: '铁壁',
    description: '防御力 +5',
    type: 'defense',
    rarity: 'common',
    effect: { defenseFlat: 5 }
  },
  resilience: {
    id: 'resilience',
    name: '坚韧',
    description: '最大生命值 +20',
    type: 'defense',
    rarity: 'common',
    effect: { maxHpFlat: 20 }
  },
  
  // 恢复类
  vampirism: {
    id: 'vampirism',
    name: '吸血',
    description: '击杀敌人时恢复 5 点生命',
    type: 'utility',
    rarity: 'rare',
    effect: { killHeal: 5 }
  },
  regeneration: {
    id: 'regeneration',
    name: '再生',
    description: '每回合恢复 1 点生命',
    type: 'utility',
    rarity: 'rare',
    effect: { hpRegen: 1 }
  },
  
  // 灵力类
  mana_boost: {
    id: 'mana_boost',
    name: '灵力强化',
    description: '最大灵力 +10',
    type: 'mana',
    rarity: 'common',
    effect: { maxMpFlat: 10 }
  },
  mana_flow: {
    id: 'mana_flow',
    name: '灵力涌动',
    description: '灵力回复速度 +50%',
    type: 'mana',
    rarity: 'rare',
    effect: { mpRegenMult: 1.5 }
  },
  
  // 速度类
  swift: {
    id: 'swift',
    name: '迅捷',
    description: '行动速度 +10',
    type: 'speed',
    rarity: 'common',
    effect: { speedFlat: 10 }
  },
  
  // 特殊类
  treasure_hunter: {
    id: 'treasure_hunter',
    name: '寻宝者',
    description: '宝箱掉落物品数量 +1',
    type: 'utility',
    rarity: 'rare',
    effect: { extraDrop: 1 }
  },
  trap_sense: {
    id: 'trap_sense',
    name: '陷阱感知',
    description: '进入陷阱格前会收到警告',
    type: 'utility',
    rarity: 'common',
    effect: { trapSense: true }
  }
};

/**
 * 天赋系统类
 */
export default class TalentSystem {
  constructor(scene, player) {
    this.scene = scene;
    this.player = player;
    this.acquiredTalents = []; // 已获得的天赋 ID 列表
    
    // 计算后的加成值
    this.bonuses = {
      attackMult: 1.0,
      attackFlat: 0,
      defenseMult: 1.0,
      defenseFlat: 0,
      maxHpFlat: 0,
      maxMpFlat: 0,
      speedFlat: 0,
      hpRegen: 0,
      mpRegenMult: 1.0,
      killHeal: 0,
      critChance: 0,
      extraDrop: 0,
      trapSense: false
    };
  }
  
  /**
   * 获得一个天赋
   */
  acquire(talentId) {
    const config = TALENT_CONFIG[talentId];
    if (!config) return false;
    
    // 检查是否已拥有
    if (this.acquiredTalents.includes(talentId)) {
      this.scene.events.emit('showMessage', `已经拥有「${config.name}」了！`);
      return false;
    }
    
    this.acquiredTalents.push(talentId);
    this.applyEffect(config.effect);
    
    // 应用到玩家属性
    this.updatePlayerStats();
    
    this.scene.events.emit('showMessage', `获得天赋：「${config.name}」- ${config.description}`);
    return true;
  }
  
  /**
   * 应用天赋效果到加成
   */
  applyEffect(effect) {
    if (!effect) return;
    
    if (effect.attackMult) this.bonuses.attackMult *= effect.attackMult;
    if (effect.attackFlat) this.bonuses.attackFlat += effect.attackFlat;
    if (effect.defenseMult) this.bonuses.defenseMult *= effect.defenseMult;
    if (effect.defenseFlat) this.bonuses.defenseFlat += effect.defenseFlat;
    if (effect.maxHpFlat) this.bonuses.maxHpFlat += effect.maxHpFlat;
    if (effect.maxMpFlat) this.bonuses.maxMpFlat += effect.maxMpFlat;
    if (effect.speedFlat) this.bonuses.speedFlat += effect.speedFlat;
    if (effect.hpRegen) this.bonuses.hpRegen += effect.hpRegen;
    if (effect.mpRegenMult) this.bonuses.mpRegenMult *= effect.mpRegenMult;
    if (effect.killHeal) this.bonuses.killHeal += effect.killHeal;
    if (effect.critChance) this.bonuses.critChance += effect.critChance;
    if (effect.extraDrop) this.bonuses.extraDrop += effect.extraDrop;
    if (effect.trapSense) this.bonuses.trapSense = true;
  }
  
  /**
   * 重新计算所有加成（用于读档恢复）
   */
  recalculateBonuses() {
    // 重置加成
    this.bonuses = {
      attackMult: 1.0,
      attackFlat: 0,
      defenseMult: 1.0,
      defenseFlat: 0,
      maxHpFlat: 0,
      maxMpFlat: 0,
      speedFlat: 0,
      hpRegen: 0,
      mpRegenMult: 1.0,
      killHeal: 0,
      critChance: 0,
      extraDrop: 0,
      trapSense: false
    };
    
    // 重新应用所有已获得天赋的效果
    for (const talentId of this.acquiredTalents) {
      const config = TALENT_CONFIG[talentId];
      if (config && config.effect) {
        this.applyEffect(config.effect);
      }
    }
    
    // 更新玩家属性
    this.updatePlayerStats();
  }
  
  /**
   * 更新玩家属性
   */
  updatePlayerStats() {
    if (!this.player) return;
    
    // 更新最大生命值
    const oldMaxHp = this.player.maxHp;
    this.player.maxHp = this.player.baseMaxHp + this.bonuses.maxHpFlat;
    // 按比例恢复血量
    if (this.player.maxHp > oldMaxHp) {
      this.player.hp += (this.player.maxHp - oldMaxHp);
    }
    
    // 更新最大灵力
    if (this.player.maxMp !== undefined) {
      const oldMaxMp = this.player.maxMp;
      this.player.maxMp = this.player.baseMaxMp + this.bonuses.maxMpFlat;
      if (this.player.maxMp > oldMaxMp) {
        this.player.mp += (this.player.maxMp - oldMaxMp);
      }
    }
    
    // 更新速度
    this.player.speed = this.player.baseSpeed + this.bonuses.speedFlat;
  }
  
  /**
   * 计算实际攻击力
   */
  getAttack(baseAttack) {
    return Math.floor((baseAttack + this.bonuses.attackFlat) * this.bonuses.attackMult);
  }
  
  /**
   * 计算实际防御力
   */
  getDefense(baseDefense) {
    return Math.floor((baseDefense + this.bonuses.defenseFlat) * this.bonuses.defenseMult);
  }
  
  /**
   * 检查是否暴击
   */
  rollCrit() {
    return Math.random() < this.bonuses.critChance;
  }
  
  /**
   * 回合结束时触发的被动效果
   */
  onTurnEnd() {
    // 生命回复
    if (this.bonuses.hpRegen > 0 && this.player.hp < this.player.maxHp) {
      const heal = this.bonuses.hpRegen;
      this.player.hp = Math.min(this.player.hp + heal, this.player.maxHp);
      // 不显示消息，避免刷屏
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
   * 随机获得一个天赋（用于奖励）
   */
  acquireRandom(rarity = null) {
    // 获取可用天赋（未拥有的）
    const available = Object.values(TALENT_CONFIG).filter(t => {
      if (this.acquiredTalents.includes(t.id)) return false;
      if (rarity && t.rarity !== rarity) return false;
      return true;
    });
    
    if (available.length === 0) {
      this.scene.events.emit('showMessage', '已获得所有天赋！');
      return null;
    }
    
    const chosen = available[Math.floor(Math.random() * available.length)];
    this.acquire(chosen.id);
    return chosen;
  }
  
  /**
   * 获取已获得天赋的描述列表
   */
  getTalentDescriptions() {
    return this.acquiredTalents.map(id => {
      const config = TALENT_CONFIG[id];
      return config ? `${config.name}: ${config.description}` : id;
    });
  }
}
