/* ==========================================================
   EQUIPAMENTOS — INTEGRAÇÃO COM O INVENTÁRIO DA FICHA
   Módulo independente e autocontido, adicionado sobre a
   arquitetura já existente. NÃO refaz o Compêndio, NÃO recria
   EQUIPAMENTOS_DATA e NÃO duplica os equipamentos:

     COMPÊNDIO → EQUIPAMENTOS (js/equipamentos.js, já pronto)
            │
            │ ID (window.Equipamentos.findItemById)
            ↓
     AGENTES → INVENTÁRIO (#tab-inventario, já existente)

   ARMAZENAMENTO: este módulo NÃO cria nenhum localStorage, chave ou
   estrutura de persistência nova. O Inventário já existe por ficha
   (ver INVENTÁRIO em index.html: invItems / saveInventory() /
   loadInventory() / inventoryStorageKey()) — este módulo só EMPURRA
   itens novos para o MESMO array global "invItems" já usado por
   esse sistema, no formato:

     { eqRef: "<id em EQUIPAMENTOS_DATA>" }

   ou seja, guarda a REFERÊNCIA, nunca uma cópia dos dados do
   equipamento (nome, dano, peso etc. continuam vivendo só em
   EQUIPAMENTOS_DATA). saveAgent()/loadAgent()/duplicateSheet()/
   exportAgentJSON()/importAgentJSONFile() já tratam invItems como
   um array opaco — nenhuma dessas funções precisou ser alterada
   para o Inventário salvar, carregar, duplicar e exportar/importar
   estes itens automaticamente, exatamente como já fazem com os
   itens manuais (nome/qtd/peso/desc).

   RENDERIZAÇÃO NO INVENTÁRIO: como cada item referenciado precisa
   mostrar só o nome (e não os campos de qtd/peso/desc que os itens
   manuais têm), renderInventory() — já existente em index.html —
   recebeu um pequeno trecho a mais dentro do mesmo forEach para
   identificar `item.eqRef` e desenhar um card simplificado e
   clicável (ver comentário lá). Esse é o único trecho de
   index.html tocado por esta etapa, e só ali — nenhuma outra parte
   do Inventário, da ficha ou do restante do projeto foi alterada.

   ESTE ARQUIVO cuida apenas de:
     1) o botão "+ Adicionar Item" (já presente no HTML de
        #tab-inventario, esta é só a ligação do clique);
     2) o modal de seleção, que lista/filtra/pesquisa os
        equipamentos existentes em EQUIPAMENTOS_DATA (via
        window.Equipamentos.data/catOrder/catLabels — nenhuma
        segunda lista é criada) e adiciona a referência escolhida
        ao invItems da ficha aberta.

   Os filtros deste modal são construídos dinamicamente a partir de
   window.Equipamentos.catOrder/catLabels — se novas categorias
   forem somadas a EQUIPAMENTOS_DATA no futuro, os filtros aqui
   acompanham automaticamente, sem precisar tocar este arquivo.

   Namespace: nenhum novo objeto global é necessário — este módulo
   não precisa ser chamado por outros arquivos.

   ----------------------------------------------------------
   ETAPA 3 — SINCRONIZAÇÃO COM "AGENTES → ITENS DO AGENTE"
   ----------------------------------------------------------
   A ficha já possui um campo próprio, existente antes desta
   integração: <textarea id="itens"> (painel "Itens do Agente", em
   #tab-agentes), com anotação livre do usuário, salvo/carregado pelo
   mesmo mecanismo genérico de agentFieldIds() — ESTE CAMPO NÃO É
   TOCADO. Nada é lido dele, nada é escrito nele, e o "Peso Total"
   (#peso_total) ao lado também continua exatamente como estava.

   O que este módulo faz é somar, logo abaixo dessa textarea (sem
   remover nem mover nada existente no painel), uma pequena área
   NOVA e SOMENTE VISUAL, reconstruída a cada renderização do
   Inventário: um card clicável para cada referência ("eqRef")
   presente em invItems — a MESMA fonte de dados já usada pelo
   Inventário, sem nenhum array/armazenamento paralelo. Não existe
   "adicionar"/"remover" nesta área: qualquer alteração só é feita
   pelo Inventário (instrução 8 do pedido), e a área aqui é só um
   espelho dele.

   Sincronização: como TODOS os pontos do projeto que alteram
   invItems (adicionar, remover, carregar ficha, importar JSON, nova
   ficha) já passam por um único ponto em comum — a função global
   renderInventory() (index.html) — este módulo apenas ENVOLVE essa
   função (mesmo padrão já usado por character-connections.js ao
   envolver openSheet()/createNewSheet()), chamando o render desta
   área nova logo depois do render original do Inventário. Nenhuma
   linha de index.html precisou ser tocada para esta etapa.

   ----------------------------------------------------------
   ETAPA 4 — ITEM PERSONALIZADO (SISTEMA "ADICIONAR" JÁ EXISTENTE
   DO INVENTÁRIO) TAMBÉM APARECE EM ITENS, E PESO TOTAL AUTOMÁTICO
   ----------------------------------------------------------
   O Inventário já possui, além dos equipamentos do Compêndio, o
   sistema de criar/adicionar um item próprio (campos #inv_nome/
   #inv_qtd/#inv_peso/#inv_desc + botão #btn_inv_add, já existentes
   em index.html) — isso já empurra o item direto para o MESMO
   invItems (sem eqRef, só nome/qtd/peso/desc). Nada disso foi
   criado por este módulo nem precisou ser alterado: só passou a ser
   RECONHECIDO também pela sincronização com ITENS (acima) e pelo
   cálculo do Peso Total (abaixo), tratando um item com eqRef e um
   item manual como duas "formas" do mesmo Inventário.

   Popup do item personalizado: como esse tipo de item não existe em
   EQUIPAMENTOS_DATA (não tem ID no Compêndio), não há como reabrir
   window.Equipamentos.openItemModal() para ele — por isso este
   módulo monta um modal próprio (#eqinv_custom_modal), mas
   reaproveitando a MESMA estrutura genérica de popup já usada por
   todo o projeto (".modal-overlay"/".modal-box"/".cx-modal-box"/
   ".cx-modal-section"/".modal-actions"), só populada com os dados
   que o próprio item já tem (nome/qtd/peso/desc) — nenhum dado novo,
   nenhuma segunda biblioteca.

   Peso Total (#peso_total, painel "Itens do Agente"): já existia
   como campo numérico digitado à mão. Passa a ser somado
   automaticamente a partir do MESMO invItems (peso de cada
   equipamento vem de EQUIPAMENTOS_DATA via eqRef; peso de cada item
   manual vem do próprio item, multiplicado pela qtd já existente
   nele) — mesmo cálculo que #inv_peso_total (Inventário) já faz,
   sem duplicar essa lógica em nenhum outro lugar novo. Nunca é
   salvo como um dado à parte: é recalculado do zero (e sobrescrito
   na tela) toda vez que renderInventory() roda, então mesmo que um
   valor antigo digitado à mão tenha sido salvo antes desta etapa,
   ele é substituído assim que a ficha é aberta ou o Inventário muda.
   Passa a ser somente leitura (definido em runtime por este script,
   sem alterar o atributo no HTML) para deixar claro que não deve
   mais ser digitado manualmente.
   ========================================================== */
(function () {
  "use strict";

  var pickerActiveFilter = "todas";

  function esc(s){
    if (typeof escapeHtml === "function") return escapeHtml(s);
    var d = document.createElement("div");
    d.textContent = (s === undefined || s === null) ? "" : String(s);
    return d.innerHTML;
  }

  /* ---------- adicionar/renderizar reaproveitando o Inventário já existente ---------- */

  // Adiciona SEMPRE uma nova referência (permite o mesmo equipamento
  // várias vezes na ficha — instrução 11: não há checagem de
  // duplicidade aqui, cada clique em "Adicionar" soma mais um item).
  function addEquipmentToSheet(id){
    if (typeof invItems === "undefined") return;
    invItems.push({ eqRef: id });
    if (typeof renderInventory === "function") renderInventory();
    if (typeof saveInventory === "function") saveInventory();
  }

  /* ==========================================================
     MODAL "ADICIONAR EQUIPAMENTO"
     Reaproveita a MESMA estrutura genérica de modal
     (".modal-overlay"/".modal-box") e os MESMOS componentes visuais
     já usados pelo Compêndio de Equipamentos e por outros pickers do
     projeto (".field"/".cx-filters"/".cx-filter-btn") — nenhum
     sistema de popup novo é criado.
     ========================================================== */

  function ensurePickerModal(){
    if (document.getElementById("eqinv_picker_modal")) return;

    var overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.id = "eqinv_picker_modal";
    overlay.innerHTML =
      '<div class="modal-box eqinv-picker-box">' +
        '<button type="button" class="eqinv-picker-close" id="eqinv_picker_close">&times;</button>' +
        '<h3>Adicionar Equipamento</h3>' +
        '<div class="field eqinv-picker-search-row"><label>Pesquisar</label>' +
          '<input type="text" id="eqinv_picker_search" placeholder="Nome do equipamento…"></div>' +
        '<div id="eqinv_picker_filters" class="cx-filters"></div>' +
        '<div id="eqinv_picker_count" class="note eqinv-picker-count"></div>' +
        '<div id="eqinv_picker_list" class="eqinv-picker-list"></div>' +
      '</div>';
    document.body.appendChild(overlay);

    document.getElementById("eqinv_picker_close").addEventListener("click", closePickerModal);
    overlay.addEventListener("click", function(e){
      if (e.target.id === "eqinv_picker_modal") closePickerModal();
    });

    document.getElementById("eqinv_picker_search").addEventListener("input", renderPickerList);
  }

  function renderPickerFilters(){
    var wrap = document.getElementById("eqinv_picker_filters");
    if (!wrap || wrap.dataset.built) return;
    if (!window.Equipamentos || !window.Equipamentos.catOrder || !window.Equipamentos.catLabels) return;

    var order = window.Equipamentos.catOrder;
    var labels = window.Equipamentos.catLabels;

    var html = '<button type="button" class="cx-filter-btn cx-filter-all active" data-eqinvfilter="todas">Todas</button>';
    order.forEach(function(key){
      html += '<button type="button" class="cx-filter-btn cx-equipamento" data-eqinvfilter="' + esc(key) + '"><span class="dot"></span>' + esc(labels[key] || key) + '</button>';
    });
    wrap.innerHTML = html;
    wrap.dataset.built = "1";

    wrap.querySelectorAll("[data-eqinvfilter]").forEach(function(btn){
      btn.addEventListener("click", function(){
        pickerActiveFilter = btn.getAttribute("data-eqinvfilter");
        wrap.querySelectorAll("[data-eqinvfilter]").forEach(function(b){ b.classList.remove("active"); });
        btn.classList.add("active");
        renderPickerList();
      });
    });
  }

  function renderPickerList(){
    var list = document.getElementById("eqinv_picker_list");
    var countEl = document.getElementById("eqinv_picker_count");
    if (!list || !window.Equipamentos) return;

    var searchEl = document.getElementById("eqinv_picker_search");
    var q = ((searchEl && searchEl.value) || "").toLowerCase().trim();
    var catLabel = window.Equipamentos.catLabel || function(k){ return k; };

    var items = window.Equipamentos.data.slice();
    if (pickerActiveFilter !== "todas"){
      items = items.filter(function(it){ return it.categoria === pickerActiveFilter; });
    }
    if (q){
      items = items.filter(function(it){ return it.nome.toLowerCase().indexOf(q) !== -1; });
    }

    if (countEl) countEl.textContent = items.length + " resultado" + (items.length === 1 ? "" : "s");

    list.innerHTML = "";
    if (items.length === 0){
      var empty = document.createElement("div");
      empty.className = "eqinv-picker-empty";
      empty.textContent = "Nenhum equipamento encontrado para este filtro/pesquisa.";
      list.appendChild(empty);
      return;
    }

    items.forEach(function(it){
      var row = document.createElement("div");
      row.className = "eqinv-picker-row cx-equipamento";
      row.innerHTML =
        '<div class="eqinv-picker-row-body">' +
          '<div class="eqinv-picker-row-title">' + esc(it.nome) + '</div>' +
          '<div class="eqinv-picker-row-cat">' + esc(catLabel(it.categoria)) + (it.subtipo ? " · " + esc(it.subtipo) : "") + '</div>' +
        '</div>' +
        '<button type="button" class="eqinv-picker-add-btn">Adicionar</button>';

      row.querySelector(".eqinv-picker-add-btn").addEventListener("click", function(e){
        e.stopPropagation();
        addEquipmentToSheet(it.id);
      });

      list.appendChild(row);
    });
  }

  function openPickerModal(){
    if (!currentAgentIdReady()) return;
    ensurePickerModal();
    pickerActiveFilter = "todas";
    var wrap = document.getElementById("eqinv_picker_filters");
    if (wrap){
      wrap.querySelectorAll("[data-eqinvfilter]").forEach(function(b){ b.classList.remove("active"); });
      var allBtn = wrap.querySelector('[data-eqinvfilter="todas"]');
      if (allBtn) allBtn.classList.add("active");
    }
    var searchEl = document.getElementById("eqinv_picker_search");
    if (searchEl) searchEl.value = "";
    renderPickerFilters();
    renderPickerList();
    document.getElementById("eqinv_picker_modal").style.display = "flex";
  }

  function closePickerModal(){
    var m = document.getElementById("eqinv_picker_modal");
    if (m) m.style.display = "none";
  }

  // Reaproveita currentAgentId (já existente/global) só para avisar
  // o usuário caso tente adicionar item sem nenhuma ficha aberta —
  // não altera em nada o fluxo de abertura/criação de fichas.
  function currentAgentIdReady(){
    if (typeof currentAgentId !== "undefined" && currentAgentId){
      return true;
    }
    alert("Abra ou crie uma ficha antes de adicionar itens ao Inventário.");
    return false;
  }

  /* ==========================================================
     "AGENTES → ITENS DO AGENTE" — ESPELHO SOMENTE VISUAL DO INVENTÁRIO
     Não cria nenhum array novo: lê invItems (mesma fonte do
     Inventário) a cada chamada e desenha um card clicável por item,
     na mesma ordem em que aparecem no Inventário — tanto para
     equipamentos do Compêndio (item.eqRef) quanto para itens
     personalizados criados pelo sistema "Adicionar" já existente do
     Inventário (item.nome, sem eqRef).
     ========================================================== */

  function ensureItensSection(){
    if (document.getElementById("eqinv_itens_list")) return;
    var textarea = document.getElementById("itens");
    if (!textarea) return;
    var wrap = document.createElement("div");
    wrap.id = "eqinv_itens_wrap";
    wrap.className = "eqinv-itens-wrap";
    wrap.innerHTML =
      '<div class="eqinv-itens-label">Itens do Inventário</div>' +
      '<div id="eqinv_itens_list" class="eqinv-itens-list"></div>';
    textarea.insertAdjacentElement("afterend", wrap);
  }

  function renderItensFromInventory(){
    ensureItensSection();
    var list = document.getElementById("eqinv_itens_list");
    if (!list) return;

    var items = (typeof invItems !== "undefined") ? invItems : [];

    if (items.length === 0){
      list.innerHTML = '<div class="empty-state">Nenhum item no Inventário ainda.</div>';
      return;
    }

    list.innerHTML = "";
    items.forEach(function(item){
      if (!item) return;
      var chip = document.createElement("button");
      chip.type = "button";
      chip.className = "eqinv-item-chip";

      if (item.eqRef){
        var eqIt = (window.Equipamentos && typeof window.Equipamentos.findItemById === "function")
          ? window.Equipamentos.findItemById(item.eqRef) : null;
        if (eqIt){
          chip.textContent = eqIt.nome;
          chip.addEventListener("click", function(){ window.Equipamentos.openItemModal(item.eqRef); });
        } else {
          chip.textContent = "Equipamento não encontrado";
          chip.classList.add("eqinv-item-chip-missing");
          chip.disabled = true;
        }
      } else if (item.nome){
        chip.textContent = item.nome;
        chip.addEventListener("click", function(){ openCustomItemModal(item); });
      } else {
        return;
      }

      list.appendChild(chip);
    });
  }

  /* ==========================================================
     POPUP DO ITEM PERSONALIZADO
     Reaproveita a MESMA estrutura genérica de modal
     (".modal-overlay"/".modal-box"/".cx-modal-box"/
     ".cx-modal-section"/".modal-actions") já usada por todos os
     outros popups do projeto — nenhum sistema de popup novo é
     criado. Só é usada para itens do Inventário que NÃO vieram do
     Compêndio (sem eqRef): equipamentos com eqRef continuam abrindo
     window.Equipamentos.openItemModal(), como já acontecia.
     ========================================================== */

  function ensureCustomItemModal(){
    if (document.getElementById("eqinv_custom_modal")) return;
    var overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.id = "eqinv_custom_modal";
    overlay.innerHTML =
      '<div class="modal-box cx-modal-box eqinv-custom-modal-box">' +
        '<h3 id="eqinv_custom_modal_title"></h3>' +
        '<div class="cx-modal-section" id="eqinv_custom_modal_stats"></div>' +
        '<div class="cx-modal-section" id="eqinv_custom_modal_desc_wrap" style="display:none;"><p id="eqinv_custom_modal_desc" style="white-space:pre-wrap;"></p></div>' +
        '<div class="modal-actions" style="margin-top:14px; justify-content:flex-end;">' +
          '<button type="button" id="eqinv_custom_modal_close">Fechar</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    document.getElementById("eqinv_custom_modal_close").addEventListener("click", closeCustomItemModal);
    overlay.addEventListener("click", function(e){
      if (e.target.id === "eqinv_custom_modal") closeCustomItemModal();
    });
  }

  function openCustomItemModal(item){
    ensureCustomItemModal();
    document.getElementById("eqinv_custom_modal_title").textContent = item.nome || "Item";

    var statsHtml = "";
    if (item.qtd) statsHtml += '<p><strong>Quantidade:</strong> ' + esc(item.qtd) + '</p>';
    if (item.peso) statsHtml += '<p><strong>Peso:</strong> ' + esc(item.peso) + ' kg</p>';
    document.getElementById("eqinv_custom_modal_stats").innerHTML = statsHtml;

    var descWrap = document.getElementById("eqinv_custom_modal_desc_wrap");
    if (item.desc){
      document.getElementById("eqinv_custom_modal_desc").textContent = item.desc;
      descWrap.style.display = "";
    } else {
      descWrap.style.display = "none";
    }

    document.getElementById("eqinv_custom_modal").style.display = "flex";
  }

  function closeCustomItemModal(){
    var m = document.getElementById("eqinv_custom_modal");
    if (m) m.style.display = "none";
  }

  /* ==========================================================
     PESO TOTAL (AGENTES → ITENS DO AGENTE) — SOMA AUTOMÁTICA
     Reaproveita o MESMO campo #peso_total já existente (não cria
     campo novo) e o MESMO invItems do Inventário — nunca é
     armazenado à parte: é recalculado sempre que o Inventário é
     renderizado (ver wrapRenderInventory) e o valor em tela é
     apenas o resultado dessa soma, nunca um dado independente.
     ========================================================== */

  // Peso de um único item do Inventário. Segue a MESMA regra já
  // usada pelo Inventário (#inv_peso_total) para itens manuais
  // (peso × qtd); para equipamentos do Compêndio, usa o peso já
  // cadastrado em EQUIPAMENTOS_DATA (cada referência em invItems já
  // representa uma unidade — duplicar o mesmo equipamento na ficha
  // significa duplicar a entrada no array, não uma "qtd" maior).
  // Nunca retorna NaN/undefined: qualquer peso ausente ou inválido
  // (texto não numérico, campo vazio, equipamento não encontrado)
  // conta como 0, sem gerar erro no console.
  function pesoDoItem(item){
    if (!item) return 0;
    if (item.eqRef){
      var eqIt = (window.Equipamentos && typeof window.Equipamentos.findItemById === "function")
        ? window.Equipamentos.findItemById(item.eqRef) : null;
      var p = eqIt ? parseFloat(eqIt.peso) : NaN;
      return isNaN(p) ? 0 : p;
    }
    var peso = parseFloat(item.peso);
    var qtd = parseInt(item.qtd, 10);
    return (isNaN(peso) ? 0 : peso) * (isNaN(qtd) ? 1 : qtd);
  }

  function recomputePesoTotalAgente(){
    var el = document.getElementById("peso_total");
    if (!el) return;
    var items = (typeof invItems !== "undefined") ? invItems : [];
    var total = items.reduce(function(sum, item){ return sum + pesoDoItem(item); }, 0);
    el.value = total.toFixed(1);
  }

  // O usuário não deve mais digitar este campo à mão (instrução 13
  // do pedido) — deixado somente leitura em runtime, sem alterar o
  // atributo no HTML.
  function ensurePesoTotalReadOnly(){
    var el = document.getElementById("peso_total");
    if (el) el.readOnly = true;
  }

  // Envolve renderInventory() (já existente, global) para reconstruir
  // esta área toda vez que o Inventário for renderizado — cobre
  // automaticamente todos os pontos que já chamam renderInventory()
  // hoje (adicionar/remover item, abrir ficha, nova ficha, importar
  // JSON), sem precisar alterar nenhum deles.
  function wrapRenderInventory(){
    if (typeof renderInventory !== "function") return;
    var _origRenderInventory = renderInventory;
    renderInventory = function(){
      _origRenderInventory();
      renderItensFromInventory();
      recomputePesoTotalAgente();
    };
  }

  /* ---------- boot ---------- */
  function init(){
    var btn = document.getElementById("eqinv_add_btn");
    if (btn) btn.addEventListener("click", openPickerModal);
    ensureItensSection();
    ensurePesoTotalReadOnly();
    wrapRenderInventory();
    renderItensFromInventory();
    recomputePesoTotalAgente();
  }

  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
