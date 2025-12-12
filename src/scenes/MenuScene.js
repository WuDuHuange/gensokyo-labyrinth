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

    var resume = this.add.text(width/2, height/2 - 50, '继续 (Esc)', { fontSize: '18px', color: '#aaffaa' }).setOrigin(0.5).setInteractive();
    var inv = this.add.text(width/2, height/2 - 10, '物品栏 (I)', { fontSize: '18px', color: '#fff' }).setOrigin(0.5).setInteractive();
    var spell = this.add.text(width/2, height/2 + 30, '符卡切换 (Tab)', { fontSize: '18px', color: '#fff' }).setOrigin(0.5).setInteractive();
    var saveBtn = this.add.text(width/2, height/2 + 70, '存档', { fontSize: '16px', color: '#fff' }).setOrigin(0.5).setInteractive();
    var loadBtn = this.add.text(width/2, height/2 + 100, '读档', { fontSize: '16px', color: '#fff' }).setOrigin(0.5).setInteractive();

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
    resume.on('pointerover', function() { hoverIn(resume); }); resume.on('pointerout', function() { hoverOut(resume, '#aaffaa'); });
    inv.on('pointerover', function() { hoverIn(inv); }); inv.on('pointerout', function() { hoverOut(inv, '#ffffff'); });
    spell.on('pointerover', function() { hoverIn(spell); }); spell.on('pointerout', function() { hoverOut(spell, '#ffffff'); });
    saveBtn.on('pointerover', function() { hoverIn(saveBtn); }); saveBtn.on('pointerout', function() { hoverOut(saveBtn, '#ffffff'); });
    loadBtn.on('pointerover', function() { hoverIn(loadBtn); }); loadBtn.on('pointerout', function() { hoverOut(loadBtn, '#ffffff'); });

    // 键盘绑定（在 MenuScene 内部监听）
    this.input.keyboard.on('keydown-ESC', function() { self.closeMenu(); });
    this.input.keyboard.on('keydown-I', function() { self.openInventory(); });
    this.input.keyboard.on('keydown-TAB', function(e) { e.preventDefault(); self.openSpellMenu(); });
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

    // 创建不透明带边框的二级菜单框，覆盖一级菜单
    var container = this.add.container(0, 0);
    var overlay = this.add.rectangle(0, 0, width * 2, height * 2, 0x000000, 0.5).setOrigin(0);
    container.add(overlay);

    // 主框（不透明，带边框）
    var boxW = 420, boxH = 360;
    var box = this.add.rectangle(width/2, height/2, boxW, boxH, 0x0e0e14, 1.0);
    box.setStrokeStyle(2, 0xffffff, 0.12);
    container.add(box);

    var title = this.add.text(width/2, height/2 - boxH/2 + 28, '物品栏', { fontSize: '22px', color: '#ffffff' }).setOrigin(0.5);
    container.add(title);

    if (!inv || inv.length === 0) {
      var empty = this.add.text(width/2, height/2 - 20, '背包为空', { fontSize: '18px', color: '#cccccc' }).setOrigin(0.5);
      container.add(empty);
    } else {
      for (var i = 0; i < inv.length; i++) {
        (function(itemId, idx, selfRef, gameRef) {
          var cfg = ITEM_CONFIG[itemId] || { name: itemId };
          var y = height/2 - boxH/2 + 68 + idx * 34;
          var txt = selfRef.add.text(width/2 - boxW/2 + 24, y, cfg.name, { fontSize: '16px', color: '#ffffff' }).setInteractive();
          // hover 高亮
          txt.on('pointerover', function() { try { txt.setColor('#88ff88'); txt.setScale(1.04); } catch (e) {} });
          txt.on('pointerout', function() { try { txt.setColor('#ffffff'); txt.setScale(1); } catch (e) {} });
          txt.on('pointerdown', function() {
            try { gameRef.player.useItem(idx); } catch (e) {}
            // 刷新背包显示
            try { container.destroy(true); } catch (e) {}
            selfRef.openInventory();
          });
          container.add(txt);
        })(inv[i], i, this, game);
      }
    }

    var back = this.add.text(width/2, height/2 + boxH/2 - 28, '返回', { fontSize: '18px', color: '#aaffaa' }).setOrigin(0.5).setInteractive();
    back.on('pointerover', function() { try { back.setColor('#88ff88'); back.setScale(1.04); } catch (e) {} });
    back.on('pointerout', function() { try { back.setColor('#aaffaa'); back.setScale(1); } catch (e) {} });
    var selfRef = this;
    back.on('pointerdown', function() { try { container.destroy(true); selfRef.inventoryContainer = null; } catch (e) {} });
    container.add(back);

    this.inventoryContainer = container;
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
