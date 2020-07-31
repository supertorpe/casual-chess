import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed, async } from '@angular/core/testing';
import { HttpClientModule } from '@angular/common/http';
import { IonicStorageModule } from '@ionic/storage';
import { SharedModule } from '../shared';
import { RouterModule } from '@angular/router';
import { AnalysisPage } from './analysis.page';

describe('AnalysisPage', () => {
  let component: AnalysisPage;
  let fixture: ComponentFixture<AnalysisPage>;
  let analysisPage: HTMLElement;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ AnalysisPage ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      imports: [
        SharedModule,
        HttpClientModule,
        IonicStorageModule.forRoot(),
        RouterModule.forRoot([
          {
            path: '',
            component: AnalysisPage
          }
        ])
      ],
    })
      .compileComponents();
  }));

  beforeEach(async () => {
    fixture = await TestBed.createComponent(AnalysisPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

});
