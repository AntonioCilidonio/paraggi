# ADR 0001 - Monorepo e Clean Architecture

Data: 2026-07-09
Stato: accettata proposta

## Contesto

Paraggi deve evolvere come app mobile pubblicabile, con backend Supabase e regole geografiche sensibili. Serve una struttura modulare e testabile.

## Decisione

Usare un monorepo npm workspaces con separazione:

- `apps/mobile`;
- `apps/admin`;
- `packages/domain`;
- `packages/application`;
- `packages/infrastructure`;
- `packages/ui`;
- `supabase`.

Applicare Clean Architecture:

- Domain puro;
- Application con use case e port;
- Infrastructure con adapter;
- UI mobile che usa dependency injection/provider.

## Conseguenze

Vantaggi:

- testabilita;
- riuso tra mobile, edge e admin;
- confini chiari;
- minore accoppiamento a Supabase nel dominio.

Costi:

- piu disciplina iniziale;
- piu file e convenzioni;
- setup monorepo da mantenere.

