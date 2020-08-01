import { Component, OnInit, ViewChild, HostListener, OnDestroy } from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AngularFirestore } from '@angular/fire/firestore';
import { ConfigurationService, Configuration, UtilsService, MoveTree } from '../shared';
import { Subscription } from 'rxjs';
import { AlertController, MenuController, ToastController, ModalController, Platform, NavController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { AnalysisChessboardComponent } from '../chessboard';
import { ClipboardDialog } from '../dialogs/clipboard.dialog';
import domtoimage from 'dom-to-image-hm';

import { PreferencesPage } from '../preferences/preferences.page';

import { environment } from '../../environments/environment';

@Component({
  selector: 'app-analysis',
  templateUrl: 'analysis.page.html',
  styleUrls: ['analysis.page.scss']
})
export class AnalysisPage implements OnInit, OnDestroy {

  private subscriptions: Subscription[] = [];

  private configuration: Configuration;
  public embed = false;
  public returnUrl: string;
  public moveTree: MoveTree;
  public currentMove: MoveTree;
  public fen: string;
  public infotext = '';
  public btnFlipEnabled = false;
  public gameOverMessage: string;
  public texts: any;

  @ViewChild('chessboard', { static: true }) chessboard: AnalysisChessboardComponent;
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
            this.returnUrl = params.returnUrl;
          })
      );
      this.subscriptions.push(
        this.route.params
          .subscribe(params => {
            this.loadFen(`${params.fen1}/${params.fen2}/${params.fen3}/${params.fen4}/${params.fen5}/${params.fen6}/${params.fen7}/${params.fen8}`);
          })
      );
    });
  }

  ngOnDestroy() {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
    this.subscriptions = [];
  }

  loadFen(fen: string) {
    this.fen = fen;
    const parts = fen.split(' ');
    const num : number = +parts[parts.length - 1];
    this.chessboard.build(fen);
    this.initLocales();
    this.moveTree = {
      parent: null,
      children: [],
      level: 0,
      order: num - 1,
      move: '[0]',
      fen: fen
    };
    this.currentMove = this.moveTree;
  }

  private updateInfoText() {
    if (this.chessboard.isGameOver()) {
      if (this.chessboard.isCheckmated()) {
        this.infotext = this.texts['position.gameover'];
      } else {
        this.infotext = this.texts['position.draw'];
      }
    } else {
      this.infotext = (this.chessboard.turn() == 'w' ?
        this.texts['position.white-turn'] :
        this.texts['position.black-turn']
      );
    }
  }
  ionViewWillEnter() {
    this.menuController.swipeGesture(false);
  }

  ionViewWillLeave() {
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
      'position.draw',
      'position.congratulations',
      'position.review',
      'position.fen-clipboard',
      'position.pgn-clipboard',
      'position.img-clipboard',
      'position.img-bbcode-clipboard',
      'position.img-capture',
      'position.img-uploading',
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

  onPlayerMoved(movement) {
    // If the move already exists in the list, just change the pointer
    const aux = this.currentMove.children.find(item => {return item.move == movement});
    if (aux) {
      this.currentMove = aux;
    } else {
      const move: MoveTree = {
        parent: this.currentMove,
        children: [],
        level: this.currentMove.level + 1,
        move: movement,
        order: this.currentMove.order + (this.chessboard.turn() == 'b' ? 1 : 0),
        fen: this.chessboard.fen()
      };
      this.currentMove.children.push(move);
      this.currentMove = move;
    }
    this.updateInfoText();
  }

  btnRemoveClick() {
    if (this.currentMove == this.moveTree) {
      this.moveTree.children = [];
    } else {
      const parent = this.currentMove.parent;
      parent.children.splice(parent.children.findIndex(item => item.fen == this.currentMove.fen), 1);
      if (parent.children.length > 0) {
        this.currentMove = parent.children[parent.children.length - 1];
      } else {
        this.currentMove = parent;
      }
      this.chessboard.showFen(this.currentMove.fen);
      this.updateInfoText();
    }
  }

  async onGameOver(message) {
    this.infotext = message;
    //this.game.gameover = true;
  }

  showMove(move: MoveTree) {
    if (this.currentMove == move) {
      return;
    }
    this.currentMove = move;
    this.chessboard.showFen(move.fen);
    this.updateInfoText();
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

  btnReturnClick() {
    this.navCtrl.navigateRoot(this.returnUrl);
  }

  private async clipboardDialog(): Promise<string> {
    return new Promise<string>(async resolve => {
      const modal = await this.modalController.create({
        component: ClipboardDialog,
        componentProps: {
          'showPGN': 'false',
          'showSpectatorLink': 'false'
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
        if ('fen' == what) {
          this.copyToClipboard(what, this.chessboard.fen());
        } else if ('img' == what || 'img-bbcode' == what) {
          const toast1 = await this.toast.create({
            message: this.texts['position.img-capture'],
            position: 'middle',
            color: 'success'
          });
          toast1.present();
          domtoimage.toPng(document.getElementById('__analysis-chessboard__')).then(async dataUrl => {
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

  trackFunc(index: number, obj: any) {
    return index;
  }
}
