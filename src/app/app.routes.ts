import { Routes } from '@angular/router';
import { WordleHome } from './wordle-home/wordle-home';

export const routes: Routes = [
    { path: '', component: WordleHome, title: 'Wordle' },
    { path: '**', redirectTo: '' },
];