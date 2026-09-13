"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { assetUrl, gameApi } from '../lib/client-hosting';
import { PUPPETS, SPECIALS, completeSets, defenceValue, fieldCards, isComplete, stackAttack, type Card, type GameAction, type PublicPlayer, type PublicState, type Stack } from '../lib/theatre';

function saved(key: string, fallback: string) { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } }
function save(key: string, value: string) { try { localStorage.setItem(key, value); } catch {} }
function cardRule(card: Card) {
  if (card.puppet) return PUPPETS[card.puppet].atk + ' ATK per card. Collect ' + PUPPETS[card.puppet].required + ' to complete a set.';
  if (card.type === 'defence') return 'Add ' + card.value + ' Defence to your Stage. It absorbs incoming attack point for point.';
  if (card.type === 'invade') return 'Attack one opponent using one of your puppet stacks. Multiply that stack’s ATK by ' + card.multiplier + '.';
  return SPECIALS[card.effect!].rule;
}

export default function Theatre() {
  const [entered, setEntered] = useState(false);
  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [room, setRoom] = useState('');
  const [token, setToken] = useState('');
  const [state, setState] = useState<PublicState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [offline, setOffline] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [inspect, setInspect] = useState<Card | null>(null);
  const [stackInspect, setStackInspect] = useState<Stack | null>(null);
  const [composer, setComposer] = useState<Card | null>(null);
  const [discarding, setDiscarding] = useState(false);
  const [copied, setCopied] = useState(false);
  const [musicVolume, setMusicVolume] = useState(18);
  const [effectVolume, setEffectVolume] = useState(65);
  const [musicOn, setMusicOn] = useState(true);
  const [effectsOn, setEffectsOn] = useState(true);
  const [musicBlocked, setMusicBlocked] = useState(false);
  const music = useRef<HTMLAudioElement | null>(null);
  const sword = useRef<HTMLAudioElement | null>(null);
  const evilLaugh = useRef<HTMLAudioElement | null>(null);
  const noStrings = useRef<HTMLAudioElement | null>(null);
  const unlocked = useRef(false);
  const version = useRef(0);
  const eventId = useRef<string | null>(null);
  const stateRef = useRef<PublicState | null>(null);
  const requestBusy = useRef(false);
  stateRef.current = state;
  const viewer = state?.players.find(p => p.id === state.viewerId);
  const current = state?.players[state.currentPlayerIndex];
  const myTurn = !!viewer && current?.id === viewer.id;
  const canPlay = !!state && myTurn && state.status === 'playing' && !state.pending && state.phase === 'play' && state.actionsLeft > 0 && !busy && !offline;

  const accept = useCallback((data: { state: PublicState; version: number }) => {
    if (data.version >= version.current) { version.current = data.version; setState(data.state); }
  }, []);
  const refresh = useCallback(async (code: string, seatToken: string) => {
    const response = await fetch(gameApi('?code=' + encodeURIComponent(code)), { headers: { Authorization: 'Bearer ' + seatToken }, cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not reconnect.');
    accept(data); return data;
  }, [accept]);
  useEffect(() => {
    const code = new URLSearchParams(location.search).get('room')?.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    setName(saved('svengali:name', ''));
    setMusicVolume(Number(saved('svengali:music-volume', '18')));
    setEffectVolume(Number(saved('svengali:effect-volume', '65')));
    setMusicOn(saved('svengali:music', 'on') !== 'off'); setEffectsOn(saved('svengali:effects', 'on') !== 'off');
    music.current = new Audio(assetUrl('/audio/creepy-circus.mp3')); music.current.loop = true; music.current.preload = 'none';
    sword.current = new Audio(assetUrl('/audio/sword-slice.mp3')); sword.current.preload = 'auto';
    evilLaugh.current = new Audio(assetUrl('/audio/evil-laugh.mp3')); evilLaugh.current.preload = 'auto';
    noStrings.current = new Audio(assetUrl('/audio/no-strings.mp3')); noStrings.current.preload = 'auto';
    if (code) {
      setJoinCode(code); setEntered(true);
      const seat = saved('svengali:seat:' + code, '');
      if (seat) { setRoom(code); setToken(seat); void refresh(code, seat).catch(e => { setError(e.message); setRoom(''); setToken(''); }); }
    }
    return () => { music.current?.pause(); sword.current?.pause(); evilLaugh.current?.pause(); noStrings.current?.pause(); };
  }, [refresh]);
  useEffect(() => {
    if (!room || !token) return;
    let active = true; let fetching = false;
    const poll = async () => {
      if (fetching || document.hidden || requestBusy.current) return;
      fetching = true;
      try {
        const response = await fetch(gameApi('?code=' + encodeURIComponent(room)), { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (active) { accept(data); setOffline(false); }
      } catch { if (active) setOffline(true); } finally { fetching = false; }
    };
    const timer = window.setInterval(poll, 1600);
    const visible = () => { if (!document.hidden) void poll(); };
    document.addEventListener('visibilitychange', visible);
    return () => { active = false; clearInterval(timer); document.removeEventListener('visibilitychange', visible); };
  }, [room, token, accept]);
  useEffect(() => {
    if (!music.current) return;
    music.current.volume = Math.max(0, Math.min(1, musicVolume / 100));
    save('svengali:music-volume', String(musicVolume)); save('svengali:music', musicOn ? 'on' : 'off');
    if (musicOn && unlocked.current) void music.current.play().then(() => setMusicBlocked(false)).catch(() => setMusicBlocked(true));
    else music.current.pause();
  }, [musicVolume, musicOn, entered]);
  useEffect(() => {
    save('svengali:effect-volume', String(effectVolume)); save('svengali:effects', effectsOn ? 'on' : 'off');
  }, [effectVolume, effectsOn]);
  useEffect(() => {
    const event = state?.event;
    if (!event || event.id === eventId.current) return;
    const initial = !eventId.current; eventId.current = event.id;
    if (!initial && effectsOn) {
      const effect = event.kind === 'invade' ? sword.current : event.kind === 'black-box' ? evilLaugh.current : event.kind === 'no-strings-attached' ? noStrings.current : null;
      if (effect) { effect.volume = effectVolume / 100; effect.currentTime = 0; void effect.play().catch(() => {}); }
    }
  }, [state?.event, effectsOn, effectVolume]);
  useEffect(() => {
    type ModelContext = { registerTool: (tool: unknown, options: { signal: AbortSignal }) => Promise<void> | void };
    const context = (document as Document & { modelContext?: ModelContext }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try { void Promise.resolve(context.registerTool({
      name: 'inspect_theatre_table', title: 'Inspect the current table',
      description: 'Read the visible game state, your own hand, current turn and pending response. Does not reveal other players’ hands or the draw order.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute(input: unknown) {
        if (!input || typeof input !== 'object' || Object.keys(input).length) throw new Error('No arguments are required.');
        const table = stateRef.current;
        return table ? { ...table, logs: table.logs.slice(-8) } : { status: 'not-seated' };
      },
    }, { signal: lifecycle.signal })).catch(() => {}); } catch {}
    return () => lifecycle.abort();
  }, []);
  function enter() {
    unlocked.current = true; setEntered(true);
    if (music.current && musicOn) { music.current.volume = musicVolume / 100; void music.current.play().then(() => setMusicBlocked(false)).catch(() => setMusicBlocked(true)); }
  }
  async function post(payload: Record<string, unknown>) {
    if (requestBusy.current) return null;
    requestBusy.current = true; setBusy(true); setError('');
    try {
      const response = await fetch(gameApi(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'That move could not be saved.');
      accept(data); setOffline(false); return data;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Please try again.');
      if (room && token) void refresh(room, token).catch(() => setOffline(true));
      return null;
    } finally { requestBusy.current = false; setBusy(false); }
  }
  async function seat(op: 'create' | 'join') {
    enter();
    if (!name.trim()) return setError('Enter your name first.');
    if (op === 'join' && joinCode.length !== 6) return setError('Enter the six-character table code.');
    version.current = 0;
    const data = await post({ op, name, code: joinCode });
    if (data) {
      setRoom(data.code); setToken(data.token); save('svengali:seat:' + data.code, data.token); save('svengali:name', name);
      history.replaceState({}, '', '?room=' + data.code);
    }
  }
  async function act(action: GameAction) {
    const data = await post({ op: 'action', code: room, token, action, requestId: crypto.randomUUID() });
    if (data) { setInspect(null); setComposer(null); setDiscarding(false); } return data;
  }
  function leave() {
    setState(null); setRoom(''); setToken(''); setError(''); setOffline(false); setInspect(null); setComposer(null); setStackInspect(null); version.current = 0; eventId.current = null; history.replaceState({}, '', location.pathname);
  }
  async function copyLink() {
    try { await navigator.clipboard.writeText(location.origin + location.pathname + '?room=' + room); setCopied(true); setTimeout(() => setCopied(false), 2500); }
    catch { setError('Share table code ' + room + ' with your friends.'); }
  }
  function playInspected(card: Card) {
    if (card.type === 'puppet' || card.type === 'defence') void act({ type: 'play', cardId: card.id });
    else { setInspect(null); setComposer(card); }
  }
  function endTurn() { if (viewer && viewer.hand.length > 5) setDiscarding(true); else void act({ type: 'endTurn' }); }
  const soundControls = <details className="sound-controls"><summary>Sound</summary><div className="sound-popover">
    <div><label htmlFor="music-volume">Music</label><button onClick={() => { unlocked.current = true; setMusicOn(!musicOn); }}>{musicOn ? 'Mute' : 'Unmute'}</button></div>
    <input id="music-volume" aria-label="Music volume" type="range" min="0" max="100" value={musicVolume} onChange={e => { unlocked.current = true; setMusicVolume(Number(e.target.value)); }} />
    <div><label htmlFor="effects-volume">Attack sound</label><button onClick={() => setEffectsOn(!effectsOn)}>{effectsOn ? 'Mute' : 'Unmute'}</button></div>
    <input id="effects-volume" aria-label="Attack sound volume" type="range" min="0" max="100" value={effectVolume} onChange={e => setEffectVolume(Number(e.target.value))} />
    {musicBlocked && <button onClick={enter}>Play music</button>}
  </div></details>;
  const shared = <>
    {error && <div className="error-toast" role="alert"><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss error">Close</button></div>}
    {rulesOpen && <Rules onClose={() => setRulesOpen(false)} />}
  </>;
  if (!state || !viewer) return <main className="entrance">
    <img className="intro-art" src={assetUrl("/intro.webp")} alt="Svengali’s Theatre, a puppet master on a candlelit stage" />
    <div className="entrance-top"><span>Svengali’s Theatre</span><div>{soundControls}<button onClick={() => setRulesOpen(true)}>How to play</button></div></div>
    <section className="ticket-panel">
      {!entered ? <><p className="eyebrow">The curtain is waiting</p><button className="primary large" onClick={enter}>Enter the Theatre</button><p className="fine">2–5 players · 110 cards · first to three sets</p></> :
        <><p className="eyebrow">Take your seat</p><label htmlFor="player-name">Your name</label><input id="player-name" autoComplete="nickname" maxLength={24} placeholder="What shall we call you?" value={name} onChange={e => setName(e.target.value)} />
        <button className="primary" disabled={busy || !name.trim()} onClick={() => void seat('create')}>{busy ? 'Opening the curtain…' : 'Create a table'}</button>
        <div className="join-line"><label htmlFor="room-code" className="sr-only">Table code</label><input id="room-code" aria-label="Table code" placeholder="TABLE CODE" maxLength={6} autoCapitalize="characters" value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} /><button disabled={busy || !name.trim() || joinCode.length !== 6} onClick={() => void seat('join')}>Join table</button></div><p className="fine">Invite your friends. Each player gets a private hand.</p></>}
    </section>{shared}
  </main>;
  if (state.status === 'lobby') return <main className="lobby scene">
    <header className="table-header"><button className="wordmark" onClick={leave}>Svengali’s <i>Theatre</i></button><div>{soundControls}<button onClick={() => setRulesOpen(true)}>How to play</button></div></header>
    <section className="lobby-ticket"><p className="eyebrow">Your company is assembling</p><h1>Set the stage.</h1><p>Share this code with your fellow puppet masters.</p><button className="room-code" onClick={copyLink} title="Copy invitation link">{room}</button><button className="text-button" onClick={copyLink}>{copied ? 'Invitation copied' : 'Copy invitation link'}</button>
      <div className="seats">{Array.from({ length: 5 }, (_, i) => <div key={i} className={state.players[i] ? 'occupied' : ''}><span className="seat-number">{String(i + 1).padStart(2, '0')}</span><span>{state.players[i]?.name ?? 'Empty seat'}</span><small>{state.players[i]?.id === state.hostId ? 'Host' : state.players[i] ? 'Ready' : 'Waiting'}</small></div>)}</div>
      {viewer.id === state.hostId ? <button className="primary large" disabled={busy || state.players.length < 2 || offline} onClick={() => { enter(); void post({ op: 'start', code: room, token }); }}>{state.players.length < 2 ? 'Waiting for one more player' : 'Raise the curtain'}</button> : <p className="waiting">The host will raise the curtain when everyone is here.</p>}
      {offline && <p role="status">Reconnecting to your table…</p>}<p className="fine">2–5 players · everyone starts with five cards</p>
    </section>{shared}
  </main>;
  const opponents = state.players.filter(p => p.id !== viewer.id);
  const responding = state.pending?.responderId === viewer.id;
  return <main className={'game scene' + (myTurn ? ' my-turn' : '')}>
    <header className="table-header"><button className="wordmark" onClick={leave}>Svengali’s <i>Theatre</i></button><div className="table-menu"><span className="round-label">Act {state.round}</span><button onClick={copyLink}>{copied ? 'Link copied' : 'Table ' + room}</button>{soundControls}<button onClick={() => setRulesOpen(true)}>Rules</button></div></header>
    {offline && <div className="connection-banner" role="status">Reconnecting… Your cards and progress are saved.</div>}
    <section className="opponents" aria-label="Opponents’ Stages">{opponents.map(player => <PlayerStage key={player.id} player={player} active={player.id === current?.id} onInspect={setStackInspect} />)}</section>
    <section className="table-centre">
      <div className="pile-group"><div className="draw-pile" aria-label={state.deckCount + ' cards in the draw pile'}><div className="card-back"><img src={assetUrl("/theatre-mark.svg")} alt="" /></div><strong>{state.deckCount}</strong><span>Draw</span></div><button className="discard-pile" disabled={!state.discardTop} onClick={() => setInspect(state.discardTop)} aria-label="Inspect discard pile">{state.discardTop ? <img src={assetUrl(state.discardTop.image)} alt="" /> : <div className="empty-pile" />}<strong>{state.discardCount}</strong><span>Discard</span></button></div>
      <div className="turn-announcement" aria-live="polite"><p className="eyebrow">{state.pending ? 'The strings are moving' : myTurn ? 'The spotlight is yours' : 'On the stage'}</p><h1>{state.pending ? (state.pending.kind === 'invade' ? state.pending.attack + ' ATK invasion' : SPECIALS[state.pending.kind].name) : myTurn ? 'Your turn.' : current?.name + '’s turn.'}</h1><p>{state.pending ? 'Waiting for ' + state.players.find(p => p.id === state.pending!.responderId)?.name + (state.pending.stage === 'surrender' ? ' to choose puppets to surrender.' : ' to respond.') : myTurn ? 'Play up to three cards. Make every string count.' : 'Your Stage is ready. Watch the other players.'}</p></div>
      <details className="play-log"><summary>Play log</summary><ol>{state.logs.slice(-12).reverse().map(entry => <li key={entry.id}>{entry.text}</li>)}</ol></details>
    </section>
    <section className="own-stage"><div className="stage-heading"><div><p className="eyebrow">Your Stage</p><h2>{viewer.name}</h2></div><SetProgress count={completeSets(viewer)} /></div><div className="own-field"><DefenceCounter player={viewer} /><div className="stacks">{viewer.stacks.length ? viewer.stacks.map(stack => <StackView key={stack.id} stack={stack} onClick={() => setStackInspect(stack)} />) : <div className="empty-stage"><span>Your cast begins here.</span><p>Play a puppet from your hand to start a set.</p></div>}</div></div></section>
    <section className="hand-section" aria-label="Your hand"><div className="hand-heading"><div><h2>Your hand <span>{viewer.hand.length}</span></h2><p>{viewer.hand.length > 5 ? 'Discard down to five when your turn ends.' : 'Select a card to inspect or play it.'}</p></div><div className="turn-actions"><span className="action-count">{myTurn ? state.actionsLeft + '/3 plays left' : 'Waiting'}</span><button className="primary" disabled={!myTurn || !!state.pending || busy || offline || state.status === 'finished'} onClick={endTurn}>{viewer.hand.length > 5 ? 'End & discard' : 'End turn'}</button></div></div>
      <div className="hand">{viewer.hand.length ? viewer.hand.map((card, i) => <button key={card.id} className="hand-card" style={{ '--tilt': (i - (viewer.hand.length - 1) / 2) * 1.2 + 'deg' } as CSSProperties} onClick={() => setInspect(card)} aria-label={card.name + '. ' + cardRule(card)}><img src={assetUrl(card.image)} alt={card.name} draggable={false} /><span>{card.type === 'puppet' ? 'ATK ' + card.value : card.type === 'defence' ? '+' + card.value + ' Defence' : card.type === 'invade' ? 'Invade ×' + card.multiplier : 'Special action'}</span></button>) : <p className="empty-hand">Your hand is empty. Draw five when your next turn begins.</p>}</div>
    </section>
    {inspect && <Modal title={inspect.name} onClose={() => setInspect(null)} error={error}><div className="card-inspector"><img src={assetUrl(inspect.image)} alt={inspect.name} /><div><p className="eyebrow">{inspect.type === 'puppet' ? (inspect.value! >= 3 ? 'Entity' : 'Puppet') : inspect.type}</p><h2>{inspect.name}</h2><p>{cardRule(inspect)}</p>{viewer.hand.some(c => c.id === inspect.id) && (inspect.effect === 'no-strings-attached' ? <p className="fine">Keep this in your hand. You’ll be offered a chance to use it when someone targets you.</p> : <button className="primary" disabled={!canPlay} onClick={() => playInspected(inspect)}>{inspect.type === 'puppet' || inspect.type === 'defence' ? 'Place on Stage' : 'Choose target'}</button>)}</div></div></Modal>}
    {stackInspect && <Modal title={PUPPETS[stackInspect.puppet].name} onClose={() => setStackInspect(null)}><h2>{PUPPETS[stackInspect.puppet].name}</h2><p>{stackInspect.cards.length}/{PUPPETS[stackInspect.puppet].required} cards · {stackAttack(stackInspect)} total ATK{isComplete(stackInspect) ? ' · Complete set' : ''}</p><div className="inspect-stack">{stackInspect.cards.map(card => <img key={card.id} src={assetUrl(card.image)} alt={card.name} />)}</div></Modal>}
    {composer && <ActionComposer card={composer} state={state} viewer={viewer} busy={busy || offline} error={error} onClose={() => setComposer(null)} onAct={act} />}
    {discarding && <DiscardModal hand={viewer.hand} busy={busy || offline} error={error} onClose={() => setDiscarding(false)} onSubmit={ids => void act({ type: 'endTurn', discardIds: ids })} />}
    {state.pending && responding && <ResponseModal key={state.pending.id + state.pending.stage + state.pending.cancelled} state={state} viewer={viewer} busy={busy || offline} error={offline ? 'Reconnecting… Your response will be available when the table reconnects.' : error} onAct={act} />}
    {state.status === 'finished' && <Modal title="The curtain falls"><div className="winner"><p className="eyebrow">The curtain falls</p><h1>{state.players.find(p => p.id === state.winnerId)?.name}</h1><h2>stole the show.</h2><p>Three complete sets. One puppet master.</p><div className="winner-cast">{state.players.find(p => p.id === state.winnerId)?.stacks.filter(isComplete).map(s => <img key={s.id} src={assetUrl(s.cards[0].image)} alt={PUPPETS[s.puppet].name} />)}</div><button className="primary" onClick={leave}>Return to the Theatre</button></div></Modal>}
    {shared}
  </main>;
}

function Modal({ title, onClose, children, error }: { title: string; onClose?: () => void; children: ReactNode; error?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  return <dialog ref={ref} className="modal" aria-label={title} onCancel={e => { e.preventDefault(); onClose?.(); }} onClick={e => { if (e.target === e.currentTarget) onClose?.(); }}><div className="modal-inner">{onClose && <button className="close-modal" onClick={onClose} aria-label="Close dialog">Close</button>}{children}{error && <p className="dialog-error" role="alert">{error}</p>}</div></dialog>;
}
function SetProgress({ count }: { count: number }) { return <div className="set-progress" aria-label={count + ' of 3 sets complete'}>{[1, 2, 3].map(n => <span key={n} className={count >= n ? 'filled' : ''}>{n}</span>)}<small>{count}/3 sets</small></div>; }
function DefenceCounter({ player }: { player: PublicPlayer }) {
  return <div className="defence-counter"><span>Defence</span><strong>{defenceValue(player)}</strong><small>Stage guard</small><details><summary>{player.defence.length} deployed</summary><div>{player.defence.length ? player.defence.map(c => <p key={c.card.id}>{c.card.name}<b>{c.remaining} left</b></p>) : <p>No Defence deployed.</p>}</div></details></div>;
}
function StackView({ stack, onClick }: { stack: Stack; onClick: () => void }) {
  return <button className={'puppet-stack' + (isComplete(stack) ? ' complete' : '')} onClick={onClick} aria-label={PUPPETS[stack.puppet].name + ', ' + stack.cards.length + ' of ' + PUPPETS[stack.puppet].required + ', ' + stackAttack(stack) + ' ATK'}><div className="layered-cards" style={{ '--layers': stack.cards.length } as CSSProperties}>{stack.cards.map((c, i) => <img key={c.id} src={assetUrl(c.image)} alt="" draggable={false} style={{ '--layer': i } as CSSProperties} />)}<span className="stack-count">{stack.cards.length}/{PUPPETS[stack.puppet].required}</span></div><span className="stack-title">{PUPPETS[stack.puppet].name}</span><span className="stack-atk">{stackAttack(stack)} ATK{isComplete(stack) ? ' · Complete' : ''}</span></button>;
}
function PlayerStage({ player, active, onInspect }: { player: PublicPlayer; active: boolean; onInspect: (stack: Stack) => void }) {
  return <article className={'opponent-stage' + (active ? ' active' : '')}><header><div><h2>{player.name}</h2><span>{active ? 'Taking their turn' : player.handCount + ' cards in hand'}</span></div><SetProgress count={completeSets(player)} /></header><div className="opponent-field"><DefenceCounter player={player} /><div className="stacks">{player.stacks.length ? player.stacks.map(s => <StackView key={s.id} stack={s} onClick={() => onInspect(s)} />) : <p className="empty-opponent">An empty Stage</p>}</div></div></article>;
}

function ActionComposer({ card, state, viewer, busy, error, onClose, onAct }: { card: Card; state: PublicState; viewer: PublicPlayer; busy: boolean; error: string; onClose: () => void; onAct: (action: GameAction) => Promise<unknown> }) {
  const [targetId, setTargetId] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [targetCardId, setTargetCardId] = useState('');
  const [targetStackId, setTargetStackId] = useState('');
  const [offerId, setOfferId] = useState('');
  const target = state.players.find(p => p.id === targetId);
  const source = viewer.stacks.find(s => s.id === sourceId);
  const targets = target?.stacks.filter(s => card.effect === 'black-box' ? isComplete(s) : !isComplete(s)) ?? [];
  const attack = source ? stackAttack(source) * card.multiplier! : 0;
  const valid = target && (card.type === 'invade' ? source && (fieldCards(target).length > 0 || defenceValue(target) > 0) : card.effect === 'black-box' ? targetStackId : targetCardId && (card.effect !== 'pulling-the-strings' || offerId));
  return <Modal title={card.name} onClose={onClose} error={error}><p className="eyebrow">Play an action</p><h2>{card.name}</h2><p>{cardRule(card)}</p>
    <label htmlFor="target-player">Choose an opponent</label><select id="target-player" value={targetId} onChange={e => { setTargetId(e.target.value); setTargetCardId(''); setTargetStackId(''); }}><option value="">Select opponent</option>{state.players.filter(p => p.id !== viewer.id).map(p => <option key={p.id} value={p.id}>{p.name} · {defenceValue(p)} Defence</option>)}</select>
    {card.type === 'invade' ? <><h3>Your attacking stack</h3><div className="choice-stacks">{viewer.stacks.map(s => <div key={s.id} className={sourceId === s.id ? 'selected-choice' : ''}><StackView stack={s} onClick={() => setSourceId(s.id)} /></div>)}</div>{!viewer.stacks.length && <p>Deploy a puppet before launching an invasion.</p>}{source && target && <div className="combat-math"><span>{stackAttack(source)} ATK × {card.multiplier}<b>{attack}</b></span><span>Stage Defence<b>−{Math.min(attack, defenceValue(target))}</b></span><span>To surrender<b>{Math.max(0, attack - defenceValue(target))}</b></span></div>}<p className="fine">The defender chooses the puppets to surrender. Completed sets can be broken.</p></> :
      target && <><h3>{card.effect === 'black-box' ? 'Choose a complete set' : 'Choose their puppet'}</h3><div className="choice-stacks">{card.effect === 'black-box' ? targets.map(s => <div key={s.id} className={targetStackId === s.id ? 'selected-choice' : ''}><StackView stack={s} onClick={() => setTargetStackId(s.id)} /></div>) : targets.flatMap(s => s.cards).map(c => <ChoiceCard key={c.id} card={c} selected={targetCardId === c.id} onClick={() => setTargetCardId(c.id)} />)}</div>{!targets.length && <p>No eligible {card.effect === 'black-box' ? 'complete sets' : 'puppets'} on this Stage.</p>}</>}
    {card.effect === 'pulling-the-strings' && <><h3>Choose your puppet to give</h3><div className="choice-stacks">{viewer.stacks.filter(s => !isComplete(s)).flatMap(s => s.cards).map(c => <ChoiceCard key={c.id} card={c} selected={offerId === c.id} onClick={() => setOfferId(c.id)} />)}</div></>}
    <button className="primary" disabled={!valid || busy} onClick={() => void onAct(card.type === 'invade' ? { type: 'invade', cardId: card.id, sourceStackId: sourceId, targetId } : { type: 'special', cardId: card.id, targetId, targetStackId, targetCardId, offerCardId: offerId })}>{busy ? 'Playing…' : card.type === 'invade' ? 'Launch invasion' : 'Play ' + card.name}</button>
  </Modal>;
}
function ChoiceCard({ card, selected, onClick }: { card: Card; selected: boolean; onClick: () => void }) { return <button className={'choice-card' + (selected ? ' selected-choice' : '')} aria-pressed={selected} onClick={onClick}><img src={assetUrl(card.image)} alt={card.name} /><span>{card.puppet ? PUPPETS[card.puppet].atk + ' ATK' : card.name}</span></button>; }
function ResponseModal({ state, viewer, busy, error, onAct }: { state: PublicState; viewer: PublicPlayer; busy: boolean; error: string; onAct: (action: GameAction) => Promise<unknown> }) {
  const pending = state.pending!; const [chosen, setChosen] = useState<string[]>([]);
  const other = state.players.find(p => p.id === (viewer.id === pending.actorId ? pending.targetId : pending.actorId))!;
  const cancel = viewer.hand.find(c => c.effect === 'no-strings-attached');
  const cards = fieldCards(viewer); const amount = cards.filter(c => chosen.includes(c.id)).reduce((n, c) => n + PUPPETS[c.puppet!].atk, 0);
  const title = pending.kind === 'invade' ? 'Invade · ' + pending.attack + ' ATK' : SPECIALS[pending.kind].name;
  const actor = state.players.find(p => p.id === pending.actorId)!;
  const target = state.players.find(p => p.id === pending.targetId)!;
  const taken = fieldCards(target).find(c => c.id === pending.targetCardId);
  const offered = fieldCards(actor).find(c => c.id === pending.offerCardId);
  const targetSet = target.stacks.find(s => s.id === pending.targetStackId);
  const attackingStack = actor.stacks.find(s => s.id === pending.sourceStackId);
  const previewCards = pending.kind === 'invade' ? attackingStack?.cards.slice(0, 1) ?? [] : targetSet ? targetSet.cards.slice(0, 1) : [taken, offered].filter((c): c is Card => !!c);
  const detail = pending.kind === 'invade' ? actor.name + ' attacks with ' + (attackingStack ? PUPPETS[attackingStack.puppet].name : 'one stack') + '.' : pending.kind === 'black-box' ? actor.name + ' wants ' + target.name + '’s complete ' + (targetSet ? PUPPETS[targetSet.puppet].name : '') + ' set.' : actor.name + ' wants ' + target.name + '’s ' + taken?.name + (offered ? ' in exchange for ' + offered.name : '') + '.';
  return <Modal title={title} error={error}><p className="eyebrow">{pending.stage === 'surrender' ? 'Your Defence has been spent' : pending.cancelled ? 'No Strings Attached' : other.name + ' is pulling the strings'}</p><h2>{pending.cancelled ? 'Your action was cancelled.' : title}</h2>
    {pending.stage === 'response' && <div className="action-preview"><div>{previewCards.map(c => <img key={c.id} src={assetUrl(c.image)} alt={c.name} />)}</div><p>{detail}</p></div>}
    {pending.stage === 'surrender' ? <><div className="combat-math"><span>Attack<b>{pending.attack}</b></span><span>Defence spent<b>−{pending.defenceSpent}</b></span><span>Still owed<b>{pending.remaining}</b></span></div><p>Choose puppets worth at least <strong>{pending.remaining} ATK</strong>. You choose what leaves your Stage. Overpayment receives no change.</p><div className="choice-stacks">{cards.map(c => <ChoiceCard key={c.id} card={c} selected={chosen.includes(c.id)} onClick={() => setChosen(chosen.includes(c.id) ? chosen.filter(id => id !== c.id) : [...chosen, c.id])} />)}</div><p className="selection-total">Selected: {amount} ATK</p>{cards.reduce((n, c) => n + PUPPETS[c.puppet!].atk, 0) < pending.remaining && <p>You have less than the amount owed. Surrender every puppet to settle the invasion.</p>}<button className="primary" disabled={busy || !(amount >= pending.remaining || chosen.length === cards.length)} onClick={() => void onAct({ type: 'surrender', pendingId: pending.id, cardIds: chosen })}>Surrender selected puppets</button></> :
      <><p>{pending.cancelled ? (cancel ? 'You have No Strings Attached. You can reverse this cancellation.' : 'You cannot reverse this cancellation. Accept it to continue.') : cancel ? 'You have No Strings Attached. You can cancel this action before it resolves.' : pending.kind === 'invade' ? 'You have no No Strings Attached. Resolve the invasion; your deployed Defence will absorb ' + Math.min(defenceValue(viewer), pending.attack) + ' ATK, then you must surrender puppets if any attack remains.' : pending.kind === 'black-box' ? 'You have no No Strings Attached. You cannot cancel Black Box; let it take the chosen set.' : 'You have no No Strings Attached. You cannot cancel this action; let it resolve.'}</p>{cancel && <button className="cancel-action" disabled={busy} onClick={() => void onAct({ type: 'respond', pendingId: pending.id, cancelCardId: cancel.id })}><img src={assetUrl(cancel.image)} alt="" /><span>Play No Strings Attached<small>{pending.cancelled ? 'Reverse the cancellation' : 'Cancel this action'}</small></span></button>}<button className="primary" disabled={busy} onClick={() => void onAct({ type: 'respond', pendingId: pending.id })}>{pending.cancelled ? 'Accept cancellation' : pending.kind === 'invade' ? (cancel ? 'Do not cancel · resolve invasion' : 'Resolve invasion') : (cancel ? 'Do not cancel · let it happen' : 'Let it happen')}</button></>}
  </Modal>;
}
function DiscardModal({ hand, busy, error, onClose, onSubmit }: { hand: Card[]; busy: boolean; error: string; onClose: () => void; onSubmit: (ids: string[]) => void }) {
  const [ids, setIds] = useState<string[]>([]); const excess = hand.length - 5;
  return <Modal title="Choose cards to discard" onClose={onClose} error={error}><p className="eyebrow">End your turn</p><h2>Keep five. Let the rest go.</h2><p>Select exactly {excess} card{excess === 1 ? '' : 's'} to discard.</p><div className="choice-stacks">{hand.map(c => <ChoiceCard key={c.id} card={c} selected={ids.includes(c.id)} onClick={() => setIds(ids.includes(c.id) ? ids.filter(id => id !== c.id) : ids.length < excess ? [...ids, c.id] : ids)} />)}</div><button className="primary" disabled={busy || ids.length !== excess} onClick={() => onSubmit(ids)}>Discard {ids.length}/{excess} & end turn</button></Modal>;
}
function Rules({ onClose }: { onClose: () => void }) { return <Modal title="How to play" onClose={onClose}><div className="rules"><p className="eyebrow">Svengali’s Theatre</p><h2>Steal the show.</h2><p>Be the first to complete <strong>three sets</strong> of puppets or entities on your Stage. Two complete sets of the same type count separately.</p><h3>Your turn</h3><ol><li>Start with five cards. Draw two at the beginning of each turn, including your first. If your hand is empty, draw five instead.</li><li>Play up to three cards: deploy puppets, add Defence, invade or use special actions. You may pass.</li><li>End with at most five cards in hand. Choose which excess cards to discard.</li></ol><h3>Build your Stage</h3><p>The number at the top of a puppet card is its set requirement. Matching puppets regroup automatically into full sets and a remaining stack after each resolved action. Your displayed ATK is the sum of that one stack’s cards.</p><h3>Invade</h3><p>Pick one of your stacks and an opponent. Multiply the stack’s total ATK by the Invade multiplier. Defence on their Stage absorbs attack point for point and is depleted. Defence still in their hand does nothing.</p><p>Two Weepers have 16 ATK. Invade ×3 gives 48 attack. Against 50 Defence, the defender keeps 2 Defence. Against 46 Defence, they owe 2 ATK in puppets.</p><p>The defender chooses one or more deployed puppets whose ATK meets or exceeds the remainder. There is no change: if only an 8-ATK Weeper is available for a 2-ATK debt, it must be surrendered. If they cannot cover the total, they surrender everything on their Stage. Received puppets go directly onto the attacker’s Stage.</p><p>Invasions can break completed sets. You attack with one stack at a time; different stacks cannot combine.</p><h3>Special actions</h3><dl>{Object.entries(SPECIALS).map(([key, d]) => <div key={key}><dt>{d.name}</dt><dd>{d.rule}</dd></div>)}</dl><p>Special actions bypass deployed Defence. The targeted player can respond with No Strings Attached before the action takes effect. The original attacker can cancel that cancellation. Each cancellation is discarded and uses no regular turn action. A cancelled action is still spent.</p><h3>The curtain keeps moving</h3><p>Used actions and discarded cards go into the discard pile. Fully spent Defence cards join them; partly spent Defence keeps its remaining points. When the draw pile runs out, shuffle the discard pile and keep playing.</p><p>The winning condition is checked after an action has fully resolved. If an exchange completes three sets for both players, the player taking their turn wins. Cards owed beyond everything a player has are forgiven; hands are never taken to pay an invasion.</p><p className="fine">110 cards · 54 puppets/entities · 22 Invade · 19 Defence · 15 special actions · no plague cards</p></div></Modal>; }
