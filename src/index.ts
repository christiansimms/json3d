import {Engine} from "@babylonjs/core/Engines/engine";
import {getSceneModuleWithName} from "./createScene";
import {RANDOM_JSON, SMALL_RANDOM_ARRAY_JSON, SMALL_RANDOM_OBJECT_JSON} from "../assets/randomJson";
import {Json3dScene} from "./scenes/json3dScene";
import {Scene} from "@babylonjs/core/scene";
import {FilesInput} from "@babylonjs/core";

const getModuleToLoad = (): string | undefined => {
    // ATM using location.search
    if (!location.search) {
        return;
    } else {
        return location.search.substr(location.search.indexOf('scene=') + 6);
    }
}

class SceneMgr {

    engine!: Engine;
    canvas!: HTMLCanvasElement

    babylonInit(): void {
        const inputFile: HTMLElement = document.getElementById('inputFile') as HTMLElement;
        inputFile.addEventListener('change', async event => {
            const file = (event.target as any).files.item(0);
            const json = await this.readJSONFile(file);
            this.createSceneWithJSON(json);
        });

        const buttonSmallJSON: HTMLElement = document.getElementById('buttonSmallJSON') as HTMLElement;
        buttonSmallJSON.addEventListener('click', event => {
            const formDiv: HTMLElement = document.getElementById('formDiv') as HTMLElement;
            formDiv.style.display = 'none';
            // this.createSceneWithJSON(SMALL_RANDOM_ARRAY_JSON);
            this.createSceneWithJSON(SMALL_RANDOM_OBJECT_JSON);
        });

        const buttonLargeJSON: HTMLElement = document.getElementById('buttonLargeJSON') as HTMLElement;
        buttonLargeJSON.addEventListener('click', event => {
            this.createSceneWithJSON(RANDOM_JSON);
        });

        // get the module to load
        // const moduleName = getModuleToLoad();
        // const createSceneModule = await getSceneModuleWithName(moduleName);

        // Get the canvas element
        const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
        this.canvas = canvas;
        // Generate the BABYLON 3D engine
        const engine = new Engine(canvas, true);
        this.engine = engine;

        // Register a render loop to repeatedly render the scene
        const divFps = document.getElementById("fps") as any;
        engine.runRenderLoop(function () {
            divFps.innerHTML = engine.getFps().toFixed() + " fps";
            if (engine.scenes.length) {
                engine.scenes[0].render();
            }
        });

        this.listenForDroppedFiles();
        this.listenToBrowserNavigation();

        // Watch for browser/canvas resize events
        window.addEventListener("resize", function () {
            engine.resize();
        });
    }

    listenForDroppedFiles(): void {
        const filesInput = new FilesInput(this.engine, null, null, null, null, null, null, null, null);
        filesInput.onProcessFileCallback = (file, name, extension) => {
            console.log("done: " + (typeof file) + " " + name + " " + extension);
            this.readJSONFile(file).then(json => {
                this.createSceneWithJSON(json);
            });
            return true;
        };
        filesInput.reload = function () {
            // Override to avoid problems.
        };
        filesInput.monitorElementForDragNDrop(this.canvas);
    }

    listenToBrowserNavigation(): void {
        // window.onpopstate = (event: PopStateEvent) => {
        //     // alert("location: " + document.location + ", state: " + JSON.stringify(event.state));
        //     this.resetPage();
        // };
    }

    resetPage(): void {
        // Show form.
        const formDiv: HTMLElement = document.getElementById('formDiv') as HTMLElement;
        formDiv.style.display = '';

        // Hide canvas.
        this.canvas.style.display = 'none';

        // Remove old scenes.
        while (this.engine.scenes.length > 0) {
            console.log('Removing old scene');
            this.engine.scenes[0].dispose();
        }
    }

    async readJSONFile(file: File): Promise<any> {
        const text = await file.text();
        // console.log('File read: ', text);
        return JSON.parse(text);
    }

    private async createSceneWithJSON(json: any): Promise<void> {
        // Change url, so user can go Back.
        // const url = new URL(window.location.href);
        // url.searchParams.set('scene', 'scene');
        // window.history.pushState({}, '', url.href);

        // Remove old scenes.
        while (this.engine.scenes.length > 0) {
            console.log('Removing old scene');
            this.engine.scenes[0].dispose();
        }

        // Create the scene
        const module = new Json3dScene();
        const scene = await module.createScene(this.engine, this.canvas);
        setTimeout(() => {
            this.canvas.tabIndex = 1;  // Need to do this before calling focus().
            this.canvas.focus();
        }, 0);
        module.displayJson(json);
    }
}

const sceneMgr = new SceneMgr();
sceneMgr.babylonInit();
