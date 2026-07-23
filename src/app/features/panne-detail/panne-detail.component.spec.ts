import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PanneDetailComponent } from './panne-detail.component';

describe('PanneDetailComponent', () => {
  let component: PanneDetailComponent;
  let fixture: ComponentFixture<PanneDetailComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PanneDetailComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PanneDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
