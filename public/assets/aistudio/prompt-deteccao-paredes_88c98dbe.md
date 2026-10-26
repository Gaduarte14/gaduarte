# Prompt: Detecção automática de paredes (método do chão)

Você é um desenvolvedor sênior de front-end, com experiência em visão computacional no navegador (Canvas, JavaScript). Refaça o **detector automático de paredes** do meu tabletop de RPG usando o método descrito abaixo.

## Escopo (leia com atenção)

- Faça **apenas** o detector automático de paredes. Nada de mapa, tokens, fichas, chat ou outras partes do tabletop.
- **Não altere nada do restante do meu código.** Entregue o detector como um módulo separado e conecte pelo ponto de integração que já existe: o botão "Desenhar Parede" e a camada de paredes que bloqueia tokens e luz. Se precisar ver como as paredes são armazenadas hoje (formato dos segmentos, camada de colisão, luz, porta), **me peça o trecho do código** em vez de inventar.
- Tudo roda no navegador, sem backend e **sem bibliotecas pesadas** (se usar alguma, que seja pequena, e me avise qual).
- Se algo estiver ambíguo, escolha a opção mais simples e liste as suposições no final.
- Responda em português do Brasil e escreva a interface em português.

## O problema do detector atual

O detector atual faz detecção de **bordas** direto na arte do mapa. Isso pega a textura do chão de pedra, mesas, barris e móveis, gerando centenas de segmentos curtos, quase todos horizontais, espalhados pelo mapa inteiro. **Não use detecção de bordas na imagem.** O novo método detecta o **chão** e traça o contorno dele.

## Método (siga esta ordem)

### 1. Amostragem do chão
- O usuário ativa a ferramenta e **clica no chão do mapa** (comportamento de "varinha mágica"). Permitir clicar em **vários pontos** para somar amostras (ex.: chão de pedra e chão de madeira).
- Pegar a cor de cada ponto clicado fazendo a média de uma pequena área ao redor (ex.: 5x5 pixels) para ignorar ruído.

### 2. Máscara do chão
- Reduzir a imagem para processar rápido (ex.: lado maior de 1000 a 1500 px), guardando o fator de escala para voltar às coordenadas originais.
- Comparar as cores em um espaço perceptual (**CIELAB** ou HSV) em vez de RGB puro.
- Criar a máscara por **flood fill** a partir dos pontos clicados, com **tolerância ajustável**. Aplicar um leve desfoque antes, para a textura de pedra não fragmentar a máscara.
- Aplicar operações morfológicas (fechamento e depois abertura) para unir pedaços do chão e remover pontinhos soltos.

### 3. Limpeza da máscara
- **Preencher buracos pequenos** da máscara: mesas, barris, tapetes, cadeiras e outros móveis dentro do chão **não devem virar paredes**. Controle de "tamanho mínimo do buraco" (em células do grid).
- Remover ilhas muito pequenas fora do chão principal.
- Opção para manter buracos grandes (ex.: pilares ou paredes internas) em vez de preenchê-los.

### 4. Traçar o contorno
- Traçar o contorno da máscara com **marching squares** (ou algoritmo equivalente), gerando polígonos fechados (contorno externo e contornos internos de buracos mantidos).
- Simplificar com **Ramer-Douglas-Peucker**, com tolerância ajustável.

### 5. Alinhar ao grid e limpar
- Pedir/ler o **tamanho do grid** do mapa e **alinhar** os vértices ao grid (ou à metade da célula), com opção de ligar/desligar.
- **Forçar linhas retas**: se um segmento estiver quase horizontal ou vertical (tolerância de ângulo configurável), torná-lo perfeitamente reto.
- **Unir segmentos colineares** consecutivos em um só, e remover segmentos menores que um comprimento mínimo.
- Fechar pequenas frestas entre pontas de segmentos que quase se tocam.

### 6. Prévia antes de aplicar
- Mostrar o resultado como uma **camada semitransparente** sobre o mapa (máscara do chão em cor suave + contorno das paredes), **sem aplicar de verdade** ainda.
- Controles em tempo real: tolerância de cor, tamanho mínimo do buraco, simplificação, alinhamento ao grid, ângulo de linha reta.
- Botões: **Aplicar** (cria as paredes de verdade, num único passo que pode ser **desfeito inteiro com um Ctrl+Z/desfazer**), **Cancelar**, e **Adicionar mais pontos de chão**.
- Depois de aplicado, as paredes devem ser **editáveis** pelas ferramentas que já existem (mover pontos, apagar segmentos, adicionar manualmente).
- **Portas:** não tentar detectar. O usuário marca as portas depois, com a ferramenta existente.

## Requisitos técnicos

- Processar sem travar a interface (usar `OffscreenCanvas`/Web Worker se necessário) e mostrar um indicador de progresso em mapas grandes.
- Funcionar com mapas grandes (ex.: 4000x3000 px) com desempenho aceitável.
- Funcionar bem em tela de toque (celular/tablet), com botões grandes.
- Código organizado em funções pequenas e testáveis: amostragem de cor, máscara, morfologia, contorno, simplificação, alinhamento, união de segmentos.
- Comentários curtos explicando cada etapa.

## Como entregar

1. Mostre em poucas linhas o plano de integração com o meu código atual (qual função recebe os segmentos finais e em que formato).
2. Entregue o módulo pronto, separado do meu código, com instruções curtas de como plugar no botão "Desenhar Parede".
3. Liste no final as suposições que você fez e os parâmetros padrão escolhidos.
