import { Component, Input } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { Analysis } from '../shared/model';

@Component({
  selector: 'position-analysis',
  templateUrl: 'analysis.dialog.html',
  styleUrls: ['analysis.dialog.scss'],
})
export class AnalysisDialog {

  @Input() list: Analysis[];

  constructor(public modalController: ModalController, public translate: TranslateService) {
  }

  showClick(id) {
    this.modalController.dismiss(id);
  }
  create() {
    this.modalController.dismiss('create');
  }

  btnCloseClick() {
    this.modalController.dismiss(null);
  }
  
  trackFunc(index: number, obj: any) {
    return index;
  }
  
}
