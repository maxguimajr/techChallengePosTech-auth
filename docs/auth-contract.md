# Contrato de autenticação (Lambda ⇄ API Gateway ⇄ Aplicação)

> Proposta para fechar o item **C1** do `PLANO-FASE-3.md` da aplicação. Mudanças: abrir PR neste arquivo.

## 1. Obter token — `POST /auth/cpf` (público)

Corpo da requisição:

```json
{ "cpf": "123.456.789-09" }
```

A pontuação é opcional, porque a Lambda normaliza para `12345678909` (o mesmo formato salvo em `clientes.documento`).

| Status | Corpo | Quando |
|---|---|---|
| `200` | `{ "accessToken": "<jwt>", "tokenType": "Bearer", "expiresIn": 3600 }` | Cliente com CPF cadastrado e ativo |
| `400` | `{ "erro": "CPF_INVALIDO", "mensagem": "..." }` | Corpo ausente, malformado ou CPF com dígito verificador inválido |
| `401` | `{ "erro": "CLIENTE_NAO_ENCONTRADO", "mensagem": "..." }` | Não existe cliente com `tipoDocumento = CPF` e esse documento |
| `403` | `{ "erro": "CLIENTE_INATIVO", "mensagem": "..." }` | Cliente com `ativo = false` |
| `500` | `{ "erro": "ERRO_INTERNO", "mensagem": "..." }` | Falha ao consultar o banco |

Toda resposta traz o header `x-correlation-id`.

## 2. JWT

- **Algoritmo:** `HS256`, com segredo compartilhado. O mesmo valor vai em `JWT_SECRET` na Lambda, no Authorizer e na aplicação.
- **Validade:** `exp` igual a 1 hora (`JWT_EXPIRES_IN_SECONDS`).

```json
{
  "sub": "<clientes.id (uuid)>",
  "cpf": "12345678909",
  "nome": "João da Silva",
  "papel": "CLIENTE",
  "iss": "oficina-auth-lambda",
  "iat": 1761200000,
  "exp": 1761203600
}
```

Os tokens de staff emitidos pela aplicação (`POST /auth/login`, payload `{ sub, email, papel }`) usam o mesmo segredo e também passam no Authorizer. Para diferenciar a origem, use `iss` ou `papel === 'CLIENTE'`.

## 3. Rotas protegidas (`ANY /{proxy+}` → aplicação no Kubernetes)

1. O cliente envia `Authorization: Bearer <jwt>`.
2. O **Lambda Authorizer** valida a assinatura e o `exp`. Se o token for inválido, o próprio gateway responde `401` ou `403`, e a requisição não chega na aplicação.
3. O gateway repassa a requisição com estes headers, sempre **sobrescritos**, de modo que o cliente não consegue forjá-los:
   - `x-correlation-id`: o `requestId` do gateway. A aplicação deve usá-lo nos logs.
   - `x-cliente-id`: o `sub` do token.
   - `x-usuario-papel`: o `papel` do token.
4. O `Authorization` original também é repassado, então a aplicação pode continuar validando o JWT pelo `JwtStrategy`. Isso é defesa em profundidade.

Estas rotas da aplicação são públicas (sem JWT) e podem ser ajustadas na variável `public_app_routes`:
`POST /auth/login`, `GET /health`, `GET /api/docs`, `GET /api/docs/{proxy+}`.

## 4. Dependências do banco

A consulta é feita em `clientes` (schema Prisma da aplicação):

```sql
SELECT id, nome, documento, ativo FROM clientes
 WHERE documento = $1 AND "tipoDocumento" = 'CPF';
```

- **Coluna `ativo`:** ainda não existe. A sugestão é uma migration com `ativo Boolean @default(true)`. Enquanto ela não sair, a Lambda considera todo cliente ativo, então dá para testar sem esperar.
- **Acesso ao RDS:** a Lambda roda em outra conta AWS e fora de VPC, então o RDS precisa de:
  - `publicly_accessible = true`;
  - SSL obrigatório (`rds.force_ssl = 1`, que já é o padrão no PostgreSQL 15 ou mais novo);
  - entrada na porta `5432` liberada no security group. O IP da Lambda muda a cada execução, por isso a regra é `0.0.0.0/0`, e a proteção fica por conta de usuário, senha e SSL.
- **`DATABASE_URL`:** deve usar o **endpoint público** do RDS.
