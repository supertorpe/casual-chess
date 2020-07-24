import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { ModalController } from '@ionic/angular'
import { ConfigurationService } from '../shared/configuration.service';
import { Configuration } from '../shared/model';
import { ThemeSwitcherService } from '../shared/theme-switcher.service';
import { BoardThemeSwitcherService } from '../shared/board-theme-switcher.service';
import { AlertController, ToastController, Platform } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { DomSanitizer } from '@angular/platform-browser';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-preferences',
  templateUrl: 'preferences.page.html',
  styleUrls: ['preferences.page.scss'],
})
export class PreferencesPage implements OnInit, OnDestroy {

  private subscriptions: Subscription[] = [];

  @Input() isModal = false;

  public configuration: Configuration;
  public showThemes = false;
  public showPieceThemes = false;
  public showBoardThemes = false;
  private literals: any;
  public pieceThemes = ['alpha', 'california', 'cburnett', 'chess7', 'chessnut', 'chicago', 'companion', 'fantasy', 'iowa', 'kosal', 'leipzig', 'letter', 'merida', 'mono', 'oslo', 'pirouetti', 'pixel', 'reilly', 'riohacha', 'shapes', 'spatial', 'symmetric'];

  constructor(
    private platform: Platform,
    public modalController: ModalController,
    private sanitizer: DomSanitizer,
    private configurationService: ConfigurationService,
    private toast: ToastController,
    public alertController: AlertController,
    public translate: TranslateService,
    public themeSwitcherService: ThemeSwitcherService,
    public boardThemeSwitcherService: BoardThemeSwitcherService) {
    this.configurationService.initialize().then(config => {
      this.configuration = config;
    });
  }

  ngOnInit() {
    this.subscriptions.push(this.translate.get([
      'preferences.clean-dialog.title',
      'preferences.clean-dialog.subtitle',
      'preferences.clean-dialog.message',
      'preferences.clean-dialog.cancel',
      'preferences.clean-dialog.continue',
      'preferences.changes-saved']).subscribe(async res => {
        this.literals = res;
      }));
  }

  ngOnDestroy() {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
    this.subscriptions = [];
  }

  trackFunc(index: number, obj: any) {
    return index;
  }

  toggleThemes() {
    this.showThemes = !this.showThemes;
    this.showPieceThemes = false;
    this.showBoardThemes = false;
  }

  selectTheme(theme) {
    this.configuration.colorTheme = theme;
    this.themeSwitcherService.setTheme(theme);
  }

  togglePieceThemes() {
    this.showPieceThemes = !this.showPieceThemes;
    this.showThemes = false;
    this.showBoardThemes = false;
  }

  selectPieceTheme(theme) {
    this.configuration.pieceTheme = theme;
    this.configurationService.notifyChanges(this.configuration);
  }

  toggleBoardThemes() {
    this.showBoardThemes = !this.showBoardThemes;
    this.showThemes = false;
    this.showPieceThemes = false;
  }

  selectBoardTheme(theme) {
    this.configuration.boardTheme = theme.name;
    this.boardThemeSwitcherService.setTheme(theme.name);
  }

  getBoardBackground(themeName) {
    return this.sanitizer.bypassSecurityTrustStyle(this.configuration.boardTheme === themeName ? 'var(--ion-color-light)' : '');
  }

  btnCloseClick() {
    this.modalController.dismiss({ config: this.configuration });
  }

  save() {
    this.configurationService.save().then(async () => {
      const toast = await this.toast.create({
        message: this.literals['preferences.changes-saved'],
        position: 'middle',
        color: 'success',
        duration: 1000
      });
      toast.present();
      if (this.isModal) {
        this.btnCloseClick();
      }
    });
  }

}
