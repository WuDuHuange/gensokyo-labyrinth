# 精灵图目录

将你画好的角色图放到这个目录下。

## 文件命名

| 文件名 | 角色 |
|--------|------|
| player.png | 灵梦 |
| slowFairy.png | 慢速妖精 |
| normalFairy.png | 普通妖精 |
| fastFairy.png | 快速妖精 |
| danmakuFairy.png | 弹幕妖精 |

## 绘制建议

1. **画布尺寸**: 64×64 或 128×128（正方形）
2. **人物位置**: 脚底对齐画布底部中心
3. **人物比例**: 可以是长方形（高大于宽），头部可超出格子

## 启用自定义精灵

画好图片后，修改 `src/config/spriteConfig.js`:

```javascript
// 改为 true
useCustomSprite: true,

// 设置你的图片尺寸
sourceSize: 64,  // 或 128
```
