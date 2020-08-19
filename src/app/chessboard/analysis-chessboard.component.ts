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

declare var ChessBoard: any;

@Component({
    selector: 'analysis-chessboard',
    templateUrl: 'analysis-chessboard.component.html',
    styleUrls: ['analysis-chessboard.component.scss'],
})
export class AnalysisChessboardComponent implements OnInit, OnDestroy {

    private subscriptions: Subscription[] = [];

    public configuration: Configuration;
    private board: Api;
    private boardConfig: Config;
    private chess: Chess = new Chess();
    
    private player: string;
    public texts: any;
    private sounds = [];

    @Output() warn: EventEmitter<string> = new EventEmitter<string>();
    @Output() playerMoved: EventEmitter<string> = new EventEmitter<string>();
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
        const board: any = document.getElementById('__analysis-chessboard__');
        board.style.height = boardWrapper.clientWidth + 'px';
        board.style.width = boardWrapper.clientHeight + 'px';
    }

    build(fen: string) {
        if (this.board) {
            this.board.destroy();
        }
        this.chess.load(fen);
        this.player = this.chess.turn();
        const turnColor: Color = (this.player == 'b' ? 'black' : 'white');
        this.boardConfig = {
            fen: fen,
            orientation: (this.player == 'b' ? colors[1] : colors[0]),
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
        this.board = Chessground(document.getElementById('__analysis-chessboard__'), this.boardConfig);
        this.uglyForceBoardRedraw();
    
    }

    afterMove(orig: Key, dest: Key, metadata: MoveMetadata) {
        // check promotion
        if (this.chess.get(orig).type == 'p' && (dest.charAt(1) == '8' || dest.charAt(1) == '1')) {
            this.promoteDialog().then(promotion => {
                if (promotion) {
                    this.registerMove(orig, dest, promotion);
                }
            });
        } else {
            this.registerMove(orig, dest, 'q');
        }
    }

    updateBoardConfig(fen: string, highlight? : boolean) {
        this.boardConfig.fen = fen;
        const turnColor: Color = (this.chess.turn() == 'b' ? 'black' : 'white');
        this.boardConfig.turnColor = turnColor;
        this.boardConfig.movable.color = turnColor;
        this.boardConfig.movable.dests = this.toDests();
        this.boardConfig.highlight.lastMove = highlight;
        this.board.set(this.boardConfig);
    }

    toDests(): Map<Key, Key[]> {
        const dests = new Map();
        this.chess.SQUARES.forEach(s => {
          const ms = this.chess.moves({square: s, verbose: true});
          if (ms.length) dests.set(s, ms.map(m => m.to));
        });
        return dests;
      }

    flip() {
        this.board.toggleOrientation();
    }

    fen() {
        return this.chess.fen();
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

    winner() {
        if (this.chess.in_checkmate()) {
            return (this.chess.turn() === 'w' ? 'black' : 'white');
        } else {
            return null;
        }
    }

    public showFen(fen) {
        this.chess.load(fen);
        this.updateBoardConfig(fen);
        if (this.configuration.playSounds) {
            this.playAudio('move');
        }
        this.player = this.chess.turn();
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

    private checkGameOver(playsounds = true) {
        if (this.chess.game_over()) {
            let message;
            if (this.chess.in_checkmate())
                message = 'Checkmate';
            else if (this.chess.in_stalemate())
                message = this.texts['chessboard.stalemate'];
            else if (this.chess.insufficient_material())
                message = this.texts['chessboard.insufficent-material'];
            else if (this.chess.in_threefold_repetition())
                message = this.texts['chessboard.three-repetition'];
            else if (this.chess.in_draw())
                message = this.texts['chessboard.rule-fifty'];
            else
                message = this.texts['chessboard.game-over'];
            if (playsounds && this.configuration.playSounds) {
                if (this.chess.in_checkmate() ) {
                    this.playAudio('success');
                } else {
                    this.playAudio('fail');
                }
            }
            this.gameOver.emit(message);
            return true;
        } else {
            return false;
        }
    }

    private registerMove(source, target, promotion) {
        const move = this.chess.move({
            from: source,
            to: target,
            promotion: promotion
        });
        const history = this.chess.history();
        this.playerMoved.emit(history[history.length - 1]);
        if (!this.checkGameOver(false)) {
            this.player = (this.player == 'w' ? 'b' : 'w');
            if (this.configuration.playSounds) {
                this.playAudio(move.captured ? 'capture' : 'move');
            }
        }
        this.updateBoardConfig(this.chess.fen(), true);
    }

}
