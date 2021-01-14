import {Scene} from "@babylonjs/core/scene";
import {SpriteMgr} from "./spriteMgr";
import {ThinstanceMgr} from "./thinstanceMgr";
import {Direction, KindOfMarker, Layout, LayoutMgr, MAX_SPRITE_TEXT_WIDTH, Offsets} from "./model";

export class RingLayoutMgr implements LayoutMgr {
    spriteCount = 0;

    constructor(public scene: Scene, public spriteMgr: SpriteMgr, public thinstanceMgr: ThinstanceMgr) {
    }

    addSprite(rawValue: any, x: number, y: number, z: number, direction: Direction): Offsets {
        const sprite = this.spriteMgr.makeSprite(rawValue, x, y, z);

        // Adjust based on direction -- we want x + z to be the middle of the sprite, not the left corner.
        if (direction === Direction.xDirection) {
            x += sprite.width / 2;
        } else if (direction === Direction.zDirection) {
            z += sprite.width / 2;
        } else {
            throw 'Bad direction';
        }

        sprite.position.x = x;
        sprite.position.y = y;
        sprite.position.z = z;
        // console.log(`addSprite "${text}" at (${x}, ${y}, ${z}), sprite width=${sprite.width}`);
        if (direction === Direction.xDirection) {
            return {xOffset: sprite.width, zOffset: 0};
        } else if (direction === Direction.zDirection) {
            return {xOffset: 0, zOffset: sprite.width};
        } else {
            throw 'Bad direction';
        }
    }

    private displayJsonRingRec(json: any, x: number, y: number, z: number, direction: Direction): Offsets {
        const offsets: Offsets = {xOffset: 0, zOffset: 0};
        if (json instanceof Array) {
            // Arrays are stacked in z-direction, each element goes in x-direction.
            y -= 4;
            const childrenCount = json.length;
            const angleStep = Math.PI * 2 / childrenCount;

            // Calculate circumference.
            const maxWidthOfEachChildGuess = MAX_SPRITE_TEXT_WIDTH / this.spriteMgr.lineHeight; // Currently 5.
            const totalCircumference = childrenCount * (maxWidthOfEachChildGuess + 3);
            const radius = totalCircumference / Math.PI / 2;

            json.forEach((child, index) => {
                const angle = index * angleStep;
                // position
                const ringX = Math.cos(angle) * radius;
                const ringZ = Math.sin(angle) * radius;

                const offset = this.displayJsonRingRec(child, x + ringX, y, z + ringZ, Direction.xDirection);
                this.thinstanceMgr.addMarker(KindOfMarker.arrayMarker, x + ringX, y, z + ringZ, offset);
                // updateOffsets(offsets, offset, Direction.xDirection);
                offsets.zOffset += 2;
            });
        } else if (json instanceof Object) {
            // Objects are stacked in x-direction, each element goes in z-direction.
            y -= 4;
            Object.keys(json).forEach(key => {
                // Display key.
                const offsetKey = this.addSprite(key, x + offsets.xOffset, y, z, Direction.zDirection);
                this.thinstanceMgr.addMarker(KindOfMarker.objectMarker, x + offsets.xOffset, y, z, offsetKey);

                // Display value.
                const extraZSpace = 0.5;
                const offsetValue = this.displayJsonRingRec(json[key], x + offsets.xOffset, y, z + offsetKey.zOffset + extraZSpace, Direction.zDirection);
                this.thinstanceMgr.addMarker(KindOfMarker.objectMarker, x + offsets.xOffset, y, z + offsetKey.zOffset + extraZSpace, offsetValue);
                const totalOffset: Offsets = {
                    xOffset: offsetKey.xOffset + offsetValue.xOffset,
                    zOffset: offsetKey.zOffset + offsetValue.zOffset + extraZSpace,
                };
                // updateOffsets(offsets, totalOffset, Direction.zDirection);
                offsets.xOffset += 2;
            });
        } else {
            return this.addSprite(json, x, y, z, direction);
        }
        return offsets;
    }

    public displayAndLayoutJson(layout: Layout): void {
        this.displayJsonRingRec(this.spriteMgr.json, 0, 0, 0, Direction.xDirection);
        this.thinstanceMgr.makeInstances(this.scene);
    }
}

