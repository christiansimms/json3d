import {Scene} from "@babylonjs/core/scene";
import {Sprite} from "@babylonjs/core/Sprites/sprite";
import {SpriteMgr} from "./spriteMgr";
import {ThinstanceMgr} from "./thinstanceMgr";
import {Direction, KindOfMarker, Offsets} from "./model";

export class LayoutMgr {
    spriteCount = 0;

    constructor(public scene: Scene, public spriteMgr: SpriteMgr, public thinstanceMgr: ThinstanceMgr) {
    }

    addSprite(rawValue: any, x: number, y: number, z: number, direction: Direction): Offsets {
        // console.log(`addSprite.0 "${rawValue}" at (${x}, ${y}, ${z})`);
        this.spriteCount++;
        if (this.spriteCount > this.spriteMgr.totalFutureSpriteCount) {
            throw 'Trying to make more sprites than we figured!';
        }

        const text = '' + rawValue;
        const frameAndInfo = this.spriteMgr.textToFrames.get(text);
        if (!frameAndInfo) {
            throw `Did not find text: ${text}`;
        }
        const filename = frameAndInfo.frame.filename;
        const sprite = new Sprite(filename, this.spriteMgr.mySpritePackedManager);
        sprite.isPickable = true;
        sprite.cellRef = filename;
        sprite.width = frameAndInfo.textWidth / this.spriteMgr.lineHeight;

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

    private displayJsonRec(json: any, x: number, y: number, z: number, direction: Direction): Offsets {
        const offsets: Offsets = {xOffset: 0, zOffset: 0};
        if (json instanceof Array) {
            // Arrays are stacked in z-direction, each element goes in x-direction.
            y -= 4;
            json.forEach(child => {
                const offset = this.displayJsonRec(child, x, y, z + offsets.zOffset, Direction.xDirection);
                this.thinstanceMgr.addMarker(KindOfMarker.arrayMarker, x, y, z + offsets.zOffset, offset);
                updateOffsets(offsets, offset, Direction.xDirection);
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
                const offsetValue = this.displayJsonRec(json[key], x + offsets.xOffset, y, z + offsetKey.zOffset + extraZSpace, Direction.zDirection);
                this.thinstanceMgr.addMarker(KindOfMarker.objectMarker, x + offsets.xOffset, y, z + offsetKey.zOffset + extraZSpace, offsetValue);
                const totalOffset: Offsets = {
                    xOffset: offsetKey.xOffset + offsetValue.xOffset,
                    zOffset: offsetKey.zOffset + offsetValue.zOffset + extraZSpace,
                };
                updateOffsets(offsets, totalOffset, Direction.zDirection);
                offsets.xOffset += 2;
            });
        } else {
            return this.addSprite(json, x, y, z, direction);
        }
        return offsets;
    }

    public displayAndLayoutJson(): void {
        this.displayJsonRec(this.spriteMgr.json, 0, 0, 0, Direction.xDirection);
        this.thinstanceMgr.makeInstances(this.scene);
    }
}

function updateOffsets(offsets: Offsets, offset: Offsets, elementsGoInThisDirection: Direction): void {
    if (elementsGoInThisDirection === Direction.xDirection) {
        offsets.xOffset = Math.max(offsets.xOffset, offset.xOffset);
        offsets.zOffset += offset.zOffset;
    } else if (elementsGoInThisDirection === Direction.zDirection) {
        offsets.xOffset += offset.xOffset;
        offsets.zOffset = Math.max(offsets.zOffset, offset.zOffset);
    } else {
        throw 'Bad direction';
    }
}