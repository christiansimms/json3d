import {ISpriteJSONSprite} from "@babylonjs/core/Sprites/ISprites";

export enum Layout {
    SIMPLE,
    RING,
}

export enum Direction {
    xDirection,
    zDirection,
}

export enum KindOfMarker {
    arrayMarker,
    objectMarker,
}

export interface FrameAndInfo {
    frame: ISpriteJSONSprite;
    textWidth: number;
}

export interface Offsets {
    xOffset: number;
    zOffset: number;
}

export interface Marker {
    kind: KindOfMarker;
    x: number;
    y: number;
    z: number;
    xLength: number;
    zLength: number;
}

export const MAX_SPRITE_TEXT_WIDTH = 100;  // This is width of text pixels, not sprite width.
