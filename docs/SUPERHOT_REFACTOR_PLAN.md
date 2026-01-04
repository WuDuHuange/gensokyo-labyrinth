# 幻想迷宫：Superhot 弹幕引擎重构计划

> **核心理念**：时间只在你行动时流逝 (Time Only Moves When You Move)  
> **灵感来源**：SUPERHOT + 东方弹幕 + Crypt of the NecroDancer

---

## 实现进度

| 功能模块 | 状态 | 文件 |
|---------|------|------|
| TimeScaleManager | ✅ 完成 | `src/systems/TimeScaleManager.js` |
| BulletManager (向量弹幕) | ✅ 完成 | `src/systems/BulletManager.js` |
| GrazeSystem (擦弹) | ✅ 完成 | `src/systems/GrazeSystem.js` |
| LastGaspSystem (决死) | ✅ 完成 | `src/systems/LastGaspSystem.js` |
| ScreenEffects | ✅ 完成 | `src/effects/ScreenEffects.js` |
| AudioEffects | ✅ 完成 | `src/effects/AudioEffects.js` |
| Entity平滑移动 | ✅ 完成 | `src/entities/Entity.js` |
| Player自动射击 | ✅ 完成 | `src/entities/Player.js` |
| Enemy弹幕发射 | ✅ 完成 | `src/entities/Enemy.js` |
| DanmakuFairy | ✅ 完成 | `src/entities/enemies/DanmakuFairy.js` |
| NormalFairy弹幕 | ✅ 完成 | `src/entities/enemies/NormalFairy.js` |
| FastFairy弹幕 | ✅ 完成 | `src/entities/enemies/FastFairy.js` |
| 迷雾中弹幕警告 | ✅ 完成 | `src/scenes/GameScene.js` |
| 玩家子弹贴图 | ✅ 完成 | `src/scenes/BootScene.js` |

---

## 一、核心引擎重构：时间流逝系统 (The "Superhot" Engine)

### 1.1 全局时间缩放 (GlobalTimeScale)

| 状态 | 值 | 触发条件 |
|------|-----|---------|
| **静止 (Idle)** | `0.05` | 玩家无输入 |
| **行动 (Action)** | `1.0` | 玩家移动/攻击 |
| **Kill Freeze** | `0.001` | 击杀 Boss |
| **决死 (Last Gasp)** | `0.0` | 被弹幕命中瞬间 |

### 1.2 静止状态效果
- **视觉**：画面轻微去饱和 + 边缘晕影
- **听觉**：
  - BGM 应用 LowPassFilter（低通滤波，水下感）
  - 音量降至 60%
  - 叠加缓慢心跳声（~60 BPM）

### 1.3 行动状态效果
- **视觉**：色彩饱和度提升 + 动态模糊/残影
- **听觉**：
  - 滤波器瞬间移除
  - 音量恢复 100%
  - 播放清脆的"咔哒"或破风声

---

## 二、移动系统重构：格子逻辑 + 视觉补间 (Hybrid Approach)

### 2.1 移动流程

```
[输入阶段] → [执行阶段] → [结束阶段]
     │            │            │
  Grid Logic   Tween 200ms   Snap & Event
```

#### 输入阶段 (Grid Logic)
1. 玩家按方向键
2. 检查目标格子是否可通行
3. 锁定输入，开始移动流程

#### 执行阶段 (Smooth Transition)
1. 使用 Phaser Tween 进行 200ms 平滑移动
2. `GlobalTimeScale = 1.0`
3. **关键**：Hitbox 实时跟随 Sprite 移动（非停留原地）
4. 移动期间可触发擦弹判定

#### 结束阶段 (Snap)
1. Tween 结束，角色抵达新格子
2. `GlobalTimeScale = 0.05`
3. 更新逻辑坐标
4. 触发地板事件（陷阱/金币）
5. 解锁输入

### 2.2 爽点来源
- **钻缝隙**：角色侧身滑过两颗子弹中间
- **节奏感**：动-静-动-静 的视听节奏
- **真实擦弹**：移动期间 Hitbox 实时碰撞

---

## 三、弹幕系统重构：向量弹幕 (Vector-based Danmaku)

### 3.1 弹幕基础属性

```javascript
class Bullet {
    x, y          // 像素坐标
    vx, vy        // 速度向量 (pixels/sec)
    angle         // 发射角度 (radians)
    speed         // 速度标量
    radius        // 碰撞半径
    grazeRadius   // 擦弹判定半径 (> radius)
    damage        // 伤害值
    pattern       // 弹幕图案类型
}
```

### 3.2 弹幕图案类型

| 类型 | 描述 | 敌人示例 |
|------|------|---------|
| `AIMED` | 自机狙（朝玩家发射） | 普通妖精 |
| `SPREAD` | 扇形散射 | 护盾妖精 |
| `SPIRAL` | 螺旋旋转 | Boss |
| `RING` | 圆环扩散 | 死亡殉爆 |
| `RANDOM` | 随机方向 | 炮台 |

### 3.3 擦弹系统 (Graze)

```javascript
// 每帧检测
for (bullet of activeBullets) {
    dist = distance(player.hitbox, bullet)
    if (dist < bullet.grazeRadius && dist > bullet.radius) {
        if (!bullet.grazed) {
            player.mp += GRAZE_MP_GAIN  // +5 MP
            bullet.grazed = true
            playGrazeEffect()
        }
    }
}
```

### 3.4 连锁反应 (Chain Reaction)
- 敌人死亡时释放"殉爆弹幕"（螺旋扩散）
- 殉爆弹幕可伤害其他敌人
- 形成连锁击杀

---

## 四、攻击系统重构

### 4.1 自动射击 (Auto-Fire on Move)
- **触发**：玩家每移动一格
- **目标**：自动瞄准最近敌人或面朝方向
- **效果**：发射一发御札
- **设计理念**：专注躲避，自动还击

### 4.2 原地狙击 (Wait & Shoot)
- **触发**：按住 Z 键不松手
- **效果**：
  - 时间以 100% 速度流逝
  - 玩家不移动
  - 射速加倍（连射）
- **用途**：安全时快速输出 / 点杀远程敌人

### 4.3 瞬步撞击 (Dash Bash)
- **触发**：移动目标格存在敌人
- **判定**：
  - 伤害 ≥ 敌人血量 → 秒杀 + 无敌穿透
  - 伤害 < 敌人血量 → 造成伤害 + 受到反击
- **视觉**：化作一道光冲向敌人

---

## 五、决死时刻 (Last Gasp)

### 5.1 触发条件
- 玩家 Hitbox 被弹幕命中的瞬间

### 5.2 处理流程

```
[被击中] → [强制时停] → [等待输入] → [结果]
              │              │           │
          屏幕变红      0.5秒实际时间    │
                                        ├─ 按下符卡键 → 决死清弹
                                        └─ 超时 → 受到伤害
```

### 5.3 决死清弹
- 消耗：全部 MP
- 效果：全屏清除所有弹幕
- 视觉：屏幕闪白 + 冲击波效果

---

## 六、敌人行为重构：弹幕发射塔

### 6.1 敌人类型重设计

| 敌人 | 行为模式 | 弹幕类型 |
|------|---------|---------|
| **普通妖精** | 缓慢移动 + 定时射击 | AIMED (自机狙) |
| **护盾妖精** | 原地 + 护盾激活时反弹 | SPREAD (扇形) |
| **召唤妖精** | 召唤小怪 + 区域弹幕 | RING (圆环) |
| **炮台晶体** | 固定 + 高速连射 | RANDOM (随机) |
| **Boss** | 复合弹幕 + 阶段变化 | SPIRAL + 特殊 |

### 6.2 敌人更新逻辑

```javascript
update(deltaScaled) {
    // 所有行为受 GlobalTimeScale 影响
    this.shootTimer -= deltaScaled
    if (this.shootTimer <= 0) {
        this.fireBullets()
        this.shootTimer = this.shootInterval
    }
    // 移动也受时间缩放
    this.moveTimer -= deltaScaled
    // ...
}
```

---

## 七、视野与迷雾重构

### 7.1 从"看不见"到"看不清"

| 区域 | 可见度 | 显示内容 |
|------|--------|---------|
| **视野内** | 100% | 全部可见 |
| **已探索** | 50% | 地形可见，敌人/弹幕半透明 |
| **未探索** | 20% | 仅显示轮廓阴影 |

### 7.2 弹幕可见性
- **重要**：弹幕在迷雾中仍可见（半透明红色警示）
- 避免因看不见弹幕而不公平死亡

---

## 八、视觉音效反馈系统

### 8.1 Kill Freeze
- **触发**：击杀 Boss
- **效果**：
  - `GlobalTimeScale = 0.001`（近乎定格）
  - 持续 1 秒实际时间
  - 屏幕反色/闪白
  - 然后恢复正常

### 8.2 心跳 UI
- 血条和 UI 随心跳声微微缩放
- 低血量时心跳加速（120 BPM）
- 与 BGM 滤波同步

### 8.3 角色跳动特效
- 主角和 NPC 有轻微呼吸/跳动动画
- 静止时更明显（强调"暂停"感）

---

## 九、技术实现清单

### 9.1 新增文件

```
src/systems/
├── TimeScaleManager.js    # 全局时间管理
├── BulletManager.js       # 向量弹幕管理
├── GrazeSystem.js         # 擦弹检测
└── LastGaspSystem.js      # 决死时刻处理

src/effects/
├── ScreenEffects.js       # 屏幕效果（滤镜/闪烁）
└── AudioEffects.js        # 音频效果（滤波/心跳）
```

### 9.2 修改文件

| 文件 | 修改内容 |
|------|---------|
| `GameScene.js` | 集成 TimeScaleManager，重写 update |
| `Player.js` | 平滑移动 + Hitbox 实时更新 + 自动射击 |
| `Entity.js` | 支持时间缩放的移动/动画 |
| `enemies/*.js` | 改为弹幕发射器模式 |
| `FogOfWar.js` | 半透明迷雾 + 弹幕可见性 |
| `UIScene.js` | 心跳 UI + MP 条 |
| `AudioManager.js` | 滤波器 + 心跳声 |

---

## 十、开发优先级

### Phase 1: 核心引擎 (MVP)
1. ✅ TimeScaleManager
2. ✅ 平滑移动 + 实时 Hitbox
3. ✅ 基础弹幕系统

### Phase 2: 战斗系统
4. 自动射击
5. 原地狙击
6. 瞬步撞击
7. 擦弹系统

### Phase 3: 生存系统
8. 决死时刻
9. 敌人弹幕重构

### Phase 4: 打磨
10. 视觉效果（滤镜/残影）
11. 音效反馈（滤波/心跳）
12. 迷雾重构

---

## 十一、数值参考

| 参数 | 值 | 说明 |
|------|-----|------|
| `IDLE_TIME_SCALE` | 0.05 | 静止时时间流速 |
| `ACTION_TIME_SCALE` | 1.0 | 行动时时间流速 |
| `MOVE_DURATION` | 200ms | 移动补间时长 |
| `GRAZE_MP_GAIN` | 5 | 单次擦弹 MP 获取 |
| `GRAZE_RADIUS_MULT` | 2.0 | 擦弹半径 = 碰撞半径 × 2 |
| `LAST_GASP_WINDOW` | 0.5s | 决死反应时间（实际时间） |
| `BULLET_BASE_SPEED` | 100 | 弹幕基础速度 (px/s) |
| `AUTO_FIRE_DAMAGE` | 10 | 自动射击伤害 |
| `DASH_BASH_MULT` | 2.0 | 瞬步撞击伤害倍率 |

---

*文档版本: 1.0*  
*最后更新: 2026-01-05*
