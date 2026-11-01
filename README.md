# encurtador-links-api

API REST para encurtar links, com slugs personalizados, data de expiração e estatísticas de cliques (por dia e por origem). Escrita em **TypeScript** com **Fastify**, validação com **Zod** e testes com **Vitest**.

## Funcionalidades

- Criação de links curtos com slug aleatório (sem caracteres ambíguos como `0/O` e `1/l/I`) ou personalizado
- Expiração opcional: links vencidos respondem `410 Gone`
- Redirecionamento `302` com registro de cada clique (data, referer e user-agent)
- Estatísticas: total de cliques, último clique, cliques por dia e principais origens
- Armazenamento em memória ou persistência em arquivo JSON (gravação atômica)
- Mensagens de erro em português com detalhes de validação por campo

## Stack

| Camada       | Tecnologia                 |
| ------------ | -------------------------- |
| Linguagem    | TypeScript 5 (ESM)         |
| Runtime      | Node.js 22+                |
| Framework    | Fastify 5                  |
| Validação    | Zod 4                      |
| Testes       | Vitest                     |
| Infra        | Docker, GitHub Actions     |

## Estrutura

```
src/
  app.ts               # monta a aplicação Fastify
  server.ts            # ponto de entrada (lê variáveis de ambiente)
  routes/links.ts      # rotas REST e redirecionamento
  storage/memory.ts    # repositório em memória
  storage/json-file.ts # repositório persistido em JSON
  slug.ts              # geração de slugs
  stats.ts             # agregação de estatísticas
tests/                 # testes de API e de unidade
```

## Instalação e execução

Pré-requisito: Node.js 22.12 ou superior.

```bash
npm install
npm test            # roda os testes
npm run dev         # modo desenvolvimento com reload
# ou
npm run build && npm start
```

Variáveis de ambiente:

| Variável    | Padrão     | Descrição                                                     |
| ----------- | ---------- | ------------------------------------------------------------- |
| `PORT`      | `3000`     | Porta HTTP                                                    |
| `HOST`      | `0.0.0.0`  | Interface de escuta                                           |
| `BASE_URL`  | (do host)  | URL pública usada para montar o `shortUrl`                    |
| `DATA_FILE` | (vazio)    | Caminho do arquivo JSON; se vazio, os dados ficam em memória  |

### Docker

```bash
docker build -t encurtador-links-api .
docker run -p 3000:3000 -e BASE_URL=http://localhost:3000 -v encurtador-dados:/app/data encurtador-links-api
```

## Endpoints

| Método   | Rota                       | Descrição                         |
| -------- | -------------------------- | --------------------------------- |
| `GET`    | `/health`                  | Verificação de saúde              |
| `POST`   | `/api/links`               | Cria um link curto                |
| `GET`    | `/api/links`               | Lista links (mais recentes antes) |
| `GET`    | `/api/links/:slug`         | Detalhes de um link               |
| `GET`    | `/api/links/:slug/stats`   | Estatísticas de cliques           |
| `DELETE` | `/api/links/:slug`         | Remove um link                    |
| `GET`    | `/:slug`                   | Redireciona para a URL original   |

## Exemplos de uso

Criar um link com slug personalizado e expiração:

```bash
curl -X POST http://localhost:3000/api/links \
  -H "Content-Type: application/json" \
  -d '{"url": "https://github.com", "slug": "github", "expiresAt": "2027-01-01T00:00:00Z"}'
```

```json
{
  "slug": "github",
  "url": "https://github.com",
  "shortUrl": "http://localhost:3000/github",
  "createdAt": "2026-11-01T23:39:14.111Z",
  "expiresAt": "2027-01-01T00:00:00.000Z",
  "expired": false,
  "totalClicks": 0
}
```

Acessar o link curto (redireciona com `302`):

```bash
curl -i http://localhost:3000/github
```

Consultar estatísticas:

```bash
curl http://localhost:3000/api/links/github/stats
```

```json
{
  "slug": "github",
  "totalClicks": 3,
  "lastClickAt": "2026-11-01T23:45:02.120Z",
  "clicksByDay": { "2026-11-01": 3 },
  "topReferrers": [
    { "referrer": "https://news.site", "clicks": 2 },
    { "referrer": "direto", "clicks": 1 }
  ]
}
```

Erro de validação:

```json
{
  "error": "Dados inválidos",
  "details": [{ "field": "url", "message": "url deve ser um endereço http(s) válido" }]
}
```

## Próximos passos

- Persistência em banco de dados (PostgreSQL ou SQLite) implementando a interface `LinkRepository`
- Autenticação por chave de API para criar e remover links
- Limite de requisições (rate limiting) na criação de links
- Documentação OpenAPI/Swagger gerada a partir dos schemas
- Geração de QR Code para cada link curto
- Painel web para visualizar as estatísticas

## Licença

Distribuído sob a licença MIT. Veja [LICENSE](LICENSE).
