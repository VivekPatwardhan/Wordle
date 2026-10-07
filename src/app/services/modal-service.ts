import { Injectable, signal } from '@angular/core';
import { Subject } from 'rxjs';

export interface ModalAction {
  id: string;
  label: string;
  className?: string;
}

export interface ModalConfig {
  message: string;
  actions?: ModalAction[];
}

@Injectable({
  providedIn: 'root',
})
export class ModalService {
  readonly currentModal = signal<ModalConfig | null>(null);

  private readonly selectedActionSubject = new Subject<string>();
  readonly selectedAction$ = this.selectedActionSubject.asObservable();

  open(config: ModalConfig): void {
    this.currentModal.set(config);
  }

  close(): void {
    this.currentModal.set(null);
  }

  selectAction(actionId: string): void {
    this.selectedActionSubject.next(actionId);
  }
}
