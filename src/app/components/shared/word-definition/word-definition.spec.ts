import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WordDefinitionCard } from './word-definition';
import { DefinitionState } from '../../../models/game';

describe('WordDefinitionCard', () => {
  let fixture: ComponentFixture<WordDefinitionCard>;

  function render(state: DefinitionState): HTMLElement {
    fixture.componentRef.setInput('state', state);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [WordDefinitionCard] }).compileComponents();
    fixture = TestBed.createComponent(WordDefinitionCard);
  });

  it('shows parts of speech, definitions and the Wiktionary credit', () => {
    const el = render({
      status: 'ready',
      definition: {
        word: 'crane',
        found: true,
        meanings: [
          { partOfSpeech: 'noun', definitions: ['A large bird.', 'A lifting machine.'] },
          { partOfSpeech: 'verb', definitions: ["To stretch one's neck."] },
        ],
        source: {
          name: 'Wiktionary',
          url: 'https://en.wiktionary.org/wiki/crane',
          license: 'CC BY-SA 4.0',
          licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
        },
      },
    });

    expect(el.querySelector('.word')?.textContent).toContain('CRANE');
    const parts = [...el.querySelectorAll('.part-of-speech')].map((p) => p.textContent?.trim());
    expect(parts).toEqual(['noun', 'verb']);
    expect(el.querySelectorAll('li').length).toBe(3);
    expect(el.querySelector('.credit')?.textContent).toContain('Wiktionary');
    expect(el.querySelector('.credit')?.textContent).toContain('CC BY-SA 4.0');
  });

  it('says so when the dictionary does not know the word', () => {
    const el = render({
      status: 'ready',
      definition: {
        word: 'qzxjv',
        found: false,
        meanings: [],
        source: { name: 'Wiktionary', url: '', license: 'CC BY-SA 4.0', licenseUrl: '' },
      },
    });

    expect(el.textContent).toContain('No definition found');
    expect(el.querySelector('.credit')).toBeNull();
  });

  it('shows loading and unavailable states', () => {
    expect(render({ status: 'loading' }).textContent).toContain('Looking up the definition');
    expect(render({ status: 'unavailable' }).textContent).toContain('Definition unavailable');
  });
});
