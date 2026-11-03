Patch do Steve original do Minecraft Java 1.0

Conteudo:
- main.js: shader u_model, alpha test da skin, draw do modelo e F5.
- steve.mjs: geometria, UV, espelhamento, matrizes e animacoes do ModelBiped.
- public/assets/mc10/char.png: skin 64x32 extraida do 1.0.jar.
- tests/steve.test.mjs: testes do modelo e transformacoes.

Aplicacao no Arch Linux:

1. Entre na pasta do projeto:
   cd ~/Projetos/minecraft-1-browser

2. Crie um backup:
   cp main.js main.js.before-steve.bak

3. Extraia este patch sobre a pasta do projeto:
   tar -xzf ~/Downloads/steve-mc10-patch.tar.gz -C .

4. Valide:
   node --check main.js
   node --check steve.mjs
   node --test genlayer.test.mjs tests/steve.test.mjs

5. Inicie o servidor normalmente e abra o jogo. F5 alterna entre:
   - primeira pessoa
   - terceira pessoa traseira
   - terceira pessoa frontal

O modelo segue as dimensoes, os UVs, o espelhamento e a cadeia de transformacoes
identificados nas classes fa, ad, pv, acf, acq e zr do Minecraft Java 1.0.
