import { NgModule, ModuleWithProviders } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { TranslateModule } from '@ngx-translate/core';
import { NgxLazyModule } from 'ngx-lazy-image';
import { UtilsService } from './utils.service';
import { ConfigurationService } from './configuration.service';
import { ThemeSwitcherService } from './theme-switcher.service';
import { BoardThemeSwitcherService } from './board-theme-switcher.service';
import { ChunksPipe } from './chunk.pipe';
import { NgNoCheck } from './no-check';
import { PreferencesPage } from '../preferences/preferences.page';
import { PromotionDialog } from '../dialogs/promotion.dialog';
import { ClipboardDialog } from '../dialogs/clipboard.dialog';
import { FlagDialog } from '../dialogs/flag.dialog';
import { AnalysisDialog } from '../dialogs/analysis.dialog';
import { NewgameDialog } from '../dialogs/newgame.dialog';
import { NotificationsService } from './notifications.service';

const providers = [
    UtilsService, ConfigurationService, ThemeSwitcherService, BoardThemeSwitcherService, NotificationsService];

    @NgModule({
        imports: [
            CommonModule,
            FormsModule,
            IonicModule,
            NgxLazyModule,
            TranslateModule.forChild()
        ],
        declarations: [ChunksPipe, PreferencesPage, NgNoCheck,PromotionDialog,ClipboardDialog,FlagDialog,AnalysisDialog,NewgameDialog],
        providers: [],
        entryComponents: [PreferencesPage,PromotionDialog,ClipboardDialog,FlagDialog,AnalysisDialog,NewgameDialog],
        exports: [
            CommonModule,
            FormsModule,
            IonicModule,
            NgxLazyModule,
            TranslateModule,
            ChunksPipe,
            NgNoCheck
        ]
    })
    export class SharedModule {
        static forRoot(): ModuleWithProviders {
            return {
                ngModule: SharedModule,
                providers: [...providers]
            };
        }
    }
    