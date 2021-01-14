import fetch from 'node-fetch';

import {Engine} from "@babylonjs/core/Engines/engine";
import {Scene} from "@babylonjs/core/scene";
import {Vector3} from "@babylonjs/core/Maths/math.vector";
import {HemisphericLight} from "@babylonjs/core/Lights/hemisphericLight";
import {GroundBuilder} from "@babylonjs/core/Meshes/Builders/groundBuilder";
import {CreateSceneClass} from "../createScene";

// If you don't need the standard material you will still need to import it since the scene requires it.
import "@babylonjs/core/Materials/standardMaterial";

// import {GridMaterial} from "@babylonjs/materials";
import {GridMaterial} from "@babylonjs/materials/grid";
import "@babylonjs/materials";
import {SMALL_RANDOM_ARRAY_JSON} from "../../assets/randomJson";
import {showAxis} from "../util";
import {
    Animatable,
    Animation,
    BoundingBox,
    BoxBuilder,
    CubicEase,
    EasingFunction,
    KeyboardEventTypes,
    KeyboardInfo,
    TargetCamera,
    UniversalCamera
} from "@babylonjs/core";
import {SkyMaterial} from "@babylonjs/materials/sky";
import {LayoutMgr} from "./layoutMgr";
import {SpriteMgr} from "./spriteMgr";
import {ThinstanceMgr} from "./thinstanceMgr";
import {Layout} from "./model";

// Run: npm start
// Display with: http://localhost:8080


async function loadDirectory(repo: string): Promise<any> {
    const result = await fetch(`/api/read-directory?repo=${repo}`)
    return result.json();
}

export class Json3dScene implements CreateSceneClass {

    wantGroundAndAxis = false;
    wantMeshSelection = false;
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
        const camera = new UniversalCamera("camera1", new Vector3(0, 10, -20), scene);
        // const camera = new ArcRotateCamera(
        //     "camera1",
        //     0,
        //     0,
        //     20,
        //     new Vector3(0, 0, 0),
        //     scene
        // );

        // camera.maxZ = 100000; // Works, but then system acts weird.
        this.camera = camera;

        // This targets the camera to scene origin
        this.displayOrigin();

        // This attaches the camera to the canvas
        camera.attachControl(canvas, true);

        // This creates a light, aiming 0,1,0 - to the sky (non-mesh)
        const light = new HemisphericLight("light", new Vector3(0, 1, 0), scene);

        // Default intensity is 1. Let's dim the light a small amount
        light.intensity = 0.7;

        if (this.wantGroundAndAxis) {
            // Our built-in 'ground' shape.
            const ground = GroundBuilder.CreateGround(
                "ground",
                {width: 6, height: 6},
                scene
            );

            // Load a texture to be used as the ground material
            const groundMaterial: GridMaterial = new GridMaterial("groundMaterial", scene);
            ground.material = groundMaterial;

            showAxis(5, scene);
        }

        // Possibly load file.
        const params = new URLSearchParams(location.search);
        const repo = params.get('repo') as string;
        if (repo) {
            const json = await loadDirectory(repo);
            this.displayJson(json);
        } else {
            // this.displayJson(SMALL_RANDOM_OBJECT_JSON, layout);
            this.displayJson(SMALL_RANDOM_ARRAY_JSON);
        }

        this.listenForNavigation();
        this.addSkyMaterial();

        return scene;
    };

    addSkyMaterial(): void {
        const skyMaterial = new SkyMaterial("skyMaterial", this.scene);
        skyMaterial.backFaceCulling = false;
        skyMaterial.inclination = 0;
        skyMaterial.turbidity = 0.5;
        skyMaterial.cameraOffset.y = 0;
        const skybox = BoxBuilder.CreateBox("skyBox", {size: 10000.0}, this.scene);
        skybox.material = skyMaterial;
    }

    displayOrigin(): void {
        this.camera.position = new Vector3(-20, 10, -20);
        this.camera.target = new Vector3(0, 0, 0);
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
        let distance = opposite / Math.tan(fov / 2);
        if (distance >= this.camera.maxZ) {
            distance = this.camera.maxZ;
            console.warn('Distance was too large, so using largest possible value');
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
    
    displayJson(json: any): void {
        const params = new URLSearchParams(location.search);
        const layoutStr = params.get('layout') as string;
        let layout: Layout;
        if (layoutStr) {
            layout = Layout[layoutStr.toUpperCase()];
            if (layout === undefined) {
                throw `Did not recognize layout: ${layoutStr}`;
            }
        } else {
            layout = Layout.SIMPLE;
        }

        // Create a packed manager
        // const spriteMgr = new SpriteMgr(SMALL_RANDOM_OBJECT_JSON);
        // const spriteMgr = new SpriteMgr(SMALL_RANDOM_ARRAY_JSON);
        // const spriteMgr = new SpriteMgr(RANDOM_JSON);
        // const spriteMgr = new SpriteMgr(RANDOM_OBJECT_C_TMLANGUAGE_JSON);
        const spriteMgr = new SpriteMgr(json);
        spriteMgr.makeTextForSprites(this.scene);

        const thinstanceMgr = new ThinstanceMgr();
        this.thinstanceMgr = thinstanceMgr;
        const layoutMgr = new LayoutMgr(this.scene, spriteMgr, thinstanceMgr);
        layoutMgr.displayAndLayoutJson(layout);
        
        this.scene.onPointerDown = (evt, pickResult) => {
            if (this.wantMeshSelection) {
                // console.log('PICK!', pickResult); // pickResult.pickedMesh.name);
                if (pickResult.pickedMesh && pickResult.thinInstanceIndex >= 0) {
                    console.log('Got a thinstance!', pickResult.thinInstanceIndex);
                    // this.camera.moveTargetTo(pointerInfo.pickInfo.pickedMesh.position, 50);
                    const targetPosition = thinstanceMgr.getPositionOfInstance(pickResult.thinInstanceIndex);
                    console.log(`Setting targetPosition to ${targetPosition}`);
                    this.camera.target = targetPosition;
                    this.camera.update();
                }
            }
        };

    }


}

export default new Json3dScene();