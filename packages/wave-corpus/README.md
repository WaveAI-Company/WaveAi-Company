# wave-corpus — corpus de pesquisa (ADR-0030)

Armazenamento de dados **de pesquisa**, fisicamente separado da produção. É onde
o **raw** (512 Hz) e as **janelas** podem viver para permitir reprocessamento,
comparação de engines e treino/validação — o que a produção, por decisão, **não**
guarda (ADR-0025/0026).

> Alimentado **só** por dados **sintéticos** e pela **autocaptação do dev**
> (ADR-0028). Nunca recebe dado de terceiro sem novo protocolo e base legal.

## Peças (N4-a)
- **`Frame`** — quadro `canais × amostras` + `fs` + `montagem` + `kind`. Modelo
  multicanal desde já (ADR-0033): NeuroSky = **N=1** (`("FP1",)`); o mesmo tipo
  aceita N>1 sem novo driver. `content_hash()` deriva do **conteúdo** (dedup
  determinística).
- **`ContentAddressedStore`** — grava/lê `Frame`s em **Parquet endereçado por
  conteúdo** (idempotente; escrita atômica). O raw só vive aqui.
- **`CorpusIndex` + models** — índice SQL com **só metadados e ponteiros**
  (device, montagem, `fs`, condição, `poor_signal`, hash+caminho). O banco nunca
  guarda o sinal. Postgres em deployment; SQLite em local/teste.
- **`CorpusSettings`** — config `WAVEAI_CORPUS_*`; **fail-closed**: recusa
  apontar para o banco de produção (`WAVEAI_API_DATABASE_URL`).

## Ainda **não** aqui (N4-b, issue #43)
Git+DVC, a **tétrade de proveniência** (commit / versão DVC do dataset /
`engine_version` / hiperparâmetros) e a **CLI de ingestão**.

## Rodar os testes
```bash
cd packages/wave-corpus
pip install -e ".[dev]"
pytest -q
```
Os testes usam SQLite e diretórios temporários — **100% sintéticos**, sem serviço.

## Config
| Env | Default | Nota |
|---|---|---|
| `WAVEAI_CORPUS_ROOT` | `_corpus` | diretório do store Parquet (gitignored) |
| `WAVEAI_CORPUS_DATABASE_URL` | `sqlite:///_corpus/index.db` | índice; **Postgres** em deployment (ADR-0030) |
