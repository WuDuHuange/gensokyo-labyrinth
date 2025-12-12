/**
 * 菜单场景：暂停/继续、物品栏（即时使用）、符卡切换、存档/读档
 */
export default class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
    this.menuContainer = null;
  }

  create() {
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;

    // 半透明遮罩
    this.add.rectangle(0, 0, w * 2, h * 2, 0x000000, 0.6).setOrigin(0);

    // 主菜单容器
    const box = this.add.rectangle(w / 2, h / 2, 360, 320, 0x111122, 0.95);
    box.setStrokeStyle(2, 0xffffff, 0.12);

    const title = this.add.text(w / 2, h / 2 - 130, '游戏菜单', { fontSize: '24px', color: '#ffffff' }).setOrigin(0.5);

    const resume = this.add.text(w / 2, h / 2 - 60, '继续 (Esc)', { fontSize: '18px', color: '#aaffaa' }).setOrigin(0.5).setInteractive();
    const inventory = this.add.text(w / 2, h / 2 - 20, '物品栏 (I)', { fontSize: '18px', color: '#fff' }).setOrigin(0.5).setInteractive();
    const spellmenu = this.add.text(w / 2, h / 2 + 20, '符卡切换 (Tab)', { fontSize: '18px', color: '#fff' }).setOrigin(0.5).setInteractive();
    const saveBtn = this.add.text(w / 2, h / 2 + 60, '存档', { fontSize: '18px', color: '#fff' }).setOrigin(0.5).setInteractive();
    const loadBtn = this.add.text(w / 2, h / 2 + 100, '读档', { fontSize: '18px', color: '#fff' }).setOrigin(0.5).setInteractive();

    // 点击交互绑定
    resume.on('pointerdown', () => this.closeMenu());
    this.input.keyboard.on('keydown-ESC', () => this.closeMenu());

    inventory.on('pointerdown', () => this.openInventory());
    this.input.keyboard.on('keydown-I', () => this.openInventory());

    spellmenu.on('pointerdown', () => this.openSpellMenu());
    this.input.keyboard.on('keydown-TAB', (e) => { e.preventDefault(); this.openSpellMenu(); });

    saveBtn.on('pointerdown', () => this.saveGame());
    loadBtn.on('pointerdown', () => this.loadGame());

    this.menuContainer = this.add.container(0, 0, [box, title, resume, inventory, spellmenu, saveBtn, loadBtn]);
    this.menuContainer.setDepth(1000);
  }

  closeMenu() {
    // 恢复主场景
    this.scene.stop();
    this.scene.resume('GameScene');
  }

  openInventory() {
    // 简易物品栏：列出场景 ItemSystem 的 items 并允许点击使用（如果是消耗品）
    const game = this.scene.get('GameScene');
    const items = (game && game.itemSystem && game.itemSystem.items) ? game.itemSystem.items.slice() : [];

    // 清空原 UI 并显示简易列表
    this.menuContainer.removeAll(true);
    const w = this.cameras.main.width, h = this.cameras.main.height;
    const box = this.add.rectangle(w/2, h/2, 420, 360, 0x0f0f1a, 0.98);
    box.setStrokeStyle(2, 0xffffff, 0.12);
    const title = this.add.text(w/2, h/2 - 160, '物品栏', { fontSize: '22px', color: '#fff' }).setOrigin(0.5);

    const listYStart = h/2 - 120;
    items.forEach((it, idx) => {
      const text = this.add.text(w/2 - 140, listYStart + idx * 36, `${it.id} @ (${it.x},${it.y})`, { fontSize: '18px', color: '#fff' }).setInteractive();
      text.on('pointerdown', async () => {
        // 立即尝试拾取并应用（如果仍在地面）
        try { await game.itemSystem.tryPickupAt(it.x, it.y, game.player); } catch (e) {}
        // 重新打开菜单主界面
        this.scene.restart();
      });
      this.menuContainer.add(text);
    });

    const back = this.add.text(w/2, h/2 + 160, '返回', { fontSize: '18px', color: '#aaffaa' }).setOrigin(0.5).setInteractive();
    back.on('pointerdown', () => this.scene.restart());
    this.menuContainer.add([box, title, back]);
    this.menuContainer.setDepth(1000);
  }

  openSpellMenu() {
    // 暂时跳回主场景并触发场景内的符卡切换UI（若有）
    const game = this.scene.get('GameScene');
    if (game && game.scene) {
      // 若 UIScene 有符卡UI可以切换，这里暂时只提示
      this.scene.stop();
      this.scene.resume('GameScene');
      game.events.emit('openSpellMenu');
    }
  }

  saveGame() {
    const game = this.scene.get('GameScene');
    if (!game) return;
    try {
      const state = {
        player: game.player.getStats(),
        floor: game.floor,
        enemies: game.enemies.map(e => ({ id: e.name, x: e.tileX, y: e.tileY, hp: e.hp })),
        map: { seed: game.mapData.seed || null }
      };
      localStorage.setItem('genso_save', JSON.stringify(state));
      this.scene.get('UIScene')?.events?.emit('showMessage', '已存档');
    } catch (e) { console.error('save failed', e); }
  }

  loadGame() {
    const data = localStorage.getItem('genso_save');
    if (!data) return;
    try {
      const state = JSON.parse(data);
      const game = this.scene.get('GameScene');
      if (!game) return;
      // 只做简单恢复：玩家 HP + floor
      game.player.hp = state.player.hp || game.player.hp;
      game.player.tileX = state.player.position.x || game.player.tileX;
      game.player.tileY = state.player.position.y || game.player.tileY;
      game.floor = state.floor || game.floor;
      // 更新玩家精灵位置
      game.player.sprite.setPosition(game.player.tileX * 32 + 16, game.player.tileY * 32 + 16);
      this.scene.get('UIScene')?.events?.emit('showMessage', '已读档（仅恢复基础状态）');
    } catch (e) { console.error('load failed', e); }
  }
}
