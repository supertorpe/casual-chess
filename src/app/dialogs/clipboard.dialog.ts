import { Component, Input } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'position-clipboard',
  templateUrl: 'clipboard.dialog.html',
  styleUrls: ['clipboard.dialog.scss'],
})
export class ClipboardDialog {

  @Input() showPGN: string;
  @Input() showSpectatorLink: string;
  @Input() showAnalysisLink: string;

  constructor(public modalController: ModalController, public translate: TranslateService) {
  }

  copySpectatorlink() {
    this.modalController.dismiss('spectator-link');
  }
  copyFen() {
    this.modalController.dismiss('fen');
  }
  copyPgn() {
    this.modalController.dismiss('pgn');
  }
  copyImg() {
    this.modalController.dismiss('img-bbcode');
  }
  saveImg() {
    this.modalController.dismiss('img');
  }
  copyAnalysislink() {
    this.modalController.dismiss('analysis');
  }

  btnCloseClick() {
    this.modalController.dismiss(null);
  }
  
}
