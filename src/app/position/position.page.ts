import { Component, OnInit, ViewChild, HostListener, OnDestroy } from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { AngularFirestore } from '@angular/fire/firestore';
import { ConfigurationService, Configuration, Game, UtilsService, Player } from '../shared';
import { Subscription } from 'rxjs';
import { AlertController, MenuController, ToastController, ModalController, Platform } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { ChessboardComponent } from '../chessboard';
import { ClipboardDialog } from './clipboard.dialog';
import domtoimage from 'dom-to-image-hm';

import { PreferencesPage } from '../preferences/preferences.page';

@Component({
  selector: 'app-position',
  templateUrl: 'position.page.html',
  styleUrls: ['position.page.scss']
})
export class PositionPage implements OnInit, OnDestroy {

  private subscriptions: Subscription[] = [];

  private configuration: Configuration;
  public game: Game;
  private gameLoaded = false;
  private playerType: string;



  public fen: string;
  public move: string;
  public idx = 1;
  public targetImage = '';
  public infotext = '';
  public btnRewindEnabled = false;
  public btnFlipEnabled = false;
  public gameOverMessage: string;
  public autoplaying = false;
  public intervalPlay;
  public texts: any;

  @ViewChild('chessboard', { static: true }) chessboard: ChessboardComponent;
  @ViewChild('fab', { static: true }) fab: any;

  constructor(
    private afs: AngularFirestore,
    private route: ActivatedRoute,
    private location: Location,
    private menuController: MenuController,
    public alertController: AlertController,
    public translate: TranslateService,
    private utils: UtilsService,
    private configurationService: ConfigurationService,
    private toast: ToastController,
    public modalController: ModalController) {
  }

  ngOnInit() {
    this.configurationService.initialize().then(config => {
      this.configuration = config;
      this.subscriptions.push(
        this.route.params.subscribe(params => {
          this.playerType = params.id[0];
          this.subscriptions.push(
            this.afs.collection<Game>('games', ref => {
              return ref.where(`${this.playerType}id`, '==', params.id)
            })
              .snapshotChanges()
              .subscribe(data => {
                this.loadGame(data.map(item => {
                  return item.payload.doc.data();
                })[0]);
                this.initLocales();
              }));
        }));
    });
    
  }

  ngOnDestroy() {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
    this.subscriptions = [];
  }

  private createPlayer() {
    const player: Player = {
      uid: null,
      pid: this.utils.uuidv4(),
      name: null
    };
    this.afs.collection<Player>('players').add(player).then(result => {
      player.uid = result.id;
      this.afs.collection<Player>('players').doc(result.id).update(player).then(() => {
        // player created: update config
        this.configuration.pid = player.pid;
        this.configurationService.save();
        this.game[`${this.playerType}pkey`] = player.uid;
        this.afs.collection<Game>('games').doc(this.game.uid).update(this.game);
      });
    });
  }

  private loadPlayerFromGame() {
    // read player
    this.subscriptions.push(this.afs.doc<Player>('players/' + this.game[`${this.playerType}pkey`])
      .snapshotChanges()
      .subscribe(doc => {
        const player = doc.payload.data() as Player;
        // update config
        this.configuration.pid = player.pid;
        this.configuration.name = player.name;
        this.configurationService.save();
      }));
    // TO DO : when player not found
  }

  private setGamePlayer() {
    // get player data
    this.subscriptions.push(this.afs.collection<Player>('players', ref => {
      return ref.where('pid', '==', this.configuration.pid)
    })
      .snapshotChanges()
      .subscribe(data => {
        const players: Player[] = data.map(item => {
          return item.payload.doc.data();
        });
        if (players == null || players.length == 0) {
          // TO DO: when player not found
        } else {
          this.game[`${this.playerType}pkey`] = players[0].uid;
          this.afs.collection<Game>('games').doc(this.game.uid).update(this.game);
        }
      }));
  }

  private checkGamePlayer() {
    // get player data
    this.subscriptions.push(this.afs.collection<Player>('players', ref => {
      return ref.where('pid', '==', this.configuration.pid)
    })
      .snapshotChanges()
      .subscribe(data => {
        const players: Player[] = data.map(item => {
          return item.payload.doc.data();
        });
        if (players == null || players.length == 0) {
          // TO DO: when player not found
        } else //if ((this.playerType == 'w' && this.game.wpkey != players[0].uid) || (this.playerType == 'b' && this.game.bpkey != players[0].uid)) {
          if (this.game[`${this.playerType}pkey`] != players[0].uid) {
            // resync player uid
            this.game[`${this.playerType}pkey`] = players[0].uid;
            this.afs.collection<Game>('games').doc(this.game.uid).update(this.game);
          }
      }));
    // TO DO: when player not found
  }

  private loadGame(game: Game) {
    this.game = game;
    if (!this.gameLoaded) {
      this.gameLoaded = true;
      // set player pid and name
      if (this.playerType !== 'v') {
        if (this.configuration.pid == null) {
          if (game[`${this.playerType}pkey`] == null) {
            this.createPlayer();
          } else {
            this.loadPlayerFromGame();
          }
        } else if (game[`${this.playerType}pkey`] == null) {
          this.setGamePlayer();
        } else {
          this.checkGamePlayer();
        }
      }
      this.chessboard.build(game.pgn, this.playerType);
    } else {
      this.chessboard.update(game.pgn);
      this.updateInfoText();
    }
  }
  private updateInfoText() {
    if (this.chessboard.isGameOver()) {
      this.infotext = this.texts['position.gameover'];
    } else if (this.playerType == 'v') {
      this.infotext = (this.chessboard.turn() == 'w' ?
        this.texts['position.white-turn'] :
        this.texts['position.black-turn']
      );
    } else if (this.chessboard.turn() == this.playerType) {
      this.infotext = this.texts['position.your-turn'];
    } else {
      this.infotext = this.texts['position.not-your-turn'];
    }
  }
  ionViewWillEnter() {
    this.menuController.swipeGesture(false);
  }

  ionViewWillLeave() {
    this.stopAutoplay();
    this.menuController.swipeGesture(true);
  }

  @HostListener('window:resize', ['$event'])
  onResize(event) {
    const container = document.querySelector('.container');
    const boardWrapper: any = document.querySelector('.board_wrapper');
    const infoWrapper: any = document.querySelector('.info_wrapper');
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    const minSize = Math.min(containerWidth, containerHeight);
    boardWrapper.style.height = minSize + 'px';
    boardWrapper.style.width = minSize + 'px';
    if (containerWidth > containerHeight) {
      infoWrapper.style.width = containerWidth - minSize - 2 + 'px';
      infoWrapper.style.height = '100%';
    } else {
      infoWrapper.style.width = '100%';
      infoWrapper.style.height = containerHeight - minSize - 2 + 'px';
    }
  }

  private initLocales() {
    this.subscriptions.push(this.translate.get([
      'position.your-turn',
      'position.not-your-turn',
      'position.white-turn',
      'position.black-turn',
      'position.gameover',
      'position.congratulations',
      'position.review',
      'position.fen-clipboard',
      'position.pgn-clipboard',
      'position.img-clipboard',
      'position.in',
      'position.moves',
      'position.ups',
      'position.ok'
    ]).subscribe(async res => {
      this.texts = res;
      this.updateInfoText();
    }));
  }

  async onWarn(info) {
    const toast = await this.toast.create({
      message: info,
      position: 'middle',
      color: 'warning',
      duration: 3000
    });
    toast.present();
  }

  onPlayerMoved() {
    this.game.pgn = this.chessboard.pgn();
    this.afs.collection<Game>('games').doc(this.game.uid).update(this.game);
  }

  async onGameOver(message) {
    this.infotext = message;
    this.game.gameover = true;
    this.afs.collection<Game>('games').doc(this.game.uid).update(this.game);
  }

  private async settingsDialog(): Promise<Configuration> {
    return new Promise<Configuration>(async resolve => {
      const modal = await this.modalController.create({
        component: PreferencesPage,
        componentProps: { isModal: true }
      });
      modal.present();
      const { data } = await modal.onDidDismiss();
      if (data == undefined) {
        resolve(null);
      } else {
        resolve(data.config);
      }
    });
  }

  btnSettingsClick() {
    const self = this;
    this.settingsDialog().then(function (config) {
      self.configurationService.notifyChanges(config);
    });
  }

  btnRewindClick() {
    this.chessboard.rewind();
    this.btnRewindEnabled = false;
    this.infotext = this.texts['position.your-turn'];
  }

  btnFlipClick() {
    this.chessboard.flip();
  }

  private async clipboardDialog(): Promise<string> {
    return new Promise<string>(async resolve => {
      const modal = await this.modalController.create({
        component: ClipboardDialog
      });
      modal.present();
      const { data } = await modal.onDidDismiss();
      if (data == undefined) {
        resolve(null);
      } else {
        resolve(data);
      }
    });
  }

  btnCopyClipboardClick() {
    this.clipboardDialog().then(what => {
      if (what) {
        if ('fen' == what) {
          this.copyTextToClipboard(what, this.chessboard.fen());
        } else if ('pgn' == what) {
          this.copyTextToClipboard(what, this.chessboard.pgn());
        } else if ('img' == what) {
          domtoimage.toPng(document.getElementById('__chessboard__')).then(dataUrl => {
            this.saveBase64AsFile(dataUrl, 'chessboard.png');

            ///////
/*
            const el = document.createElement('img');
            el.src = dataUrl;
            el.style.position = 'absolute';
            el.style.left = '-9999px';
            document.body.appendChild(el);
            const myrange = document.createRange();
            myrange.setStartBefore(el);
            myrange.setEndAfter(el);
            myrange.selectNode(el);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(myrange);
            document.execCommand('copy');
            sel.removeAllRanges();
            document.body.removeChild(el);
            */
            /*
            const img = document.createElement('img');
            img.src = dataUrl;

            const div = document.createElement('div');
            div.contentEditable = 'true';
            div.appendChild(img);
            document.body.appendChild(div);

            // do copy

            const doc = document;
            // if (doc.body.createTextRange) {
            //     var range = document.body.createTextRange();
            //     range.moveToElementText(div);
            //     range.select();
            // } else if (window.getSelection) {
                const selection = window.getSelection();
                const range = document.createRange();
                range.selectNodeContents(div);
                selection.removeAllRanges();
                selection.addRange(range);
            //}

            document.execCommand('Copy');
            document.body.removeChild(div);
            ///////
            */
          });
        }
      }
    });
  }

  saveBase64AsFile(base64, fileName) {
    const link = document.createElement("a");
    document.body.appendChild(link); // for Firefox
    link.setAttribute("href", base64);
    link.setAttribute("download", fileName);
    link.click();
    this.showToastClipboard('img');
  }

  private copyTextToClipboard(what: string, text: string) {
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style.position = 'absolute';
    el.style.left = '-9999px';
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    this.showToastClipboard(what);
  }

  private async showToastClipboard(what) {
    const toast = await this.toast.create({
      message: this.texts['position.' + what + '-clipboard'],
      position: 'middle',
      color: 'success',
      duration: 1000
    });
    toast.present();
  }


  btnShowFirstPositionClick() {
    this.chessboard.showFirstPosition();
  }

  btnShowPreviousPositionClick() {
    this.chessboard.showPreviousPosition();
  }

  btnShowNextPositionClick() {
    this.chessboard.showNextPosition();
  }

  btnShowLatestPositionClick() {
    this.chessboard.showLatestPosition();
  }

  btnPlayClick() {
    //if (this.fab.activated) this.fab.close();
    const self = this;
    this.autoplaying = true;
    if (this.internalPlay()) {
      this.intervalPlay = setInterval(function () {
        if (!self.internalPlay()) {
          clearInterval(self.intervalPlay);
          self.intervalPlay = null;
        }
      }, 1000);
    }
  }

  internalPlay() {
    this.chessboard.showNextPosition();
    if (this.chessboard.isShowingLatestPosition()) {
      this.autoplaying = false;
      return false;
    }
    return true;
  }

  btnPauseClick() {
    this.autoplaying = false;
    clearInterval(this.intervalPlay);
  }

  private stopAutoplay() {
    if (this.intervalPlay) {
      clearInterval(this.intervalPlay);
      this.intervalPlay = null;
      this.autoplaying = false;
    }
  }

}
