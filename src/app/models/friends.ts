import { PlayerRef } from './duel';

export interface Friend extends PlayerRef {
  since: string;
}

export interface FriendRequest {
  requestId: number;
  createdAt: string;
}

export interface FriendsOverview {
  friends: Friend[];
  incoming: (FriendRequest & { from: PlayerRef })[];
  outgoing: (FriendRequest & { to: PlayerRef })[];
}

/** Pushed live to the player who receives a request. */
export interface FriendRequestEvent {
  request: FriendRequest & { from: PlayerRef };
}
