import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { RealtimeService } from './services/realtime-service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('wordle-app');

  constructor() {
    // Keep a live connection open whenever a player is signed in.
    inject(RealtimeService).start();
  }
}
