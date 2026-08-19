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
  if (salvo) {
    try {
      return JSON.parse(salvo);
    } catch (e) {
      // ignora storage corrompido e recomeça
    }
  }
  return { salario: 1700, gastos: [] };
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

// --- mês atual ---
const nomeMes = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
elMes.textContent = nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1);

render();
