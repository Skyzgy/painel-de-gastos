# Painel de Gastos

Painel simples para acompanhar seus gastos mensais pelo celular ou computador, sem precisar de servidor, banco de dados ou instalação.

## O que ele faz

- Você define seu salário fixo (já vem com R$ 1.700, mas pode alterar).
- Você cadastra as contas do mês (nome, valor, dia do vencimento e categoria).
- Marca cada conta como paga conforme for pagando.
- O painel calcula automaticamente:
  - Quanto já está comprometido em contas fixas (e o % do salário).
  - Quanto ainda sobra livre para "gastar com bobeira" depois de pagar tudo.
  - Uma barra visual mostrando o que já foi pago, o que falta pagar e o que sobra.

## Como usar

Basta abrir o arquivo `index.html` em qualquer navegador — funciona offline. Para acessar pelo celular de forma prática, o mais simples é publicar os arquivos em algum serviço gratuito de páginas estáticas (por exemplo, GitHub Pages a partir deste mesmo repositório) e abrir o link no navegador do celular. Dá pra "adicionar à tela inicial" pelo navegador para ficar com aparência de aplicativo.

## Onde os dados ficam salvos

Os dados são salvos localmente no navegador (localStorage), não em nenhum servidor — ou seja, eles não saem do seu dispositivo. Por isso:

- Se você usar o painel só no celular, os dados ficam só no celular.
- Se quiser usar no computador e no celular, use os botões **Exportar backup** / **Importar backup** para transferir seus dados de um dispositivo para o outro (gera/lê um arquivo `.json`).
- Vale exportar um backup de vez em quando para não perder os dados.

## Arquivos

- `index.html` — estrutura da página.
- `style.css` — visual (tema escuro, pensado para telas de celular).
- `app.js` — toda a lógica: cálculos, cadastro de contas e salvamento local.
