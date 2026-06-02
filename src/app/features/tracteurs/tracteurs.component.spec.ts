import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TracteursComponent } from './tracteurs.component';

describe('TracteursComponent', () => {
  let component: TracteursComponent;
  let fixture: ComponentFixture<TracteursComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TracteursComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TracteursComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
