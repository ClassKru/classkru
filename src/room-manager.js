import { GAME } from './config.js';
import { projectIso } from './isometric.js';

const asColor = (value) => Phaser.Display.Color.HexStringToColor(value).color;

export class RoomManager {
  constructor(scene) {
    this.scene = scene;
    this.objects = [];
    this.floor = null;
    this.walls = null;
    this.exitGlow = null;
    this.exitPortal = null;
    this.current = null;
    this.exitUnlocked = false;
  }

  keep(object) {
    this.objects.push(object);
    return object;
  }

  draw(room) {
    this.clear();
    this.current = room;
    this.exitUnlocked = false;
    this.drawWalls(room);
    this.drawFloor(room);
    this.drawProps(room);
    this.drawDoors(room);
  }

  drawWalls(room) {
    const g = this.scene.add.graphics().setDepth(0);
    const corners = [
      projectIso(0, 0, this.scene.scale.width),
      projectIso(GAME.roomSize, 0, this.scene.scale.width),
      projectIso(GAME.roomSize, GAME.roomSize, this.scene.scale.width),
      projectIso(0, GAME.roomSize, this.scene.scale.width),
    ];
    g.fillStyle(asColor(room.wall), 0.95);
    g.fillPoints([corners[0], corners[1], { x: corners[1].x, y: corners[1].y - 74 }, { x: corners[0].x, y: corners[0].y - 74 }], true);
    g.fillStyle(asColor(room.wall) ^ 0x151515, 0.94);
    g.fillPoints([corners[1], corners[2], { x: corners[2].x, y: corners[2].y - 74 }, { x: corners[1].x, y: corners[1].y - 74 }], true);
    g.lineStyle(3, 0xffffff, 0.32);
    g.strokePoints([...corners, corners[0]], true);
    g.fillStyle(0xfff8e8, 0.75);
    for (let i = 0; i < 5; i += 1) {
      const x = 312 + i * 84;
      g.fillRoundedRect(x, 38 + (i % 2) * 12, 24, 37, 10);
      g.fillStyle(asColor(room.accent), 0.78);
      g.fillCircle(x + 12, 54 + (i % 2) * 12, 4);
      g.fillStyle(0xfff8e8, 0.75);
    }
    this.walls = this.keep(g);
  }

  drawFloor(room) {
    const g = this.scene.add.graphics().setDepth(1);
    const width = GAME.tileWidth;
    const height = GAME.tileHeight;
    for (let u = 0; u < GAME.roomSize; u += 1) {
      for (let v = 0; v < GAME.roomSize; v += 1) {
        const point = projectIso(u + 0.5, v + 0.5, this.scene.scale.width);
        const color = asColor(room.floor[(u * 2 + v + (u % 2)) % room.floor.length]);
        g.fillStyle(color, 1);
        g.lineStyle(1, 0xd1c6d7, 0.48);
        g.fillPoints([
          { x: point.x, y: point.y - height / 2 },
          { x: point.x + width / 2, y: point.y },
          { x: point.x, y: point.y + height / 2 },
          { x: point.x - width / 2, y: point.y },
        ], true);
        g.strokePoints([
          { x: point.x, y: point.y - height / 2 },
          { x: point.x + width / 2, y: point.y },
          { x: point.x, y: point.y + height / 2 },
          { x: point.x - width / 2, y: point.y },
          { x: point.x, y: point.y - height / 2 },
        ], false);
      }
    }
    this.floor = this.keep(g);
    const rugPoint = projectIso(5, 6.2, this.scene.scale.width);
    const rug = this.scene.add.ellipse(rugPoint.x, rugPoint.y, 122, 52, asColor(room.accent), 0.12).setStrokeStyle(2, asColor(room.accent), 0.58).setDepth(2);
    this.keep(rug);
  }

  drawProps(room) {
    room.obstacles.forEach((obstacle, index) => {
      const p = projectIso(obstacle.x, obstacle.y, this.scene.scale.width);
      const shadow = this.scene.add.ellipse(p.x, p.y + 5, 43, 18, 0x54406f, 0.18).setDepth(p.y + 3);
      this.keep(shadow);
      if (obstacle.kind === 'crystal') {
        const crystal = this.scene.add.graphics().setDepth(p.y + 16);
        crystal.fillStyle(0xa9e7df, 0.95);
        crystal.fillPoints([{ x: p.x, y: p.y - 28 }, { x: p.x + 16, y: p.y - 5 }, { x: p.x, y: p.y + 14 }, { x: p.x - 16, y: p.y - 5 }], true);
        crystal.fillStyle(0xe9fff9, 0.78);
        crystal.fillPoints([{ x: p.x, y: p.y - 24 }, { x: p.x + 3, y: p.y - 4 }, { x: p.x, y: p.y + 8 }, { x: p.x - 3, y: p.y - 4 }], true);
        this.keep(crystal);
      } else {
        const cap = this.scene.add.ellipse(p.x, p.y - 10, 34, 19, 0xf2a9a3, 1).setStrokeStyle(2, 0xd88794, 0.8).setDepth(p.y + 17);
        const stalk = this.scene.add.rectangle(p.x, p.y - 2, 12, 19, 0xffefcf, 1).setDepth(p.y + 15);
        const dots = this.scene.add.graphics().setDepth(p.y + 18);
        dots.fillStyle(0xffffff, 0.85);
        dots.fillCircle(p.x - 7, p.y - 12, 2.2);
        dots.fillCircle(p.x + 4, p.y - 15, 2.5);
        dots.fillCircle(p.x + 10, p.y - 8, 1.8);
        this.keep(cap);
        this.keep(stalk);
        this.keep(dots);
      }
    });
  }

  drawDoors(room) {
    const entry = projectIso(5, 9.86, this.scene.scale.width);
    const exit = projectIso(room.exit.x, room.exit.y, this.scene.scale.width);
    const entryDoor = this.scene.add.graphics().setDepth(8);
    entryDoor.fillStyle(0x6d5d85, 0.95);
    entryDoor.fillRoundedRect(entry.x - 36, entry.y - 63, 72, 63, 19);
    entryDoor.fillStyle(0xbba9dc, 1);
    entryDoor.fillRoundedRect(entry.x - 28, entry.y - 57, 56, 58, 15);
    entryDoor.fillStyle(0x7865a5, 1);
    entryDoor.fillRoundedRect(entry.x - 21, entry.y - 49, 42, 49, 12);
    this.keep(entryDoor);
    this.exitPortal = this.keep(this.scene.add.graphics().setDepth(8));
    this.drawPortal(room, false);
    this.exitGlow = this.keep(this.scene.add.ellipse(exit.x, exit.y - 24, 76, 86, 0xa9ead9, 0.08).setDepth(7));
    this.scene.exitPoint = { x: room.exit.x, y: room.exit.y, screenX: exit.x, screenY: exit.y };
  }

  setExitUnlocked(unlocked) {
    this.exitUnlocked = unlocked;
    const room = this.current;
    if (!room) return;
    if (this.exitGlow) this.exitGlow.setFillStyle(unlocked ? 0x9cebd8 : 0xa9ead9, unlocked ? 0.3 : 0.08);
    this.drawPortal(room, unlocked);
  }

  drawPortal(room, unlocked) {
    if (!this.exitPortal) return;
    const exit = projectIso(room.exit.x, room.exit.y, this.scene.scale.width);
    const portal = this.exitPortal;
    portal.clear();
    portal.fillStyle(0x7f6c9f, 0.95);
    portal.fillRoundedRect(exit.x - 39, exit.y - 75, 78, 76, 22);
    portal.fillStyle(0xe8cf86, 1);
    portal.fillRoundedRect(exit.x - 31, exit.y - 70, 62, 72, 19);
    portal.fillStyle(unlocked ? 0x91dec5 : 0xa994d9, unlocked ? 0.9 : 0.32);
    portal.fillRoundedRect(exit.x - 25, exit.y - 64, 50, 66, 16);
    portal.fillStyle(0xc3ecde, unlocked ? 0.95 : 0.4);
    portal.fillCircle(exit.x, exit.y - 69, 7);
  }

  update(time) {
    if (!this.exitGlow) return;
    const pulse = 0.07 + (Math.sin(time * (this.exitUnlocked ? 4 : 1.8)) + 1) * (this.exitUnlocked ? 0.11 : 0.025);
    this.exitGlow.setAlpha(this.exitUnlocked ? pulse : pulse * 0.38);
  }

  clear() {
    this.objects.forEach((object) => object?.destroy?.());
    this.objects.length = 0;
    this.floor = null;
    this.walls = null;
    this.exitGlow = null;
    this.exitPortal = null;
  }

  destroy() {
    this.clear();
    this.current = null;
  }
}
