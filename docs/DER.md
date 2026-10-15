# DER — Módulo Treino

Diagrama entidade-relacionamento do módulo de treino. Detalhes de campos, regras e
a query de histórico em [`SPEC-treino.md`](./SPEC-treino.md).

```mermaid
erDiagram
    EXERCISE ||--o{ WORKOUT_EXERCISE : "aparece em"
    WORKOUT  ||--o{ WORKOUT_EXERCISE : "contém"
    WORKOUT  ||--o{ WORKOUT_SESSION  : "executado como"
    WORKOUT_SESSION ||--o{ SET_LOG   : "registra"
    EXERCISE ||--o{ SET_LOG          : "logado para"

    EXERCISE {
        int         id PK
        text        name
        text        muscle_group "null"
        text        equipment "null"
        bool        archived "default false"
        timestamptz created_at
    }

    WORKOUT {
        int         id PK
        text        name
        text        notes "null"
        bool        archived "default false"
        timestamptz created_at
    }

    WORKOUT_EXERCISE {
        int  id PK
        int  workout_id FK
        int  exercise_id FK
        int  position "ordem"
        int  target_sets "default 6"
    }

    WORKOUT_SESSION {
        int         id PK
        int         workout_id FK
        timestamptz performed_at
        text        notes "null"
        timestamptz created_at
    }

    SET_LOG {
        int          id PK
        int          session_id FK
        int          exercise_id FK
        int          set_number "1..N"
        int          reps "null ate preencher"
        numeric      weight_kg "null ; 6,2"
        timestamptz  created_at
    }
```

## Leitura das relações

| Relação | Cardinalidade | Significado |
|---|---|---|
| WORKOUT × EXERCISE | N—N via `workout_exercise` | um treino junta vários exercícios; um exercício vive em vários treinos |
| WORKOUT → WORKOUT_SESSION | 1—N | cada vez que você faz o treino gera uma sessão (o histórico) |
| WORKOUT_SESSION → SET_LOG | 1—N | uma sessão registra várias séries |
| EXERCISE → SET_LOG | 1—N | link direto: viabiliza a comparação "última vez" por exercício |

## Chaves e integridade

- `workout_exercise`: **UNIQUE(workout_id, exercise_id)** — sem exercício duplicado no mesmo treino.
- `set_log`: **UNIQUE(session_id, exercise_id, set_number)** — uma linha por série.
- Delete: sessão → `CASCADE` nos `set_log`; exercício → `RESTRICT` (usar `archived`).
