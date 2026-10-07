import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class WordService {
  private wordBank: String[] = [];
  pickedWord: String = '';
  // constructor() {
  //   this.loadWordBank();
  // }

  async loadWordBank()  {
    try {
      const response = await fetch(`/wordle_words.json`)
      this.wordBank = await response.json();
      // console.log(`Loaded ${this.wordBank.length} words locally.`);
    } catch (err) {
      console.log(`Failed to load local word asset:`, err);
      this.wordBank = ["APPLE", "ABOUT", "ALERT", "BEACH", "CRANE", "TRAIN"];
    }
  }

  async getRandomWord(): Promise<String> {
    if (this.wordBank.length === 0) {
      await this.loadWordBank();
    }
    const randomIndex = Math.floor(Math.random() * this.wordBank.length);
    this.pickedWord = this.wordBank[randomIndex];
    console.log(this.pickedWord); //Remove
    return this.wordBank[randomIndex];
  }

  isValidGuess(guess: String): boolean {
    if(this.wordBank.includes(guess.toUpperCase().trim())) {
      return true;
    }
    return false;
  }

  isCorrectGuess(guess: String): boolean {
    if(guess === this.pickedWord) {
      return true;
    }
    return false;
  }
}
