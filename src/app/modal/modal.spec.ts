import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalService } from '../services/modal-service';
import { ModalComponent } from './modal';

describe('ModalComponent', () => {
  let fixture: ComponentFixture<ModalComponent>;
  let modalService: ModalService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ModalComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ModalComponent);
    modalService = TestBed.inject(ModalService);
  });

  it('does not render while closed', () => {
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
  });

  it('renders the supplied message and action labels', () => {
    modalService.open({
      message: 'Try again',
      actions: [{ id: 'next', label: 'Next word' }],
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Try again');
    expect(fixture.nativeElement.querySelector('button').textContent).toContain('Next word');
  });

  it('emits the selected action ID without closing the modal', () => {
    const actionListener = jasmine.createSpy('actionListener');
    modalService.selectedAction$.subscribe(actionListener);
    modalService.open({
      message: 'Game over',
      actions: [{ id: 'reveal', label: 'Reveal word' }],
    });
    fixture.detectChanges();

    fixture.nativeElement.querySelector('button').click();
    fixture.detectChanges();

    expect(actionListener).toHaveBeenCalledOnceWith('reveal');
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).not.toBeNull();
  });
});