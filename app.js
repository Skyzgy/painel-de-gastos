const CHAVE_STORAGE = "painelGastos:v1";

const CATEGORIAS = {
  moradia: "Moradia",
  contas: "Contas",
  transporte: "Transporte",
  alimentacao: "Alimentação",
  assinaturas: "Assinaturas",
  outros: "Outros",
};

function carregarEstado() {
  const salvo = localStorage.getItem(CHAVE_STORAGE);
  let estado = null;
  if (salvo) {
    try {
      estado = JSON.parse(salvo);
    } catch (e) {
      // ignora storage corrompido e recomeça
    }
  }
  if (!estado) estado = { salario: 1700, gastos: [] };
  if (!estado.periodo) {
    const agora = new Date();
    estado.periodo = { mes: agora.getMonth(), ano: agora.getFullYear() };
  }
  return estado;
}

function formatarMesAno(periodo) {
  const nome = new Date(periodo.ano, periodo.mes, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  return nome.charAt(0).toUpperCase() + nome.slice(1);
}

// Reconhece contas no formato "N/M nome" (parcela N de M) para avançar a contagem a cada mês.
function avancarParcelaNoNome(nome) {
  const match = nome.match(/^(\d+)\/(\d+)(.*)$/);
  if (!match) return nome;
  const atual = parseInt(match[1], 10);
  const total = parseInt(match[2], 10);
  const novoAtual = Math.min(atual + 1, total);
  return `${novoAtual}/${total}${match[3]}`;
}

const MESES_FUTUROS = 6;

// Projeta como uma conta ficaria "passos" meses adiante: avança a parcela no nome
// e informa se a conta já teria acabado (parcela passou do total) nesse mês futuro.
function projetarGasto(nome, passos) {
  const match = nome.match(/^(\d+)\/(\d+)(.*)$/);
  if (!match) return { nome, acabou: false, ultimaParcela: false };
  const total = parseInt(match[2], 10);
  const projetado = parseInt(match[1], 10) + passos;
  if (projetado > total) return { nome, acabou: true, ultimaParcela: false };
  return { nome: `${projetado}/${total}${match[3]}`, acabou: false, ultimaParcela: projetado === total };
}

let estado = carregarEstado();
let idEditando = null;

function salvarEstado() {
  localStorage.setItem(CHAVE_STORAGE, JSON.stringify(estado));
}

function formatarMoeda(valor) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function gerarId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// --- elementos ---
const elSalario = document.getElementById("inputSalario");
const elTotalFixo = document.getElementById("totalFixo");
const elPercent = document.getElementById("percentComprometido");
const elTotalLivre = document.getElementById("totalLivre");
const elStatusLivre = document.getElementById("statusLivre");
const elCardLivre = document.getElementById("cardLivre");
const elBarra = document.getElementById("barraProgresso");
const elLista = document.getElementById("listaGastos");
const elVazio = document.getElementById("msgVazio");
const elFuturos = document.getElementById("listaFuturos");
const elMes = document.getElementById("mesAtual");

const modalFundo = document.getElementById("modalFundo");
const formGasto = document.getElementById("formGasto");
const fNome = document.getElementById("fNome");
const fValor = document.getElementById("fValor");
const fDia = document.getElementById("fDia");
const fCategoria = document.getElementById("fCategoria");
const fPago = document.getElementById("fPago");
const btnExcluir = document.getElementById("btnExcluir");
const formTitulo = document.getElementById("formTitulo");

function render() {
  elMes.textContent = formatarMesAno(estado.periodo);
  elSalario.value = estado.salario;

  const totalFixo = estado.gastos.reduce((soma, g) => soma + g.valor, 0);
  const totalPago = estado.gastos.filter((g) => g.pago).reduce((s, g) => s + g.valor, 0);
  const totalPendente = totalFixo - totalPago;
  const livre = estado.salario - totalFixo;
  const percent = estado.salario > 0 ? (totalFixo / estado.salario) * 100 : 0;

  elTotalFixo.textContent = formatarMoeda(totalFixo);
  elPercent.textContent = `${percent.toFixed(0)}% do salário`;

  elTotalLivre.textContent = formatarMoeda(livre);
  elCardLivre.classList.toggle("negativo", livre < 0);
  elStatusLivre.textContent =
    livre < 0
      ? "suas contas passaram do salário"
      : "pra gastar sem culpa esse mês";

  const pctPago = estado.salario > 0 ? Math.min(100, (totalPago / estado.salario) * 100) : 0;
  const pctPendente = estado.salario > 0 ? Math.min(100 - pctPago, (totalPendente / estado.salario) * 100) : 0;
  elBarra.innerHTML = `
    <div class="seg-pago" style="width:${pctPago}%"></div>
    <div class="seg-pendente" style="width:${pctPendente}%"></div>
  `;

  const gastosOrdenados = [...estado.gastos].sort((a, b) => {
    const diaA = a.dia ?? 32;
    const diaB = b.dia ?? 32;
    return diaA - diaB;
  });

  elLista.innerHTML = "";
  elVazio.style.display = gastosOrdenados.length === 0 ? "block" : "none";

  for (const gasto of gastosOrdenados) {
    const li = document.createElement("li");
    li.className = "item-gasto" + (gasto.pago ? " pago" : "");
    li.dataset.id = gasto.id;

    const metaPartes = [`<span class="categoria-badge">${CATEGORIAS[gasto.categoria] || "Outros"}</span>`];
    if (gasto.dia) metaPartes.push(`vence dia ${gasto.dia}`);

    const parcela = gasto.nome.match(/^(\d+)\/(\d+)/);
    if (parcela && parcela[1] === parcela[2]) {
      metaPartes.push(`<span class="categoria-badge badge-fim">Última parcela</span>`);
    }

    li.innerHTML = `
      <button class="check-pago" data-acao="pago" aria-label="Marcar como pago">${gasto.pago ? "✓" : ""}</button>
      <div class="item-info" data-acao="editar">
        <div class="item-nome">${escapeHtml(gasto.nome)}</div>
        <div class="item-meta">${metaPartes.join(" · ")}</div>
      </div>
      <div class="item-valor numero" data-acao="editar">${formatarMoeda(gasto.valor)}</div>
    `;
    elLista.appendChild(li);
  }

  renderFuturos();
}

function renderFuturos() {
  elFuturos.innerHTML = "";

  for (let passos = 1; passos <= MESES_FUTUROS; passos++) {
    const data = new Date(estado.periodo.ano, estado.periodo.mes + passos, 1);
    const periodoFuturo = { mes: data.getMonth(), ano: data.getFullYear() };

    const itens = estado.gastos
      .map((g) => ({ ...g, proj: projetarGasto(g.nome, passos) }))
      .filter((g) => !g.proj.acabou);

    const totalFixoFuturo = itens.reduce((soma, g) => soma + g.valor, 0);
    const livreFuturo = estado.salario - totalFixoFuturo;

    const details = document.createElement("details");
    details.className = "futuro-mes";
    details.innerHTML = `
      <summary>
        <span class="futuro-label">${formatarMesAno(periodoFuturo)}</span>
        <span class="futuro-valores">
          <span class="numero">${formatarMoeda(totalFixoFuturo)}</span>
          <span class="numero futuro-livre${livreFuturo < 0 ? " negativo" : ""}">${formatarMoeda(livreFuturo)}</span>
        </span>
      </summary>
      <ul class="futuro-lista">
        ${
          itens.length
            ? itens
                .map(
                  (g) => `
          <li>
            <span>${escapeHtml(g.proj.nome)}${g.proj.ultimaParcela ? ' <span class="categoria-badge badge-fim">Última parcela</span>' : ""}</span>
            <span class="numero">${formatarMoeda(g.valor)}</span>
          </li>`
                )
                .join("")
            : '<li class="futuro-vazia">Nenhuma conta fixa prevista</li>'
        }
      </ul>
    `;
    elFuturos.appendChild(details);
  }
}

function escapeHtml(texto) {
  const div = document.createElement("div");
  div.textContent = texto;
  return div.innerHTML;
}

// --- salário ---
elSalario.addEventListener("change", () => {
  const valor = parseFloat(elSalario.value);
  estado.salario = isNaN(valor) ? 0 : valor;
  salvarEstado();
  render();
});

// --- lista: toggle pago / abrir edição ---
elLista.addEventListener("click", (e) => {
  const acao = e.target.closest("[data-acao]")?.dataset.acao;
  const li = e.target.closest(".item-gasto");
  if (!li) return;
  const gasto = estado.gastos.find((g) => g.id === li.dataset.id);
  if (!gasto) return;

  if (acao === "pago") {
    gasto.pago = !gasto.pago;
    salvarEstado();
    render();
  } else if (acao === "editar") {
    abrirForm(gasto);
  }
});

// --- modal ---
function abrirForm(gasto) {
  idEditando = gasto ? gasto.id : null;
  formTitulo.textContent = gasto ? "Editar conta" : "Nova conta";
  fNome.value = gasto?.nome || "";
  fValor.value = gasto?.valor ?? "";
  fDia.value = gasto?.dia ?? "";
  fCategoria.value = gasto?.categoria || "outros";
  fPago.checked = gasto?.pago || false;
  btnExcluir.hidden = !gasto;
  modalFundo.classList.add("ativo");
}

function fecharForm() {
  modalFundo.classList.remove("ativo");
  formGasto.reset();
  idEditando = null;
}

document.getElementById("btnAbrirForm").addEventListener("click", () => abrirForm(null));
document.getElementById("btnCancelar").addEventListener("click", fecharForm);
modalFundo.addEventListener("click", (e) => {
  if (e.target === modalFundo) fecharForm();
});

formGasto.addEventListener("submit", (e) => {
  e.preventDefault();
  const nome = fNome.value.trim();
  const valor = parseFloat(fValor.value);
  if (!nome || isNaN(valor)) return;

  const dados = {
    nome,
    valor,
    dia: fDia.value ? parseInt(fDia.value, 10) : null,
    categoria: fCategoria.value,
    pago: fPago.checked,
  };

  if (idEditando) {
    const gasto = estado.gastos.find((g) => g.id === idEditando);
    Object.assign(gasto, dados);
  } else {
    estado.gastos.push({ id: gerarId(), ...dados });
  }

  salvarEstado();
  render();
  fecharForm();
});

btnExcluir.addEventListener("click", () => {
  if (!idEditando) return;
  estado.gastos = estado.gastos.filter((g) => g.id !== idEditando);
  salvarEstado();
  render();
  fecharForm();
});

// --- backup ---
document.getElementById("btnExportar").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(estado, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `painel-de-gastos-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

const inputImportar = document.getElementById("inputImportar");
document.getElementById("btnImportar").addEventListener("click", () => inputImportar.click());
inputImportar.addEventListener("change", () => {
  const arquivo = inputImportar.files[0];
  if (!arquivo) return;
  const leitor = new FileReader();
  leitor.onload = () => {
    try {
      const dados = JSON.parse(leitor.result);
      if (typeof dados.salario === "number" && Array.isArray(dados.gastos)) {
        estado = dados;
        salvarEstado();
        render();
      } else {
        alert("Arquivo de backup inválido.");
      }
    } catch (e) {
      alert("Não foi possível ler esse arquivo.");
    }
  };
  leitor.readAsText(arquivo);
  inputImportar.value = "";
});

// --- importar extrato do Nubank (CSV) ---
function dividirLinhaCsv(linha) {
  const campos = [];
  let atual = "";
  let dentroDeAspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (c === '"') {
      dentroDeAspas = !dentroDeAspas;
    } else if (c === "," && !dentroDeAspas) {
      campos.push(atual);
      atual = "";
    } else {
      atual += c;
    }
  }
  campos.push(atual);
  return campos.map((c) => c.trim());
}

function extrairDia(dataStr) {
  const isoMatch = dataStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return parseInt(isoMatch[3], 10);
  const brMatch = dataStr.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (brMatch) return parseInt(brMatch[1], 10);
  return null;
}

// Valores do Nubank vem em formato BR: virgula decimal, ponto de milhar,
// e as vezes um espaco depois do sinal de negativo (ex: "- 1.863,81").
function parseValorNubank(str) {
  if (!str) return NaN;
  const limpo = str.trim().replace(/^-\s+/, "-").replace(/\./g, "").replace(",", ".");
  return parseFloat(limpo);
}

// O Nubank descreve parcelas como sufixo ("Nome - Parcela 1/3"); o painel
// reconhece parcelas como prefixo ("1/3 Nome") para poder avança-las ao
// virar o mes, entao a gente reordena aqui.
function normalizarNomeParcela(nome) {
  const match = nome.match(/^(.*?)\s*-?\s*Parcela\s+(\d+)\/(\d+)\s*$/i);
  if (!match) return nome;
  const [, resto, atual, total] = match;
  return `${atual}/${total} ${resto}`;
}

// Reconhece os dois formatos de extrato exportados pelo Nubank: conta
// (Data,Valor,Identificador,Descrição) e fatura do cartão (date,title,amount).
function parsearExtratoNubank(texto) {
  const linhas = texto.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (linhas.length < 2) return [];

  const cabecalho = dividirLinhaCsv(linhas[0]).map((c) => c.toLowerCase());
  const lancamentos = [];

  if (cabecalho.includes("identificador") || cabecalho.includes("descrição") || cabecalho.includes("descricao")) {
    const idxData = cabecalho.indexOf("data");
    const idxValor = cabecalho.indexOf("valor");
    const idxDescricao = cabecalho.findIndex((c) => c.startsWith("descri"));
    for (const linha of linhas.slice(1)) {
      const campos = dividirLinhaCsv(linha);
      const valor = parseValorNubank(campos[idxValor]);
      if (isNaN(valor) || valor >= 0) continue;
      lancamentos.push({
        nome: normalizarNomeParcela(campos[idxDescricao] || "Lançamento"),
        valor: Math.abs(valor),
        dia: extrairDia(campos[idxData] || ""),
      });
    }
  } else if (cabecalho.includes("title") && cabecalho.includes("amount")) {
    const idxDate = cabecalho.indexOf("date");
    const idxTitle = cabecalho.indexOf("title");
    const idxAmount = cabecalho.indexOf("amount");
    for (const linha of linhas.slice(1)) {
      const campos = dividirLinhaCsv(linha);
      const valor = parseValorNubank(campos[idxAmount]);
      if (isNaN(valor) || valor <= 0) continue;
      lancamentos.push({
        nome: normalizarNomeParcela(campos[idxTitle] || "Lançamento"),
        valor,
        dia: extrairDia(campos[idxDate] || ""),
      });
    }
  }

  return lancamentos;
}

const modalExtratoFundo = document.getElementById("modalExtratoFundo");
const listaExtrato = document.getElementById("listaExtrato");
const extratoVazio = document.getElementById("extratoVazio");
const inputExtrato = document.getElementById("inputExtrato");
let lancamentosExtrato = [];

document.getElementById("btnImportarExtrato").addEventListener("click", () => inputExtrato.click());

inputExtrato.addEventListener("change", () => {
  const arquivo = inputExtrato.files[0];
  if (!arquivo) return;
  const leitor = new FileReader();
  leitor.onload = () => {
    lancamentosExtrato = parsearExtratoNubank(leitor.result);
    renderExtrato();
    modalExtratoFundo.classList.add("ativo");
  };
  leitor.readAsText(arquivo, "utf-8");
  inputExtrato.value = "";
});

function renderExtrato() {
  listaExtrato.innerHTML = "";
  extratoVazio.hidden = lancamentosExtrato.length > 0;

  lancamentosExtrato.forEach((l, i) => {
    const li = document.createElement("li");
    li.className = "extrato-item";
    li.innerHTML = `
      <label class="extrato-linha">
        <input type="checkbox" data-idx="${i}">
        <span class="extrato-nome">${escapeHtml(l.nome)}</span>
        <span class="extrato-valor numero">${formatarMoeda(l.valor)}</span>
      </label>
    `;
    listaExtrato.appendChild(li);
  });
}

document.getElementById("btnCancelarExtrato").addEventListener("click", () => {
  modalExtratoFundo.classList.remove("ativo");
  lancamentosExtrato = [];
});
modalExtratoFundo.addEventListener("click", (e) => {
  if (e.target === modalExtratoFundo) modalExtratoFundo.classList.remove("ativo");
});

document.getElementById("btnConfirmarExtrato").addEventListener("click", () => {
  const marcados = listaExtrato.querySelectorAll("input[type=checkbox]:checked");
  marcados.forEach((chk) => {
    const l = lancamentosExtrato[parseInt(chk.dataset.idx, 10)];
    estado.gastos.push({
      id: gerarId(),
      nome: l.nome,
      valor: l.valor,
      dia: l.dia,
      categoria: "outros",
      pago: false,
    });
  });
  salvarEstado();
  render();
  modalExtratoFundo.classList.remove("ativo");
  lancamentosExtrato = [];
});

// --- virar o mês ---
document.getElementById("btnAvancarMes").addEventListener("click", () => {
  const proximo = new Date(estado.periodo.ano, estado.periodo.mes + 1, 1);
  const nomeProximo = formatarMesAno({ mes: proximo.getMonth(), ano: proximo.getFullYear() });

  const confirmou = confirm(
    `Virar para ${nomeProximo}?\n\nAs parcelas (ex: 1/10) avançam um número e todas as contas voltam a ficar como "a pagar".`
  );
  if (!confirmou) return;

  estado.periodo = { mes: proximo.getMonth(), ano: proximo.getFullYear() };
  for (const gasto of estado.gastos) {
    gasto.nome = avancarParcelaNoNome(gasto.nome);
    gasto.pago = false;
  }
  salvarEstado();
  render();
});

render();
