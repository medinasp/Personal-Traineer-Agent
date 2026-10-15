# Runbook de Deploy — Meu Treino (Hetzner + Coolify)

Guia executável pra tirar o app da máquina local e colocar em produção.
Provedor: **Hetzner Cloud** (mas os passos 4–12 valem igual em Contabo/Vultr/DO).
DNS: **DuckDNS** (grátis). Camada: **Coolify**. Auth: **token estático** (já no código).

Tempo estimado com a conta ativa: ~30–40 min.

---

## 0. Pré-requisitos (o que ter em mãos)
- Conta Hetzner ativa (ou outro provedor).
- Uma conta GitHub (repo privado pro backend).
- Terminal no seu PC (Linux — você já tem).
- O backend já está pronto pra deploy:
  - `Dockerfile` + `entrypoint.sh` (roda `alembic upgrade head` + `seed` no boot).
  - Auth por token: env `API_TOKEN` (vazio = desligada; setado = exige `Authorization: Bearer <token>`).
  - `/health` e `/` ficam **abertos** (pro health-check do Coolify).

Valores que vamos usar como exemplo (troque pelos reais):
- Subdomínio: `meu-treino.duckdns.org`
- App container escuta na porta **8000**.
- Banco local (dev): container `fitness-db`, user `fit`, db `fitness`, host `5434`.

---

## 1. Gerar chave SSH (no seu PC)
Melhor que senha. Gera o par uma vez:

```bash
ssh-keygen -t ed25519 -C "medinasp@gmail.com" -f ~/.ssh/hetzner_treino
# Enter pra sem passphrase (ou defina uma)
cat ~/.ssh/hetzner_treino.pub   # <- essa é a PÚBLICA, vai pro Hetzner
```

Guarde a privada (`~/.ssh/hetzner_treino`) — nunca compartilhe.

---

## 2. Criar o servidor (Hetzner Cloud Console)
`New Project` → dentro dele `Add Server`:
- **Location**: Ashburn, VA (EUA)
- **Image**: Ubuntu 24.04
- **Type**: Shared vCPU → **CPX11** (2 vCPU / 2 GB / 40 GB) — ~US$4,8/mês
- **SSH Key**: cole a **pública** do passo 1
- **Name**: `treino-prod`
- `Create & Buy now`

Anote o **IP** do servidor.

### 2.1 Firewall (Hetzner Cloud → Firewalls)
Crie um firewall e aplique ao servidor. Inbound permitido:
- TCP **22** (SSH)
- TCP **80** (HTTP → redireciona pra 443)
- TCP **443** (HTTPS)
- ICMP (ping)

**Não** exponha 8000 publicamente — acessaremos o painel do Coolify por túnel SSH (passo 5).

---

## 3. Apontar o DuckDNS pro servidor
1. https://www.duckdns.org → login.
2. Crie o subdomínio (ex: `meu-treino`).
3. No campo **current ip**, cole o **IP do servidor** e salve.
4. Teste: `ping meu-treino.duckdns.org` deve resolver pro IP.

> DuckDNS é grátis (sem SLA). Serve bem pro app pessoal. Se virar produto pago, troca por domínio próprio depois (envolve rebuild do APK).

---

## 4. Instalar o Coolify (no servidor)
Conecta via SSH e roda o instalador oficial (instala Docker + Coolify):

```bash
ssh -i ~/.ssh/hetzner_treino root@SEU_IP
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

Aguarde terminar (~3–5 min).

---

## 5. Acessar o painel do Coolify (com segurança)
O painel sobe na porta 8000 do servidor. Em vez de abrir essa porta, use **túnel SSH** (do seu PC):

```bash
ssh -i ~/.ssh/hetzner_treino -L 8000:localhost:8000 root@SEU_IP
```

Deixe esse terminal aberto e acesse no navegador: **http://localhost:8000**

1. Crie a conta admin (primeiro acesso).
2. Em `Servers`, o próprio servidor (`localhost`) já vem cadastrado como destino.

(Opcional, depois: dar um subdomínio ao próprio Coolify e fechar o túnel.)

---

## 6. Subir o backend pro GitHub (no seu PC)
O projeto ainda não é repositório git. Na raiz do backend:

```bash
cd "/home/usuario/1a/claude/projetos pessoais/fitness-app"
git init
git add .
git commit -m "backend meu-treino"
```

Crie um repo **privado** no GitHub e faça o push:

```bash
git branch -M main
git remote add origin git@github.com:SEU_USUARIO/meu-treino.git
git push -u origin main
```

> `.env` e `backups/` já estão no `.gitignore` — segredos não vão pro repo. ✅

---

## 7. Criar o banco Postgres no Coolify
No painel → seu projeto → `+ New` → `Database` → **PostgreSQL 16**.
- Nome: `treino-db`
- Deixe o Coolify gerar user/senha.
- Após criar, copie a **connection string interna** (algo como
  `postgres://<user>:<senha>@<host-interno>:5432/<db>`).

**Ainda não** conecte a API. Primeiro restauramos os dados (passo 8),
pra o `seed`/`alembic` do boot não conflitar.

---

## 8. Migrar os dados (local → produção)
### 8.1 Dump do banco local (no seu PC)
```bash
docker exec -t fitness-db pg_dump -U fit -d fitness \
  --no-owner --no-privileges > /tmp/treino_dump.sql
```
(Se a senha do dev não for a padrão, o `docker exec` não precisa dela.)

### 8.2 Enviar o dump pro servidor
```bash
scp -i ~/.ssh/hetzner_treino /tmp/treino_dump.sql root@SEU_IP:/root/
```

### 8.3 Restaurar dentro do container do Postgres (no servidor)
Descubra o container do banco e restaure:
```bash
ssh -i ~/.ssh/hetzner_treino root@SEU_IP
docker ps | grep postgres        # pega o NOME/ID do container do treino-db
docker exec -i <CONTAINER_PG> psql -U <user> -d <db> < /root/treino_dump.sql
```
O dump traz schema + dados + `alembic_version` (já no head).
Depois, `rm /root/treino_dump.sql`.

---

## 9. Gerar o API_TOKEN
No seu PC (ou no servidor):
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```
Guarde esse valor — vai no backend **e** no app (têm que bater).

---

## 10. Deploy da API no Coolify
No projeto → `+ New` → `Application` → source **GitHub** (repo privado do passo 6).
- **Build Pack**: Dockerfile (o Coolify detecta o `Dockerfile`).
- **Port / Ports Exposes**: `8000`
- **Domain**: `https://meu-treino.duckdns.org`
  (o Coolify emite o certificado Let's Encrypt automático — precisa do DNS já apontado e portas 80/443 abertas.)
- **Health Check Path**: `/health`
- **Environment Variables**:
  ```
  DATABASE_URL=postgresql+psycopg://<user>:<senha>@<host-interno>:5432/<db>
  API_TOKEN=<token do passo 9>
  CORS_ORIGINS=*
  ```
  > Atenção ao formato: `postgresql+psycopg://...` (o SQLAlchemy usa o driver psycopg).
  > Pegue user/senha/host da string do passo 7 e reescreva nesse formato.

`Deploy`. No boot, o `entrypoint.sh` roda:
- `alembic upgrade head` → no-op (dump já está no head)
- `python -m app.seed` → pula (catálogo não está vazio)
- sobe o uvicorn.

### 10.1 Verificar
```bash
curl https://meu-treino.duckdns.org/health
# -> {"status":"ok"}

curl https://meu-treino.duckdns.org/api/v1/exercises
# -> 401 (auth ativa, sem token) ✅

curl -H "Authorization: Bearer <TOKEN>" \
  https://meu-treino.duckdns.org/api/v1/exercises
# -> lista dos seus exercícios ✅
```

---

## 11. Apontar o app pro cloud e rebuildar o APK
### 11.1 `mobile/eas.json` — trocar URL e adicionar token
Nos perfis `preview` e `production`, no bloco `env`:
```json
"env": {
  "EXPO_PUBLIC_API_URL": "https://meu-treino.duckdns.org/api/v1",
  "EXPO_PUBLIC_API_TOKEN": "<TOKEN do passo 9>"
}
```
(hoje aponta pro IP Tailscale `http://100.123.82.103:8000/api/v1`)

### 11.2 `mobile/app.json` — desligar cleartext (agora é HTTPS)
No plugin `expo-build-properties`, trocar:
```json
"android": { "usesCleartextTraffic": false }
```

### 11.3 Rebuild
```bash
cd "/home/usuario/1a/claude/projetos pessoais/fitness-app/mobile"
EAS_NO_VCS=1 npx eas build -p android --profile preview --non-interactive
```
Instale o novo APK no celular. Ele agora fala com o cloud, via HTTPS, com token.

> ⚠️ Nota de segurança: `EXPO_PUBLIC_*` fica embutido no APK — quem extrair o app
> consegue ler o token. Pra app pessoal (1 usuário) é aceitável. Quando virar
> multiusuário, migrar pra contas + JWT (token por usuário, com expiração).

---

## 12. Backups off-site (recomendado)
No Coolify, no recurso do Postgres → `Backups`:
- Agende backup diário.
- Destino: **S3-compatível** — Cloudflare **R2** ou **Backblaze B2** (baratíssimos).
- Configure as credenciais do bucket.

Assim, se o servidor morrer, os dados estão salvos fora dele.

---

## 13. Troubleshooting rápido
- **Cert HTTPS não emite**: DNS ainda não propagou, ou portas 80/443 fechadas no firewall. Confere `ping meu-treino.duckdns.org` e o firewall.
- **API sobe mas 500 no banco**: `DATABASE_URL` errado (formato `postgresql+psycopg://`, host interno certo, senha certa). Veja os logs no Coolify.
- **401 mesmo com token**: o `API_TOKEN` do backend ≠ `EXPO_PUBLIC_API_TOKEN` do app. Têm que ser idênticos.
- **App não conecta**: rebuildou o APK depois de trocar o `eas.json`? O valor é embutido em build.
- **Rollback**: no Coolify, aba `Deployments` → redeploy de uma versão anterior.

---

## Ordem-resumo
1. chave SSH → 2. servidor + firewall → 3. DuckDNS → 4. instalar Coolify →
5. painel via túnel → 6. push GitHub → 7. Postgres → 8. restaurar dump →
9. gerar token → 10. deploy API + env → 11. rebuild APK → 12. backups.
