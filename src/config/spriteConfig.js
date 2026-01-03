/**
 * 角色精灵配置
 * 
 * 当你画好像素图后，只需修改这里的配置：
 * 1. 将 useCustomSprite 改为 true
 * 2. 设置 sourceSize 为你画的图片尺寸（如 64 或 128）
 * 3. 把图片放到 public/assets/sprites/ 目录下
 * 
 * 图片命名规范：
 *   - player.png      灵梦
 *   - slowFairy.png   慢速妖精
 *   - normalFairy.png 普通妖精
 *   - fastFairy.png   快速妖精
 *   - danmakuFairy.png 弹幕妖精
 * 
 * 绘制建议：
 *   - 画布使用正方形（64x64 或 128x128）
 *   - 人物脚底对齐画布底部中心
 *   - 人物可以是长方形（高大于宽），头部可超出格子
 */

export const SPRITE_CONFIG = {
  // ========== 主要配置 ==========
  
  // 是否使用自定义精灵图（设为 true 后会加载 png 文件）
  useCustomSprite: true,
  
  // 你画的图片原始尺寸（正方形边长）
  sourceSize: 128,  // 支持 64 或 128
  
  // 游戏中显示的目标尺寸（一个格子是 32x32）
  targetSize: 32,
  
  // ========== 各角色单独配置（可选覆盖） ==========
  
  player: {
    // 精灵原点：0.5, 1 表示脚底中心
    // 这样人物头部可以超出格子，更自然
    originX: 0.5,
    originY: 1,
    // 显示时的缩放（如果人物画得偏小可以调大）
    displayScale: 1.0,
    // Y轴偏移（正数向下，用于微调站立位置）
    offsetY: 16  // 因为原点在脚底，需要向下偏移半格让脚踩在格子中心
  },
  
  slowFairy: {
    originX: 0.5,
    originY: 1,
    displayScale: 1.0,
    offsetY: 16
  },
  
  normalFairy: {
    originX: 0.5,
    originY: 1,
    displayScale: 1.0,
    offsetY: 16
  },
  
  fastFairy: {
    originX: 0.5,
    originY: 0.9,  // 快速妖精稍微飘起来一点
    displayScale: 0.9,  // 稍微小一点
    offsetY: 14
  },
  
  danmakuFairy: {
    originX: 0.5,
    originY: 1,
    displayScale: 1.0,
    offsetY: 16
  },
  
  demoCrystal: {
    originX: 0.5,
    originY: 0.5,  // Boss 居中显示
    displayScale: 2.0,  // Boss 大一点
    offsetY: 0
  },
  
  smallCrystal: {
    originX: 0.5,
    originY: 0.5,
    displayScale: 1.0,
    offsetY: 0
  }
};

/**
 * 获取精灵的缩放比例
 */
export function getSpriteScale(spriteName) {
  const baseScale = SPRITE_CONFIG.targetSize / SPRITE_CONFIG.sourceSize;
  const config = SPRITE_CONFIG[spriteName] || {};
  return baseScale * (config.displayScale || 1.0);
}

/**
 * 获取精灵配置
 */
export function getSpriteConfig(spriteName) {
  return SPRITE_CONFIG[spriteName] || {
    originX: 0.5,
    originY: 0.5,
    displayScale: 1.0,
    offsetY: 0
  };
}
