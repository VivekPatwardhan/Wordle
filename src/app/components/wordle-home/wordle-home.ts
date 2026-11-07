import { Component, inject } from '@angular/core';
import { ModalComponent } from '../shared/modal/modal';
import { Footer } from '../shared/footer/footer';
import { Header } from '../shared/header/header';
import { Router } from '@angular/router';
import { GameApi } from '../../services/game-api';
import { GameMode } from '../../models/game';

@Component({
  selector: 'app-wordle-home',
  imports: [ModalComponent, Header, Footer],
  templateUrl: './wordle-home.html',
  styleUrl: './wordle-home.css',
})

export class WordleHome {

  private gameApi = inject(GameApi);
  private router = inject(Router);

  modeSelection(e: Event): void {
    const buttonElement = e.target as HTMLButtonElement;
    const buttonTitle = buttonElement.textContent?.trim().toLowerCase();

    if (buttonTitle === 'daily') {
      this.dailyGame(buttonTitle);
    } else if (buttonTitle === "practice") {
      this.practiceGame(buttonTitle);
    } else {
      this.pvpGame();
    }
  }

  dailyGame(mode: GameMode) {
    this.gameApi.createGame({ mode: mode }).subscribe((res: any) => {
      if (res) {
        this.router.navigate(['/game', res.game.id], {
          state: { data: res.game }
        });
      } else {
        console.error(res.error);
      }
    });

  }

  practiceGame(mode: GameMode) {
    this.gameApi.createGame({ mode: mode }).subscribe((res: any) => {
      if (res) {
        this.router.navigate(['/game', res.game.id], {
          state: { data: res.game }
        });
      } else {
        console.error(res.error);
      }
    });
  }

  pvpGame() {
    this.router.navigate(['/duel']);
  }
}