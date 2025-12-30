/**
 * 简化版菜单场景，避免使用高级语法以兼容现有构建流程。
 */
import { ITEM_CONFIG } from '../config/gameConfig.js';

export default class MenuScene extends Phaser.Scene {
  constructor() {
    // 这个文件作为游戏内暂停菜单，使用 InGameMenu 作为场景 key
    super({ key: 'InGameMenu' });
  }

  create() {
    var width = this.cameras.main.width;
    var height = this.cameras.main.height;

    // 背景遮罩
    this.add.rectangle(0, 0, width * 2, height * 2, 0x000000, 0.6).setOrigin(0);

    var box = this.add.rectangle(width/2, height/2, 360, 280, 0x101018, 0.98);
    box.setStrokeStyle(2, 0xffffff, 0.1);

    this.add.text(width/2, height/2 - 110, '游戏菜单', { fontSize: '24px', color: '#ffffff' }).setOrigin(0.5);

    var resume = this.add.text(width/2, height/2 - 50, '继续 (Esc)', { fontSize: '18px', color: '#ffffff' }).setOrigin(0.5).setInteractive();
    var inv = this.add.text(width/2, height/2 - 10, '物品栏 (I)', { fontSize: '18px', color: '#ffffff' }).setOrigin(0.5).setInteractive();
    var spell = this.add.text(width/2, height/2 + 30, '符卡切换 (Tab)', { fontSize: '18px', color: '#ffffff' }).setOrigin(0.5).setInteractive();
    var saveBtn = this.add.text(width/2, height/2 + 70, '存档', { fontSize: '16px', color: '#ffffff' }).setOrigin(0.5).setInteractive();
    var loadBtn = this.add.text(width/2, height/2 + 100, '读档', { fontSize: '16px', color: '#ffffff' }).setOrigin(0.5).setInteractive();

    // 存储菜单选项用于键盘导航
    this.menuItems = [resume, inv, spell, saveBtn, loadBtn];
    this.menuActions = [
      function() { self.closeMenu(); },
      function() { self.openInventory(); },
      function() { self.openSpellMenu(); },
      function() { self.saveGame(); },
      function() { self.loadGame(); }
    ];
    this.selectedIndex = 0;

    var self = this;
    // 点击
    resume.on('pointerdown', function() { self.closeMenu(); });
    inv.on('pointerdown', function() { self.openInventory(); });
    spell.on('pointerdown', function() { self.openSpellMenu(); });
    saveBtn.on('pointerdown', function() { self.saveGame(); });
    loadBtn.on('pointerdown', function() { self.loadGame(); });

    // hover 高亮（光标在选项上时绿色并略微放大）
    var hoverIn = function(txt) { try { txt.setColor('#88ff88'); txt.setScale(1.06); } catch (e) {} };
    var hoverOut = function(txt, defaultColor) { try { txt.setColor(defaultColor); txt.setScale(1); } catch (e) {} };
    resume.on('pointerover', function() { self.selectedIndex = 0; self.updateMenuSelection(); });
    inv.on('pointerover', function() { self.selectedIndex = 1; self.updateMenuSelection(); });
    spell.on('pointerover', function() { self.selectedIndex = 2; self.updateMenuSelection(); });
    saveBtn.on('pointerover', function() { self.selectedIndex = 3; self.updateMenuSelection(); });
    loadBtn.on('pointerover', function() { self.selectedIndex = 4; self.updateMenuSelection(); });

    // 键盘绑定（在 MenuScene 内部监听）
    this.input.keyboard.on('keydown-ESC', function() { self.closeMenu(); });
    this.input.keyboard.on('keydown-I', function() { self.openInventory(); });
    this.input.keyboard.on('keydown-TAB', function(e) { e.preventDefault(); self.openSpellMenu(); });

    // 上下键选择
    this.input.keyboard.on('keydown-UP', function() { self.navigateMenu(-1); });
    this.input.keyboard.on('keydown-DOWN', function() { self.navigateMenu(1); });
    this.input.keyboard.on('keydown-W', function() { self.navigateMenu(-1); });
    this.input.keyboard.on('keydown-S', function() { self.navigateMenu(1); });

    // Z 或 Enter 确定
    this.input.keyboard.on('keydown-Z', function() { self.confirmSelection(); });
    this.input.keyboard.on('keydown-ENTER', function() { self.confirmSelection(); });

    // 初始高亮第一个选项
    this.updateMenuSelection();
  }

  // 导航菜单（上下移动）
  navigateMenu(direction) {
    // 如果物品栏子菜单打开，交给子菜单处理
    if (this.inventoryContainer) {
      this.navigateInventory(direction);
      return;
    }
    this.selectedIndex = (this.selectedIndex + direction + this.menuItems.length) % this.menuItems.length;
    this.updateMenuSelection();
  }

  // 更新菜单选中高亮
  updateMenuSelection() {
    for (var i = 0; i < this.menuItems.length; i++) {
      var item = this.menuItems[i];
      if (i === this.selectedIndex) {
        try { item.setColor('#88ff88'); item.setScale(1.06); } catch (e) {}
      } else {
        try { item.setColor('#ffffff'); item.setScale(1); } catch (e) {}
      }
    }
  }

  // 确认选择
  confirmSelection() {
    // 如果物品栏子菜单打开，确认子菜单选项
    if (this.inventoryContainer) {
      this.confirmInventorySelection();
      return;
    }
    if (this.menuActions[this.selectedIndex]) {
      this.menuActions[this.selectedIndex]();
    }
  }

  closeMenu() {
    this.scene.stop();
    this.scene.resume('GameScene');
  }

  openInventory() {
    var game = this.scene.get('GameScene');
    if (!game) return;

    // 若已有 inventoryContainer，先销毁
    try { if (this.inventoryContainer) { this.inventoryContainer.destroy(true); this.inventoryContainer = null; } } catch (e) {}

    var inv = game.player.inventory || [];
    var width = this.cameras.main.width, height = this.cameras.main.height;

    // 合并重复道具：统计数量
    var itemCounts = {};
    var itemOrder = []; // 保留顺序
    for (var i = 0; i < inv.length; i++) {
      var itemId = inv[i];
      if (itemCounts[itemId] === undefined) {
        itemCounts[itemId] = 0;
        itemOrder.push(itemId);
      }
      itemCounts[itemId]++;
    }

    // 创建不透明带边框的二级菜单框，覆盖一级菜单
    var container = this.add.container(0, 0);
    var overlay = this.add.rectangle(0, 0, width * 2, height * 2, 0x000000, 0.5).setOrigin(0);
    container.add(overlay);

    // 主框（不透明，带边框）
    var boxW = 420, boxH = 360;
    var box = this.add.rectangle(width/2, height/2, boxW, boxH, 0x0e0e14, 1.0);
    box.setStrokeStyle(2, 0xffffff, 0.12);
    container.add(box);

    var title = this.add.text(width/2, height/2 - boxH/2 + 28, '物品栏 (上下选择 / Z或Enter使用 / X或Esc返回)', { fontSize: '14px', color: '#ffffff' }).setOrigin(0.5);
    container.add(title);

    // 存储物品栏选项用于键盘导航
    this.invItems = [];
    this.invItemData = []; // { itemId, canUse }
    this.invSelectedIndex = 0;

    var self = this;

    if (!inv || inv.length === 0) {
      var empty = this.add.text(width/2, height/2 - 20, '背包为空', { fontSize: '18px', color: '#cccccc' }).setOrigin(0.5);
      container.add(empty);
    } else {
      for (var idx = 0; idx < itemOrder.length; idx++) {
        (function(itemId, displayIdx, selfRef, gameRef) {
          var cfg = ITEM_CONFIG[itemId] || { name: itemId };
          var count = itemCounts[itemId];
          var y = height/2 - boxH/2 + 68 + displayIdx * 34;

          // 显示名称和数量
          var displayText = cfg.name;
          if (count > 1) {
            displayText += ' x' + count;
          }

          // 判断是否可使用（金币不可使用）
          var canUse = cfg.type !== 'currency';
          var textColor = canUse ? '#ffffff' : '#888888';

          var txt = selfRef.add.text(width/2 - boxW/2 + 24, y, displayText, { fontSize: '16px', color: textColor }).setInteractive();

          // hover 与点击
          txt.on('pointerover', function() {
            selfRef.invSelectedIndex = displayIdx;
            selfRef.updateInventorySelection();
          });
          txt.on('pointerdown', function() {
            if (!canUse) {
              // 金币不可使用，显示提示
              var ui = selfRef.scene.get('UIScene');
              if (ui && ui.events) ui.events.emit('showMessage', '金币不能直接使用');
              return;
            }
            // 找到该物品在原背包中的第一个索引
            var realIdx = gameRef.player.inventory.indexOf(itemId);
            if (realIdx !== -1) {
              try { gameRef.player.useItem(realIdx); } catch (e) {}
            }
            // 刷新背包显示
            try { container.destroy(true); } catch (e) {}
            selfRef.openInventory();
          });

          selfRef.invItems.push(txt);
          selfRef.invItemData.push({ itemId: itemId, canUse: canUse });
          container.add(txt);
        })(itemOrder[idx], idx, this, game);
      }
    }

    // 返回按钮
    var back = this.add.text(width/2, height/2 + boxH/2 - 28, '返回 (X/Esc)', { fontSize: '18px', color: '#ffffff' }).setOrigin(0.5).setInteractive();
    back.on('pointerover', function() {
      self.invSelectedIndex = self.invItems.length; // 最后一个位置是返回
      self.updateInventorySelection();
    });
    back.on('pointerdown', function() { try { container.destroy(true); self.inventoryContainer = null; self.invItems = null; } catch (e) {} });
    this.invItems.push(back);
    this.invItemData.push({ itemId: '__back__', canUse: true });
    container.add(back);

    this.inventoryContainer = container;

    // 键盘：X 或 Esc 返回
    this.input.keyboard.once('keydown-X', function() {
      if (self.inventoryContainer) {
        try { self.inventoryContainer.destroy(true); self.inventoryContainer = null; self.invItems = null; } catch (e) {}
      }
    });

    // 初始高亮
    this.updateInventorySelection();
  }

  // 导航物品栏
  navigateInventory(direction) {
    if (!this.invItems || this.invItems.length === 0) return;
    this.invSelectedIndex = (this.invSelectedIndex + direction + this.invItems.length) % this.invItems.length;
    this.updateInventorySelection();
  }

  // 更新物品栏选中高亮
  updateInventorySelection() {
    if (!this.invItems) return;
    for (var i = 0; i < this.invItems.length; i++) {
      var item = this.invItems[i];
      var data = this.invItemData[i];
      var isSelected = (i === this.invSelectedIndex);
      var baseColor = (data && data.canUse === false) ? '#888888' : '#ffffff';

      if (isSelected) {
        try { item.setColor('#88ff88'); item.setScale(1.06); } catch (e) {}
      } else {
        try { item.setColor(baseColor); item.setScale(1); } catch (e) {}
      }
    }
  }

  // 确认物品栏选择
  confirmInventorySelection() {
    if (!this.invItems || this.invSelectedIndex < 0) return;

    var data = this.invItemData[this.invSelectedIndex];
    if (!data) return;

    // 返回按钮
    if (data.itemId === '__back__') {
      try { this.inventoryContainer.destroy(true); this.inventoryContainer = null; this.invItems = null; } catch (e) {}
      return;
    }

    // 金币不可使用
    if (!data.canUse) {
      var ui = this.scene.get('UIScene');
      if (ui && ui.events) ui.events.emit('showMessage', '金币不能直接使用');
      return;
    }

    // 使用道具
    var game = this.scene.get('GameScene');
    if (!game || !game.player) return;

    var realIdx = game.player.inventory.indexOf(data.itemId);
    if (realIdx !== -1) {
      try { game.player.useItem(realIdx); } catch (e) {}
    }

    // 刷新背包显示
    var self = this;
    try { this.inventoryContainer.destroy(true); this.inventoryContainer = null; } catch (e) {}
    this.openInventory();
  }

  openSpellMenu() {
    var game = this.scene.get('GameScene');
    if (!game) { this.closeMenu(); return; }
    // 触发 GameScene 的事件，UI 可以监听
    game.events.emit('openSpellMenu');
    this.closeMenu();
  }

  saveGame() {
    var game = this.scene.get('GameScene');
    if (!game) return;
    try {
      var state = { player: game.player.getStats(), floor: game.floor };
      localStorage.setItem('genso_save', JSON.stringify(state));
      var ui = this.scene.get('UIScene'); if (ui && ui.events) ui.events.emit('showMessage', '已存档');
    } catch (e) { console.error('save failed', e); }
  }

  loadGame() {
    var data = localStorage.getItem('genso_save');
    if (!data) return;
    try {
      var state = JSON.parse(data);
      var game = this.scene.get('GameScene'); if (!game) return;
      game.player.hp = (state.player && state.player.hp) || game.player.hp;
      var ui = this.scene.get('UIScene'); if (ui && ui.events) ui.events.emit('showMessage', '已读档（仅恢复基础状态）');
    } catch (e) { console.error('load failed', e); }
  }
}
