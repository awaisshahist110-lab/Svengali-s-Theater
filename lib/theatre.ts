export const PUPPETS = {
  angel: { name: 'Angel', atk: 1, required: 4, copies: 8 },
  'thread-knight': { name: 'Thread Knight', atk: 1, required: 4, copies: 8 },
  'stage-spider': { name: 'Stage Spider', atk: 1, required: 4, copies: 8 },
  'thread-cutter': { name: 'Thread Cutter', atk: 2, required: 3, copies: 6 },
  'needle-pot': { name: 'Needle Pot', atk: 2, required: 3, copies: 6 },
  spotlight: { name: 'Spotlight', atk: 3, required: 2, copies: 4 },
  shader: { name: 'Shader', atk: 4, required: 3, copies: 6 },
  faceless: { name: 'Faceless', atk: 4, required: 2, copies: 4 },
  weeper: { name: 'Weeper', atk: 8, required: 2, copies: 4 },
} as const;
export type PuppetKey = keyof typeof PUPPETS;
export type Special = 'black-box' | 'no-strings-attached' | 'loose-thread' | 'pulling-the-strings';
export const SPECIALS: Record<Special, { name: string; copies: number; rule: string }> = {
  'black-box': { name: 'Black Box', copies: 2, rule: 'Steal one complete puppet set.' },
  'no-strings-attached': { name: 'No Strings Attached', copies: 3, rule: 'Cancel an Invade or special action played against you. You can also cancel a cancellation.' },
  'loose-thread': { name: 'Loose Thread', copies: 5, rule: 'Steal one puppet from an opponent’s incomplete set.' },
  'pulling-the-strings': { name: 'Pulling the Strings', copies: 5, rule: 'Exchange one of your puppets for an opponent’s puppet. Complete sets are protected.' },
};
export const INVADE_COUNTS: Record<number, number> = { 1: 12, 2: 6, 3: 4 };
export const DEFENCE_COUNTS: Record<number, number> = { 1: 6, 2: 4, 3: 3, 5: 3, 10: 2, 20: 1 };
export const MAX_PLAYERS = 5;
export interface Card { id: string; type: 'puppet' | 'invade' | 'defence' | 'special'; name: string; image: string; puppet?: PuppetKey; value?: number; multiplier?: number; effect?: Special }
export interface Stack { id: string; puppet: PuppetKey; cards: Card[] }
export interface DefenceCharge { card: Card; remaining: number }
export interface Player { id: string; token: string; name: string; seat: number; hand: Card[]; stacks: Stack[]; defence: DefenceCharge[] }
export interface Pending {
  id: string; kind: 'invade' | Exclude<Special, 'no-strings-attached'>;
  actorId: string; targetId: string; responderId: string;
  stage: 'response' | 'surrender'; cancelled: boolean;
  sourceStackId?: string; targetStackId?: string; targetCardId?: string; offerCardId?: string;
  attack: number; remaining: number; defenceSpent: number;
}
export interface GameState {
  code: string; hostId: string; status: 'lobby' | 'playing' | 'finished'; players: Player[];
  deck: Card[]; discard: Card[]; currentPlayerIndex: number; actionsLeft: number; round: number;
  phase: 'play' | 'discard'; pending: Pending | null; winnerId: string | null;
  logs: { id: string; text: string }[]; event: { id: string; kind: string } | null; processed: string[];
}
export type PublicPlayer = Omit<Player, 'token' | 'hand'> & { hand: Card[]; handCount: number };
export type PublicState = Omit<GameState, 'players' | 'deck' | 'discard' | 'processed'> & { players: PublicPlayer[]; deckCount: number; discardCount: number; discardTop: Card | null; viewerId: string | null };
export type GameAction =
  | { type: 'play'; cardId: string }
  | { type: 'invade'; cardId: string; sourceStackId: string; targetId: string }
  | { type: 'special'; cardId: string; targetId: string; targetStackId?: string; targetCardId?: string; offerCardId?: string }
  | { type: 'respond'; pendingId: string; cancelCardId?: string }
  | { type: 'surrender'; pendingId: string; cardIds: string[] }
  | { type: 'endTurn'; discardIds?: string[] };
export class GameError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}
function rule(test: unknown, message: string, status = 400): asserts test { if (!test) throw new GameError(message, status); }
const uid = () => crypto.randomUUID();
export function shuffle<T>(cards: T[]): T[] {
  const result = [...cards];
  for (let i = result.length - 1; i > 0; i--) { const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}
export function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (const [key, data] of Object.entries(PUPPETS)) for (let i = 0; i < data.copies; i++) deck.push({ id: uid(), type: 'puppet', puppet: key as PuppetKey, name: data.name, image: '/cards/' + key + '.webp', value: data.atk });
  for (const [multiplier, count] of Object.entries(INVADE_COUNTS)) for (let i = 0; i < count; i++) deck.push({ id: uid(), type: 'invade', name: 'Invade ×' + multiplier, image: '/cards/invade-' + multiplier + '.webp', multiplier: Number(multiplier) });
  for (const [value, count] of Object.entries(DEFENCE_COUNTS)) for (let i = 0; i < count; i++) deck.push({ id: uid(), type: 'defence', name: 'Defence ' + value, image: '/cards/defence-' + value + '.webp', value: Number(value) });
  for (const [effect, data] of Object.entries(SPECIALS)) for (let i = 0; i < data.copies; i++) deck.push({ id: uid(), type: 'special', name: data.name, image: '/cards/' + effect + '.webp', effect: effect as Special });
  rule(deck.length === 110, 'Deck must contain 110 cards.', 500); return shuffle(deck);
}
function log(state: GameState, text: string) { state.logs.push({ id: uid(), text }); state.logs = state.logs.slice(-70); }
function signal(state: GameState, kind: string) { state.event = { id: uid(), kind }; }
function newPlayer(name: string, seat: number): Player { return { id: uid(), token: uid() + uid(), name: name.trim().slice(0, 24), seat, hand: [], stacks: [], defence: [] }; }
export function createLobby(code: string, name: string) {
  rule(name.trim(), 'Enter your name.'); const player = newPlayer(name, 0);
  const state: GameState = { code, hostId: player.id, status: 'lobby', players: [player], deck: [], discard: [], currentPlayerIndex: 0, actionsLeft: 3, round: 1, phase: 'play', pending: null, winnerId: null, logs: [], event: null, processed: [] };
  log(state, player.name + ' opened the Theatre.'); return { state, token: player.token };
}
export function joinLobby(state: GameState, name: string) {
  rule(state.status === 'lobby', 'This performance has already started.');
  rule(state.players.length < MAX_PLAYERS, 'All five seats are taken.'); rule(name.trim(), 'Enter your name.');
  rule(!state.players.some(p => p.name.toLowerCase() === name.trim().slice(0, 24).toLowerCase()), 'That name is already in this room.');
  const player = newPlayer(name, state.players.length); state.players.push(player); log(state, player.name + ' joined the Theatre.'); return player.token;
}
export function playerFromToken(state: GameState, token?: string | null) { return token ? state.players.find(p => p.token === token) : undefined; }
export function isComplete(stack: Stack) { return stack.cards.length === PUPPETS[stack.puppet].required; }
export function stackAttack(stack: Stack) { return stack.cards.length * PUPPETS[stack.puppet].atk; }
export function defenceValue(player: Pick<Player, 'defence'>) { return player.defence.reduce((sum, charge) => sum + charge.remaining, 0); }
export function fieldCards(player: Pick<Player, 'stacks'>) { return player.stacks.flatMap(stack => stack.cards); }
export function completeSets(player: Pick<Player, 'stacks'>) { return player.stacks.filter(isComplete).length; }
export function drawCards(state: GameState, player: Player, count: number) {
  for (let i = 0; i < count; i++) {
    if (!state.deck.length && state.discard.length) { state.deck = shuffle(state.discard); state.discard = []; log(state, 'The discard pile was shuffled into a new draw pile.'); }
    const card = state.deck.pop(); if (!card) break; player.hand.push(card);
  }
}
function beginTurn(state: GameState) {
  const player = state.players[state.currentPlayerIndex]; const count = player.hand.length === 0 ? 5 : 2;
  drawCards(state, player, count); state.actionsLeft = 3; state.phase = 'play';
  log(state, player.name + ' draws ' + count + ' and begins their turn.'); signal(state, 'turn');
}
export function startMatch(state: GameState, actorId: string) {
  rule(state.hostId === actorId, 'Only the host can start.', 403); rule(state.status === 'lobby', 'The match has already started.');
  rule(state.players.length >= 2, 'Invite at least one other player.');
  state.deck = buildDeck(); state.discard = []; state.status = 'playing';
  for (const player of state.players) { player.hand = []; player.stacks = []; player.defence = []; drawCards(state, player, 5); }
  log(state, 'The curtain rises. Complete three sets to win.'); beginTurn(state);
}
function nextTurn(state: GameState) { state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length; if (state.currentPlayerIndex === 0) state.round++; beginTurn(state); }
function checkWinner(state: GameState) {
  const active = state.players[state.currentPlayerIndex];
  const winner = [active, ...state.players.filter(p => p.id !== active.id)].find(p => completeSets(p) >= 3);
  if (winner) { state.winnerId = winner.id; state.status = 'finished'; log(state, winner.name + ' completed three sets and stole the show!'); signal(state, 'win'); }
}
function finishAction(state: GameState) {
  if (state.pending) return;
  for (const player of state.players) arrangeStage(player);
  checkWinner(state); if (state.status === 'finished') return;
  if (state.actionsLeft === 0) { if (state.players[state.currentPlayerIndex].hand.length > 5) state.phase = 'discard'; else nextTurn(state); }
}
function arrangeStage(player: Player) {
  const result: Stack[] = [];
  for (const puppet of Object.keys(PUPPETS) as PuppetKey[]) {
    const old = player.stacks.filter(s => s.puppet === puppet);
    const cards = old.flatMap(s => s.cards);
    const size = PUPPETS[puppet].required;
    for (let offset = 0, index = 0; offset < cards.length; offset += size, index++)
      result.push({ id: old[index]?.id ?? uid(), puppet, cards: cards.slice(offset, offset + size) });
  }
  player.stacks = result;
}
function takeHand(player: Player, id: string) { const index = player.hand.findIndex(c => c.id === id); rule(index >= 0, 'That card is no longer in your hand.'); return player.hand.splice(index, 1)[0]; }
function addToStage(player: Player, card: Card) {
  rule(card.puppet, 'Only puppets or entities go into sets.'); const puppet = card.puppet;
  let stack = player.stacks.find(s => s.puppet === puppet && !isComplete(s));
  if (!stack) { stack = { id: uid(), puppet, cards: [] }; player.stacks.push(stack); } stack.cards.push(card);
}
function removeFromStage(player: Player, ids: string[]) {
  rule(Array.isArray(ids) && new Set(ids).size === ids.length, 'Select each card only once.');
  const cards = fieldCards(player).filter(c => ids.includes(c.id)); rule(cards.length === ids.length, 'A selected puppet is unavailable.');
  for (const stack of player.stacks) stack.cards = stack.cards.filter(c => !ids.includes(c.id));
  player.stacks = player.stacks.filter(s => s.cards.length); return cards;
}
function exposedCard(player: Player, id?: string) { return player.stacks.some(s => !isComplete(s) && s.cards.some(c => c.id === id)); }
export function spendDefence(state: GameState, player: Player, amount: number) {
  let left = amount;
  for (const charge of player.defence) { const spent = Math.min(left, charge.remaining); charge.remaining -= spent; left -= spent; if (charge.remaining === 0) state.discard.push(charge.card); }
  player.defence = player.defence.filter(c => c.remaining > 0); return amount - left;
}
function settleEffect(state: GameState) {
  const effect = state.pending!; const actor = state.players.find(p => p.id === effect.actorId)!; const target = state.players.find(p => p.id === effect.targetId)!;
  if (effect.cancelled) { log(state, (effect.kind === 'invade' ? 'The invasion' : SPECIALS[effect.kind].name) + ' was cancelled.'); state.pending = null; signal(state, 'cancel'); finishAction(state); return; }
  if (effect.kind === 'invade') {
    effect.defenceSpent = spendDefence(state, target, effect.attack); effect.remaining = effect.attack - effect.defenceSpent;
    log(state, target.name + ' spends ' + effect.defenceSpent + ' Defence; ' + defenceValue(target) + ' remains.');
    if (effect.remaining > 0 && fieldCards(target).length) { effect.stage = 'surrender'; effect.responderId = target.id; return; }
    log(state, target.name + (effect.remaining ? ' has no puppets left to surrender.' : ' repelled the invasion.'));
  } else if (effect.kind === 'black-box') {
    const index = target.stacks.findIndex(s => s.id === effect.targetStackId && isComplete(s)); rule(index >= 0, 'That completed set is no longer available.');
    const [stack] = target.stacks.splice(index, 1); actor.stacks.push(stack);
    log(state, actor.name + ' takes ' + target.name + '’s complete ' + PUPPETS[stack.puppet].name + ' set.');
  } else if (effect.kind === 'loose-thread') {
    const [card] = removeFromStage(target, [effect.targetCardId!]); addToStage(actor, card); log(state, actor.name + ' takes ' + card.name + ' from ' + target.name + '.');
  } else {
    const [offered] = removeFromStage(actor, [effect.offerCardId!]); const [taken] = removeFromStage(target, [effect.targetCardId!]);
    addToStage(actor, taken); addToStage(target, offered); log(state, actor.name + ' exchanges ' + offered.name + ' for ' + target.name + '’s ' + taken.name + '.');
  }
  state.pending = null; finishAction(state);
}
export function applyAction(state: GameState, actorId: string, action: GameAction) {
  rule(state.status === 'playing', 'The game is not in progress.');
  const player = state.players.find(p => p.id === actorId); rule(player, 'Your seat could not be verified.', 403); rule(action && typeof action.type === 'string', 'Choose an action.');
  if (action.type === 'respond') {
    const pending = state.pending; rule(pending && pending.id === action.pendingId && pending.stage === 'response', 'This action has already been resolved.');
    rule(pending.responderId === actorId, 'Waiting for the other player’s response.', 403);
    if (action.cancelCardId) {
      const card = player.hand.find(c => c.id === action.cancelCardId); rule(card?.effect === 'no-strings-attached', 'Choose No Strings Attached from your hand.');
      state.discard.push(takeHand(player, card.id)); pending.cancelled = !pending.cancelled; pending.responderId = actorId === pending.actorId ? pending.targetId : pending.actorId;
      log(state, player.name + ' plays No Strings Attached.'); signal(state, 'cancel');
    } else settleEffect(state); return;
  }
  if (action.type === 'surrender') {
    const pending = state.pending; rule(pending && pending.id === action.pendingId && pending.stage === 'surrender', 'There is no invasion to settle.');
    rule(pending.targetId === actorId, 'Only the defender chooses the payment.', 403);
    rule(Array.isArray(action.cardIds) && new Set(action.cardIds).size === action.cardIds.length, 'Select each puppet once.');
    const all = fieldCards(player); const chosen = all.filter(c => action.cardIds.includes(c.id)); rule(chosen.length === action.cardIds.length, 'A selected puppet is unavailable.');
    const total = chosen.reduce((n, c) => n + PUPPETS[c.puppet!].atk, 0);
    rule(total >= pending.remaining || chosen.length === all.length, 'Surrender at least ' + pending.remaining + ' ATK, or every puppet you have.');
    const attacker = state.players.find(p => p.id === pending.actorId)!;
    for (const card of removeFromStage(player, action.cardIds)) addToStage(attacker, card);
    log(state, player.name + ' surrenders ' + chosen.length + ' puppet(s), worth ' + total + ' ATK, to ' + attacker.name + '.');
    state.pending = null; finishAction(state); return;
  }
  rule(!state.pending, 'Wait for the current action to resolve.'); rule(state.players[state.currentPlayerIndex].id === actorId, 'Wait for your turn.', 403);
  if (action.type === 'endTurn') {
    const excess = Math.max(0, player.hand.length - 5); const ids = action.discardIds ?? [];
    rule(Array.isArray(ids) && ids.length === excess && new Set(ids).size === ids.length, 'Discard exactly ' + excess + ' excess cards.');
    rule(ids.every(id => player.hand.some(c => c.id === id)), 'Choose cards from your hand.');
    for (const id of ids) state.discard.push(takeHand(player, id));
    log(state, player.name + ' ends their turn' + (excess ? ' and discards ' + excess : '') + '.'); nextTurn(state); return;
  }
  rule(state.phase === 'play' && state.actionsLeft > 0, 'Discard down to five and end your turn.');
  const card = player.hand.find(c => c.id === action.cardId); rule(card, 'That card is not in your hand.');
  if (action.type === 'play') {
    rule(card.type === 'puppet' || card.type === 'defence', 'Choose a target for that action card.'); const placed = takeHand(player, card.id);
    if (placed.type === 'puppet') addToStage(player, placed); else player.defence.push({ card: placed, remaining: placed.value! });
    state.actionsLeft--; log(state, player.name + ' places ' + placed.name + ' on their Stage.'); signal(state, 'card'); finishAction(state); return;
  }
  rule(action.type === 'invade' || action.type === 'special', 'Unknown action.');
  const target = state.players.find(p => p.id === action.targetId); rule(target && target.id !== actorId, 'Choose an opponent.');
  const pending: Pending = { id: uid(), kind: 'invade', actorId, targetId: target.id, responderId: target.id, stage: 'response', cancelled: false, attack: 0, remaining: 0, defenceSpent: 0 };
  if (action.type === 'invade') {
    rule(card.type === 'invade', 'Choose an Invade card.'); const stack = player.stacks.find(s => s.id === action.sourceStackId); rule(stack, 'Choose one puppet or entity stack.');
    rule(fieldCards(target).length || defenceValue(target) > 0, 'That opponent has an empty Stage.');
    pending.attack = stackAttack(stack) * card.multiplier!; pending.sourceStackId = stack.id;
    log(state, player.name + ' invades ' + target.name + ' with ' + pending.attack + ' ATK (' + PUPPETS[stack.puppet].name + ' ×' + card.multiplier + ').');
  } else {
    rule(card.type === 'special' && card.effect && card.effect !== 'no-strings-attached', 'No Strings Attached is played in response to an action.');
    pending.kind = card.effect;
    if (card.effect === 'black-box') rule(target.stacks.some(s => s.id === action.targetStackId && isComplete(s)), 'Choose a complete opponent set.');
    else rule(exposedCard(target, action.targetCardId), 'Choose a puppet from an incomplete opponent set.');
    if (card.effect === 'pulling-the-strings') rule(exposedCard(player, action.offerCardId), 'Offer one of your puppets from an incomplete set.');
    pending.targetStackId = action.targetStackId; pending.targetCardId = action.targetCardId; pending.offerCardId = action.offerCardId;
    log(state, player.name + ' plays ' + card.name + ' against ' + target.name + '.');
  }
  state.discard.push(takeHand(player, card.id)); state.actionsLeft--; state.pending = pending; signal(state, pending.kind === 'invade' ? 'invade' : 'special');
}
export function publicState(state: GameState, token?: string | null): PublicState {
  const viewer = playerFromToken(state, token);
  return { code: state.code, hostId: state.hostId, status: state.status, currentPlayerIndex: state.currentPlayerIndex, actionsLeft: state.actionsLeft, round: state.round, phase: state.phase, pending: state.pending, winnerId: state.winnerId, logs: state.logs, event: state.event, viewerId: viewer?.id ?? null, deckCount: state.deck.length, discardCount: state.discard.length, discardTop: state.discard.at(-1) ?? null,
    players: state.players.map(p => ({ id: p.id, name: p.name, seat: p.seat, stacks: p.stacks, defence: p.defence, handCount: p.hand.length, hand: p.id === viewer?.id ? p.hand : [] })) };
}
