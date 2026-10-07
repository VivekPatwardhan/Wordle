import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WordleHome } from './wordle-home';

describe('WordleHome', () => {
  let component: WordleHome;
  let fixture: ComponentFixture<WordleHome>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WordleHome]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WordleHome);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
