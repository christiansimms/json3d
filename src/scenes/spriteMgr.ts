import {ISpriteJSONAtlas, ISpriteJSONSprite} from "@babylonjs/core/Sprites/ISprites";
import {SpritePackedManager} from "@babylonjs/core/Sprites/spritePackedManager";
import {Scene} from "@babylonjs/core/scene";
import {FrameAndInfo, MAX_SPRITE_TEXT_WIDTH} from "./model";
import {Sprite} from "@babylonjs/core/Sprites/sprite";

export class SpriteMgr {
    lineHeight = 20;
    xFudgeFactor = 5;
    yFudgeFactor = 2;

    totalWidth = 1000;
    totalHeight = 10000;

    ctx!: CanvasRenderingContext2D;
    frameCount = 0;
    totalFutureSpriteCount = 0;
    spriteCount = 0;
    offset = this.lineHeight;
    frames: ISpriteJSONSprite[] = [];
    spriteImage!: string;
    spriteAtlas!: ISpriteJSONAtlas;
    mySpritePackedManager!: SpritePackedManager;

    // textToFrames: { [text: string]: FrameAndInfo } = {};
    textToFrames: Map<string, FrameAndInfo> = new Map();

    constructor(public json: any) {
        this.json = json;
    }

    makeSprite(rawValue: any, x: number, y: number, z: number): Sprite {
        // console.log(`makeSprite.0 "${rawValue}" at (${x}, ${y}, ${z})`);
        this.spriteCount++;
        if (this.spriteCount > this.totalFutureSpriteCount) {
            throw 'Trying to make more sprites than we figured!';
        }

        const text = '' + rawValue;
        const frameAndInfo = this.textToFrames.get(text);
        if (!frameAndInfo) {
            throw `Did not find text: ${text}`;
        }
        const filename = frameAndInfo.frame.filename;
        const sprite = new Sprite(filename, this.mySpritePackedManager);
        sprite.isPickable = true;
        sprite.cellRef = filename;
        sprite.width = frameAndInfo.textWidth / this.lineHeight;

        sprite.position.x = x;
        sprite.position.y = y;
        sprite.position.z = z;

        return sprite;
    }

    maybeAddText(rawValue: any): void {
        this.totalFutureSpriteCount++;

        const text = '' + rawValue;
        if (this.textToFrames.has(text)) {
            // console.log('Cool -- found a duplicate', text);
            return;
        }

        const textWidth = Math.min(this.ctx.measureText(text).width + 2 * this.xFudgeFactor, MAX_SPRITE_TEXT_WIDTH);
        // console.log('Calc text width', text, textWidth);
        // const textWidth = 100;

        const _frame: Partial<ISpriteJSONSprite> = {
            filename: `sprite${this.frameCount}`,
            frame: {
                x: 0,
                y: this.offset - this.lineHeight + this.yFudgeFactor,
                w: textWidth,
                h: this.lineHeight + this.yFudgeFactor
            },
            rotated: false,
            trimmed: false,
        };
        const frame: ISpriteJSONSprite = _frame as ISpriteJSONSprite;
        this.textToFrames.set(text, {frame, textWidth});
        this.frames.push(frame as ISpriteJSONSprite);
        this.ctx.fillText(text, this.xFudgeFactor, this.offset);
        this.offset += this.lineHeight;
        this.frameCount++;
    }

    makeTextForSpritesRec(json: any): void {
        if (json instanceof Array) {
            json.forEach(child => {
                this.makeTextForSpritesRec(child);
            });
        } else if (json instanceof Object) {
            Object.keys(json).forEach(key => {
                this.maybeAddText(key);
                this.makeTextForSpritesRec(json[key]);
            });
        } else {
            this.maybeAddText(json);
        }
    }

    makeTextForSprites(scene: Scene): void {
        // Add text.
        const cv = document.createElement('canvas');
        cv.width = this.totalWidth;
        cv.height = this.totalHeight;

        this.ctx = cv.getContext('2d') as any;
        this.ctx.font = `22px Arial`
        this.ctx.fillStyle = 'steelblue'
        this.ctx.fillRect(0, 0, this.totalWidth, this.totalHeight)

        this.ctx.fillStyle = '#fff'
        this.makeTextForSpritesRec(this.json);

        this.spriteImage = cv.toDataURL('image/png')
        this.spriteAtlas = {
            frames: this.frames,
        };

        this.mySpritePackedManager = new SpritePackedManager("spm", this.spriteImage, this.totalFutureSpriteCount, scene, this.spriteAtlas as any);
        this.mySpritePackedManager.isPickable = true;
    }

}