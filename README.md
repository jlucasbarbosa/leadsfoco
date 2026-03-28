# leadsfoco

## Painel de envio com login

- Login: `/login`
- Painel: `/envio`
- API de disparo: `/api/envio/disparar`
- Campos de disparo no painel: `linkDisparo`, `diaTreino`, `periodo`, `local`, `horarioTreino`, `dataEnvio`, `horarioEnvio`, `mensagem`

## Variaveis de ambiente

- `ADMIN_USERNAME`: usuario do painel
- `ADMIN_PASSWORD`: senha do painel
- `AUTH_SESSION_SECRET`: segredo usado para assinar cookie de sessao
- `DISPATCH_WEBHOOK_URL`: webhook do n8n para disparo (opcional, usa `WEBHOOK_URL` se nao informado)
- `DISPATCH_TIMEZONE`: timezone enviada no payload (padrao `America/Cuiaba`)
