import { Routes } from '@angular/router';
import { Login } from './components/login/login';
import { authGuard } from './guards/auth-guard';

// Login is the landing page, so it ships in the initial bundle. Every other
// page is lazy-loaded: its code is downloaded the first time it is visited.
export const routes: Routes = [
    { path: '', component: Login, title: 'Login' },
    {
        path: 'verify',
        loadComponent: () => import('./components/verify/verify').then((m) => m.Verify),
        title: 'Verify email',
    },
    {
        path: 'home',
        loadComponent: () => import('./components/wordle-home/wordle-home').then((m) => m.WordleHome),
        title: 'Home',
        canActivate: [authGuard],
    },
    {
        path: 'game/:gameId',
        loadComponent: () => import('./components/game-board/game-board').then((m) => m.GameBoard),
        title: 'Game',
        canActivate: [authGuard],
    },
    {
        path: 'profile',
        loadComponent: () => import('./components/profile/profile').then((m) => m.Profile),
        title: 'Profile',
        canActivate: [authGuard],
    },
    {
        path: 'duel',
        loadComponent: () => import('./components/duel/duel-hub/duel-hub').then((m) => m.DuelHub),
        title: 'PvP Duels',
        canActivate: [authGuard],
    },
    {
        // Public: a signed-out visitor can see who invited them before registering.
        // Must come before 'duel/:duelId'.
        path: 'duel/invite/:token',
        loadComponent: () => import('./components/duel/invite-landing/invite-landing').then((m) => m.InviteLanding),
        title: 'Duel invite',
    },
    {
        path: 'duel/:duelId',
        loadComponent: () => import('./components/duel/duel-lobby/duel-lobby').then((m) => m.DuelLobby),
        title: 'Duel',
        canActivate: [authGuard],
    },
    { path: '**', redirectTo: '' },
];
