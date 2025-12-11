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
