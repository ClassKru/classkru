const PhaserLib = window.Phaser;

export class EffectPool {
  constructor(scene, size = 28) {
    this.scene = scene;
    this.items = [];
    for (let i = 0; i < size; i += 1) {
      const sprite = scene.add.sprite(-100, -100, 'atlas', 28 + (i % 4)).setVisible(false).setActive(false).setDepth(800);
      this.items.push(sprite);
    }
    this.lightning = Array.from({ length: 3 }, () => scene.add.graphics().setVisible(false).setDepth(790));
    this.cursor = 0;
  }

  take(frame, x, y) {
    const item = this.items[this.cursor];
    this.cursor = (this.cursor + 1) % this.items.length;
    this.scene.tweens.killTweensOf(item);
    item.setTexture('atlas', frame).setPosition(x, y).setAlpha(1).setScale(0.6).setAngle(0).setVisible(true).setActive(true);
    return item;
  }

  burstAtScreen(x, y, count = 6, frame = 30) {
    for (let i = 0; i < count; i += 1) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.35;
      const distance = 14 + Math.random() * 24;
      const item = this.take(frame + (i % 2), x + Math.cos(angle) * 4, y + Math.sin(angle) * 4);
      this.scene.tweens.add({
        targets: item,
        x: item.x + Math.cos(angle) * distance,
        y: item.y + Math.sin(angle) * distance,
        alpha: 0,
        scale: 0.08,
        angle: PhaserLib.Math.Between(-80, 80),
        duration: 360 + Math.random() * 180,
        ease: 'Cubic.Out',
        onComplete: () => item.setVisible(false).setActive(false),
      });
    }
  }

  burstAtWorld(x, y, count = 6, frame = 30) {
    const point = this.scene.project(x, y);
    this.burstAtScreen(point.x, point.y - 6, count, frame);
  }

  projectile(from, to, frame, onComplete) {
    const item = this.take(frame, from.x, from.y);
    item.setScale(frame >= 24 ? 0.9 : 0.65);
    this.scene.tweens.add({
      targets: item,
      x: to.x,
      y: to.y,
      scale: 0.2,
      angle: 300,
      duration: 310,
      ease: 'Cubic.In',
      onComplete: () => {
        item.setVisible(false).setActive(false);
        onComplete?.();
      },
    });
  }

  lightning(from, to, index = 0) {
    const line = this.lightning[index % this.lightning.length];
    this.scene.tweens.killTweensOf(line);
    line.clear().setVisible(true).setAlpha(1);
    const points = [];
    const count = 8;
    for (let i = 0; i <= count; i += 1) {
      const t = i / count;
      const wiggle = i === 0 || i === count ? 0 : PhaserLib.Math.Between(-8, 8);
      points.push(new PhaserLib.Math.Vector2(from.x + (to.x - from.x) * t + wiggle, from.y + (to.y - from.y) * t + (i === 0 || i === count ? 0 : PhaserLib.Math.Between(-5, 5))));
    }
    line.lineStyle(7, 0x9bdcff, 0.28).strokePoints(points);
    line.lineStyle(3, 0xfff3ab, 1).strokePoints(points);
    this.scene.tweens.add({ targets: line, alpha: 0, duration: 240, onComplete: () => line.clear().setVisible(false) });
  }

  destroy() {
    this.items.forEach((item) => item.destroy());
    this.lightning.forEach((line) => line.destroy());
    this.items.length = 0;
    this.lightning.length = 0;
  }
}
