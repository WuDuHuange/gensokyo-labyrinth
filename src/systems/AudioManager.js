export default class AudioManager {
  static init(scene) {
    AudioManager.scene = scene;
  }

  static preload(scene) {
    // 预加载三首 BGM
    scene.load.audio('music_title', 'assets/BGMS/maou_bgm_piano36.mp3');
    scene.load.audio('music_game', 'assets/BGMS/maou_game_dangeon18.mp3');
    scene.load.audio('music_boss', 'assets/BGMS/maou_bgm_neorock71b.mp3');
  }

  /**
   * 播放指定音乐，若当前已在播放相同 key 则只更新配置。
   */
  static play(key, { volume = 1, loop = true, fade = 600 } = {}) {
    if (!AudioManager.scene) return;
    if (AudioManager.currentKey === key && AudioManager.currentSound) {
      AudioManager.currentSound.setLoop(loop);
      AudioManager.currentSound.setVolume(volume);
      return;
    }

    const scene = AudioManager.scene;
    const prev = AudioManager.currentSound;
    const next = scene.sound.add(key, { loop, volume: 0 });
    next.play();

    if (prev) {
      try {
        scene.tweens.add({
          targets: prev,
          volume: 0,
          duration: fade,
          onComplete: () => { try { prev.stop(); prev.destroy(); } catch (e) {} }
        });
      } catch (e) { try { prev.stop(); prev.destroy(); } catch (err) {} }
    }

    try {
      scene.tweens.add({ targets: next, volume, duration: fade });
    } catch (e) {
      next.setVolume(volume);
    }

    AudioManager.currentSound = next;
    AudioManager.currentKey = key;
  }

  /**
   * 停止当前音乐
   */
  static stop({ fade = 400 } = {}) {
    if (!AudioManager.currentSound) return;
    const s = AudioManager.currentSound;
    if (fade > 0 && AudioManager.scene) {
      try {
        AudioManager.scene.tweens.add({
          targets: s,
          volume: 0,
          duration: fade,
          onComplete: () => { try { s.stop(); s.destroy(); } catch (e) {} }
        });
      } catch (e) { try { s.stop(); s.destroy(); } catch (err) {} }
    } else {
      try { s.stop(); s.destroy(); } catch (e) {}
    }
    AudioManager.currentSound = null;
    AudioManager.currentKey = null;
  }
}
