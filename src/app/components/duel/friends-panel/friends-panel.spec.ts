import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { FriendsPanel } from './friends-panel';
import { FriendsApi } from '../../../services/friends-api';
import { RealtimeService } from '../../../services/realtime-service';
import { FakeRealtime } from '../../../testing/fake-realtime';
import { FriendsOverview } from '../../../models/friends';

describe('FriendsPanel', () => {
  let fixture: ComponentFixture<FriendsPanel>;
  let api: jasmine.SpyObj<FriendsApi>;
  let overview: FriendsOverview;
  let challenged: number[];

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  beforeEach(() => {
    overview = {
      friends: [{ userId: 2, username: 'Bob', since: '2026-10-27T06:00:00.000Z' }],
      incoming: [{ requestId: 7, from: { userId: 3, username: 'Carol' }, createdAt: '' }],
      outgoing: [{ requestId: 8, to: { userId: 4, username: 'Dan' }, createdAt: '' }],
    };
    api = jasmine.createSpyObj<FriendsApi>('FriendsApi', ['getFriends', 'sendRequest', 'acceptRequest', 'removeRequest', 'removeFriend']);
    api.getFriends.and.callFake(() => of(overview));
    TestBed.configureTestingModule({
      imports: [FriendsPanel],
      providers: [{ provide: FriendsApi, useValue: api }, { provide: RealtimeService, useValue: new FakeRealtime() }],
    });
    fixture = TestBed.createComponent(FriendsPanel);
    fixture.componentRef.setInput('rounds', 4);
    challenged = [];
    fixture.componentInstance.challenge.subscribe((id) => challenged.push(id));
    fixture.detectChanges();
  });

  it('lists friends, requests for you and requests you sent', () => {
    expect(text()).toContain('Friends · 1');
    expect(text()).toContain('Bob');
    expect(text()).toContain('Requests for you');
    expect(text()).toContain('Carol');
    expect(text()).toContain('Waiting for them to accept');
    expect(text()).toContain('Dan');
  });

  it('adds a friend by exact username', () => {
    api.sendRequest.and.returnValue(of({ status: 'pending' as const, friend: { userId: 5, username: 'Eve' } }));

    fixture.componentInstance.username.set(' Eve ');
    fixture.componentInstance.addByUsername();
    fixture.detectChanges();

    expect(api.sendRequest).toHaveBeenCalledWith({ username: 'Eve' });
    expect(text()).toContain('Friend request sent to Eve.');
  });

  it('shows why a request was refused', () => {
    api.sendRequest.and.returnValue(throwError(() => new HttpErrorResponse({
      status: 404, error: { error: { code: 'PLAYER_NOT_FOUND', message: 'No player with that username.' } },
    })));

    fixture.componentInstance.username.set('Nobody');
    fixture.componentInstance.addByUsername();
    fixture.detectChanges();

    expect(text()).toContain('No player with that username.');
  });

  it('accepts a request and challenges a friend', () => {
    api.acceptRequest.and.returnValue(of({ accepted: true }));

    fixture.componentInstance.accept(7);
    fixture.componentInstance.challenge.emit(2);

    expect(api.acceptRequest).toHaveBeenCalledWith(7);
    expect(challenged).toEqual([2]);
  });

  it('asks before removing a friend', () => {
    api.removeFriend.and.returnValue(of({ removed: true }));

    fixture.componentInstance.remove(2);
    expect(api.removeFriend).not.toHaveBeenCalled();
    fixture.componentInstance.remove(2);
    expect(api.removeFriend).toHaveBeenCalledWith(2);
  });
});
