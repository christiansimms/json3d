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
export const MAX_SPRITE_TEXT_LINE_HEIGHT = 20;  // This is height of text pixels, not sprite width.
export const MAX_WIDTH_OF_EACH_SPRITE = MAX_SPRITE_TEXT_WIDTH / MAX_SPRITE_TEXT_LINE_HEIGHT; // Currently 5.

export interface LayoutMgr {
    displayAndLayoutJson();
}