export interface Configuration {
    colorTheme: string,
    playSounds: boolean,
    highlightSquares: boolean,
    pieceTheme: string,
    boardTheme: string,
    pid: string,
    name: string
}

export interface Player {
    $key?: string,
    uid: string,
    pid: string,
    name: string,
    stars: string[]
}

export interface Game {
    $key?: string,
    uid: string,
    timestamp: Date,
    lastupdated: Date,
    vid: string,
    wid: string,
    bid: string,
    wpkey: string,
    bpkey: string,
    wpname: string,
    bpname: string,
    pgn: string
    gameover: boolean,
    wdeleted: boolean,
    bdeleted: boolean,
    status? : string,
    statusDescription?: string
}

export interface MoveTree {
    parent: MoveTree,
    children: MoveTree[],
    level: number,
    order: number,
    move: string,
    fen: string
}