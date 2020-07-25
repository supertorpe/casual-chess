import { Component, HostListener, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ModalController, Platform } from '@ionic/angular';
import { Howl, Howler } from 'howler';
import { Subscription } from 'rxjs';
import { PromotionDialog } from './promotion.dialog';
import * as Chess from 'chess.js';
import { TranslateService } from '@ngx-translate/core';
import { ConfigurationService, Configuration } from '../shared';

declare var ChessBoard: any;

@Component({
    selector: 'chessboard',
    templateUrl: 'chessboard.component.html',
    styleUrls: ['chessboard.component.scss'],
})
export class ChessboardComponent implements OnInit, OnDestroy {

    private subscriptions : Subscription[] = [];

    private configuration: Configuration;
    private board: any;
    private chess: Chess = new Chess();
    private player: string;
    private pointer: number;
    private squareSelected;
    public texts: any;
    private sounds = [];
    private isMobileBrowser = false;

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
        this.isMobileBrowser = (null !== navigator.userAgent.match(/(iPhone|iPod|iPad|Android|BlackBerry|IEMobile)/));
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
        this.uglyForceBoardRedraw();
    }

    private loadAudio() {
        this.sounds.push({ key: 'move', audio: new Howl({ src: ['/assets/audio/move.mp3'] }) });
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
        if (this.board) this.board.resize(event);
    }

    build(pgn: string, player: string) {
        const self = this;
        if (pgn != null) {
            this.chess.load_pgn(pgn);
            this.pointer = this.chess.history().length - 1;
        } else {
            this.pointer =  -1;
        }
        if (this.board) {
            this.board.destroy();
        }
        this.board = ChessBoard('__chessboard__', {
            position: this.chess.fen(),
            pieceTheme: function (piece) { return '/assets/pieces/' + self.configuration.pieceTheme + '/' + piece + '.svg' },
            draggable: true,
            onDragStart: function (source, piece, position, orientation) { return self.onDragStart(source, piece, position, orientation); },
            onDrop: function (source, target, piece, newPos, oldPos, orientation) { return self.onDrop(source, target, piece, newPos, oldPos, orientation); },
            onMoveEnd: function (source, target) { self.onMoveEnd(source, target); },
            onMouseoutSquare: function (square, piece, position, orientation) { self.onMouseoutSquare(square, piece, position, orientation); },
            onMouseoverSquare: function (square, piece, position, orientation) { self.onMouseoverSquare(square, piece, position, orientation); },
            onSnapEnd: function (source, target, piece) { self.onSnapEnd(source, target, piece); }
        });
        if (player == 'b') {
            this.flip();
        }
        this.cleanHighlights();
        this.player = player;
        this.uglyForceBoardRedraw();
    }

    update(pgn: string) {
        this.chess.load_pgn(pgn);
        this.pointer = this.chess.history().length - 1;
        this.board.position(this.chess.fen());
        this.checkGameOver();
    }

    flip() {
        this.board.flip();
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

    rewind() {
        this.cleanHighlights();
        // this.board.position(this.originalFen);
        // this.chess.load(this.originalFen);
        // this.fenHistory = [this.originalFen];
        // this.fenPointer = 0;
        this.player = this.chess.turn();
    }

    history() {
        return this.chess.history();
    }


    winner() {
        if (this.chess.in_checkmate()) {
            return (this.chess.turn() === 'w' ? 'black' : 'white');
        } else {
            return null;
        }
    }

    showFirstPosition() {
        if (this.pointer === -1) {
            return;
        }
        this.pointer = -1;
        this.showFenPointer();
    }

    showPreviousPosition() {
        if (this.pointer === -1) {
            return;
        }
        this.pointer--;
        this.showFenPointer();
    }

    showNextPosition() {
        if (this.pointer === this.chess.history().length - 1) {
            return;
        }
        this.pointer++;
        this.showFenPointer();
    }

    showLatestPosition() {
        const historyLength = this.chess.history().length;
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
        return (this.pointer === this.chess.history().length - 1);
    }

    fen() {
        return this.chess.fen();
    }

    private showFenPointer() {
        this.cleanHighlights();
        if (this.configuration.playSounds) {
            this.playAudio('move');
        }
        const auxChess = new Chess();
        for (let i = 0; i <= this.pointer; i++) {
            auxChess.move(this.chess.history()[i]);
        }
        this.board.position(auxChess.fen(), true);
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

    private onDragStart(source, piece, position, orientation) {
        const re = this.player == 'w' ? /^b/ : /^w/;
        if (this.chess.game_over() || piece.search(re) !== -1 || this.chess.turn() !== this.player) {
            return false;
        }
        this.drawGreySquares(source);
    };

    private onDrop(source, target, piece, newPos, oldPos, orientation) {
        this.removeGreySquares();
        if (source == target) {
            this.squareSelected = source;
            this.drawGreySquares(source);
            return;
        }
        // validate move
        const move = this.chess.move({
            from: source,
            to: target,
            promotion: 'q'
        });
        if (move === null) return 'snapback';
        this.chess.undo();
        this.squareSelected = target;
        // check promotion
        if (this.chess.get(source).type == 'p' && (target.charAt(1) == '8' || target.charAt(1) == '1')) {
            this.promoteDialog().then(promotion => {
                if (promotion) {
                    this.registerMove(source, target, promotion);
                }
                this.board.position(this.chess.fen(), false);
            });
        } else {
            this.registerMove(source, target, 'q');
        }
    };

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
            //this.pointer = this.chess.history().length - 1;
            if (playsounds && this.configuration.playSounds && this.player != 'v') {
                if (this.chess.in_checkmate() && this.player !== this.chess.turn()) {
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
        this.chess.move({
            from: source,
            to: target,
            promotion: promotion
        });
        if (this.configuration.playSounds) {
            this.playAudio('move');
        }
        //this.fenHistory.push(this.chess.fen());
        this.pointer++;

        this.playerMoved.emit();
        this.checkGameOver(false);
    }

    private onMoveEnd(source, target) {
    };

    private onMouseoutSquare(square, piece, position, orientation) {
        this.removeGreySquares();
    };

    private onMouseoverSquare(square, piece, position, orientation) {
        if (this.chess.turn() !== this.player) {
            return;
        }
        if (this.isMobileBrowser && this.squareSelected) {
            this.onDrop(this.squareSelected, square, piece, null, null, orientation);
            this.board.position(this.chess.fen(), false);
            this.squareSelected = square;
        } else if (piece) {
            this.drawGreySquares(square);
        }
    };

    private onSnapEnd(source, target, piece) {
        this.highlightSquares(source, target);
    };

    private cleanHighlights() {
        document.querySelectorAll('.highlight-square').forEach(square => {
            square.classList.remove('highlight-square');
        });
    }

    private highlightSquares(source, target) {
        this.cleanHighlights();
        document.querySelector('.square-' + source).classList.add('highlight-square');
        document.querySelector('.square-' + target).classList.add('highlight-square');
    }

    private drawGreySquares(square) {
        if (!this.configuration.highlightSquares) {
            return;
        }
        // get list of possible moves for this square
        const moves = this.chess.moves({ square: square, verbose: true });
        // exit if there are no moves available for this square
        if (moves.length === 0) return;
        // highlight the square they moused over
        this.greySquare(square);
        // highlight the possible squares for this piece
        moves.forEach(move => {
            this.greySquare(move.to);
        });
    }

    private greySquare(square) {
        if (!this.configuration.highlightSquares) {
            return;
        }
        const squareEl = document.querySelector(`#__chessboard__ .square-${square}`) as HTMLElement;
        if (squareEl.classList.contains('black-3c85d')) {
            squareEl.classList.add('move-dest-black');
        } else {
            squareEl.classList.add('move-dest-white');
        }
    };

    private removeGreySquares() {
        if (!this.configuration.highlightSquares) {
            return;
        }
        document.querySelectorAll('.move-dest-black').forEach(function (el) {
            el.classList.remove('move-dest-black');
        });
        document.querySelectorAll('.move-dest-white').forEach(function (el) {
            el.classList.remove('move-dest-white');
        });
    };
}
