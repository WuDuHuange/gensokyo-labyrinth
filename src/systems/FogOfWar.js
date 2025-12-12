/**
 * 简单战争迷雾（Fog of War）系统
 * - 跟踪已探索（explored）和当前可见（visible）瓦片
 * - 使用基于 Bresenham 的射线检测视线阻挡（墙壁阻挡）
 */
import { TileType } from './MapGenerator.js';

export default class FogOfWar {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.explored = [];
    this.visible = [];
    this._initArrays();
    this.visionRadius = 6;
  }

  _initArrays() {
    this.explored = new Array(this.height);
    this.visible = new Array(this.height);
    for (let y = 0; y < this.height; y++) {
      this.explored[y] = new Array(this.width).fill(false);
      this.visible[y] = new Array(this.width).fill(false);
    }
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
    this._initArrays();
  }

  clearVisible() {
    for (let y = 0; y < this.height; y++) {
      this.visible[y].fill(false);
    }
  }

  setVisionRadius(r) { this.visionRadius = r; }

  // Bresenham line algorithm generator
  *bresenham(x0, y0, x1, y1) {
    let dx = Math.abs(x1 - x0);
    let dy = Math.abs(y1 - y0);
    let sx = (x0 < x1) ? 1 : -1;
    let sy = (y0 < y1) ? 1 : -1;
    let err = dx - dy;

    let x = x0, y = y0;
    while (true) {
      yield [x, y];
      if (x === x1 && y === y1) break;
      let e2 = err * 2;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
    }
  }

  // 检查从 (x0,y0) 到 (x1,y1) 的直线是否被阻挡（排除目标点）
  _isBlockedByWall(mapTiles, x0, y0, x1, y1, blockers) {
    blockers = blockers || [];
    for (const [x, y] of this.bresenham(x0, y0, x1, y1)) {
      // skip starting tile
      if (x === x0 && y === y0) continue;
      // if we reached target, it's not blocked (target may be wall or floor - still visible)
      if (x === x1 && y === y1) return false;
      if (!mapTiles[y] || mapTiles[y][x] === undefined) return true;
      if (mapTiles[y][x] === TileType.WALL) return true;
      // blockers list contains objects like {x,y} or [x,y]
      for (const b of blockers) {
        try {
          const bx = Array.isArray(b) ? b[0] : b.x;
          const by = Array.isArray(b) ? b[1] : b.y;
          if (bx === x && by === y) return true;
        } catch (e) {}
      }
    }
    return false;
  }

  /**
   * 计算当前可见并更新已探索
   * @param {Array<Array<number>>} mapTiles
   * @param {number} px 玩家格子 x
   * @param {number} py 玩家格子 y
   */
  compute(mapTiles, px, py) {
    if (!mapTiles || !mapTiles.length) return;
    this.clearVisible();

    const r = Math.max(0, Math.floor(this.visionRadius));
    const x0 = px, y0 = py;

    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = x0 + dx;
        const y = y0 + dy;
        if (x < 0 || y < 0 || x >= this.width || y >= this.height) continue;
        // within radius (circle)
        if (dx * dx + dy * dy <= r * r) {
          // raycast to see if blocked
          const blocked = this._isBlockedByWall(mapTiles, x0, y0, x, y, this._blockers);
          if (!blocked) {
            this.visible[y][x] = true;
            this.explored[y][x] = true;
          }
        }
      }
    }
  }

  // 设置临时视野阻挡点（例如门），compute 时会参考这些点
  setBlockers(list) { this._blockers = list || []; }

  // 返回副本以避免外部误改
  getExplored() { return this.explored; }
  getVisible() { return this.visible; }
}
