import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MarquesComponent } from './marques.component';

describe('MarquesComponent', () => {
  let component: MarquesComponent;
  let fixture: ComponentFixture<MarquesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MarquesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MarquesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
