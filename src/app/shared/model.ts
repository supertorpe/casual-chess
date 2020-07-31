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
    turn? : string,
    checkmated? : boolean
}
// https://gist.github.com/arniebradfo/5cf89c362cc216df6fc1d9ca4d536b72
export interface MoveTree {
    parent: MoveTree,
    children: MoveTree[],
    level: number,
    order: number,
    move: string,
    fen: string
}