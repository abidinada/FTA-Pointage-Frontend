import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VoituresServiceComponent } from './voitures-service.component';

describe('VoituresServiceComponent', () => {
  let component: VoituresServiceComponent;
  let fixture: ComponentFixture<VoituresServiceComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VoituresServiceComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VoituresServiceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
