import { Routes } from '@angular/router';
import { WordleHome } from './components/wordle-home/wordle-home';

export const routes: Routes = [
    { path: '', component: WordleHome, title: 'Wordle' },
    { path: '**', redirectTo: '' },
];