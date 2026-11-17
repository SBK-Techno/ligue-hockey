# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Québec garage-league hockey players, substitutes, managers and one league administrator. Players check the next game, answer presence, read the lineup, chat and see their own season stats on a phone, often at the rink or in the car. Managers build teams, place players, handle substitutes and balances, mostly on a phone and sometimes on a desktop. The administrator manages accounts, evaluations, rules, locations and settings on desktop.

## Product Purpose

Run one Sunday-morning hockey league end to end: schedule, presence, teams, substitutes, game sheets, payments, chat, notifications and player statistics. Success means a player knows where to be and who is on the ice in seconds, and a manager can prepare a fair lineup without paperwork.

## Positioning

A real Québec garage-league operating system, not a generic team app: French `tu` copy, real league rituals, position-aware identities, thirty-eight fact-checked Montréal Canadiens tributes, and stats-only comparison with no skill ratings.

## Operating Context

The league plays Sunday mornings on real arena ice. Players arrive with a hockey bag, answer presence before a deadline, look for a substitute when short, and check the lineup at the rink. Managers balance teams, fill open places and record the sheet. Money is in Canadian dollars. The product is a PWA used on phones at 320 px and on desktop for administration.

## Capabilities and Constraints

SvelteKit and Node, SQLite in WAL mode, one league per deployment. Presence, substitute requests, ratings, balances, chat, polls, push and email notifications. Every active player has one unique identity from a 66-identity catalogue: 38 tribute legends and 28 league faces kept as capacity fallback. The picker offers the position-aware tribute legends; league faces remain for existing profiles and full leagues. Players see their own season statistics, never skills or ratings of other players. No official league, team or Canadiens logo or photograph is used. Currency is CAD. The supported production entry point is `node serve.js`.

## Brand Commitments

Québec French in the `tu` form, sentence case, no English or jargon, no em or en dash. The league voice is warm, direct and a little dry. The visual world is paper and ice: real materials, printed and painted surfaces, flat controls, no AI gradients, glass or glows. The user confirmed on 2026-11-17 a system-wide move to realistic, natural and modern materials across every surface, with illustrated realism for player portraits. Each tribute portrait is an original painted image, recognizable as the real player through likeness, era and equipment; it is never an official photograph, logo or mark.

## Evidence on Hand

The live league database, the 38 fact-checked tribute identities and their era/position facts, the existing paper/ice design system, and the generated identity and texture assets. No customer testimonials, benchmarks or commercial claims exist and none may be invented.

## Product Principles

1. The rink is the source of truth: who is on the ice, in which place, must be readable at a glance.
2. Respect the league's history without claiming affiliation: name the tributes, never borrow an official mark or likeness.
3. One owner per fact: identities, positions, budgets and copy each have one authority.
4. A phone at the rink outranks a desktop: 320 px, one hand, cold fingers, bright arena light.
5. Fair and legible over clever: every control names its action and every state has a way back.

## Accessibility & Inclusion

44 px touch targets, visible keyboard focus, 4.5:1 body contrast, reduced-motion support, no colour-only meaning, and a lineup that works without dragging.
