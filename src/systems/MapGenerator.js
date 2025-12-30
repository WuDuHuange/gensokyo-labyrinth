/**
 * 地图生成器
 * 使用 BSP 算法生成迷宫地图
 */
import { MAP_CONFIG, TILE_SIZE } from '../config/gameConfig.js';

// 瓦片类型
export const TileType = {
  WALL: 0,
  FLOOR: 1,
  EXIT: 2,
  SPAWN: 3
};

/**
 * 房间类
 */
class Room {
  constructor(x, y, width, height) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.centerX = Math.floor(x + width / 2);
    this.centerY = Math.floor(y + height / 2);
    this.type = 'normal'; // normal, spawn, boss, exit, resource, combat, danger
    this.connected = false;
    this.cleared = false; // 是否已清理（战斗房专用）
  }

  intersects(other) {
    return (
      this.x <= other.x + other.width &&
      this.x + this.width >= other.x &&
      this.y <= other.y + other.height &&
      this.y + this.height >= other.y
    );
  }
}

/**
 * 地图生成器类
 */
export default class MapGenerator {
  constructor(width = MAP_CONFIG.width, height = MAP_CONFIG.height) {
    this.width = width;
    this.height = height;
    this.tiles = [];
    this.rooms = [];
    this.spawnPoint = { x: 0, y: 0 };
    this.exitPoint = { x: 0, y: 0 };
    this.enemySpawnPoints = [];
  }

  /**
   * 生成新地图
   * @returns {Object} 包含地图数据的对象
   */
  generate() {
    // 初始化地图为墙壁
    this.initializeMap();
    
    // 生成房间
    this.generateRooms();
    
    // 连接房间
    this.connectRooms();
    
    // 设置特殊房间
    this.setupSpecialRooms();
    
    // 生成敌人出生点
    this.generateEnemySpawnPoints();

    return {
      tiles: this.tiles,
      rooms: this.rooms,
      width: this.width,
      height: this.height,
      spawnPoint: this.spawnPoint,
      exitPoint: this.exitPoint,
      enemySpawnPoints: this.enemySpawnPoints
    };
  }

  /**
   * 初始化地图为全墙壁
   */
  initializeMap() {
    this.tiles = [];
    for (let y = 0; y < this.height; y++) {
      this.tiles[y] = [];
      for (let x = 0; x < this.width; x++) {
        this.tiles[y][x] = TileType.WALL;
      }
    }
  }

  /**
   * 生成房间
   */
  generateRooms() {
    this.rooms = [];
    const maxAttempts = 100;
    let attempts = 0;

    while (this.rooms.length < MAP_CONFIG.maxRooms && attempts < maxAttempts) {
      // 随机房间尺寸
      const roomWidth = this.randomRange(MAP_CONFIG.roomMinSize, MAP_CONFIG.roomMaxSize);
      const roomHeight = this.randomRange(MAP_CONFIG.roomMinSize, MAP_CONFIG.roomMaxSize);
      
      // 随机位置（确保不超出边界）
      const x = this.randomRange(2, this.width - roomWidth - 2);
      const y = this.randomRange(2, this.height - roomHeight - 2);

      const newRoom = new Room(x, y, roomWidth, roomHeight);

      // 检查是否与现有房间重叠
      let overlaps = false;
      for (const room of this.rooms) {
        // 增加一些间距
        const expandedRoom = new Room(
          room.x - 2, room.y - 2,
          room.width + 4, room.height + 4
        );
        if (newRoom.intersects(expandedRoom)) {
          overlaps = true;
          break;
        }
      }

      if (!overlaps) {
        this.carveRoom(newRoom);
        this.rooms.push(newRoom);
      }

      attempts++;
    }
  }

  /**
   * 在地图上挖出房间
   * @param {Room} room 
   */
  carveRoom(room) {
    for (let y = room.y; y < room.y + room.height; y++) {
      for (let x = room.x; x < room.x + room.width; x++) {
        if (y >= 0 && y < this.height && x >= 0 && x < this.width) {
          this.tiles[y][x] = TileType.FLOOR;
        }
      }
    }
  }

  /**
   * 连接所有房间
   */
  connectRooms() {
    // 按位置排序房间
    const sortedRooms = [...this.rooms].sort((a, b) => {
      return (a.centerX + a.centerY) - (b.centerX + b.centerY);
    });

    // 连接相邻房间
    for (let i = 0; i < sortedRooms.length - 1; i++) {
      this.createCorridor(sortedRooms[i], sortedRooms[i + 1]);
    }

    // 额外连接一些房间增加路径多样性
    for (let i = 0; i < Math.floor(this.rooms.length / 3); i++) {
      const room1 = this.rooms[this.randomRange(0, this.rooms.length - 1)];
      const room2 = this.rooms[this.randomRange(0, this.rooms.length - 1)];
      if (room1 !== room2) {
        this.createCorridor(room1, room2);
      }
    }
  }

  /**
   * 创建走廊连接两个房间
   * @param {Room} room1 
   * @param {Room} room2 
   */
  createCorridor(room1, room2) {
    let x1 = room1.centerX;
    let y1 = room1.centerY;
    let x2 = room2.centerX;
    let y2 = room2.centerY;

    // 随机选择先水平后垂直或相反
    if (Math.random() < 0.5) {
      this.createHorizontalTunnel(x1, x2, y1);
      this.createVerticalTunnel(y1, y2, x2);
    } else {
      this.createVerticalTunnel(y1, y2, x1);
      this.createHorizontalTunnel(x1, x2, y2);
    }
  }

  /**
   * 创建水平走廊
   */
  createHorizontalTunnel(x1, x2, y) {
    const startX = Math.min(x1, x2);
    const endX = Math.max(x1, x2);
    
    for (let x = startX; x <= endX; x++) {
      if (y >= 0 && y < this.height && x >= 0 && x < this.width) {
        this.tiles[y][x] = TileType.FLOOR;
        // 走廊宽度为2
        if (y + 1 < this.height) {
          this.tiles[y + 1][x] = TileType.FLOOR;
        }
      }
    }
  }

  /**
   * 创建垂直走廊
   */
  createVerticalTunnel(y1, y2, x) {
    const startY = Math.min(y1, y2);
    const endY = Math.max(y1, y2);
    
    for (let y = startY; y <= endY; y++) {
      if (y >= 0 && y < this.height && x >= 0 && x < this.width) {
        this.tiles[y][x] = TileType.FLOOR;
        // 走廊宽度为2
        if (x + 1 < this.width) {
          this.tiles[y][x + 1] = TileType.FLOOR;
        }
      }
    }
  }

  /**
   * 设置特殊房间
   */
  setupSpecialRooms() {
    if (this.rooms.length < 2) return;

    // 第一个房间作为出生点
    const spawnRoom = this.rooms[0];
    spawnRoom.type = 'spawn';
    this.spawnPoint = {
      x: spawnRoom.centerX,
      y: spawnRoom.centerY
    };
    this.tiles[spawnRoom.centerY][spawnRoom.centerX] = TileType.SPAWN;

    // 现在：最后一个房间作为 Boss 房，出口放在 Boss 房内部（玩家需在该房内击败首领）
    const lastIndex = this.rooms.length - 1;
    const exitIndex = Math.max(0, this.rooms.length - 2);

    // 标记 boss 房并尝试扩大其尺寸以显得更大
    const bossRoom = this.rooms[lastIndex];
    bossRoom.type = 'boss';
    // 适度扩大 boss 房（在地图边界内）
    try {
      const expand = 2;
      const nx = Math.max(1, bossRoom.x - expand);
      const ny = Math.max(1, bossRoom.y - expand);
      const nw = Math.min(this.width - 2 - nx, bossRoom.width + expand * 2);
      const nh = Math.min(this.height - 2 - ny, bossRoom.height + expand * 2);
      // 修改房间并挖出额外地板
      bossRoom.x = nx;
      bossRoom.y = ny;
      bossRoom.width = Math.max(bossRoom.width, nw);
      bossRoom.height = Math.max(bossRoom.height, nh);
      bossRoom.centerX = Math.floor(bossRoom.x + bossRoom.width / 2);
      bossRoom.centerY = Math.floor(bossRoom.y + bossRoom.height / 2);
      this.carveRoom(bossRoom);
    } catch (e) {}

    // 将出口放在 boss 房内部中心
    try {
      this.tiles[bossRoom.centerY][bossRoom.centerX] = TileType.EXIT;
      this.exitPoint = { x: bossRoom.centerX, y: bossRoom.centerY };
      // 保证 bossRoom 标记仍然为 'boss'
      bossRoom.type = 'boss';
    } catch (e) {
      // 兜底：放在 spawn
      this.exitPoint = { x: this.spawnPoint.x, y: this.spawnPoint.y };
      this.tiles[this.exitPoint.y][this.exitPoint.x] = TileType.EXIT;
    }

    // 随机选择一个普通房间作为资源房（resource），放更多资源并可能有特殊入口
    const candidates = this.rooms.filter(r => r.type === 'normal');
    if (candidates.length > 0) {
      const idx = this.randomRange(0, candidates.length - 1);
      const resRoom = candidates[idx];
      resRoom.type = 'resource';
    }

    // 从剩余普通房间中选择部分作为战斗房（combat）- 进入后需清怪才能离开
    const normalRooms = this.rooms.filter(r => r.type === 'normal');
    const combatCount = Math.min(Math.floor(normalRooms.length * 0.4), 3); // 40% 或最多 3 个战斗房
    for (let i = 0; i < combatCount && normalRooms.length > 0; i++) {
      const idx = this.randomRange(0, normalRooms.length - 1);
      const combatRoom = normalRooms.splice(idx, 1)[0];
      combatRoom.type = 'combat';
    }

    // 从剩余普通房间中选择一个作为危险房（danger）- 敌人更强但掉落更好
    const remainingNormal = this.rooms.filter(r => r.type === 'normal');
    if (remainingNormal.length > 0) {
      const dangerIdx = this.randomRange(0, remainingNormal.length - 1);
      remainingNormal[dangerIdx].type = 'danger';
    }
  }

  /**
   * 生成敌人出生点
   */
  generateEnemySpawnPoints() {
    this.enemySpawnPoints = [];
    
    // 在普通房间中生成敌人出生点
    for (const room of this.rooms) {
      if (room.type === 'spawn' || room.type === 'exit') continue;

      // 每个房间1-3个敌人
      const enemyCount = this.randomRange(1, 3);
      for (let i = 0; i < enemyCount; i++) {
        const x = this.randomRange(room.x + 1, room.x + room.width - 2);
        const y = this.randomRange(room.y + 1, room.y + room.height - 2);
        
        // 确保不在出生点或出口
        if (this.tiles[y][x] === TileType.FLOOR) {
          this.enemySpawnPoints.push({ x, y, room: room });
        }
      }
    }
  }

  /**
   * 检查某个位置是否可通行
   * @param {number} x 
   * @param {number} y 
   * @returns {boolean}
   */
  isWalkable(x, y) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return false;
    }
    return this.tiles[y][x] !== TileType.WALL;
  }

  /**
   * 获取指定位置的瓦片类型
   * @param {number} x 
   * @param {number} y 
   * @returns {number}
   */
  getTileAt(x, y) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return TileType.WALL;
    }
    return this.tiles[y][x];
  }

  /**
   * 生成随机数
   * @param {number} min 
   * @param {number} max 
   * @returns {number}
   */
  randomRange(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}
