# Prompt: Sistema de Notas / Ficha em Texto (estilo Quest Portal)

Você é um desenvolvedor sênior de front-end. Sua tarefa é criar **somente** o sistema de **blocos de nota / ficha em texto** no estilo do Quest Portal, para ser encaixado no meu tabletop de RPG que já existe.

## Escopo (leia com atenção)

- Faça **apenas** o sistema de notas descrito abaixo. Nada de mapa, tokens, chat, iniciativa, névoa, sincronização ou qualquer outra parte de VTT.
- **Não altere, não reescreva e não remova nada do código que eu já tenho.** Crie o sistema de notas como um módulo/componente separado.
- A ligação com os dados (rolagens) deve ser feita por um ponto de integração simples: o botão ou expressão da nota chama uma função de rolagem recebida de fora (ex.: `onRoll(expressao, origem)`). Deixe essa função fácil de conectar ao meu sistema de dados existente. Se precisar saber como meu sistema de dados funciona, **me peça** o arquivo/trecho em vez de inventar.
- Se algo estiver ambíguo, escolha a opção mais simples e liste as suposições no final.
- Responda em português do Brasil.

## Ideia central

Quando a pessoa escreve no Discord, ela pode usar vários símbolos para marcar o texto. Quero esse mesmo estilo nas notas. A **ficha do personagem é um bloco de texto**, e isso permite montá-la literalmente do jeito que a pessoa quiser, sem formulário fixo.

Exemplo do que deve funcionar:

```
# Ficha do Josino

**Força** 1d20-100
**Bobeza** 1d20+ 100

-# use as habilidades de Josino em sequência para ele não explodir
```

## 1. Markdown estilo Discord

Renderizar o texto marcado, no mínimo:

- `#`, `##`, `###` títulos
- `-# texto` subtexto pequeno/cinza (como no exemplo acima)
- `**negrito**`, `*itálico*`, `__sublinhado__`, `~~riscado~~`
- `> citação`, listas com `-` e `1.`, linha `---`
- `` `código` `` e blocos de código
- tabelas markdown (renderizadas como tabelas de verdade; com rolagem horizontal no celular)

## 2. Modificadores e cálculos ligados à ficha

- A pessoa pode **criar modificadores para fazer as contas matemáticas por ela**, ou simplesmente **ligar os modificadores na ficha**.
- Exemplo do comportamento esperado: ao alterar a **Destreza** na ficha (que é um bloco de texto), todas as coisas que dependem dela mudam sozinhas: perícias de Destreza, CA, modificador de ataque, testes de resistência, CD de teste, etc.
- Para isso, o texto deve permitir **definir valores/variáveis** e **usá-los em fórmulas** dentro da própria nota (você escolhe uma sintaxe simples e clara, por exemplo variáveis entre colchetes e fórmulas entre chaves, e me explica no final).
- Variáveis podem depender de outras variáveis. Mudou a base, recalcula tudo que depende dela.
- Fórmulas com as operações básicas (+, -, *, /, parênteses) e funções úteis (arredondar para baixo/cima, mínimo, máximo).
- Mostrar o valor calculado de forma visível na nota e avisar em caso de erro ou referência circular.
- Não usar `eval()`; fazer um avaliador de fórmulas próprio e seguro.

## 3. Notas de mecânicas com tabelas e botões

- A pessoa pode criar uma **nota de mecânicas**: colocar **tabelas direto na nota** e/ou colocar **para rolar dados direto da nota**.
- Dentro da nota, ela usa muito markdown e **botões para cálculos**.
- Botões devem poder: rolar uma expressão de dados (via a função de integração `onRoll`), fazer um cálculo, e usar variáveis da ficha (ex.: um botão de ataque que soma o modificador atual da ficha).
- Expressões de dados escritas no texto (como `1d20-100` ou `1d20+ 100`, aceitando espaços) devem ser clicáveis para rolar.
- Tabelas podem ter células com rolagens/botões.

## 4. Editor

- Dois modos: **editar** (texto cru) e **ler/jogar** (texto renderizado com botões e rolagens ativos).
- Várias notas por personagem (ficha, mecânicas, inventário, anotações), em abas ou lista.
- Salvamento automático.
- Funcionar bem no celular.

## 5. Como entregar

1. Primeiro me mostre em poucas linhas a sintaxe que você escolheu para variáveis, fórmulas e botões, com um exemplo de ficha completa.
2. Depois entregue o módulo pronto, separado do meu código, com instruções curtas de como plugar e como conectar o `onRoll` ao meu sistema de dados.
3. Liste no final as suposições que você fez.
