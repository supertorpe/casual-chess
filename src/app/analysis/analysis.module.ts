import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SharedModule } from '../shared';
import { AnalysisPage } from './analysis.page';
import { AnalysisChessboardComponent } from '../chessboard';

@NgModule({
  imports: [
    SharedModule,
    RouterModule.forChild([
      {
        path: '',
        component: AnalysisPage
      }
    ])
  ],
  declarations: [AnalysisPage,AnalysisChessboardComponent],
  entryComponents: []
})
export class AnalisysPageModule {}
