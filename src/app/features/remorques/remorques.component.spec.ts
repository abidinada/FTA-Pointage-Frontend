import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RemorquesComponent } from './remorques.component';

describe('RemorquesComponent', () => {
  let component: RemorquesComponent;
  let fixture: ComponentFixture<RemorquesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RemorquesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RemorquesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
