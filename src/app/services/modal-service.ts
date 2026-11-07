import { Injectable, Signal, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { DefinitionState } from '../models/game';

export interface ModalAction {
  id: string;
  label: string;
  className?: string;
}

export interface ModalConfig {
  message: string;
  actions?: ModalAction[];
  /** Optional word definition, shown live as it loads (a signal, so the open modal updates). */
  definition?: Signal<DefinitionState>;
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
