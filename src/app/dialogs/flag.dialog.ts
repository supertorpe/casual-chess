import { Component, Input } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'position-flag',
  templateUrl: 'flag.dialog.html',
  styleUrls: ['flag.dialog.scss'],
})
export class FlagDialog {

  @Input() showOfferDraw: string;

  constructor(public modalController: ModalController, public translate: TranslateService) {
  }

  abandonClick() {
    this.modalController.dismiss('abandon');
  }
  offerDraw() {
    this.modalController.dismiss('offer-draw');
  }

  btnCloseClick() {
    this.modalController.dismiss(null);
  }
  
}
