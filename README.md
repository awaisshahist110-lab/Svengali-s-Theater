# Svengali’s Theatre

A public, browser-based puppet card game for 2–5 players. Create a table, share its invitation link or six-character code, and be the first player with three complete sets on your Stage.

The GitHub Pages version is prepared for **https://awaisshahist110-lab.github.io/Svengali-s-Theater/**. The complete playable static build is committed in `docs/`.

## GitHub Pages hosting

In this repository, open **Settings → Pages**. Choose **Deploy from a branch**, select **main** and **/docs**, and save. GitHub then publishes the game from this repository. No API keys or paid hosting setup are needed to play.

To update the Pages version after changing the game:

```sh
npm ci
npm test
npm run build:pages
```

Commit the source changes and the regenerated `docs/` together. The Vite Pages build uses the `/Svengali-s-Theater/` base path so card art, backgrounds, music and scripts load correctly on GitHub.

GitHub Pages hosts the game interface and all its artwork/audio. Multiplayer requests use `https://svengalis-theatre.awaisshah-ist110.chatgpt.site/api/game`, which stores rooms and keeps players’ hands private. The server explicitly permits requests from this GitHub Pages origin. GitHub Pages itself cannot run a database or server-side code.

Built from the supplied Bloody Evolution v8 source, with Svengali’s Theatre rules, card illustrations, intro, backdrop and audio. The interface uses layered card stacks, a numbered Stage Defence guard, private hands and explicit attack/cancellation responses.

## Play

Each person joins on their own browser or device. The host starts when 2–5 players have joined. Keep the table link: refreshing that link in the same browser restores your seat. A match waits for the player whose turn or response is required. This version has human multiplayer; it does not include bots or a turn timer.

1. Everyone receives five cards. At the start of your turn, draw two once; draw five instead if your hand is empty.
2. Play up to three cards. You may deploy puppets, add Defence, invade, or play special actions. Passing is allowed.
3. End with no more than five cards in hand. Choose which excess cards to discard.
4. Three complete puppet/entity sets win. Two complete sets of the same creature count separately.

Matching puppets automatically regroup into complete sets and one remaining stack after an action resolves. The number at the top of each puppet card is its set requirement.

### Invade and Defence

An invasion uses one stack of matching puppets or entities. Its summed ATK is multiplied by the Invade card. Different stacks cannot combine.

- Two Weepers have 16 ATK; Invade ×3 produces 48 attack.
- Against 50 deployed Defence, the defender keeps 2 Defence.
- Against 46 deployed Defence, the defender owes 2 ATK in puppets.
- The defender chooses deployed puppets meeting or exceeding the remaining attack. There is no change: an 8-ATK Weeper must be surrendered if it is the only available puppet for a 2-ATK debt.
- If the entire Stage is insufficient, all its puppets are surrendered and the unpaid balance is forgiven. Hands are never used for payment.
- Received puppets go directly onto the attacker’s Stage. Invasions can break completed sets.

Defence only works after it is deployed. It is depleted point for point. A partially used Defence card keeps its remaining points; a fully used card goes to the discard pile. No extra Defence cards are created to make change.

### Special actions

| Card | Effect |
| --- | --- |
| Black Box | Steal one complete opponent set. |
| Loose Thread | Steal one puppet from an incomplete opponent set. |
| Pulling the Strings | Exchange a puppet from your incomplete set for a puppet from an opponent’s incomplete set. |
| No Strings Attached | Cancel an invasion or special action targeting you, or counter another cancellation. |

Special actions bypass Defence. The target responds before the action resolves. No Strings Attached is played from the hand and does not use a regular turn action. Used cancellations and cancelled action cards are discarded. A cancelled invasion spends no Defence.

Victory is checked after the action and all responses finish. If an exchange simultaneously gives both players three complete sets, the player taking their turn wins.

When the draw pile runs out, the discard pile is shuffled into a new draw pile. If both piles are empty, only available cards can be drawn; the game never invents cards.

## The 110-card deck

| Puppet/entity | ATK | Cards per set | Copies |
| --- | ---: | ---: | ---: |
| Angel | 1 | 4 | 8 |
| Thread Knight | 1 | 4 | 8 |
| Stage Spider | 1 | 4 | 8 |
| Thread Cutter | 2 | 3 | 6 |
| Needle Pot | 2 | 3 | 6 |
| Spotlight | 3 | 2 | 4 |
| Shader | 4 | 3 | 6 |
| Faceless | 4 | 2 | 4 |
| Weeper | 8 | 2 | 4 |

| Other card | Copies |
| --- | ---: |
| Invade ×1 / ×2 / ×3 | 12 / 6 / 4 |
| Defence 1 / 2 / 3 / 5 / 10 / 20 | 6 / 4 / 3 / 3 / 2 / 1 |
| Black Box | 2 |
| No Strings Attached | 3 |
| Loose Thread | 5 |
| Pulling the Strings | 5 |

There are 54 puppets/entities, 22 Invade cards, 19 Defence cards and 15 special actions. Each creature has enough copies for exactly two complete sets. There is no plague card.

## Development

Node.js 22.13 or newer is required. The project uses React, TypeScript, vinext/Vite and a Cloudflare Worker with D1 persistence.

```sh
npm ci
npm test
npx tsc --noEmit
npm run build
```

`npm run dev` starts the full development server. Multiplayer needs a D1 database bound as `DB`, with the migration in `drizzle/0000_solid_puppet_master.sql` applied. The existing multiplayer server provisions this binding and applies migrations. `npm run build` builds that server; `npm run build:pages` builds the GitHub-hosted interface separately.

- `lib/theatre.ts`: authoritative game rules and public-state projection.
- `app/api/game/route.ts`: room creation/joining, authenticated seat actions and reads.
- `db/rooms.ts`: persisted room snapshots with optimistic version checks.
- `app/theatre-client.tsx` and `app/theatre.css`: responsive theatre interface.
- `tests/rules.test.mjs`: rule, privacy and 110-card conservation tests.
- `public/cards`, `public/audio`, `public/intro.webp`, `public/backdrop.webp`: supplied game assets.

The server validates turns, payments, targets and cancellation chains. Seat tokens are random and saved in the player’s browser. Other players’ hands, tokens and the draw order are excluded from API responses. Room updates use compare-and-swap versions; action request IDs prevent duplicate moves from being applied twice.

The optional WebMCP `inspect_theatre_table` tool exposes only the current seat’s authorized view and is registered only when the browser supports it.

## Artwork and sound

The supplied card faces and theatre backgrounds are retained, with WebP conversion for loading speed. `scripts/prepare-assets.mjs` reproduces this conversion from the original upload directory using ImageMagick.

Background music: supplied `astronautflute-the-creepy-circus-521971.mp3`. Attack effect: supplied `dragon-studio-sword-slice-393847.mp3`. Music starts after a user gesture; separate music/effect volume and mute settings are saved locally.

The repository retains its existing Apache-2.0 `LICENSE`.
