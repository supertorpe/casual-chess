import { Component, ViewChildren, QueryList, OnInit, OnDestroy } from '@angular/core';
import { Router, NavigationStart } from '@angular/router';

import { Platform, IonRouterOutlet, NavController, ToastController } from '@ionic/angular';

import { TranslateService } from '@ngx-translate/core';

import { Subscription } from 'rxjs';

import { ConfigurationService, Configuration, ThemeSwitcherService, BoardThemeSwitcherService, NotificationsService } from './shared';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {

  private subscriptions : Subscription[] = [];

  public initialized = false;
  private config: Configuration;
  public pieceTheme: string;
  private texts: any;
  private lastTimeBackPress = 0;
  private timePeriodToExit = 2000;
  public hideMenu = false;
  private onConfigChangeSubscription: Subscription;
  @ViewChildren(IonRouterOutlet) routerOutlets: QueryList<IonRouterOutlet>;

  public pages = [
    {
      title: 'home',
      url: '/home',
      icon: 'home'
    },
    {
      title: 'preferences',
      url: '/preferences',
      icon: 'options'
    },
    {
      title: 'about',
      url: '/about',
      icon: 'help'
    }
  ];

  constructor(
    private platform: Platform,
    private router: Router,
    private toast: ToastController,
    private navCtrl: NavController,
    private translate: TranslateService,
    private configurationService: ConfigurationService,
    private themeSwitcherService: ThemeSwitcherService,
    private boardThemeSwitcherService: BoardThemeSwitcherService,
    private notificationsService: NotificationsService
  ) {
    this.translate.setDefaultLang('en');
    this.translate.use(this.translate.getBrowserLang());
    this.initializeApp();
  }

  ngOnInit(): void {
    this.subscriptions.push(this.configurationService.onChange$.subscribe(event => this.configurationChanged(event)));
  }

  ngOnDestroy(): void {
    alert('destrucción!!!!!!');
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
    this.subscriptions = [];
  }

  private configurationChanged(config) {
    this.config = config;
  }

  private initializeApp() {
    this.notificationsService.requestSubscription();
    this.router.events.subscribe(evt => {
      if (evt instanceof NavigationStart) {
        if (evt.url.startsWith('/position') && evt.url.endsWith('embed=true'))
          this.hideMenu = true;
      }
    });
    this.platform.backButton.subscribe(async () => {
      this.routerOutlets.forEach(async (outlet: IonRouterOutlet) => {
        this.goBack();
      });
    });
    Promise.all([
      this.configurationService.initialize(),
      this.platform.ready()
    ]).then((values: any[]) => {
      this.config = values[0];
      this.pieceTheme = this.config.pieceTheme;
      this.themeSwitcherService.setTheme(this.config.colorTheme);
      this.boardThemeSwitcherService.setTheme(this.config.boardTheme);
      this.translate.get(['app.back-to-exit']).subscribe(async res => {
        this.texts = res;
      });
      this.initialized = true;
    });
  }

  private async goBack() {
    if (this.router.url === '/home') {
      if (this.lastTimeBackPress !== 0 && new Date().getTime() - this.lastTimeBackPress < this.timePeriodToExit) {
        navigator['app'].exitApp();
      } else {
        const toast = await this.toast.create({
          message: this.texts['app.back-to-exit'],
          position: 'middle',
          color: 'medium',
          duration: this.timePeriodToExit
        });
        toast.present();
        this.lastTimeBackPress = new Date().getTime();
      }
    } else if (this.router.url.startsWith('/list/') ||
      this.router.url === '/preferences' || this.router.url === '/about') {
      this.navCtrl.navigateRoot('/home');
    } else if (this.router.url.startsWith('/position/')) {
      this.navCtrl.navigateRoot(this.router.url.substring(0, this.router.url.lastIndexOf('/')).replace('position', 'list'));
    }
  }

  trackFunc(index: number, obj: any) {
    return index;
  }
  
}
