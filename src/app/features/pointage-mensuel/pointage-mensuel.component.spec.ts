import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PointageMensuelComponent } from './pointage-mensuel.component';

describe('PointageMensuelComponent', () => {
  let component: PointageMensuelComponent;
  let fixture: ComponentFixture<PointageMensuelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PointageMensuelComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PointageMensuelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
