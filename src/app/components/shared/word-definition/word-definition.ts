import { Component, input } from '@angular/core';
import { UpperCasePipe } from '@angular/common';
import { DefinitionState } from '../../../models/game';

/**
 * Part of speech + definitions of a word, with the Wiktionary credit its
 * CC BY-SA licence requires. Used in result popups (Daily, Practice, later PvP).
 */
@Component({
  selector: 'app-word-definition',
  imports: [UpperCasePipe],
  templateUrl: './word-definition.html',
  styleUrl: './word-definition.css',
})
export class WordDefinitionCard {
  readonly state = input.required<DefinitionState>();
}
