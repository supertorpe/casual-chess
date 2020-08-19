import { Component, HostListener, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ModalController, Platform } from '@ionic/angular';
import { Howl, Howler } from 'howler';
import { Subscription } from 'rxjs';
import { PromotionDialog } from '../dialogs/promotion.dialog';
import * as Chess from 'chess.js';
import { Chessground }  from 'chessground';
import { Api }  from 'chessground/api';
import { colors, MoveMetadata, Color, Key }  from 'chessground/types';
import { Config } from 'chessground/config';
import { TranslateService } from '@ngx-translate/core';
import { ConfigurationService, Configuration } from '../shared';

@Component({
    selector: 'chessboard',
    templateUrl: 'chessboard.component.html',
    styleUrls: ['chessboard.component.scss'],
})
export class ChessboardComponent implements OnInit, OnDestroy {

    private subscriptions: Subscription[] = [];

    private INITIAL_POS = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

    public configuration: Configuration;
    private board: Api;
    private boardConfig: Config;
    private chess: Chess = new Chess();
    private auxChess: Chess = new Chess();
    private player: string;
    private pointer: number;
    public texts: any;
    private sounds = [];
    private chessHistory: any;

    @Output() warn: EventEmitter<string> = new EventEmitter<string>();
    @Output() playerMoved: EventEmitter<void> = new EventEmitter<void>();
    @Output() gameOver: EventEmitter<string> = new EventEmitter<string>();

    constructor(
        private configurationService: ConfigurationService,
        public translate: TranslateService,
        public modalController: ModalController,
        private http: HttpClient,
        private platform: Platform) {
        this.configurationService.initialize().then(config => {
            this.configuration = config;
        });
    }

    ngOnInit() {
        this.subscriptions.push(this.configurationService.onChange$.subscribe(event => this.configurationChanged(event)));
        this.subscriptions.push(this.translate.get([
            'chessboard.stalemate',
            'chessboard.insufficent-material',
            'chessboard.three-repetition',
            'chessboard.rule-fifty',
            'chessboard.game-over',
            'chessboard.mate-in',
            'chessboard.receive-mate-in',
            'chessboard.unfeasible-mate',
            'chessboard.white-advantage',
            'chessboard.black-advantage'
        ]).subscribe(async res => {
            this.texts = res;
        }));
        this.loadAudio();
    }

    ngOnDestroy() {
        this.subscriptions.forEach(subscription => subscription.unsubscribe());
        this.subscriptions = [];
        this.unloadAudio();
    }

    private uglyForceBoardRedraw() {
        window.setTimeout(function () { window.dispatchEvent(new Event('resize')); }, 100);
        window.setTimeout(function () { window.dispatchEvent(new Event('resize')); }, 1000);
    }

    private configurationChanged(config) {
        this.configuration = config;
        this.updateBoardConfig(this.fen());   
    }

    private loadAudio() {
        this.sounds.push({ key: 'move', audio: new Howl({ src: ['/assets/audio/move.mp3'] }) });
        this.sounds.push({ key: 'capture', audio: new Howl({ src: ['/assets/audio/capture.mp3'] }) });
        this.sounds.push({ key: 'success', audio: new Howl({ src: ['/assets/audio/success.mp3'] }) });
        this.sounds.push({ key: 'fail', audio: new Howl({ src: ['/assets/audio/fail.mp3'] }) });
    }

    private unloadAudio() {
        this.sounds.forEach(sound => {
            sound.audio.unload();
        });
        this.sounds = [];
    }

    private playAudio(sound) {
        const soundToPlay = this.sounds.find((item) => { return item.key === sound; });
        if (sound !== 'fail' || !soundToPlay.audio.playing()) {
            soundToPlay.audio.play();
        }
    }

    @HostListener('window:resize', ['$event']) onResize(event) {
        const boardWrapper: any = document.querySelector('.board_wrapper');
        const board: any = document.getElementById('__chessboard__');
        board.style.height = boardWrapper.clientWidth + 'px';
        board.style.width = boardWrapper.clientHeight + 'px';
    }

    build(pgn: string, player: string, gameStatus: string) {
        if (gameStatus != 'WRE' && gameStatus != 'BRE')
            this.player = player;
        if (pgn != null) {
            this.chess.load_pgn(pgn);
            this.chessHistory = this.chess.history({verbose:true});
            this.pointer = this.chessHistory.length - 1;
        } else {
            this.pointer = -1;
        }
        if (this.board) {
            this.board.destroy();
        }
        let movement;
        let prevFen;
        if (this.pointer >= 0 && this.chessHistory.length > this.pointer) {
            movement = this.chessHistory[this.pointer];
            if (this.pointer == 0)
                prevFen = this.INITIAL_POS;
            else
                prevFen = this.fen(this.pointer - 1);
        }
        let turnColor: Color = (this.chess.turn() == 'b' ? 'black' : 'white');
        this.boardConfig = {
            fen: prevFen ? prevFen : this.chess.fen(),
            orientation: (player == 'b' ? colors[1] : colors[0]),
            viewOnly: (this.player != 'b' && this.player != 'w') || (this.chess.turn() != this.player) ? true : false,
            turnColor: turnColor,
            premovable: {
                enabled: false
            },
            movable: {
                free: false,
                color: turnColor,
                dests: this.toDests(),
                showDests: this.configuration.highlightSquares,
                events: {
                    after: (orig: Key, dest: Key, metadata: MoveMetadata) => this.afterMove(orig, dest, metadata)
                }
              },
              highlight: {
                lastMove: true,
                check: true
              },
              draggable: {
                showGhost: false
              }
        };
        this.board = Chessground(document.getElementById('__chessboard__'), this.boardConfig);
        if (prevFen) {
            this.board.move(movement.from, movement.to);
            this.boardConfig.fen = this.chess.fen();
            this.board.set(this.boardConfig);
        }
        this.uglyForceBoardRedraw();
    }

    afterMove(orig: Key, dest: Key, metadata: MoveMetadata) {
        // check promotion
        if (this.chess.get(orig).type == 'p' && (dest.charAt(1) == '8' || dest.charAt(1) == '1')) {
            this.promoteDialog().then(promotion => {
                if (promotion) {
                    this.registerMove(orig, dest, promotion);
                }
                this.updateBoardConfig(this.chess.fen());
            });
        } else {
            this.registerMove(orig, dest, 'q');
        }
    }

    toDests(): Map<Key, Key[]> {
        const dests = new Map();
        this.chess.SQUARES.forEach(s => {
          const ms = this.chess.moves({square: s, verbose: true});
          if (ms.length) dests.set(s, ms.map(m => m.to));
        });
        return dests;
      }
      
    updateBoardConfig(fen: string, prevFen? : string, move?: any) {
        if (prevFen && move) {
            this.boardConfig.fen = prevFen;
            this.board.set(this.boardConfig);
            this.board.move(move.from, move.to);
        }
        this.boardConfig.fen = fen;
        const latestFen = (this.chess.fen() == this.boardConfig.fen);
        this.boardConfig.viewOnly = (this.player != 'b' && this.player != 'w') || !latestFen || this.chess.turn() != this.player ? true : false;
        const turnColor: Color = (this.chess.turn() == 'b' ? 'black' : 'white');
        this.boardConfig.turnColor = turnColor;
        this.boardConfig.movable.color = turnColor;
        this.boardConfig.movable.dests = this.toDests();
        this.boardConfig.movable.showDests = latestFen && this.configuration.highlightSquares ? true : false;
        this.boardConfig.highlight.lastMove = (this.boardConfig.fen != this.INITIAL_POS);
        this.board.set(this.boardConfig);
    }

    update(pgn: string, gameStatus: string) {
        this.chess.load_pgn(pgn);
        this.chessHistory = this.chess.history({verbose:true});
        let movement;
        let prevFen;
        if (this.chessHistory.length > 0) {
            movement = this.chessHistory[this.chessHistory.length - 1];
            if (this.chessHistory.length == 1)
                prevFen = this.INITIAL_POS;
            else
                prevFen = this.fen(this.chessHistory.length - 2);
        }
        this.pointer = this.chessHistory.length - 1;
        this.updateBoardConfig(this.chess.fen(), prevFen, movement);
        if (this.chess.game_over()) {
            let message;
            if (this.chess.in_checkmate()) {
                message = 'Checkmate';
            } else {
                if (this.chess.in_stalemate())
                    message = this.texts['chessboard.stalemate'];
                else if (this.chess.insufficient_material())
                    message = this.texts['chessboard.insufficent-material'];
                else if (this.chess.in_threefold_repetition())
                    message = this.texts['chessboard.three-repetition'];
                else if (this.chess.in_draw())
                    message = this.texts['chessboard.rule-fifty'];
                else
                    message = this.texts['chessboard.game-over'];
            }
            this.warn.emit(message);
            if (this.configuration.playSounds && this.player != 'v') {
                if (this.chess.in_checkmate() && this.player !== this.chess.turn()) {
                    this.playAudio('success');
                } else {
                    this.playAudio('fail');
                }
            }
        } else if (this.pointer >= 0 && this.configuration.playSounds) {
            this.playAudio(this.chessHistory[this.pointer].captured ? 'capture' : 'move');
        }
        if (gameStatus == 'WRE' || gameStatus == 'BRE')
            this.player = '';
    }

    undoMove() {
        this.chess.undo();
        this.updateBoardConfig(this.chess.fen());
        this.chessHistory = this.chess.history({verbose:true});
        if (this.configuration.playSounds) {
            this.playAudio('move');
        }
        this.pointer--;
        this.playerMoved.emit();
    }

    cleanPlayer() {
        this.player = '';
    }

    flip() {
        this.board.toggleOrientation();
    }

    turn() {
        return this.chess.turn();
    }

    isGameOver() {
        return this.chess.game_over();
    }

    isCheckmated() {
        return this.chess.in_checkmate();
    }

    pgn() {
        return this.chess.pgn();
    }

    history() {
        return this.chessHistory;
    }

    winner() {
        if (this.chess.in_checkmate()) {
            return (this.chess.turn() === 'w' ? 'black' : 'white');
        } else {
            return null;
        }
    }

    currentPosition() {
        return this.pointer;
    }

    showFirstPosition() {
        if (this.pointer === -1) {
            return;
        }
        this.pointer = -1;
        this.showFenPointer(false);
    }

    showPosition(idx) {
        if (this.pointer == idx) {
            return;
        }
        this.pointer = idx;
        this.showFenPointer();
    }

    showPreviousPosition() {
        if (this.pointer === -1) {
            return;
        }
        this.pointer--;
        this.showFenPointer(false);
    }

    showNextPosition() {
        if (this.pointer === this.chessHistory.length - 1) {
            return;
        }
        this.pointer++;
        this.showFenPointer();
    }

    showLatestPosition() {
        const historyLength = this.chessHistory.length;
        if (this.pointer === historyLength - 1) {
            return;
        }
        this.pointer = historyLength - 1;
        this.showFenPointer();
    }

    isShowingFirstPosition() {
        return (this.pointer === -1);
    }

    isShowingLatestPosition() {
        return (this.pointer === this.chessHistory.length - 1);
    }

    fen(auxPointer? : number) {
        if (!auxPointer)
            auxPointer = this.pointer;
        const numMovs = this.chessHistory.length;
        if (auxPointer == numMovs - 1) {
            return this.chess.fen();
        } else {
            if (auxPointer >= numMovs / 2) {
                this.auxChess.load_pgn(this.chess.pgn());
                const movsToDelete = (numMovs - auxPointer);
                for (let i = 1; i < movsToDelete; i++) {
                    this.auxChess.undo();
                }
            } else {
                this.auxChess.reset();
                for (let i = 0; i <= auxPointer; i++) {
                    this.auxChess.move(this.chessHistory[i].san);
                }
            }
            return this.auxChess.fen();
        }
    }

    private showFenPointer(useCaptureSound = true) {
        let movement;
        let prevFen;
        if (this.pointer >= 0 && this.chessHistory.length > this.pointer) {
            movement = this.chessHistory[this.pointer];
            if (this.pointer == 0)
                prevFen = this.INITIAL_POS;
            else
                prevFen = this.fen(this.pointer - 1);
        }
        this.updateBoardConfig(this.fen(), prevFen, movement);
        if (this.configuration.playSounds && this.pointer >= 0 && this.chessHistory.length > this.pointer) {
            this.playAudio(
                this.chessHistory[this.pointer].san.endsWith('#') ? 'success' :
                useCaptureSound && this.chessHistory[this.pointer].captured ? 'capture' : 'move');
        }
    }

    private async promoteDialog(): Promise<string> {
        return new Promise<string>(async resolve => {
            const modal = await this.modalController.create({
                component: PromotionDialog,
                componentProps: { turn: this.player }
            });
            modal.present();
            const { data } = await modal.onDidDismiss();
            if (data == undefined) {
                resolve(null);
            } else {
                resolve(data.piece);
            }
        });
    }

    private registerMove(source, target, promotion) {
        const move = this.chess.move({
            from: source,
            to: target,
            promotion: promotion
        });
        if (this.chess.game_over()) {
            let status;
            if (this.chess.in_checkmate()) {
                if (this.chess.turn() == 'w') {
                    status = 'BWI';
                } else {
                    status = 'WWI';
                }
            } else {
                status = 'DRA';
            }
            this.gameOver.emit(status);
        } else {
            this.playerMoved.emit();
        }
    }

}
