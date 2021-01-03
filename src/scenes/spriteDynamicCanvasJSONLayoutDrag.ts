import {Engine} from "@babylonjs/core/Engines/engine";
import {Scene} from "@babylonjs/core/scene";
import {ArcRotateCamera} from "@babylonjs/core/Cameras/arcRotateCamera";
import {Matrix, Vector3} from "@babylonjs/core/Maths/math.vector";
import {HemisphericLight} from "@babylonjs/core/Lights/hemisphericLight";
import {GroundBuilder} from "@babylonjs/core/Meshes/Builders/groundBuilder";
import {CreateSceneClass} from "../createScene";

// If you don't need the standard material you will still need to import it since the scene requires it.
import "@babylonjs/core/Materials/standardMaterial";

// import {GridMaterial} from "@babylonjs/materials";
import {GridMaterial} from "@babylonjs/materials/grid";
import "@babylonjs/materials";
import {SpritePackedManager} from "@babylonjs/core/Sprites/spritePackedManager";
import {Sprite} from "@babylonjs/core/Sprites/sprite";
import {ISpriteJSONAtlas, ISpriteJSONSprite} from "@babylonjs/core/Sprites/ISprites";
import {
    RANDOM_JSON,
    RANDOM_OBJECT_C_TMLANGUAGE_JSON,
    SMALL_RANDOM_ARRAY_JSON,
    SMALL_RANDOM_OBJECT_JSON
} from "../../assets/randomJson";
import {showAxis} from "../util";
import {
    Animation,
    Animatable,
    BoxBuilder,
    Color3, CubicEase, EasingFunction,
    FilesInput,
    KeyboardEventTypes,
    KeyboardInfo,
    Mesh,
    StandardMaterial, BoundingBox, FreeCamera, UniversalCamera, Camera, TargetCamera, FlyCamera
} from "@babylonjs/core";

enum Direction {
    xDirection,
    zDirection,
}

enum KindOfMarker {
    arrayMarker,
    objectMarker,
}

interface FrameAndInfo {
    frame: ISpriteJSONSprite;
    textWidth: number;
}

interface Offsets {
    xOffset: number;
    zOffset: number;
}

interface Marker {
    kind: KindOfMarker;
    x: number;
    y: number;
    z: number;
    xLength: number;
    zLength: number;
}

const MAX_SPRITE_TEXT_WIDTH = 100;  // This is width of text pixels, not sprite width.

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

// Run: npm start
// Display with: http://localhost:8080/?scene=spriteDynamicCanvasJSONLayoutDrag

class SpriteMgr {
    lineHeight = 20;
    xFudgeFactor = 5;
    yFudgeFactor = 2;

    totalWidth = 1000;
    totalHeight = 10000;

    ctx!: CanvasRenderingContext2D;
    frameCount = 0;
    totalFutureSpriteCount = 0;
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


class LayoutMgr {
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
            y -= 2;
            json.forEach(child => {
                const offset = this.displayJsonRec(child, x, y, z + offsets.zOffset, Direction.xDirection);
                this.thinstanceMgr.addMarker(KindOfMarker.arrayMarker, x, y, z + offsets.zOffset, offset);
                updateOffsets(offsets, offset, Direction.xDirection);
                offsets.zOffset += 2;
            });
        } else if (json instanceof Object) {
            // Objects are stacked in x-direction, each element goes in z-direction.
            y -= 2;
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
            const offset = this.addSprite(json, x, y, z, direction);
            return offset;
        }
        return offsets;
    }

    public displayAndLayoutJson(): void {
        this.displayJsonRec(this.spriteMgr.json, 0, 0, 0, Direction.xDirection);
        this.thinstanceMgr.makeInstances(this.scene);
    }
}

class ThinstanceMgr {
    box!: Mesh;
    markers: Marker[] = [];

    makeInstances(scene: Scene) {
        const box = BoxBuilder.CreateBox("root", {size: 1});
        this.box = box;
        box.thinInstanceEnablePicking = true;

        const instanceCount = this.markers.length;

        const matricesData = new Float32Array(16 * instanceCount);
        const colorData = new Float32Array(4 * instanceCount);

        const m = Matrix.Identity();
        const _m = m['_m'];
        for (let index = 0; index < instanceCount; index++) {
            const marker = this.markers[index];
            _m[0] = marker.xLength || 0.5;  // x scale
            _m[5] = 0.5;  // y scale
            _m[10] = marker.zLength || 0.5;  // z scale
            _m[12] = marker.x + marker.xLength / 2;
            _m[13] = marker.y + 1.0;
            _m[14] = marker.z + marker.zLength / 2;
            // console.log(`makeInstance at (${_m[12]}, _m[13]}, _m[14]})`)
            m.copyToArray(matricesData, index * 16);

            colorData[index * 4 + 0] = marker.kind === KindOfMarker.objectMarker ? 1 : 0;  // red
            colorData[index * 4 + 1] = 0;  // green
            colorData[index * 4 + 2] = marker.kind === KindOfMarker.arrayMarker ? 1 : 0;  // blue
            colorData[index * 4 + 3] = 1.0;  // alpha
        }

        box.thinInstanceSetBuffer("matrix", matricesData, 16, false);
        box.thinInstanceSetBuffer("color", colorData, 4, false);

        const boxMaterial = new StandardMaterial("material", scene);
        boxMaterial.disableLighting = true;
        boxMaterial.emissiveColor = Color3.White();
        boxMaterial.alpha = 0.5;
        box.material = boxMaterial;
    }

    addMarker(kind: KindOfMarker, x: number, y: number, z: number, offsets: Offsets): void {
        this.markers.push({
            kind: kind,
            x, y, z,
            xLength: offsets.xOffset,
            zLength: offsets.zOffset,
        });
        // console.log(`AddArrayMarker at (${x}, ${y}, ${z}), xLength=${offsets.xOffset}, zLength=${offsets.zOffset}`);
    }

    getPositionOfInstance(thinInstanceIndex: number): Vector3 {
        const marker = this.markers[thinInstanceIndex];
        return new Vector3(marker.x, marker.y, marker.z);
    }
}

export class DefaultSceneWithTexture implements CreateSceneClass {

    speed = 45;
    frameCount = 100;

    engine!: Engine;
    scene!: Scene;
    camera!: TargetCamera;
    thinstanceMgr!: ThinstanceMgr;

    createScene = async (
        engine: Engine,
        canvas: HTMLCanvasElement
    ): Promise<Scene> => {
        // This creates a basic Babylon Scene object (non-mesh)
        this.engine = engine;
        const scene = new Scene(engine);
        this.scene = scene;

        // This creates and positions a camera.
        // const camera = new FlyCamera("camera1", new Vector3(0, 10, -20), scene);
        // const camera = new UniversalCamera("camera1", new Vector3(0, 10, -20), scene);
        const camera = new ArcRotateCamera(
            "my first camera",
            0,
            Math.PI / 3,
            20,
            new Vector3(0, 0, 0),
            scene
        );

        // camera.maxZ = 100000; // Works, but then system acts weird.
        this.camera = camera;

        // This targets the camera to scene origin
        camera.setTarget(Vector3.Zero());

        // This attaches the camera to the canvas
        camera.attachControl(canvas, true);

        // This creates a light, aiming 0,1,0 - to the sky (non-mesh)
        const light = new HemisphericLight("light", new Vector3(0, 1, 0), scene);

        // Default intensity is 1. Let's dim the light a small amount
        light.intensity = 0.7;

        // Our built-in 'ground' shape.
        const ground = GroundBuilder.CreateGround(
            "ground",
            {width: 6, height: 6},
            scene
        );

        // Load a texture to be used as the ground material
        const groundMaterial = new GridMaterial("groundMaterial", scene);
        ground.material = groundMaterial;
        // ground.position.y -= 0.5;

        // this.displayJson(this.scene, SMALL_RANDOM_OBJECT_JSON);
        this.displayJson(this.scene, SMALL_RANDOM_ARRAY_JSON);
        this.listenForDroppedFiles(engine, scene, canvas);
        this.listenForNavigation();

        showAxis(5, scene);

        return scene;
    };

    displayOrigin(): void {
        this.camera.target = new Vector3(0, 0, 0);
        this.camera.position = new Vector3(20, 10, 0);
        this.camera.update();
    }

    displayBottom(): void {
        const boundingInfo = this.thinstanceMgr.box.getBoundingInfo();
        const targetPosition = boundingInfo.boundingBox.centerWorld;
        this.camera.target = targetPosition;
        this.camera.position = new Vector3(targetPosition.x, targetPosition.y - 20, targetPosition.z);
        this.camera.update();
    }

    // This is for pointing up. We want x and z axes.
    // Algo taken from: https://gamedev.net/forums/topic/638114-how-to-fit-a-box-in-the-camera39s-view-frustum/5034500/
    getCameraInfoFromBoundingBox(boundingBox: BoundingBox): [Vector3, Vector3] {
        // target here is the centerpoint closest to us
        const target = boundingBox.centerWorld.clone();
        target.y = boundingBox.minimumWorld.y;
        
        const xDiff = boundingBox.maximumWorld.x - boundingBox.minimumWorld.x;
        const zDiff = boundingBox.maximumWorld.z - boundingBox.minimumWorld.z;

        const screenWidth = this.engine.getRenderWidth();
        const screenHeight = this.engine.getRenderHeight();
        const fov = this.camera.fov;
        
        const horizPercent = xDiff / screenWidth;
        const vertPercent = zDiff / screenHeight;

        // Calculate distance.
        let opposite: number;
        if (horizPercent > vertPercent) {
            opposite = xDiff / 2;
        } else {
            opposite = zDiff / 2;
        }
        const distance = opposite / Math.tan(fov / 2);
        if (distance >= this.camera.maxZ) {
            throw 'Distance was too large';
        }

        console.log(`Diffs: x: ${xDiff}, ${zDiff}  -- Also, screen width x height: ${screenWidth} x ${screenHeight} -- camera distance=${distance}`);
        const position = target.clone();
        position.y -= distance;

        return [target, position];
    }

    displayBottomSmart(): void {
        const boundingInfo = this.thinstanceMgr.box.getBoundingInfo();
        const [target, position] = this.getCameraInfoFromBoundingBox(boundingInfo.boundingBox);
        
        this.camera.position = position;
        this.camera.target = target;
        this.camera.update();
    }

    animateCameraTargetToPosition(cam, speed, frameCount, newPos): void {
        const ease = new CubicEase();
        ease.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT);

        const aable1: Animatable = Animation.CreateAndStartAnimation('animateCameraTarget', cam, 'target', speed, frameCount, cam.target, newPos, 0, ease) as Animatable;
        aable1.disposeOnEnd = true;
    }

    animateCameraToPosition(cam, speed, frameCount, newPos): void {
        const ease = new CubicEase();
        ease.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT);
        const aable2: Animatable = Animation.CreateAndStartAnimation('animateCamera', cam, 'position', speed, frameCount, cam.position, newPos, 0, ease) as Animatable;
        aable2.disposeOnEnd = true;
    }
    
    displayBottomWithAnimation(): void {
        const boundingInfo = this.thinstanceMgr.box.getBoundingInfo();
        const target = boundingInfo.boundingBox.centerWorld;
        const position = new Vector3(target.x, target.y - 20, target.z);
        
        this.animateCameraTargetToPosition(this.camera, this.speed, this.frameCount, target);
        this.animateCameraToPosition(this.camera, this.speed, this.frameCount, position);
    }
    
    listenForNavigation(): void {
        this.scene.onKeyboardObservable.add((eventData: KeyboardInfo) => {
            const key = eventData.event.key;
            const eventType = eventData.type;
            // console.log(`Got key: ${key}, ${eventType}`);
            if (eventType === KeyboardEventTypes.KEYDOWN) {
                switch (key) {
                    case 'o':
                        this.displayOrigin();
                        break;
                    case 'd':
                        // this.displayBottom();
                        // this.displayBottomWithAnimation();
                        this.displayBottomSmart();
                        break;
                }
            }
        });
    }
    
    listenForDroppedFiles(engine: Engine, scene: Scene, canvas: HTMLCanvasElement): void {
        const filesInput = new FilesInput(engine, scene, null, null, null, null, null , null, null);
        filesInput.onProcessFileCallback = (file, name, extension) => {
            console.log("done: " + (typeof file) + " " + name + " " + extension);
            this.loadAsText(file);
            return true;
        };
        filesInput.reload = function () {
            // Override to avoid problems.
        };
        filesInput.monitorElementForDragNDrop(canvas);
    }
    
    loadAsText(theFile) {
        const reader = new FileReader();

        reader.onload = (loadedEvent) => {
            // result contains loaded file.
            if (loadedEvent && loadedEvent.target) {
                console.log(`Read file: `, (loadedEvent.target.result as string).length);
                const json = JSON.parse(loadedEvent.target.result as string);
                this.displayJson(this.scene, json);
            }
        };
        reader.readAsText(theFile);
    }
    
    displayJson(scene: Scene, json): void {
        // Create a packed manager
        // const spriteMgr = new SpriteMgr(SMALL_RANDOM_OBJECT_JSON);
        // const spriteMgr = new SpriteMgr(SMALL_RANDOM_ARRAY_JSON);
        // const spriteMgr = new SpriteMgr(RANDOM_JSON);
        // const spriteMgr = new SpriteMgr(RANDOM_OBJECT_C_TMLANGUAGE_JSON);
        const spriteMgr = new SpriteMgr(json);
        spriteMgr.makeTextForSprites(scene);

        const thinstanceMgr = new ThinstanceMgr();
        this.thinstanceMgr = thinstanceMgr;
        const layoutMgr = new LayoutMgr(scene, spriteMgr, thinstanceMgr);
        layoutMgr.displayAndLayoutJson();
        
        scene.onPointerDown = (evt, pickResult) => {
            // console.log('PICK!', pickResult); // pickResult.pickedMesh.name);
            if (pickResult.pickedMesh && pickResult.thinInstanceIndex >= 0) {
                console.log('Got a thinstance!', pickResult.thinInstanceIndex);
                // this.camera.moveTargetTo(pointerInfo.pickInfo.pickedMesh.position, 50);
                const targetPosition = thinstanceMgr.getPositionOfInstance(pickResult.thinInstanceIndex);
                console.log(`Setting targetPosition to ${targetPosition}`);
                this.camera.target = targetPosition;
                this.camera.update();
            }
            //let picked = evt.pickInfo.pickedMesh;
            //console.log(evt.pickInfo);
        };

    }


}

export default new DefaultSceneWithTexture();