# Minecraft 1.0 Browser Port

## Executar no navegador

O projeto é uma aplicação estática: HTML, CSS, JavaScript ES Modules e WebGL 2. Não precisa de servidor Node em produção.

Para executar localmente com Electron:

```bash
npm install
npm start
```

## Preparar os assets

Os assets gráficos e de áudio são carregados pelo navegador a partir de `public/assets/`.

Para extrair os recursos de uma cópia local do Minecraft 1.0.jar:

```bash
npm run extract-assets
```

Ou informe o caminho do JAR:

```bash
npm run extract-assets -- "/caminho/para/1.0.jar"
```

O script não sobrescreve arquivos existentes. Para substituir os arquivos existentes intencionalmente:

```bash
python3 tools/extract-mc10-assets.py --force
```

O arquivo `public/assets/mc10_faces_spec.json` contém metadados de mapeamento usados pelo port.

**Importante:** os arquivos originais de Minecraft não são incluídos no Git por padrão. Antes de publicar ou compartilhar assets, confirme que você tem autorização para distribuí-los. Na Vercel, o jogador importa uma cópia local pelo navegador; os arquivos não são enviados ao repositório nem ao servidor.

## Deploy na Vercel

O `vercel.json` configura o projeto como site estático, sem instalar Electron nem executar Node/Python no servidor.

1. Envie o código do projeto para um repositório Git.
2. Importe o repositório na Vercel.
3. Use **Other** como Framework Preset (já definido em `vercel.json`).
4. A saída estática é a raiz do projeto (`.`); não há etapa de build.

Como os assets originais não são enviados ao Git, a primeira abertura do site pede a pasta local `public/assets`. Selecione essa pasta no seletor de diretórios e aguarde a importação.

Os arquivos ficam no IndexedDB do navegador e são reutilizados nas próximas visitas naquele navegador. A importação acontece no próprio dispositivo: os assets não são enviados para a Vercel. Cada pessoa precisa selecionar uma cópia local dos assets que tenha direito de usar.

Selecione a pasta completa, não apenas o `1.0.jar`: os sons e músicas usados pelo port ficam na pasta de recursos local e não estão todos dentro do JAR.

A Vercel não executa Electron nem o extrator Python. Para o aplicativo Electron local, continue usando o fluxo de extração do JAR.
