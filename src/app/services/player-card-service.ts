import { Injectable, signal } from '@angular/core';

/** Opens the player card popup from anywhere a player's name is shown. */
@Injectable({
  providedIn: 'root',
})
export class PlayerCardService {
  /** The player whose card is open, or null. */
  readonly openUserId = signal<number | null>(null);

  open(userId: number): void {
    this.openUserId.set(userId);
  }

  close(): void {
    this.openUserId.set(null);
  }
}
