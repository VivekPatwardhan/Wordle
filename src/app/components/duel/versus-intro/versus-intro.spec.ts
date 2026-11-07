import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { VersusIntro } from './versus-intro';

describe('VersusIntro', () => {
  let fixture: ComponentFixture<VersusIntro>;
  let done: number;

  beforeEach(() => {
    fixture = TestBed.createComponent(VersusIntro);
    done = 0;
    fixture.componentInstance.done.subscribe(() => done++);
    fixture.componentRef.setInput('me', 'Alice');
    fixture.componentRef.setInput('opponent', 'Bob');
    fixture.componentRef.setInput('heading', '4-round duel');
    fixture.componentRef.setInput('subtitle', 'Bob sets the first word');
    fixture.detectChanges();
  });

  it('announces both players and the duel', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Alice');
    expect(text).toContain('VS');
    expect(text).toContain('Bob');
    expect(text).toContain('4-round duel');
    expect(text).toContain('Bob sets the first word');
  });

  it('can be skipped with a tap', () => {
    (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.stage')!.click();
    expect(done).toBe(1);
  });

  it('clears itself after a few seconds', fakeAsync(() => {
    const local = TestBed.createComponent(VersusIntro);
    let finished = false;
    local.componentInstance.done.subscribe(() => (finished = true));
    tick(3600);
    expect(finished).toBeTrue();
    local.destroy();
  }));
});
