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
    name: string
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