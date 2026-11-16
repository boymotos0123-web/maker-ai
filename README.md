# ZeyForge — CAD 3D de hardware

**ZeyForge** é um modelador 3D focado em **hardware**: celulares, notebooks, placas Arduino/ESP32/Raspberry, PCBs, baterias, telas, câmeras, drones e peças mecânicas. Roda **no navegador**, pode ser **instalado como app** (Android, Windows, macOS, Linux) e funciona **offline** depois da primeira visita.

> Criado por **Zeylor**. Tudo roda no seu aparelho; nenhum projeto sai do seu computador.

---

## O que ele faz

| Área | Recursos |
|---|---|
| **Biblioteca paramétrica** | +50 componentes com **medidas reais** (Arduino Uno R3 68,6×53,3 mm, ESP32 DevKit V1 51,8×28,2 mm, Raspberry Pi 4/Pico, Nano, protoboard, servo SG90, motor brushless 2207, USB-C, 18650, Li-Po, bobina Qi/MagSafe, tela por diagonal/proporção, módulo de câmera, parafusos M1.6–M5, dissipador, ventoinha…). Cada um tem parâmetros editáveis. |
| **Montagens prontas** | Celular transparente 6,1", Kit Arduino, ESP32 em gabinete, Drone FPV 5", Notebook 14". |
| **Modelagem** | Primitivas, perfil extrudado (squircle estilo Apple, polígono, L, oblongo, com parede oca), gabinete para impressão 3D, **booleanas** (unir / subtrair / interseção), espelhar, padrão linear (array), agrupar em montagens. |
| **Engenharia** | **Vista explodida** (radial ou por camadas), **plano de corte** X/Y/Z, **Raio-X**, wireframe, **medição** ponto a ponto (ΔX/ΔY/ΔZ), dimensões da caixa envolvente, snap 1 mm / 15°, vistas ortográficas. |
| **Materiais PBR** | Vidro, policarbonato e acrílico transparentes reais (transmissão + IOR), titânio, alumínio anodizado, fibra de carbono, FR4, cobre, ouro, tela ligada… |
| **Negócio** | **BOM (lista de materiais)** com custo por item, exportação CSV para Excel e **calculadora de preço** (montagem, embalagem, frete, impostos, margem → preço sugerido e lucro por unidade). |
| **Arquivos** | Exporta **STL** (impressão 3D, Z-up), **GLB** (Blender / web / AR), **OBJ**, **PNG**. Importa STL/OBJ/GLB. Salva projeto `.zeyforge.json`. Desfazer/refazer e salvamento automático. |

### Atalhos
`W` mover · `E` girar · `R` escalar · `Q` selecionar · `M` medir · `F` enquadrar · `X` raio-X · `H` ocultar · `Del` excluir · `Ctrl+D` duplicar · `Ctrl+G` agrupar · `Ctrl+Shift+G` desagrupar · `Ctrl+Z/Y` desfazer/refazer · `Ctrl+S` salvar · `1/3/7/0` frente/direita/topo/iso · `5` ortográfica.
Clique seleciona a peça; **clique de novo** seleciona a montagem-pai. Botão direito arrasta a câmera.

---

## Como usar / instalar

### 1. No navegador (qualquer aparelho)
Abra o site hospedado (ex.: InfinityFree). No Chrome/Edge aparece **"Instalar app"** na barra de endereço; no Android, menu ⋮ → **Adicionar à tela inicial**. Ele vira um app com ícone e funciona offline.

### 2. Pelo terminal — Linux / macOS / Termux (Android)
```bash
curl -fsSL https://raw.githubusercontent.com/boymotos0123-web/zeyforge/main/install.sh | bash
~/zeyforge/run.sh
```
Ou manualmente:
```bash
git clone https://github.com/boymotos0123-web/zeyforge.git
cd zeyforge && ./run.sh        # abre http://localhost:8080
```
No **Termux**: `pkg install git python` antes.

### 3. Windows
Baixe o ZIP do repositório (botão **Code → Download ZIP**), extraia e dê dois cliques em `run.bat` (precisa de Python ou Node instalado).

### 4. App desktop nativo (janela própria) — Windows / macOS / Linux
```bash
cd zeyforge/desktop
npm install
npm start                 # abre o ZeyForge numa janela
npm run dist:linux        # gera AppImage + .deb em desktop/dist
npm run dist:win          # gera instalador .exe (rode no Windows)
npm run dist:mac          # gera .dmg (rode no Mac)
```
Ou no Linux: `curl -fsSL .../install.sh | bash -s -- --desktop` (instala e cria atalho no menu).

---

## Hospedar no InfinityFree

1. Rode `./make-deploy.sh` (gera `zeyforge-web.zip`) **ou** pegue estas pastas/arquivos: `index.html`, `manifest.json`, `sw.js`, `.htaccess`, `css/`, `src/`, `vendor/`, `icons/`.
2. No painel do InfinityFree → **Online File Manager** → entre em `htdocs/`.
3. Envie o ZIP e extraia lá dentro (ou envie os arquivos por FTP com o FileZilla).
4. Abra seu domínio. Pronto, sem build, sem banco de dados.

> Dica: o **GitHub Pages** também hospeda grátis e com HTTPS automático (Settings → Pages → branch `main`). O app fica em `https://boymotos0123-web.github.io/zeyforge/`.

---

## Estrutura

```
index.html            app (sem build: ES modules + importmap)
css/app.css           interface
src/main.js           estado, UI, atalhos, operações
src/viewport.js       renderizador, câmeras, seleção, corte, medição
src/library.js        biblioteca de componentes paramétricos (medidas em mm)
src/templates.js      montagens prontas
src/materials.js      materiais PBR
src/geo.js            helpers geométricos (squircle, extrusão, PCB, pinos…)
src/tools.js          booleanas (CSG), explodida, import/export, BOM
src/doc.js            modelo do projeto, histórico, serialização
vendor/               three.js r187, three-bvh-csg, three-mesh-bvh (MIT)
desktop/              app Electron (Windows/macOS/Linux)
```

### Como adicionar um componente
Em `src/library.js`, copie um `def({...})` existente: dê um `type`, `name`, `cat`, `cost`, os `params` (com unidades) e a função `build(p)` que monta o objeto com os helpers de `geo.js` (1 unidade = 1 mm, Y para cima, origem no centro da base). Ele aparece sozinho na biblioteca, com miniatura.

---

## Limites atuais (sinceridade de engenharia)

O ZeyForge hoje é um **modelador de montagens por malha (mesh)** com componentes paramétricos. Ferramentas como **Siemens NX, Creo, SolidWorks e CATIA** (usadas por Apple/Samsung) trabalham com **B-Rep/NURBS**, esboços com restrições, tolerâncias (GD&T), simulação (FEA/térmica) e integração com ECAD (Altium/Cadence). Roteiro para chegar perto disso:

1. **Kernel B-Rep** com [OpenCascade.js / replicad](https://replicad.xyz) → filetes e chanfros reais, exportação **STEP** (o formato que fábricas pedem).
2. **Esboço 2D com restrições** (cotas e relações) → extrusão/revolução paramétrica.
3. **Importar PCB do KiCad** (`.kicad_pcb` → placa 3D com componentes reais).
4. **Checagem de interferência** entre peças e folgas mínimas.
5. **Simulação térmica simplificada** (dissipação por componente).
6. Biblioteca de footprints/modelos maior e colaborativa.

## Licença
MIT © Zeylor. Bibliotecas de terceiros em `vendor/` mantêm suas licenças MIT.
