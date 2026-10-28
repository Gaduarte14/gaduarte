# Prompt: Movimento de token em tempo real (ao vivo, durante o arrasto)

Você é um desenvolvedor sênior de front-end e de apps em tempo real com Firebase. No meu tabletop de RPG (já online, hospedado no GitHub Pages, com Firebase), o **movimento dos tokens está lento para os outros jogadores**. Corrija isso para que o token se mova **imediatamente na tela de todos, enquanto o dono ainda está arrastando**, sem precisar soltar o botão.

## O problema

- Quando alguém move um token, quem está do outro lado só vê o token se mexer **depois que o botão é solto**, e ainda demora **alguns segundos** para atualizar.
- O atraso é só na visão da **outra pessoa**; na tela de quem move, é imediato.
- Quero: ao arrastar, o token se move **ao vivo** nas outras telas, de forma fluida, com atraso quase imperceptível.

## Escopo (leia com atenção)

- Corrija **apenas** a sincronização do movimento de tokens. Nada de redesenhar mapa, fichas, tela inicial ou outras partes.
- **Não quebre o que já funciona.** Faça mudanças pequenas e isoladas; me mostre exatamente quais trechos mudou.
- **Me peça o código** das partes que você precisar ver (função de arrastar token, função que salva/sincroniza o estado, listeners do Firebase, regras de segurança). Não invente como elas são.
- Responda em português do Brasil.

## Passo 1: diagnóstico (antes de mudar qualquer coisa)

Descubra **onde está o atraso**, medindo, e me diga o resultado. Investigue pelo menos:

1. **A posição só é enviada ao soltar (`mouseup`/`pointerup`)?** Se sim, é a causa principal do "só mexe quando solta".
2. **Há `debounce`/`throttle` grande**, ou envio dentro de um `setTimeout`?
3. **O que está sendo gravado a cada movimento?** Se o código grava o **estado inteiro** da mesa (mapa, fichas, imagens em base64, todos os tokens) em um único documento, cada gravação fica pesada e lenta. Medir o tamanho do que é enviado.
4. **O listener do outro lado reaplica o estado inteiro** e re-renderiza tudo (ou recria os tokens) a cada mudança?
5. **Latência real do Firebase:** medir com logs de tempo (hora do envio vs. hora do recebimento) em dois navegadores.
6. **Região do banco e conexão:** só mencionar se for relevante (o GitHub Pages só entrega arquivos e **não** participa da sincronização).

Entregue o diagnóstico em poucas linhas antes de propor a solução.

## Passo 2: solução esperada (arquitetura)

Use esta abordagem, adaptando ao meu código e justificando qualquer mudança:

### A. Dois caminhos de dados: ao vivo e salvo
- **Caminho ao vivo (efêmero, enquanto arrasta):** enviar apenas `{ tokenId, x, y }` (e no máximo quem está movendo e um contador de versão), **a cada ~30–60 ms** durante o arrasto, para um canal de **baixa latência**. Para isso, prefira o **Firebase Realtime Database** (feito para atualizações frequentes) em um caminho como `/live/{salaId}/{tokenId}`. Se achar que dá para fazer só com Firestore sem estourar limites, explique, mas **não** envie a posição a cada pixel para um documento grande do Firestore (há limite prático de gravações por segundo por documento).
- **Caminho salvo (persistente):** ao **soltar** o token, gravar a posição final no Firestore (o estado que sobrevive a recarregar a página), e limpar o canal ao vivo.
- Se o Realtime Database exigir configuração (criar o banco, regras), **me dê o passo a passo** e as regras de segurança: só usuários logados, só membros da sala, e só o dono do token (ou o mestre) escreve a posição dele.

### B. Enviar pouco
- Nunca enviar o estado inteiro da mesa por movimento. Enviar **só o que mudou** (id e coordenadas).
- Se os tokens, imagens e configurações estiverem todos em **um único documento grande**, proponha separar: **um documento/nó por token** (e imagens fora do documento principal), para que mover um token não regrave tudo. Me mostre o plano antes de reestruturar dados existentes e como não perder as mesas já salvas.

### C. Recebimento suave
- No receptor, atualizar **somente o token afetado** (sem recriar nem re-renderizar a mesa inteira).
- Aplicar **interpolação** entre as posições recebidas (por exemplo, animar com `requestAnimationFrame` suavizando até a última posição) para o movimento não ficar "pulando".
- **Ignorar eco:** quem está arrastando não deve reaplicar as próprias atualizações recebidas (evita o token "brigar" com o mouse).
- Descartar atualizações antigas fora de ordem (usar contador de versão ou timestamp).

### D. Arrasto no lado de quem move
- Atualização **otimista e local**: o token acompanha o mouse/dedo sem esperar o servidor.
- Usar `pointer events` (mouse, toque e caneta) e `requestAnimationFrame` para o envio limitado (throttle), garantindo que a **última posição sempre seja enviada** ao soltar.
- Se o arrasto for cancelado, o token volta e o canal ao vivo é limpo.

### E. Robustez
- Se alguém desconectar no meio de um arrasto, **limpar o estado ao vivo** (`onDisconnect` do Realtime Database) para o token não ficar "preso".
- Conflito: se dois usuários tentam mover o mesmo token, vence quem começou primeiro (ou o mestre); o outro vê o token travado.
- Respeitar as regras que já existem (só o mestre move tokens de monstros, por exemplo, se existir).

## Requisitos

- Meta de desempenho: o outro jogador deve ver o movimento com atraso **inferior a ~200 ms** em condições normais, e fluido (sem trancos).
- Funcionar bem em **celular e computador**.
- Não aumentar muito o uso do plano gratuito do Firebase: limitar a taxa de envio e **não gravar no Firestore durante o arrasto**. Me explique o impacto nos limites gratuitos em linguagem simples.
- Versões de bibliotecas **fixas**, sem "latest".

## Como entregar

1. Primeiro, o **diagnóstico** (Passo 1) e as **perguntas** que faltarem (código que precisa ver, se posso ativar o Realtime Database).
2. Depois o plano em poucas linhas e, em seguida, as **mudanças no código**, mostrando só os trechos alterados, com instruções de onde colar.
3. Um **roteiro de teste** com dois navegadores/usuários para eu confirmar que o movimento ao vivo funciona (arrastar, soltar, recarregar a página, desconectar no meio).
4. Liste no final as suposições feitas e qualquer risco.
