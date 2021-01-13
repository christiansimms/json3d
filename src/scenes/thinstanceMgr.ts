import {BoxBuilder, Color3, Mesh, StandardMaterial} from "@babylonjs/core";
import {Scene} from "@babylonjs/core/scene";
import {Matrix, Vector3} from "@babylonjs/core/Maths/math.vector";
import {KindOfMarker, Marker, Offsets} from "./model";

export class ThinstanceMgr {
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