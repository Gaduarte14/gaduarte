# Prompt: Ferramenta de parede com lápis (riscar e concluir)

Você é um desenvolvedor sênior de front-end, com experiência em canvas e geometria 2D no navegador (JavaScript). Crie a **ferramenta de parede com lápis** do meu tabletop de RPG, onde o usuário **risca à mão livre** sobre o mapa e, ao clicar em **Concluir**, o sistema transforma o traço em parede **organizada**, já que a linha riscada nunca sai reta.

## Escopo (leia com atenção)

- Faça **apenas** esta ferramenta. Nada de mapa, tokens, fichas, chat ou outras partes do tabletop.
- **Não altere nada do restante do meu código.** Entregue como módulo separado e conecte pelo botão "Desenhar Parede" e pela camada de paredes que já existem (as paredes bloqueiam tokens e luz). Se precisar ver como as paredes são guardadas hoje (formato dos segmentos, camada de colisão, luz, porta, desfazer/refazer), **me peça o trecho do código** em vez de inventar.
- **Não use detecção automática de paredes na imagem** (nada de detecção de bordas ou de chão). O usuário é quem mostra onde a parede está; o sistema só organiza o traço. O único uso de imagem permitido é o "lápis magnético" opcional descrito abaixo, e só perto do traço.
- Tudo roda no navegador, sem backend e **sem bibliotecas pesadas** (se usar alguma, que seja pequena, e me avise qual).
- Se algo estiver ambíguo, escolha a opção mais simples e liste as suposições no final.
- Responda em português do Brasil e escreva a interface em português.

## Fluxo da ferramenta

1. O usuário escolhe **Desenhar Parede** e, dentro dela, a opção **Lápis** (ao lado das outras opções que já existirem, como traçar linha reta).
2. Ele **risca à mão livre** no mapa, com mouse, toque ou caneta. Pode fazer **vários traços seguidos** antes de concluir.
3. Enquanto risca, o traço aparece como uma linha provisória (cor diferente das paredes reais, por exemplo tracejada).
4. Aparecem os botões **Concluir**, **Cancelar** e **Desfazer último traço**.
5. Ao clicar em **Concluir**, o sistema **organiza** os traços (regras abaixo) e **adiciona as paredes** à camada de paredes existente.
6. Antes de concluir, mostrar uma **prévia** do resultado organizado (sobreposta ao traço original), atualizando em tempo real quando o usuário mexe nos controles.

## Como organizar o traço (siga esta ordem)

### 1. Limpar o rabisco
- Remover pontos repetidos e suavizar tremidas leves (média móvel curta), sem arredondar cantos de verdade.
- Descartar traços minúsculos (cliques acidentais), com tamanho mínimo configurável.

### 2. Simplificar
- Usar **Ramer-Douglas-Peucker** para transformar o traço em poucos segmentos retos.
- Controle de **intensidade da simplificação** (tolerância em pixels ou em fração de célula do grid).
- Preservar cantos reais: onde o traço muda de direção de forma clara, deve nascer um vértice.

### 3. Endireitar
- Segmentos **quase horizontais ou verticais** viram retas perfeitas (tolerância de ângulo configurável, ex.: 8°).
- Opção para também aceitar diagonais de 45°.
- Opção **alinhar ao grid**: vértices vão para o ponto de grid mais próximo (ou a metade da célula), com interruptor para ligar e desligar.

### 4. Grudar e fechar
- Se uma ponta do traço terminar perto de outra parede (dentro de um raio configurável), **conectar** nela: grudar no vértice mais próximo, ou na linha, dividindo o segmento existente no ponto de encontro.
- Se a ponta final ficar perto da ponta inicial do mesmo traço, **fechar o polígono**.
- Resultado: cantos sem frestas, para a luz e os tokens não vazarem.

### 5. Limpeza final
- Unir segmentos colineares consecutivos em um só.
- Remover segmentos menores que um comprimento mínimo configurável.
- Evitar duplicar paredes que já existem exatamente no mesmo lugar.

## Atalhos e extras

- **Linha reta rápida:** segurando **Shift** (ou com um interruptor "Linha reta" no celular), o usuário clica em um ponto, arrasta/clica em outro, e sai uma parede reta, já alinhada ao grid se estiver ligado.
- **Apagar:** borracha ou seleção para apagar segmentos depois de aplicados, usando as ferramentas existentes (se não existirem, me avise).
- **Desfazer tudo de uma vez:** cada **Concluir** vira **um único passo** no desfazer/refazer, desfazendo todas as paredes criadas por aquele Concluir.
- **Portas:** o sistema não detecta portas; o usuário marca depois com a ferramenta que já existe.
- **Zoom e arrastar o mapa** devem continuar funcionando normalmente (por exemplo, dois dedos no celular), sem riscar sem querer.

## Lápis magnético (opcional, interruptor desligado por padrão)

- Com o interruptor ligado, enquanto o usuário risca, cada ponto do traço é **puxado para a borda mais escura/forte da arte** que estiver a poucos pixels de distância (raio configurável), como o laço magnético de editores de imagem.
- Só analisar a imagem **perto do traço**, nunca o mapa inteiro. Se não achar borda perto, manter o ponto onde o usuário riscou.
- Controle de **força/raio** do magnetismo.
- Isso é uma ajuda para o traço ficar mais preciso, e depois ele passa pelas mesmas etapas de organização acima.
- Entregue o lápis normal **primeiro e funcionando**; o magnético vem como etapa seguinte, separado, para não atrapalhar.

## Requisitos técnicos

- Desenhar o traço provisório sem travar (usar `requestAnimationFrame`, `pointermove` com eventos coalescidos e um canvas de sobreposição).
- Funcionar bem em **tela de toque** (celular e tablet), com botões grandes.
- Funcionar com mapas grandes e muitos segmentos sem perder desempenho.
- Coordenadas sempre no **espaço do mapa** (corrigindo zoom e deslocamento), para as paredes ficarem no lugar certo em qualquer zoom.
- Código organizado em funções pequenas e testáveis: captura do traço, suavização, simplificação, endireitar, alinhar ao grid, grudar/fechar, unir segmentos.
- Comentários curtos explicando cada etapa.

## Como entregar

1. Mostre em poucas linhas o plano de integração com o meu código atual (qual função recebe os segmentos finais, em que formato, e como entra no desfazer).
2. Entregue o módulo pronto, separado do meu código, com instruções curtas de como plugar no botão "Desenhar Parede".
3. Liste no final as suposições que você fez e os valores padrão escolhidos (tolerâncias, raios, tamanhos mínimos).
