# Owlbear Quest VTT — Tabletop RPG Studio

Mesa virtual tática inspirada no **Owlbear Rodeo 2.0** e **Quest Portal**, com fichas completas de D&D 5e (Proficiência + Expertise), motor de dados estilo **Rollem** (`src/utils/engine.ts`), sistema atômico de **Dano / Cura / Vida Temporária / Resistência** (`src/utils/dano.ts`), Névoa de Guerra com iluminação dinâmica por token, Iniciativa com foco automático de câmera e indicador `💡`, e Jukebox de áudio YouTube em segundo plano.

---

## Como Hospedar no GitHub (Passo a Passo)

Os arquivos do projeto já estão configurados com caminhos relativos (`base: './'` no `vite.config.ts`) e com o workflow oficial de deploy automático em `.github/workflows/deploy.yml`.

### Opção 1: Hospedar Grátis no GitHub Pages (Automático)

1. Crie um repositório no seu **GitHub** (ex.: `owlbear-quest-vtt`).
2. Envie todos os arquivos deste projeto para a branch `main` do repositório:
   ```bash
   git init
   git add .
   git commit -m "Deploy inicial Owlbear Quest VTT"
   git branch -M main
   git remote add origin https://github.com/SEU-USUARIO/NOME-DO-REPO.git
   git push -u origin main
   ```
3. No GitHub, abra o seu repositório e vá em:
   - **Settings** (Configurações) ➔ **Pages** (no menu lateral esquerdo).
   - Em **Build and deployment** ➔ **Source**, selecione **GitHub Actions**.
4. Pronto! A aba **Actions** do GitHub vai compilar o projeto automaticamente e publicar no link:
   `https://SEU-USUARIO.github.io/NOME-DO-REPO/`

> **Nota sobre o GitHub Pages:** O GitHub Pages hospeda o site estático completo (com salvamento automático no navegador via `localStorage` e sincronização instantânea entre abas via `BroadcastChannel`).

---

### Opção 2: Hospedar com Servidor WebSocket em Tempo Real (Múltiplos PCs na Mesma Sala)

Se você quiser que jogadores em computadores/redes diferentes sincronizem movimentos de tokens, dados, névoa e trava de **1 único Mestre** via servidor Node.js + WebSocket (`server.ts`):

1. Suba este repositório no seu **GitHub**.
2. Crie uma conta gratuita no **Render.com**, **Railway.app** ou **Fly.io** e conecte ao seu repositório do GitHub:
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `NODE_ENV=production npm start`
3. Ou, se você hospedar o front-end no **GitHub Pages** e o `server.ts` em outro serviço, basta definir a variável `VITE_WS_URL=wss://seu-servidor.com/ws` ao compilar.

---

## Rodando Localmente no Seu Computador

```bash
# 1. Instalar dependências
npm install

# 2. Iniciar servidor completo (Vite + WebSocket em tempo real na porta 3000)
npm run dev

# 3. Rodar os testes automatizados (Motor de Dados, Dano/Cura/VDT e Regras D&D 5e)
npm test
```
