import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDeck, createLobby, joinLobby, startMatch, applyAction, publicState, defenceValue, drawCards, isComplete, PUPPETS, SPECIALS } from '../lib/theatre.ts';
function fixture() {
  const { state } = createLobby('ABC123', 'Awais'); joinLobby(state, 'Mira'); startMatch(state, state.hostId);
  const [a, b] = state.players; state.deck.push(...a.hand, ...b.hand); a.hand = []; b.hand = []; state.actionsLeft = 3;
  return { state, a, b };
}
function take(state, matches) { const i = state.deck.findIndex(matches); assert.notEqual(i, -1); return state.deck.splice(i, 1)[0]; }
function hand(state, player, matches) { const card = take(state, matches); player.hand.push(card); return card; }
function stack(state, player, puppet, count) { const value = { id: crypto.randomUUID(), puppet, cards: Array.from({ length: count }, () => take(state, c => c.puppet === puppet)) }; player.stacks.push(value); return value; }
function guard(state, player, ...values) { for (const value of values) player.defence.push({ card: take(state, c => c.type === 'defence' && c.value === value), remaining: value }); }
function invade(f, source, multiplier = 3) { const card = hand(f.state, f.a, c => c.type === 'invade' && c.multiplier === multiplier); applyAction(f.state, f.a.id, { type: 'invade', cardId: card.id, sourceStackId: source.id, targetId: f.b.id }); return f.state.pending.id; }
function allow(f, who = f.b) { applyAction(f.state, who.id, { type: 'respond', pendingId: f.state.pending.id }); }
function special(f, kind, options) { const card = hand(f.state, f.a, c => c.effect === kind); applyAction(f.state, f.a.id, { type: 'special', cardId: card.id, targetId: f.b.id, ...options }); return card; }
function conservation(state) {
  const cards = [...state.deck, ...state.discard, ...state.players.flatMap(p => [...p.hand, ...p.stacks.flatMap(s => s.cards), ...p.defence.map(d => d.card)])];
  assert.equal(cards.length, 110); assert.equal(new Set(cards.map(c => c.id)).size, 110); assert.equal(cards.filter(c => c.type === 'defence').length, 19);
}
test('exact 110-card distribution; two sets per creature', () => {
  const cards = buildDeck();
  for (const [type, count] of Object.entries({ puppet: 54, invade: 22, defence: 19, special: 15 })) assert.equal(cards.filter(c => c.type === type).length, count);
  for (const [key, p] of Object.entries(PUPPETS)) { assert.equal(cards.filter(c => c.puppet === key).length, p.required * 2); assert.equal(cards.find(c => c.puppet === key).value, p.atk); }
  for (const [key, p] of Object.entries(SPECIALS)) assert.equal(cards.filter(c => c.effect === key).length, p.copies);
  assert.deepEqual([1, 2, 3].map(n => cards.filter(c => c.multiplier === n).length), [12, 6, 4]);
  assert.deepEqual([1, 2, 3, 5, 10, 20].map(n => cards.filter(c => c.type === 'defence' && c.value === n).length), [6, 4, 3, 3, 2, 1]);
});
test('deal five, draw two once per turn, discard back to five', () => {
  const { state } = createLobby('ABCD12', 'Awais'); joinLobby(state, 'Mira'); startMatch(state, state.hostId);
  const [a, b] = state.players; assert.equal(a.hand.length, 7); assert.equal(b.hand.length, 5);
  assert.throws(() => applyAction(state, a.id, { type: 'endTurn' }), /exactly 2/);
  applyAction(state, a.id, { type: 'endTurn', discardIds: a.hand.slice(0, 2).map(c => c.id) });
  assert.equal(a.hand.length, 5); assert.equal(b.hand.length, 7); assert.equal(state.actionsLeft, 3); conservation(state);
});
test('empty hand draws five instead of two', () => { const f = fixture(); applyAction(f.state, f.a.id, { type: 'endTurn' }); assert.equal(f.b.hand.length, 5); conservation(f.state); });
test('passing is allowed, including unplayable hands; turn ownership is enforced', () => {
  const f = fixture(); hand(f.state, f.a, c => c.effect === 'no-strings-attached');
  assert.throws(() => applyAction(f.state, f.b.id, { type: 'endTurn' }), /Wait for your turn/);
  applyAction(f.state, f.a.id, { type: 'endTurn' }); assert.equal(f.state.currentPlayerIndex, 1); conservation(f.state);
});
test('three card plays end the turn; a fourth is rejected', () => {
  const f = fixture(); const cards = Array.from({ length: 3 }, () => hand(f.state, f.a, c => c.type === 'defence'));
  for (const c of cards) applyAction(f.state, f.a.id, { type: 'play', cardId: c.id });
  assert.equal(f.state.currentPlayerIndex, 1); assert.throws(() => applyAction(f.state, f.a.id, { type: 'endTurn' }), /Wait for your turn/); conservation(f.state);
});
test('48 against 50 Defence leaves exactly 2 and never mints new cards', () => {
  const f = fixture(); const source = stack(f.state, f.a, 'weeper', 2); guard(f.state, f.b, 20, 10, 10, 5, 5);
  invade(f, source); assert.equal(f.state.pending.attack, 48); assert.equal(defenceValue(f.b), 50); allow(f);
  assert.equal(defenceValue(f.b), 2); assert.equal(f.b.defence.length, 1); assert.equal(f.b.defence[0].card.value, 5);
  assert.equal(f.state.pending, null); assert.equal(f.state.actionsLeft, 2); conservation(f.state);
});
test('48 against 46 requires the lone Weeper for the remaining 2-ATK debt', () => {
  const f = fixture(); const source = stack(f.state, f.a, 'weeper', 2); const payment = stack(f.state, f.b, 'weeper', 1).cards[0]; guard(f.state, f.b, 20, 10, 10, 5, 1);
  const id = invade(f, source); allow(f); assert.equal(f.state.pending.remaining, 2);
  assert.throws(() => applyAction(f.state, f.b.id, { type: 'surrender', pendingId: id, cardIds: [] }), /at least 2/);
  applyAction(f.state, f.b.id, { type: 'surrender', pendingId: id, cardIds: [payment.id] });
  assert.equal(f.b.stacks.length, 0); assert.ok(f.a.stacks.flatMap(s => s.cards).some(c => c.id === payment.id)); conservation(f.state);
});
test('Defence in hand does not protect; invasions can break complete sets', () => {
  const f = fixture(); const source = stack(f.state, f.a, 'angel', 1); const target = stack(f.state, f.b, 'stage-spider', 4); hand(f.state, f.b, c => c.type === 'defence' && c.value === 20);
  const id = invade(f, source, 1); allow(f); assert.equal(f.state.pending.remaining, 1);
  applyAction(f.state, f.b.id, { type: 'surrender', pendingId: id, cardIds: [target.cards[0].id] }); assert.equal(isComplete(f.b.stacks[0]), false); conservation(f.state);
});
test('insufficient Stage: surrender everything and settle the invasion', () => {
  const f = fixture(); const source = stack(f.state, f.a, 'weeper', 2); const target = stack(f.state, f.b, 'angel', 2);
  const id = invade(f, source); allow(f);
  assert.throws(() => applyAction(f.state, f.b.id, { type: 'surrender', pendingId: id, cardIds: [target.cards[0].id] }), /at least 48/);
  applyAction(f.state, f.b.id, { type: 'surrender', pendingId: id, cardIds: target.cards.map(c => c.id) }); assert.equal(f.state.pending, null); conservation(f.state);
});
test('multiple surrendered cards may meet the debt exactly', () => {
  const f = fixture(); const source = stack(f.state, f.a, 'faceless', 1); const target = stack(f.state, f.b, 'needle-pot', 2);
  const id = invade(f, source, 1); allow(f);
  applyAction(f.state, f.b.id, { type: 'surrender', pendingId: id, cardIds: target.cards.map(c => c.id) }); assert.equal(f.b.stacks.length, 0); conservation(f.state);
});
test('Black Box is wasted by cancellation without spending Defence', () => {
  const f = fixture(); const target = stack(f.state, f.b, 'angel', 4); guard(f.state, f.b, 20);
  const no = hand(f.state, f.b, c => c.effect === 'no-strings-attached'); const box = special(f, 'black-box', { targetStackId: target.id });
  assert.equal(f.state.event.kind, 'black-box');
  applyAction(f.state, f.b.id, { type: 'respond', pendingId: f.state.pending.id, cancelCardId: no.id }); allow(f, f.a);
  assert.equal(f.state.event.kind, 'cancel');
  assert.equal(f.a.stacks.length, 0); assert.equal(f.b.stacks[0].cards.length, 4); assert.equal(defenceValue(f.b), 20);
  assert.ok(f.state.discard.some(c => c.id === box.id)); assert.ok(f.state.discard.some(c => c.id === no.id)); assert.equal(f.state.actionsLeft, 2); conservation(f.state);
});
test('cancel a cancellation to resolve Black Box, which bypasses Defence', () => {
  const f = fixture(); const target = stack(f.state, f.b, 'angel', 4); guard(f.state, f.b, 20);
  const noB = hand(f.state, f.b, c => c.effect === 'no-strings-attached'); const noA = hand(f.state, f.a, c => c.effect === 'no-strings-attached');
  special(f, 'black-box', { targetStackId: target.id }); const id = f.state.pending.id;
  applyAction(f.state, f.b.id, { type: 'respond', pendingId: id, cancelCardId: noB.id });
  assert.equal(f.state.event.kind, 'no-strings-attached');
  applyAction(f.state, f.a.id, { type: 'respond', pendingId: id, cancelCardId: noA.id }); allow(f);
  assert.equal(f.a.stacks[0].cards.length, 4); assert.equal(f.b.stacks.length, 0); assert.equal(defenceValue(f.b), 20); conservation(f.state);
});
test('cancelled invasion consumes neither Defence nor puppets', () => {
  const f = fixture(); const source = stack(f.state, f.a, 'weeper', 2); guard(f.state, f.b, 20); const no = hand(f.state, f.b, c => c.effect === 'no-strings-attached'); invade(f, source);
  applyAction(f.state, f.b.id, { type: 'respond', pendingId: f.state.pending.id, cancelCardId: no.id }); allow(f, f.a); assert.equal(defenceValue(f.b), 20); conservation(f.state);
});
test('Loose Thread takes a chosen exposed puppet and rejects complete sets', () => {
  const f = fixture(); const complete = stack(f.state, f.b, 'angel', 4); const loose = stack(f.state, f.b, 'faceless', 1).cards[0];
  const card = hand(f.state, f.a, c => c.effect === 'loose-thread');
  assert.throws(() => applyAction(f.state, f.a.id, { type: 'special', cardId: card.id, targetId: f.b.id, targetCardId: complete.cards[0].id }), /incomplete/);
  applyAction(f.state, f.a.id, { type: 'special', cardId: card.id, targetId: f.b.id, targetCardId: loose.id }); allow(f); assert.equal(f.a.stacks[0].cards[0].id, loose.id); conservation(f.state);
});
test('Pulling the Strings swaps specified puppets between Stages', () => {
  const f = fixture(); const offered = stack(f.state, f.a, 'angel', 1).cards[0]; const taken = stack(f.state, f.b, 'faceless', 1).cards[0];
  special(f, 'pulling-the-strings', { offerCardId: offered.id, targetCardId: taken.id }); allow(f);
  assert.equal(f.a.stacks[0].cards[0].id, taken.id); assert.equal(f.b.stacks[0].cards[0].id, offered.id); conservation(f.state);
});
test('victory waits until a cancellable action fully resolves', () => {
  const f = fixture(); stack(f.state, f.a, 'angel', 4); stack(f.state, f.a, 'weeper', 2); const target = stack(f.state, f.b, 'stage-spider', 4);
  special(f, 'black-box', { targetStackId: target.id }); assert.equal(f.state.winnerId, null); allow(f);
  assert.equal(f.state.winnerId, f.a.id); assert.equal(f.state.status, 'finished'); conservation(f.state);
});
test('reshuffling preserves every card', () => {
  const f = fixture(); f.state.discard = f.state.deck; f.state.deck = []; drawCards(f.state, f.a, 2);
  assert.equal(f.a.hand.length, 2); assert.equal(f.state.discard.length, 0); conservation(f.state);
});
test('public state hides draw order, opponent hands and all seat tokens', () => {
  const f = fixture(); drawCards(f.state, f.a, 5); drawCards(f.state, f.b, 5); const visible = publicState(f.state, f.a.token);
  assert.equal(visible.players[0].hand.length, 5); assert.equal(visible.players[1].hand.length, 0); assert.equal(visible.players[1].handCount, 5); assert.equal(visible.deck, undefined);
  const json = JSON.stringify(visible); assert.ok(!json.includes(f.a.token)); assert.ok(!json.includes(f.b.token)); assert.ok(!json.includes(f.state.deck[0].id)); assert.ok(!json.includes(f.b.hand[0].id));
});
