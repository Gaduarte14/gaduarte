# Prompt: Tela inicial de salas (estilo Owlbear Rodeo)

Você é um desenvolvedor sênior de front-end. Crie **somente a tela inicial de salas**, no estilo do Owlbear Rodeo, que leva o usuário para a tela do meu tabletop que **já existe**.

## Escopo (leia com atenção)

- Faça **apenas** esta tela inicial e a navegação dela para a tela existente. Nada de mapa, tokens, chat, fichas ou qualquer outra parte do tabletop.
- **Não altere, não reescreva e não remova nada do código que eu já tenho.** Crie a tela inicial como um módulo/componente separado e conecte por um ponto de integração simples (por exemplo, uma função `onOpenRoom(sala)` ou uma rota).
- A tela do meu tabletop (a "tela de destino") é o hub da campanha: título da campanha com código da sala (ex.: `SALA SINCRONIZADA · OWL-5E26`), nome do usuário, alternância Mestre/Jogador, Exportar/Importar JSON, botão "Entrar na Mesa Tática", "Criar Ficha Rápida", lista de fichas salvas e lista da campanha. Ela já funciona, então **só abra ela**; se precisar ver o código dela para integrar, **me peça o arquivo** em vez de inventar.
- Se algo estiver ambíguo, escolha a opção mais simples e liste as suposições no final.
- Responda em português do Brasil e escreva a interface em português.

## 1. Layout (igual ao Owlbear)

Um painel central grande, com cantos bem arredondados, sobre um fundo escuro azul-arroxeado:

- **Título** "Salas" (cor roxa/lilás) e, embaixo, o subtítulo "Crie uma sala para conectar seus jogadores".
- No canto superior direito do painel: contador **"Salas usadas: 1 de 2"**.
- **Duas abas** em largura total: **MESTRE** e **JOGADOR**. A aba ativa tem uma linha branca embaixo; a inativa fica com fundo um pouco mais escuro.
- Abaixo das abas, a **área de salas**: um painel interno arredondado com os cartões das salas em grade.
- **Cartão de sala**: quadrado com cantos arredondados, imagem da mesa preenchendo todo o quadrado, um degradê escuro na parte de baixo, o **nome da sala** em branco e negrito no canto inferior esquerdo e um **ícone de lápis** (editar) no canto inferior direito.
- Embaixo do painel, um botão largo em formato de pílula, só com borda lilás e texto em maiúsculas: **CRIAR UMA NOVA SALA**.
- Visual geral: tons de azul-acinzentado/roxo, bordas suaves, tipografia sem serifa, texto em maiúsculas nos botões e abas.

## 2. Comportamento

### Criar sala
- "CRIAR UMA NOVA SALA" abre um pequeno modal com: **nome da sala** e **imagem da mesa** (upload, com pré-visualização).
- Limite de salas configurável (começa em **2**, como no contador). Ao atingir o limite, o botão fica desabilitado e mostra uma mensagem curta.
- Ao confirmar, a sala aparece como um novo cartão na aba MESTRE e o contador atualiza.

### Clicar no cartão da sala (o quadrado com a imagem da mesa)
1. Se a sala **ainda não tem imagem**, o cartão mostra um espaço vazio com "Adicionar imagem da mesa". O clique abre o seletor de arquivo para o usuário **adicionar a imagem**.
2. Quando a imagem está definida (ou ao clicar numa sala que já tem imagem), a sala **abre e leva o usuário para a tela do meu tabletop** (a tela de destino descrita acima), já carregada com os dados dessa sala: nome da campanha, código da sala e a imagem como capa da campanha.
3. Deve existir um jeito de voltar da tela do tabletop para esta tela inicial (um botão/link "Voltar às salas"), sem quebrar nada da tela existente.

### Lápis (editar)
- Abre um modal para **trocar o nome**, **trocar a imagem** e **excluir a sala** (com confirmação).

### Aba JOGADOR
- Lista as salas em que o usuário entrou como jogador, no mesmo estilo de cartão.
- Tem um campo e um botão **"Entrar com código"** para entrar numa sala usando o código (ex.: `OWL-5E26`). Ao entrar, o cartão aparece na lista e abre o tabletop com o papel de Jogador.
- Se não houver salas, mostrar um texto vazio amigável.

### Dados e imagens
- Cada sala tem: id, nome, código, imagem da capa, papel (mestre/jogador), data de criação.
- Salvar localmente (por exemplo no `localStorage`/IndexedDB), usando o mesmo mecanismo de armazenamento do meu projeto se você descobrir qual é.
- Redimensionar/comprimir a imagem ao enviar para não estourar o armazenamento.

## 3. Requisitos

- Responsivo e confortável no celular (cartões em 1 ou 2 colunas, botões grandes).
- Animações leves ao passar o mouse/tocar nos cartões.
- Código organizado e fácil de plugar no meu projeto sem mexer no que existe.

## 4. Como entregar

1. Mostre em poucas linhas como vai ser a integração com a minha tela atual (qual função/rota abre o tabletop e o que ela recebe).
2. Entregue a tela inicial pronta, separada do meu código, com instruções curtas de como plugar.
3. Liste no final as suposições que você fez.
