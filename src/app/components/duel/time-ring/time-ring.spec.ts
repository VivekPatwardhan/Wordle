import { TestBed } from '@angular/core/testing';
import { TimeRing } from './time-ring';

describe('TimeRing', () => {
  it('draws the border starting at top centre, sized to its element', () => {
    const fixture = TestBed.createComponent(TimeRing);
    fixture.componentRef.setInput('fraction', 0.5);
    fixture.componentRef.setInput('level', 'caution');
    fixture.componentInstance.size.set({ width: 300, height: 80 });
    fixture.detectChanges();

    const path = (fixture.nativeElement as HTMLElement).querySelector('path')!;
    expect(path.getAttribute('d')!.startsWith('M 150 2')).toBeTrue(); // x = width / 2, y = half the stroke
    expect(path.getAttribute('stroke-dasharray')).toBe('50 100');
    expect((fixture.nativeElement as HTMLElement).classList).toContain('caution');
  });

  it('draws nothing until it knows its size', () => {
    const fixture = TestBed.createComponent(TimeRing);
    fixture.componentRef.setInput('fraction', 1);
    fixture.componentRef.setInput('level', 'safe');
    fixture.componentInstance.size.set({ width: 0, height: 0 });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('path')).toBeNull();
  });
});
