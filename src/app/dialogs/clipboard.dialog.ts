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

  constructor(public modalController: ModalController, public translate: TranslateService) {
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

  btnCloseClick() {
    this.modalController.dismiss(null);
  }
  
}
