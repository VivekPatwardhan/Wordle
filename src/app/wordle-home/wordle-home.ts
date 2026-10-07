import { Component, ElementRef, inject, OnDestroy, OnInit, Renderer2, ViewChild } from '@angular/core';
import { WordService } from '../services/word-service';
import { ModalService } from '../services/modal-service';
import { ModalComponent } from '../modal/modal';
import { skip, Subscription } from 'rxjs';

@Component({
  selector: 'app-wordle-home',
  imports: [ModalComponent],
  templateUrl: './wordle-home.html',
  styleUrl: './wordle-home.css',
})

export class WordleHome implements OnInit, OnDestroy {

  constructor(public renderer: Renderer2) {}

  noOfRows: number = 6;
  noOfCols: number = 5;
  cursorRowTracker: number = this.noOfRows;
  cursorColTracker: number = this.noOfCols;
  rowCount: number = 0;
  colCount: number = 0;
  isRowComplete: boolean = false;
  isBoardEngaged: boolean = false;
  isGameOver: boolean = false;
  isWordReady: boolean = false;

  @ViewChild('boardElement', { static: false }) boardEleRef!: ElementRef;
  @ViewChild('kbElement', { static: false }) kbEleRef!: ElementRef;

  keyboardRows: { label: string; wide: boolean; backspace: boolean; ariaLabel: string }[][] = [
    'QWERTYUIOP'.split('').map((label) => ({ label, wide: false, backspace: false, ariaLabel: label })),
    'ASDFGHJKL'.split('').map((label) => ({ label, wide: false, backspace: false, ariaLabel: label })),
    [
      { label: 'ENTER', wide: true, backspace: false, ariaLabel: 'Enter' },
      ...'ZXCVBNM'.split('').map((label) => ({ label, wide: false, backspace: false, ariaLabel: label })),
      { label: '⌫', wide: true, backspace: true, ariaLabel: 'Backspace' },
    ],
  ];
  get rowIndexes(): number[] {
    return Array.from({ length: this.noOfRows }, (_, index) => index);
  }
  get colIndexes(): number[] {
    return Array.from({ length: this.noOfCols }, (_, index) => index);
  }
  
  letters: string[][] = Array.from(
    { length: this.noOfRows },
    () => Array(this.noOfCols).fill('')
  );

  private wordService = inject(WordService);
  private modalService = inject(ModalService);
  private actionSubscription?: Subscription;

  ngOnInit(): void {
    if(!this.isBoardEngaged) {
      void this.loadWord();
    }
    this.actionSubscription = this.modalService.selectedAction$.subscribe((actionId) =>{
      switch(actionId) {
        case "next-word":
          this.newGame();
          this.modalService.close();
          break;
        case "reveal-word":
          this.modalService.close();
          this.modalService.open({
            message: `"${this.wordService.pickedWord}"`,
            actions: [
              { id: 'next-word', label: 'Next word' },
            ],
          });
          break;
      }
    });
  }

  ngOnDestroy() {
    this.actionSubscription?.unsubscribe();
  }

  private async loadWord(): Promise<void> {
    await this.wordService.getRandomWord();
    this.isWordReady = true;
  }

  btnClicked(ariaLabel: any) {
    if (ariaLabel === "Enter" && !this.isGameOver) {
      if(this.isRowComplete) {
        this.guessHelper();
      }
      return;
    }
    
    if (ariaLabel === "Backspace" && !this.isGameOver) {
      if(this.colCount > 0){
        this.colCount--;
        this.letters[this.rowCount][this.colCount] = '';
        this.isRowComplete = false;
      }
      return;
    }
    
    if(!this.isBoardEngaged) {
      this.isBoardEngaged = true;
    }

    if(this.isRowComplete) {
      return;
    }

    for(let row = this.rowCount; row<this.cursorRowTracker; row++) {
      for(let col = this.colCount; col<this.cursorColTracker; col++) {
        this.letters[this.rowCount][this.colCount] = ariaLabel;
        this.colCount++;
        if(this.colCount == this.cursorColTracker) {
          this.isRowComplete = true;
        } 
        break;
      }
      break;
    }
  }

  guessHelper() {
    let guessedWord = this.letters[this.rowCount].join('');
    let isValid = this.wordService.isValidGuess(guessedWord);
    let isCorrect = this.wordService.isCorrectGuess(guessedWord);
    if(isValid) {
      if(isCorrect) { 
        this.isRowComplete = true;
        this.isGameOver = true;
        this.wordRowStyle("Flip&Colors", this.letters[this.rowCount], this.rowCount);
        setTimeout(() => {
          this.modalService.open({
            message: 'Congratulations!!!',
            actions: [
              { id: 'next-word', label: 'Next word' },
            ],
          });
        }, 3000);
      } else {
        this.wordRowStyle("Flip&Colors", this.letters[this.rowCount], this.rowCount);
        this.rowCount++;
        this.colCount = 0;
        this.isRowComplete = false;
        if(this.rowCount == this.cursorRowTracker) {
          this.isGameOver = true;
          setTimeout(() => {
            this.modalService.open({
            message: 'You were close!',
            actions: [
              { id: 'next-word', label: 'Next word' },
              { id: 'reveal-word', label: 'Reveal word' },
            ],
          });
          }, 3000);
        }
      }
    } else {
      this.wordRowStyle("Invalid", this.letters[this.rowCount], this.rowCount);

    }
  }

  wordRowStyle(action: string, guess: string[], rowCount: number) {
    const pickedWordArr: string[] = [...this.wordService.pickedWord];
    const boardEle = this.boardEleRef.nativeElement as HTMLElement;
    switch(action) {
      case "Flip&Colors": 
        for(let i = 0; i < guess.length; i++ ){
          let currentRow = boardEle.querySelector(`.board-row:nth-of-type(${rowCount+1})`);
          let currentCell = currentRow?.querySelector(`.squareBlock:nth-of-type(${i+1})`);
          setTimeout(() => {
            if(guess[i] === pickedWordArr[i]) {
              this.renderer.addClass(currentCell, 'flipCell');
              this.renderer.addClass(currentCell, 'matched-Letter');
              this.keyboardStyle(guess[i], 'matched-Letter');
            } else {
              this.renderer.addClass(currentCell, 'flipCell');
              if(pickedWordArr.includes(guess[i])) {
                this.renderer.addClass(currentCell, 'has-Letter');
                this.keyboardStyle(guess[i], 'has-Letter');
              } else {
                this.renderer.addClass(currentCell, 'wrong-Letter');
                this.keyboardStyle(guess[i], 'wrong-Letter');
              }
            }
          }, i * 300);
        }
        break;
      case "Invalid": 
        let currentRow = boardEle.querySelector(`.board-row:nth-of-type(${rowCount+1})`);
        this.renderer.addClass(currentRow, 'shake-row');
        setTimeout(() => {
          this.renderer.removeClass(currentRow, 'shake-row');
        }, 500);
        break;
    }
  }

  keyboardStyle(letterKey: string, style: string) {
    const kbEle = this.kbEleRef.nativeElement as HTMLElement;
    const currentKey = kbEle.querySelector(`[aria-label="${letterKey}"]`);
    if(currentKey?.classList.contains('matched-Letter')) {
      return;
    }
    if(currentKey?.classList.contains('has-Letter')) {
      currentKey?.classList.remove('has-Letter');
    }
    this.renderer.addClass(currentKey, style);
  }

  async newGame() {
    this.letters = Array.from(
      { length: this.noOfRows },
      () => Array(this.noOfCols).fill('')
    );
    this.rowCount = 0;
    this.colCount = 0;
    this.isBoardEngaged = false;
    this.isRowComplete = false;
    this.isGameOver = false;

    const boardEle = this.boardEleRef.nativeElement as HTMLElement;
    for(let i = 0; i < this.cursorRowTracker; i++ ){
      let currentRow = boardEle.querySelector(`.board-row:nth-of-type(${i+1})`);
      this.renderer.removeClass(currentRow, 'shake-row');
      for(let j = 0; j < this.cursorColTracker; j++ ){
        let currentCell = currentRow?.querySelector(`.squareBlock:nth-of-type(${j+1})`);
        this.renderer.removeClass(currentCell, 'flipCell');
        this.renderer.removeClass(currentCell, 'matched-Letter');
        this.renderer.removeClass(currentCell, 'has-Letter');
        this.renderer.removeClass(currentCell, 'wrong-Letter');
      }
    }

    const kbEle = this.kbEleRef.nativeElement as HTMLElement;
    const keys = kbEle.querySelectorAll('.key');
    keys.forEach(key => {
      if(key?.classList.contains('has-Letter')) {
        key?.classList.remove('has-Letter');
      }
      if(key?.classList.contains('matched-Letter')) {
        key?.classList.remove('matched-Letter');
      }
      if(key?.classList.contains('wrong-Letter')) {
        key?.classList.remove('wrong-Letter');
      }
    });
    await this.wordService.getRandomWord();
  }
}