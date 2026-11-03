PATCH UI — Minecraft Java 1.0

Este é um patch incremental, gerado contra mc10-ui-atual.tar.gz enviado pelo usuário.
Não é uma cópia do projeto.

Aplicação, a partir da raiz do projeto:

  patch --dry-run -p1 < ~/Downloads/minecraft-1.0-ui-fix.patch
  patch -p1 < ~/Downloads/minecraft-1.0-ui-fix.patch
  python3 tools/extract-mc10-inventory-asset.py
  node --check main.js
  node --test

O patch altera main.js, index.html e hotbar-renderer.mjs, e adiciona
inventory-layout.mjs, steve-preview.mjs, o extrator de assets e testes.

Controles:
- E abre/fecha o inventário.
- Esc fecha o inventário.
- Clique esquerdo pega, move, troca e empilha pilhas.
- Clique direito pega metade ou coloca um item.
- F5 continua alternando a câmera.

Referências do JAR 1.0 usadas:
- qd.java: HUD 9x9 com passo de 8px e âncoras originais.
- hw.java / mg.java: painel 176x166 e fundo gui/inventory.png.
- gd.java: posições dos slots e grade de crafting 2x2.
- fa.java / steve.mjs: preview do Steve e skin char.png já presentes no projeto.
- zr.java: transformação do item no braço direito.

Limites deste patch:
- Os slots 2x2 de crafting são visíveis e aceitam pilhas, mas o resultado das receitas não é calculado aqui.
- Os quatro slots de armadura são posicionados e armazenados, mas os efeitos de armadura não são implementados por este patch.
- gui/inventory.png e gui/items.png são extraídos do JAR local pelo script após aplicar o patch.
