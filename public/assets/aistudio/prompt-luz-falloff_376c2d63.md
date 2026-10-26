# Prompt: luz com falloff (apaga gradualmente até o limite)

Copie tudo abaixo e cole na outra IA.

---

Já existe um sistema de luz no meu tabletop virtual. **NÃO reescreva o sistema nem mude o que já funciona** (raio da luz, cor, posição, paredes/colisão, portas, névoa). Mude **só** o jeito como a intensidade da luz se comporta com a distância.

## Comportamento atual

A luz ilumina com a mesma força em todo o raio e corta de repente na borda.

## Comportamento desejado (falloff)

- **Perto da fonte (centro):** luz com intensidade máxima.
- **Conforme se afasta:** a intensidade cai gradualmente, ficando cada vez mais apagada.
- **No limite do raio que eu defini:** intensidade 0, **sem corte seco**. A luz some suavemente, sem anel nem borda visível.
- O raio máximo continua sendo o que eu configuro hoje. Não aumente nem diminua esse alcance.

## Como fazer

1. Descubra no código atual como a luz é desenhada (gradiente, máscara, canvas, shader etc.) e altere **esse** trecho, mantendo a estrutura.
2. Use um gradiente radial com vários pontos de parada (stops), ou uma função de atenuação por distância (`d = distância / raio`):
   - suave e natural: `intensidade = (1 - d²)²`, ou um smoothstep invertido;
   - nunca uma queda linear dura nem corte em `d = 1`.
3. Se a luz hoje é um recorte (buraco na escuridão), faça a transparência variar com a distância: totalmente clara no centro e voltando à escuridão da cena no limite.
4. A luz continua respeitando **paredes e portas**: o falloff é aplicado só dentro da área que a luz realmente alcança.
5. Crie **1 parâmetro simples** para ajustar a suavidade (ex.: `falloff`, de 0 = luz uniforme até 1 = apaga bem rápido), com um valor padrão agradável.
6. Mantenha a performance: não recalcule por pixel em JavaScript se o canvas ou o gradiente nativo resolve.

## Verificação

- Com a luz ligada, o centro está mais claro que a metade do raio, que está mais claro que a borda.
- Na borda do raio não aparece linha, anel nem degrau.
- Duas luzes sobrepostas somam de forma natural, sem estourar o branco.
- Mover o token com luz continua fluido e as paredes continuam bloqueando.

Entregue só o código alterado e diga em 2 ou 3 linhas o que mudou e onde.
