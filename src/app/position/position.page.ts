import { Component, OnInit, ViewChild, HostListener, OnDestroy } from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AngularFirestore } from '@angular/fire/firestore';
import { ConfigurationService, Configuration, Game, UtilsService, Player, Analysis } from '../shared';
import { Subscription, Subject } from 'rxjs';
import { AlertController, MenuController, ToastController, ModalController, Platform, NavController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { ChessboardComponent } from '../chessboard';
import { ClipboardDialog } from '../dialogs/clipboard.dialog';
import { FlagDialog } from '../dialogs/flag.dialog';
import domtoimage from 'dom-to-image-hm';
import * as Chess from 'chess.js';
import { PreferencesPage } from '../preferences/preferences.page';

import { environment } from '../../environments/environment';
import { subscribeOn } from 'rxjs/operators';
import { AnalysisDialog } from '../dialogs/analysis.dialog';

@Component({
  selector: 'app-position',
  templateUrl: 'position.page.html',
  styleUrls: ['position.page.scss']
})
export class PositionPage implements OnInit, OnDestroy {

  private subscriptions: Subscription[] = [];

  private configuration: Configuration;
  private id;
  public embed = false;
  public game: Game;
  private gameLoaded = false;
  public playerType: string;

  public fen: string;
  public parsedPgn: string[][];
  public move: string;
  public idx = 1;
  public targetImage = '';
  public infotext = '';
  public btnFlipEnabled = false;
  public gameOverMessage: string;
  public autoplaying = false;
  public intervalPlay;
  public texts: any;
  private opponent: Player;

  @ViewChild('chessboard', { static: true }) chessboard: ChessboardComponent;
  @ViewChild('fab', { static: true }) fab: any;

  constructor(
    private afs: AngularFirestore,
    private route: ActivatedRoute,
    private navCtrl: NavController,
    private http: HttpClient,
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
        this.route.queryParams
          .subscribe(params => {
            this.embed = (params.embed == 'true');
          })
      );

      this.subscriptions.push(this.translate.get([
        'position.your-turn',
        'position.not-your-turn',
        'position.white-turn',
        'position.black-turn',
        'position.white-resigned',
        'position.black-resigned',
        'position.gameover',
        'position.draw',
        'position.draw-offer-rejected',
        'position.request-undo-rejected',
        'position.congratulations',
        'position.review',
        'position.spectator-link-clipboard',
        'position.fen-clipboard',
        'position.pgn-clipboard',
        'position.img-clipboard',
        'position.img-bbcode-clipboard',
        'position.img-capture',
        'position.img-uploading',
        'position.draw-dialog.title',
        'position.draw-dialog.subtitle',
        'position.draw-dialog.message',
        'position.draw-dialog.cancel',
        'position.draw-dialog.accept',
        'position.undo-dialog.title',
        'position.undo-dialog.subtitle',
        'position.undo-dialog.message',
        'position.undo-dialog.cancel',
        'position.undo-dialog.accept',
        'position.in',
        'position.moves',
        'position.ups',
        'position.ok',
        'position.name-dialog.title',
        'position.name-dialog.subtitle',
        'position.name-dialog.message',
        'position.name-dialog.name',
        'position.name-dialog.cancel',
        'position.name-dialog.accept',
        'position.move-notification-text',
        'position.not-both-pieces'
      ]).subscribe(async res => {
        this.texts = res;
        this.subscriptions.push(
          this.route.params.subscribe(params => {
            this.id = params.id;
            this.playerType = params.id[0];
            this.subscriptions.push(
              this.afs.collection<Game>('games', ref => {
                return ref.where(`${this.playerType}id`, '==', params.id)
              })
                .valueChanges()
                .subscribe(data => {
                  this.loadGame(data[0]);
                  this.updateInfoText();
                }));
            if (this.playerType == 'v' && this.configuration.pid) {
              this.subscriptions.push(
                this.afs.collection<Player>('players', ref => {
                  return ref.where('pid', '==', this.configuration.pid)
                })
                  .snapshotChanges()
                  .subscribe(players => {
                    const playerData = players[0];
                    const player = playerData.payload.doc.data();
                    const playerKey = playerData.payload.doc.id;
                    let mustUpdate = false;
                    if (!player.hasOwnProperty('stars')) {
                      player.stars = [params.id];
                      mustUpdate = true;
                    } else if (!player.stars.includes(params.id)) {
                      player.stars.push(params.id);
                      mustUpdate = true;
                    }
                    if (mustUpdate) {
                      this.afs.collection<Player>('players').doc(playerKey).update(player);
                    }
                  }));
            }
          }));
      }));
    });

  }

  ngOnDestroy() {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
    this.subscriptions = [];
  }

  async queryGameName() {
    const alert = await this.alertController.create({
      header: this.texts['position.name-dialog.title'],
      subHeader: this.texts['position.name-dialog.subtitle'],
      message: this.texts['position.name-dialog.message'],
      inputs: [
        {
          name: 'inputtext',
          type: 'text',
          placeholder: this.texts['position.name-dialog.name']
        }],
      buttons: [
        {
          text: this.texts['position.name-dialog.cancel'],
          role: 'cancel',
          cssClass: 'overlay-button',
          handler: () => {
            // do nothing
          }
        }, {
          text: this.texts['position.name-dialog.accept'],
          cssClass: 'overlay-button',
          handler: (alertData) => {
            if (this.playerType == 'w')
              this.game.wpname = alertData.inputtext;
            else if (this.playerType == 'b')
              this.game.bpname = alertData.inputtext;
            this.afs.collection<Game>('games').doc(this.game.uid).update(this.game);
          }
        }
      ]
    });
    await alert.present();
  }

  private loadGame(game: Game) {
    this.game = game;
    if (!this.gameLoaded) {
      this.gameLoaded = true;
      // set player pid and name
      if (this.playerType !== 'v') {
        let theSubject = new Subject<boolean>();
        this.utils.linkGameToUser(this.game, this.playerType, theSubject);
        theSubject.subscribe(async result => {
          if (result) {
            if ((this.playerType == 'w' && !this.game.wpname) || (this.playerType == 'b' && !this.game.bpname)) {
              this.queryGameName();
            }
            this.loadOpponent();
          } else {
            const toast = await this.toast.create({
              message: this.texts['position.not-both-pieces'],
              position: 'middle',
              color: 'warning',
              duration: 3000
            });
            toast.present();
            this.navCtrl.navigateRoot('/home');
          }
        })
      }
      this.checkGameStatus();
      this.chessboard.build(game.pgn, this.playerType, game.status);
      this.parsePgn(game.pgn);
    } else {
      this.checkGameStatus();
      this.chessboard.update(game.pgn, game.status);
      this.parsePgn(game.pgn);
      this.updateInfoText();
    }
    if (this.game.status == 'WOD' && this.playerType == 'b' || this.game.status == 'BOD' && this.playerType == 'w') {
      this.showDrawOfferDialog();
    } else if (this.game.status == 'WRU' && this.playerType == 'b' || this.game.status == 'BRU' && this.playerType == 'w') {
      this.showConfirmUndoDialog();
    }
  }

  loadOpponent() {
    let opponentKey = null;
    if (this.playerType == 'w')
      opponentKey = this.game.bpkey;
    else if (this.playerType == 'b')
      opponentKey = this.game.wpkey;
    if (opponentKey == null)
      return;
    this.afs.doc<Player>('players/' + opponentKey)
      .valueChanges()
      .subscribe(player => {
        if (!player.hasOwnProperty('pushSubscription') || player.pushSubscription == null) {
          return;
        }
        this.opponent = player;
      });
  }

  async showDrawOfferDialog() {
    const alert = await this.alertController.create({
      header: this.texts['position.draw-dialog.title'],
      subHeader: this.texts['position.draw-dialog.subtitle'],
      message: this.texts['position.draw-dialog.message'],
      buttons: [
        {
          text: this.texts['position.draw-dialog.cancel'],
          role: 'cancel',
          cssClass: 'overlay-button',
          handler: () => {
            if (this.playerType == 'w')
              this.game.status = 'WRD';
            else if (this.playerType == 'b')
              this.game.status = 'BRD';
            this.game.lastupdated = new Date();
            this.afs.collection<Game>('games').doc(this.game.uid).update(this.game);
          }
        }, {
          text: this.texts['position.draw-dialog.accept'],
          cssClass: 'overlay-button',
          handler: () => {
            this.game.status = 'DRA';
            this.game.lastupdated = new Date();
            this.afs.collection<Game>('games').doc(this.game.uid).update(this.game);
          }
        }
      ]
    });
    await alert.present();
  }

  async showConfirmUndoDialog() {
    const alert = await this.alertController.create({
      header: this.texts['position.undo-dialog.title'],
      subHeader: this.texts['position.undo-dialog.subtitle'],
      message: this.texts['position.undo-dialog.message'],
      buttons: [
        {
          text: this.texts['position.undo-dialog.cancel'],
          role: 'cancel',
          cssClass: 'overlay-button',
          handler: () => {
            if (this.playerType == 'w')
              this.game.status = 'WNU';
            else if (this.playerType == 'b')
              this.game.status = 'BNU';
            this.game.lastupdated = new Date();
            this.afs.collection<Game>('games').doc(this.game.uid).update(this.game);
          }
        }, {
          text: this.texts['position.undo-dialog.accept'],
          cssClass: 'overlay-button',
          handler: () => {
            this.chessboard.undoMove();
          }
        }
      ]
    });
    await alert.present();
  }
  checkGameStatus() {
    if (!this.game.status) {
      const auxChess: Chess = new Chess();
      auxChess.load_pgn(this.game.pgn);
      if (auxChess.in_checkmate()) {
        if (auxChess.turn() == 'w') {
          this.game.status = 'BWI';
        } else {
          this.game.status = 'WWI';
        }
      } else if (auxChess.in_stalemate() || auxChess.insufficient_material() || auxChess.in_threefold_repetition() || auxChess.in_draw()) {
        this.game.status = 'DRA';
      } else {
        if (auxChess.turn() == 'w') {
          this.game.status = 'WTR';
        } else {
          this.game.status = 'BTR';
        }
      }
      this.afs.collection<Game>('games').doc(this.game.uid).update(this.game);
    }
  }

  async updateInfoText() {
    if (this.game.status == 'WRD' && this.playerType == 'b' || this.game.status == 'BRD' && this.playerType == 'w') {
      const toast = await this.toast.create({
        message: this.texts['position.draw-offer-rejected'],
        position: 'middle',
        color: 'warning',
        duration: 3000
      });
      toast.present();
      if (this.game.status == 'WRD') {
        this.game.status = 'BTR';
      } else if (this.game.status == 'BRD') {
        this.game.status = 'WBTR';
      }
      this.afs.collection<Game>('games').doc(this.game.uid).update(this.game);
    }
    if (this.game.status == 'WNU' && this.playerType == 'b' || this.game.status == 'BNU' && this.playerType == 'w') {
      const toast = await this.toast.create({
        message: this.texts['position.request-undo-rejected'],
        position: 'middle',
        color: 'warning',
        duration: 3000
      });
      toast.present();
      if (this.game.status == 'WNU') {
        this.game.status = 'WTR';
      } else if (this.game.status == 'BNU') {
        this.game.status = 'BTR';
      }
      this.afs.collection<Game>('games').doc(this.game.uid).update(this.game);
    }
    if (this.game.status == 'DRA') {
      this.infotext = this.texts['position.draw'];
    } else if (this.game.status == 'WRE') {
      this.infotext = this.texts['position.white-resigned'];
    } else if (this.game.status == 'BRE') {
      this.infotext = this.texts['position.black-resigned'];
    } else if (this.chessboard.isGameOver()) {
      if (this.chessboard.isCheckmated()) {
        this.infotext = this.texts['position.gameover'];
      } else {
        this.infotext = this.texts['position.draw'];
      }
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
    this.parsePgn(this.game.pgn);
    this.game.lastupdated = new Date();
    if (this.chessboard.turn() == 'w') {
      this.game.status = 'WTR';
    } else {
      this.game.status = 'BTR';
    }
    this.afs.collection<Game>('games').doc(this.game.uid).update(this.game);
    this.sendNotification();
  }

  sendNotification() {
    if (this.playerType == 'w' && this.game.hasOwnProperty('bpnotif') && !this.game.bpnotif)
      return;
    if (this.playerType == 'b' && this.game.hasOwnProperty('wpnotif') && !this.game.wpnotif)
      return;
    if (this.opponent && this.opponent.pushSubscription) {
      const httpOptions = {
        headers: new HttpHeaders({
          'Content-Type': 'application/json; charset=utf-8',
          'Accept': '"application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*'
        })
      };
      const formData = {
        jsonSub: this.opponent.pushSubscription,
        notificationTitle: 'Casual Chess',
        notificationBody: this.texts['position.move-notification-text']
      };
      this.http.post<any>(environment.sendNotificationUrl, formData, httpOptions)
        .subscribe(
          data => { },
          err => { },
          () => { }
        );
    }
  }

  async onGameOver(values: string[]) {
    const message = values[0];
    const status = values[1];
    const toast = await this.toast.create({
      message: message,
      position: 'middle',
      color: 'warning',
      duration: 5000
    });
    toast.present();
    this.game.gameover = true;
    this.game.status = status;
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

  btnFlipClick() {
    this.chessboard.flip();
  }

  private async clipboardDialog(): Promise<string> {
    return new Promise<string>(async resolve => {
      const modal = await this.modalController.create({
        component: ClipboardDialog,
        componentProps: {
          'showPGN': 'true',
          'showSpectatorLink': 'true'
        }
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
    this.clipboardDialog().then(async what => {
      if (what) {
        if ('spectator-link' == what) {
          this.copyToClipboard(what, `https://casual-chess.web.app/position/${this.game.vid}`);
        } if ('fen' == what) {
          this.copyToClipboard(what, this.chessboard.fen());
        } else if ('pgn' == what) {
          this.copyToClipboard(what, this.chessboard.pgn());
        } else if ('img' == what || 'img-bbcode' == what) {
          const toast1 = await this.toast.create({
            message: this.texts['position.img-capture'],
            position: 'middle',
            color: 'success'
          });
          toast1.present();
          domtoimage.toPng(document.getElementById('__chessboard__')).then(async dataUrl => {
            toast1.dismiss();
            if ('img' == what) {
              this.saveBase64AsFile(dataUrl, 'chessboard.png');
            } else if ('img-bbcode' == what) {
              const toast = await this.toast.create({
                message: this.texts['position.img-uploading'],
                position: 'middle',
                color: 'success'
              });
              toast.present();
              const self = this;
              const img = new Image;
              img.onload = function () {
                const newDataUri = self.resizeImage(this, 350, 350);
                const httpOptions = {
                  headers: new HttpHeaders({
                    'Authorization': 'Client-ID ' + environment.imgur.clientId,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                  })
                };
                const data = {
                  type: 'base64',
                  name: 'chessboard.png',
                  image: newDataUri.split(',')[1]
                };
                self.http.post<any>('https://api.imgur.com/3/image', data, httpOptions)
                  .subscribe(response => {
                    toast.dismiss();
                    const bbcode = '[img]' + response.data.link + '[/img]';
                    self.copyToClipboard(what, bbcode);
                  });
              };
              img.src = dataUrl;
            }
          });
        }
      }
    });
  }

  private async flagDialog(): Promise<string> {
    return new Promise<string>(async resolve => {
      const modal = await this.modalController.create({
        component: FlagDialog,
        componentProps: {
          showOfferDraw: (this.chessboard.turn() == this.playerType ? 'true' : 'false'),
          showRequestUndo: (this.chessboard.turn() == this.playerType ? 'false' : 'true')
        }
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

  btnFlagClick() {
    this.flagDialog().then(async what => {
      let update = false;
      if (what) {
        if ('abandon' == what) {
          if (this.playerType == 'w' && this.game.status != 'WRE') {
            this.game.status = 'WRE';
            update = true;
          } else if (this.playerType == 'b' && this.game.status != 'BRE') {
            this.game.status = 'BRE';
            update = true;
          }
          if (update) {
            this.chessboard.cleanPlayer();
            this.updateInfoText();
          }
        } else if ('offer-draw' == what) {
          if (this.playerType == 'w' && this.game.status != 'WOD') {
            this.game.status = 'WOD';
            update = true;
          } else if (this.playerType == 'b' && this.game.status != 'BOD') {
            this.game.status = 'BOD';
            update = true;
          }
        } else if ('request-undo' == what) {
          if (this.playerType == 'w' && this.game.status != 'WRU') {
            this.game.status = 'WRU';
            update = true;
          } else if (this.playerType == 'b' && this.game.status != 'BRU') {
            this.game.status = 'BRU';
            update = true;
          }
        }
      }
      if (update) {
        this.game.lastupdated = new Date();
        this.afs.collection<Game>('games').doc(this.game.uid).update(this.game);
      }
    });
  }

  resizeImage(img, width, height) {
    const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL();
  }

  saveBase64AsFile(base64, fileName) {
    const link = document.createElement("a");
    document.body.appendChild(link); // for Firefox
    link.setAttribute("href", base64);
    link.setAttribute("download", fileName);
    link.click();
    this.showToastClipboard('img');
  }

  private copyToClipboard(what, text) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
    } else {
      const el = document.createElement('textarea');
      el.value = text;
      el.setAttribute('readonly', '');
      el.style.position = 'absolute';
      el.style.left = '-9999px';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
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

  private async analysisDialog(list: Analysis[]): Promise<string> {
    return new Promise<string>(async resolve => {
      const modal = await this.modalController.create({
        component: AnalysisDialog,
        componentProps: {
          'list': list
        }
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

  btnAnalysisClick() {
    this.subscriptions.push(
      this.afs.collection<Analysis>('analysis', ref => {
        return ref
          .where('pid', '==', this.configuration.pid)
          .where('gid', '==', this.game.uid)
      })
        .valueChanges()
        .subscribe(list => {
          if (list == null || list.length == 0) {
            this.navCtrl.navigateRoot('/analysis/' + this.chessboard.fen() + '?embed=' + this.embed + '&returnUrl=/position/' + this.id);
          } else {
            this.analysisDialog(list).then(async what => {
              if ('create' == what) {
                this.navCtrl.navigateRoot('/analysis/' + this.chessboard.fen() + '?embed=' + this.embed + '&returnUrl=/position/' + this.id);
              } else if (what) {
                this.navCtrl.navigateRoot('/analysis/' + what + '?embed=' + this.embed + '&returnUrl=/position/' + this.id);
              }
            });
          }
        }));
  }

  parsePgn(pgn: string) {
    this.parsedPgn = [];
    if (pgn == '')
      return;
    const parts = pgn.split('.');
    let pos = 0;
    parts.forEach(part => {
      if (pos > 0) {
        let moves = part.trim().split(' ', 2);
        this.parsedPgn.push(moves);
      }
      pos++;
    });
  }

  toggleNotifications() {
    if (this.playerType == 'w') {
      if (!this.game.hasOwnProperty('wpnotif'))
        this.game.wpnotif = false;
      else
        this.game.wpnotif = !this.game.wpnotif;
    }
    else if (this.playerType == 'b') {
      if (!this.game.hasOwnProperty('bpnotif'))
        this.game.bpnotif = false;
      else
        this.game.bpnotif = !this.game.bpnotif;
    }
    this.afs.collection<Game>('games').doc(this.game.uid).update(this.game);
  }

  trackFunc(index: number, obj: any) {
    return index;
  }
}
