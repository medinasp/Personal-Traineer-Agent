# Spec — Módulo Treino (back)

> App pessoal de treino + nutrição. Este documento cobre o **back do módulo de treino**:
> cadastro de exercícios, montagem de treinos, registro de séries por sessão e
> histórico para comparação "hoje vs última vez".

## 1. Objetivo

Registrar séries (repetições + peso) por exercício, por sessão, de forma que ao
reabrir um exercício apareça **a última execução** ao lado de uma coluna **nova vazia**,
permitindo comparação imediata. Todo dado é cru e normalizado, para análise futura.

## 2. Fluxo do usuário

1. Cadastra exercícios (supino reto, supino inclinado, puxador, tríceps corda, ...) — quantos quiser.
2. Monta um treino juntando N exercícios em ordem ("Treino A — Peito/Tríceps").
3. Escolhe um treino do dia → o app mostra o treino e seus exercícios abaixo.
4. Clica num exercício → abre coluna com 6 séries (default, aumentável); em cada série marca reps e peso.
5. No dia seguinte, ao reabrir o exercício: vê o que preencheu na **última vez** + coluna nova vazia para preencher e comparar.

## 3. Decisão central: modelo ≠ execução

- **workout** = o treino que você monta. Molde reutilizável.
- **workout_session** = uma vez que você *fez* aquele treino (um dia). É onde o histórico vive.

Sem separar molde de execução, não há como comparar "hoje vs última vez" nem manter histórico limpo.

## 4. Entidades

### exercise — catálogo de exercícios
| campo | tipo | notas |
|---|---|---|
| id | PK | |
| name | text | "Supino reto" |
| muscle_group | text null | "Peito" |
| equipment | text null | |
| archived | bool = false | soft delete (histórico referencia) |
| created_at | timestamptz | |

### workout — treino montado
| campo | tipo | notas |
|---|---|---|
| id | PK | |
| name | text | "Treino A" |
| notes | text null | |
| archived | bool = false | soft delete |
| created_at | timestamptz | |

### workout_exercise — junção: exercícios dentro do treino, em ordem
| campo | tipo | notas |
|---|---|---|
| id | PK | |
| workout_id | FK → workout | |
| exercise_id | FK → exercise | |
| position | int | ordem de exibição |
| target_sets | int = 6 | default de linhas na UI (aumentável) |
| | | UNIQUE(workout_id, exercise_id) |

### workout_session — execução de um dia
| campo | tipo | notas |
|---|---|---|
| id | PK | |
| workout_id | FK → workout | qual treino foi feito |
| performed_at | timestamptz | quando treinou |
| notes | text null | |
| created_at | timestamptz | |

### set_log — série realizada (o dado que importa)
| campo | tipo | notas |
|---|---|---|
| id | PK | |
| session_id | FK → workout_session | |
| exercise_id | FK → exercise | link direto: query de histórico por exercício |
| set_number | int | 1..N |
| reps | int null | null = série criada, não feita |
| weight_kg | numeric(6,2) null | aceita 0,5 kg |
| created_at | timestamptz | |
| | | UNIQUE(session_id, exercise_id, set_number) |

## 5. Relacionamentos (cardinalidade)

```
exercise ─1──N─ workout_exercise ─N──1─ workout      (workout N—N exercise)
workout  ─1──N─ workout_session
workout_session ─1──N─ set_log
exercise ─1──N─ set_log
```

Ver diagrama entidade-relacionamento em [`DER.md`](./DER.md).

## 6. Query-chave — "mostrar a última vez"

Ao abrir exercício `X` no treino `T` (sessão atual = `S`):

```sql
SELECT sl.set_number, sl.reps, sl.weight_kg
FROM set_log sl
JOIN workout_session ws ON ws.id = sl.session_id
WHERE ws.workout_id = :T
  AND sl.exercise_id = :X
  AND ws.id = (
      SELECT ws2.id
      FROM workout_session ws2
      JOIN set_log s2 ON s2.session_id = ws2.id AND s2.exercise_id = :X
      WHERE ws2.workout_id = :T AND ws2.id <> :S
      ORDER BY ws2.performed_at DESC
      LIMIT 1
  )
ORDER BY sl.set_number;
```

Retorna as séries da última sessão anterior desse exercício nesse treino → a UI mostra ao lado da coluna nova.

## 7. Fluxo → banco

1. **Montar treino**: cria `workout` + N `workout_exercise` (com `position`, `target_sets=6`).
2. **Escolher treino hoje**: cria `workout_session(workout_id, performed_at=now)`.
3. **Abrir exercício**: roda a query da seção 6 → mostra última vez. UI abre `target_sets` linhas vazias.
4. **Preencher e salvar**: insere `set_log` (só as preenchidas, ou todas). Aumentar séries = `set_number` 7, 8, ...

## 8. Regras e decisões

- **`exercise_id` direto no `set_log`** (não via `workout_exercise`): a comparação é *por exercício*, e o mesmo exercício pode viver em vários treinos. Link direto = query simples.
- **`reps`/`weight_kg` nullable**: a série pode existir vazia e ser preenchida na hora.
- **Soft delete (`archived`)** em `workout` e `exercise`: apagar de verdade quebraria histórico. Some da lista, mantém o passado.
- **`numeric(6,2)`** no peso: aceita frações (anilhas de 0,5 kg).
- **FK cascade**: apagar sessão → apaga seus `set_log`. Apagar exercício → **restrict** (usar `archived`).
- **`performed_at` = timestamp** (não date): permite 2 sessões no mesmo dia.
- Guardar sempre **dado cru, nunca pré-agregado**: análises (volume, e1RM, progressão) saem de views/queries depois.

## 9. Escopo — fora deste spec

- Nutrição (módulo separado).
- Autenticação (entra só na fase "público").
- Análises/dashboards (fase posterior; dados já ficam prontos para isso).
