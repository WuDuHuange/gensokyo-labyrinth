/**
 * 游戏配置文件
 * 幻想迷宫 - Gensokyo Labyrinth
 */

// 瓦片大小
export const TILE_SIZE = 32;

// 地图配置
export const MAP_CONFIG = {
  width: 128,        // 地图宽度（瓦片数）
  height: 128,       // 地图高度（瓦片数）
  roomMinSize: 6,    // 最小房间尺寸
  roomMaxSize: 12,   // 最大房间尺寸
  maxRooms: 15       // 最大房间数量
};

// 玩家配置
export const PLAYER_CONFIG = {
  speed: 100,        // 基准速度
  maxHp: 100,        // 最大生命值
  maxMp: 100,        // 最大灵力值
  mpRegen: 2,        // 每回合灵力恢复
  attack: 10,        // 基础攻击力
  defense: 5         // 基础防御力
};

// 敌人配置
export const ENEMY_CONFIG = {
  slowFairy: {
    name: '慢速妖精',
    speed: 50,
    hp: 30,
    attack: 8,
    defense: 2,
    expReward: 10,
    roomDetectThreshold: 2
  },
  normalFairy: {
    name: '普通妖精',
    speed: 100,
    hp: 40,
    attack: 10,
    defense: 3,
    expReward: 15,
    roomDetectThreshold: 2
  },
  fastFairy: {
    name: '快速妖精',
    speed: 200,
    hp: 25,
    attack: 12,
    defense: 1,
    expReward: 20,
    roomDetectThreshold: 3
  },
  danmakuFairy: {
    name: '弹幕妖精',
    speed: 80,
    hp: 35,
    attack: 15,
    defense: 2,
    expReward: 25,
    roomDetectThreshold: 4
  },
  smallCrystal: {
    name: '小晶体',
    speed: 60,
    hp: 18,
    attack: 10,
    defense: 0,
    expReward: 15,
    laserDamage: 10
  },
  demoBoss: {
    name: '水晶核心',
    speed: 80,
    hp: 240,
    attack: 0,
    defense: 2,
    expReward: 100
  }
};

// 符卡配置
export const SPELLCARD_CONFIG = {
  // 珠符「明珠暗投」- 反弹型：扔出三个会反弹的阴阳玉
  meigyokuAnki: {
    name: '珠符「明珠暗投」',
    type: 'bounce',
    mpCost: 30,
    cooldown: 4,
    damage: 30,
    projectileCount: 3,  // 三个阴阳玉
    bounceCount: 3,      // 反弹次数
    range: 6             // 射程
  },
  // 梦符「封魔阵」- 结界型：放置结界，敌人进入受伤
  fuumajin: {
    name: '梦符「封魔阵」',
    type: 'barrier',
    mpCost: 25,
    cooldown: 5,
    damage: 15,
    duration: 5,         // 持续回合数
    radius: 2            // 结界半径
  },
  // 空符「梦想妙珠」- 追踪型：释放多个追踪光球
  musouMyouji: {
    name: '空符「梦想妙珠」',
    type: 'homing',
    mpCost: 35,
    cooldown: 6,
    damage: 12,
    projectileCount: 5,  // 五个光球
    range: 8             // 追踪范围
  }
};

// 行动队列配置
export const ACTION_CONFIG = {
  threshold: 100    // 行动阈值
};

// Phaser 游戏配置
export const GAME_CONFIG = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: 800,
  height: 600,
  pixelArt: true,
  backgroundColor: '#1a1a2e',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false
    }
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
};

// 颜色配置
export const COLORS = {
  primary: 0xe94560,
  secondary: 0x533483,
  background: 0x1a1a2e,
  wall: 0x4a4a6a,
  floor: 0x2a2a4a,
  player: 0xff6b6b,
  enemy: 0x95e1d3,
  item: 0xf9ed69,
  exit: 0x00ff88
};

// 道具配置（示例）
export const ITEM_CONFIG = {
  potion_small: {
    id: 'potion_small',
    name: '小瓶回复药',
    type: 'consumable',
    sprite: 'potion',
    description: '恢复 25 点生命值',
    effect: {
      heal: 25
    }
  }
  ,
  gold_coin: {
    id: 'gold_coin',
    name: '金币',
    type: 'currency',
    sprite: 'coin',
    description: '可以用于商店或特殊交互'
  },
  herb: {
    id: 'herb',
    name: '草药',
    type: 'consumable',
    sprite: 'herb',
    description: '恢复少量生命',
    effect: {
      heal: 10
    }
  },
  talent_book: {
    id: 'talent_book',
    name: '秘传书',
    type: 'consumable',
    sprite: 'book',
    description: '使用后获得一个随机天赋',
    effect: {
      grantTalent: true
    }
  },
  // 装备类道具
  omamori_health: {
    id: 'omamori_health',
    name: '健康御守',
    type: 'equipment',
    sprite: 'omamori',
    description: '装备后最大生命值 +30'
  },
  omamori_protection: {
    id: 'omamori_protection',
    name: '守护御守',
    type: 'equipment',
    sprite: 'omamori',
    description: '装备后防御力 +8'
  },
  magatama_power: {
    id: 'magatama_power',
    name: '力之勾玉',
    type: 'equipment',
    sprite: 'magatama',
    description: '装备后攻击力 +10'
  },
  magatama_spirit: {
    id: 'magatama_spirit',
    name: '灵之勾玉',
    type: 'equipment',
    sprite: 'magatama_blue',
    description: '装备后灵力 +15，回复速度 +25%'
  },
  ribbon_red: {
    id: 'ribbon_red',
    name: '红色缎带',
    type: 'equipment',
    sprite: 'ribbon',
    description: '装备后速度 +15'
  },
  chest_wood: {
    id: 'chest_wood',
    name: '木箱',
    type: 'container',
    sprite: 'chest',
    description: '封存的木箱，打开可能获得物品',
    // contents: 可掉落的物品与权重
    contents: [
      { item: 'potion_small', weight: 45 },
      { item: 'herb', weight: 25 },
      { item: 'gold_coin', weight: 35 },
      { item: 'talent_book', weight: 12 },
      { item: 'omamori_health', weight: 8 },
      { item: 'magatama_power', weight: 8 },
      { item: 'ribbon_red', weight: 6 }
    ],
    minDrop: 1,
    maxDrop: 2
  }
};
