# Minecraft 1.0 Browser Port

## Instalar os assets gráficos

Os arquivos gráficos originais do Minecraft não são distribuídos pelo repositório. Para preparar o jogo, use uma cópia local e legítima do Minecraft 1.0.jar.

Com o JAR no caminho padrão do SKLauncher:

```bash
npm run extract-assets
```

Ou informe o caminho do JAR manualmente:

```bash
npm run extract-assets -- "/caminho/para/1.0.jar"
```

O script extrai os arquivos gráficos usados pelo port para `public/assets/`. Ele não sobrescreve arquivos existentes. Para substituir os arquivos existentes intencionalmente:

```bash
python3 tools/extract-mc10-assets.py --force
```

O arquivo `public/assets/mc10_faces_spec.json` contém metadados de mapeamento usados pelo port e fica versionado no repositório; as imagens extraídas permanecem locais.
