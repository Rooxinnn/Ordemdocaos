/* ==========================================================
   CONEXÕES DA FICHA — ETAPA 2
   Sistema independente e autocontido, adicionado sobre a
   arquitetura já existente. NÃO recria o Compêndio de Conexões
   (CONEXOES_DATA / renderConexoes / openConexaoModal continuam
   exatamente como estão) e NÃO cria uma segunda biblioteca:
   apenas guarda, por ficha, uma lista de REFERÊNCIAS (o nome de
   cada Conexão, que já é único dentro de CONEXOES_DATA) e usa
   essas referências para:

     PARANORMAL → "Minhas Conexões"   (gerenciamento: add/remover)
     AGENTES → "Conexão"              (reflexo automático da ficha)

   Armazenamento: NÃO cria um localStorage/chave separada. A lista
   de referências fica num <input type="hidden" id="agente_conexoes_ids">
   dentro de #tab-agentes — ou seja, é só mais um campo que
   agentFieldIds() já varre sozinho, então saveAgent()/loadAgent()/
   duplicateSheet()/export-import já salvam, carregam e duplicam
   essa lista automaticamente, exatamente como fazem hoje com
   hab50_unlocked e aborto_limbico_habilidades — nenhuma dessas
   funções precisou ser reescrita.

   Este arquivo só ENVOLVE (sem redefinir) openSheet() e
   createNewSheet(), do mesmo jeito que a Bandeja de Rolagens já
   faz mais abaixo no projeto, para trocar de "dono" junto com a
   troca/criação de ficha.
   ========================================================== */
(function(){

  var HIDDEN_FIELD_ID = "agente_conexoes_ids";
  var pickerActiveFilter = "todas";

  /* ==========================================================
     PERSONALIZADAS
     Conteúdo criado pelo próprio usuário (Conexão/Habilidade/
     Técnica/Outro). NÃO entra em CONEXOES_DATA — é uma camada
     separada, guardada com a MESMA infraestrutura de storage que
     Inventário e Paranormal já usam (storageGet/storageSet,
     definidas no index.html), só que numa chave própria:
     "conexoes:personalizadas". Nenhum localStorage/API novo.

     Uma personalizada adicionada a uma ficha usa a mesma lista de
     referências (#agente_conexoes_ids) que as Conexões oficiais já
     usam — só que a referência tem o prefixo "custom:" + id, em vez
     do nome, porque nomes de personalizadas não são garantidamente
     únicos. findConnByRef() reconhece esse prefixo e resolve para a
     personalizada certa; todo o resto (dedupe, remover, persistência
     por ficha, duplicação de ficha) continua sendo o mesmo mecanismo
     de sempre, sem nenhuma alteração.
     ========================================================== */

  var PERSONALIZADAS_KEY = "conexoes:personalizadas";
  var CUSTOM_REF_PREFIX = "custom:";
  var CUSTOM_TIPOS = ["Conexão", "Habilidade", "Técnica", "Outro"];
  var personalizadas = [];
  var personalizadasLoaded = false;

  function genCustomId(){
    return "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  async function loadPersonalizadas(){
    if(typeof storageGet !== "function") { personalizadasLoaded = true; return; }
    try{
      var raw = await storageGet(PERSONALIZADAS_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      personalizadas = Array.isArray(arr) ? arr : [];
    }catch(e){
      personalizadas = [];
    }
    personalizadasLoaded = true;
  }

  async function savePersonalizadas(){
    if(typeof storageSet !== "function") return;
    await storageSet(PERSONALIZADAS_KEY, JSON.stringify(personalizadas));
  }

  // Converte o registro salvo (nome, tipo, etiqueta, desc, obs, id) para
  // o mesmo "formato de entrada" usado pelas Conexões oficiais (n, d, dl),
  // para que dimLabel()/symSrc()/os cards reaproveitem o código já existente
  // sem precisar de um caminho de renderização paralelo.
  function toCustomEntry(p){
    return {
      n: p.n, d: "personalizada", dl: "Personalizada",
      custom: true, id: p.id, tipo: p.tipo, etiqueta: p.etiqueta,
      desc: p.desc, obs: p.obs
    };
  }

  function getPersonalizadas(){
    return personalizadas.map(toCustomEntry);
  }

  function findPersonalizadaRaw(id){
    for(var i = 0; i < personalizadas.length; i++){
      if(personalizadas[i].id === id) return personalizadas[i];
    }
    return null;
  }

  async function upsertPersonalizada(data, editId){
    if(editId){
      var existing = findPersonalizadaRaw(editId);
      if(!existing) return null;
      existing.n = data.n; existing.tipo = data.tipo;
      existing.etiqueta = data.etiqueta; existing.desc = data.desc; existing.obs = data.obs;
      await savePersonalizadas();
      return existing;
    }
    var novo = {
      id: genCustomId(), n: data.n, tipo: data.tipo,
      etiqueta: data.etiqueta, desc: data.desc, obs: data.obs
    };
    personalizadas.push(novo);
    await savePersonalizadas();
    return novo;
  }

  // Exclui a personalizada do "catálogo" (conexoes:personalizadas) e também
  // remove a referência dela de QUALQUER ficha que a tenha adicionado —
  // sem isso, a ficha ficaria com uma referência "órfã" (mesmo tratamento
  // que já existe para uma Conexão oficial renomeada/removida, só que aqui
  // limpamos ativamente em vez de só exibir "não encontrada").
  async function deletePersonalizada(id){
    personalizadas = personalizadas.filter(function(p){ return p.id !== id; });
    await savePersonalizadas();
    var ref = CUSTOM_REF_PREFIX + id;
    var refs = getConnRefs();
    if(refs.indexOf(ref) !== -1){
      setConnRefs(refs.filter(function(r){ return r !== ref; }));
    }
  }

  /* ---------- acesso ao campo oculto (fonte única de verdade da ficha) ---------- */

  function ensureHiddenField(){
    var el = document.getElementById(HIDDEN_FIELD_ID);
    if(!el){
      var tabAgentes = document.getElementById("tab-agentes");
      if(!tabAgentes) return null;
      el = document.createElement("input");
      el.type = "hidden";
      el.id = HIDDEN_FIELD_ID;
      el.value = "[]";
      tabAgentes.appendChild(el);
    }
    return el;
  }

  function getConnRefs(){
    var el = ensureHiddenField();
    if(!el) return [];
    try{
      var arr = JSON.parse(el.value || "[]");
      return Array.isArray(arr) ? arr : [];
    }catch(e){
      return [];
    }
  }

  // Grava a lista e marca a ficha como tendo alterações pendentes
  // (mesmo comportamento dos demais campos da ficha — só é
  // persistido de fato quando o usuário clica "💾 Salvar Ficha").
  function setConnRefs(arr){
    var el = ensureHiddenField();
    if(!el) return;
    el.value = JSON.stringify(arr);
    if(typeof markAgentDirty === "function") markAgentDirty();
  }

  // Reset silencioso (sem marcar a ficha como suja) — usado só ao
  // trocar/criar ficha, para nunca deixar a referência da ficha
  // anterior vazar para a próxima antes do carregamento real.
  function resetConnRefsSilent(){
    var el = ensureHiddenField();
    if(el) el.value = "[]";
  }

  function findConnByRef(ref){
    if(typeof ref === "string" && ref.indexOf(CUSTOM_REF_PREFIX) === 0){
      var raw = findPersonalizadaRaw(ref.slice(CUSTOM_REF_PREFIX.length));
      return raw ? toCustomEntry(raw) : null;
    }
    if(typeof CONEXOES_DATA === "undefined") return null;
    for(var i = 0; i < CONEXOES_DATA.length; i++){
      if(CONEXOES_DATA[i].n === ref) return CONEXOES_DATA[i];
    }
    return null;
  }

  function addConnection(ref){
    var refs = getConnRefs();
    if(refs.indexOf(ref) !== -1) return; // já está na ficha — não duplica
    var c = findConnByRef(ref);
    if(c && c.noAdd === true) return; // Aborto Límbico — nunca adicionável como Conexão
    refs.push(ref);
    setConnRefs(refs);
    renderAll();
  }

  function removeConnection(ref){
    var refs = getConnRefs().filter(function(r){ return r !== ref; });
    setConnRefs(refs);
    renderAll();
  }

  /* ---------- pequenos helpers que reaproveitam funções já existentes ---------- */

  function esc(s){
    if(typeof escapeHtml === "function") return escapeHtml(s);
    var d = document.createElement("div");
    d.textContent = (s === undefined || s === null) ? "" : String(s);
    return d.innerHTML;
  }

  // Algumas entradas do Compêndio (ex.: categoria "Especiais") não
  // possuem símbolo no livro — retorna null nesse caso, e quem chama
  // decide não renderizar nenhuma <img> (sem imagem quebrada / falsa).
  function symSrc(c){
    if(!c || !c.s) return null;
    if(typeof cx_symSrc === "function") return cx_symSrc(c);
    return "data:image/png;base64," + c.s;
  }

  function dimLabel(c){
    if(c.custom){
      return c.tipo + (c.etiqueta ? " · " + c.etiqueta : "");
    }
    if(typeof CONEXOES_DIM_LABELS !== "undefined"){
      return c.d === "tecnica" ? "Técnica de Aborto Límbico" : (CONEXOES_DIM_LABELS[c.d] || c.dl || "");
    }
    return c.dl || "";
  }

  /* ==========================================================
     PARANORMAL → "MINHAS CONEXÕES"
     Painel novo, adicionado como último filho de #tab-paranormal —
     o painel manual já existente ali ("Paranormal — Conexões")
     não é tocado nem movido.
     ========================================================== */

  function ensureParanormalPanel(){
    if(document.getElementById("cconn_panel")) return;
    var tabParanormal = document.getElementById("tab-paranormal");
    if(!tabParanormal) return;

    var panel = document.createElement("div");
    panel.className = "panel";
    panel.id = "cconn_panel";
    panel.innerHTML =
      '<h2>Minhas Conexões <span class="tag">Vinculado ao Compêndio</span></h2>' +
      '<p class="empty-state" style="margin-bottom:14px;">' +
        'Conexões desta ficha, selecionadas diretamente do Compêndio. ' +
        'Elas aparecem automaticamente em <strong>Agentes → Conexão</strong>.' +
      '</p>' +
      '<div class="cconn-toolbar">' +
        '<button type="button" id="cconn_add_btn">+ Adicionar Conexão</button>' +
      '</div>' +
      '<div id="cconn_list"></div>';

    tabParanormal.appendChild(panel);
    document.getElementById("cconn_add_btn").addEventListener("click", openPickerModal);
  }

  function renderMinhasConexoes(){
    ensureParanormalPanel();
    var list = document.getElementById("cconn_list");
    if(!list) return;

    var refs = getConnRefs();
    if(refs.length === 0){
      list.innerHTML = '<div class="empty-state">Nenhuma Conexão adicionada a esta ficha ainda.</div>';
      return;
    }

    list.innerHTML = "";
    refs.forEach(function(ref){
      var c = findConnByRef(ref);
      var card = document.createElement("div");
      card.className = "entry-card cconn-entry-card";

      if(c){
        var thumbSrc = symSrc(c);
        var thumbHtml = thumbSrc ? ('<img class="cconn-thumb" src="' + thumbSrc + '" alt="">') : '';
        card.innerHTML =
          thumbHtml +
          '<div class="entry-body">' +
            '<div class="entry-title">' + esc(c.n) + ' <span class="meta">' + esc(dimLabel(c)) + '</span>' +
              (c.custom ? ' <span class="cconn-custom-badge">Personalizada</span>' : '') +
            '</div>' +
          '</div>' +
          '<button class="entry-del" type="button" data-cconn-remove="' + esc(ref) + '">Remover</button>';
      } else {
        // Referência que não foi encontrada no Compêndio (ex.: Conexão
        // renomeada/removida da biblioteca) — não quebra a lista, só
        // avisa, e continua removível normalmente.
        card.innerHTML =
          '<div class="entry-body">' +
            '<div class="entry-title">' + esc(ref) + ' <span class="meta">não encontrada no Compêndio</span></div>' +
          '</div>' +
          '<button class="entry-del" type="button" data-cconn-remove="' + esc(ref) + '">Remover</button>';
      }
      list.appendChild(card);
    });

    list.querySelectorAll("[data-cconn-remove]").forEach(function(btn){
      btn.addEventListener("click", function(){
        removeConnection(btn.getAttribute("data-cconn-remove"));
      });
    });
  }

  /* ==========================================================
     AGENTES → "CONEXÃO"
     Painel novo, inserido como irmão do bloco ".two-col" que já
     contém "Conexões Aprendidas" / "Anotações do Agente" — esse
     bloco e os campos que ele contém não são alterados nem
     movidos, o painel novo só entra antes dele.
     ========================================================== */

  function ensureAgentesDisplayPanel(){
    if(document.getElementById("cconn_agente_panel")) return;
    var conexoesField = document.getElementById("conexoes");
    if(!conexoesField) return;
    var twoCol = conexoesField.closest(".two-col");
    if(!twoCol || !twoCol.parentElement) return;

    var panel = document.createElement("div");
    panel.className = "panel";
    panel.id = "cconn_agente_panel";
    panel.innerHTML =
      '<h2>Conexão</h2>' +
      '<div id="cconn_agente_grid" class="cconn-agente-grid"></div>';

    twoCol.parentElement.insertBefore(panel, twoCol);
  }

  function renderAgenteConexoes(){
    ensureAgentesDisplayPanel();
    var grid = document.getElementById("cconn_agente_grid");
    if(!grid) return;

    var refs = getConnRefs();
    if(refs.length === 0){
      grid.innerHTML = '<div class="empty-state">Nenhuma Conexão vinculada. Adicione em Paranormal → Minhas Conexões.</div>';
      return;
    }

    grid.innerHTML = "";
    refs.forEach(function(ref){
      var c = findConnByRef(ref);
      var block = document.createElement("div");
      block.className = "cconn-block" + (c ? (" cx-" + c.d) : "");
      block.setAttribute("data-conn-ref", ref);

      var blockThumbSrc = c ? symSrc(c) : null;
      block.innerHTML = c
        ? ((blockThumbSrc ? ('<img class="cconn-thumb-sm" src="' + blockThumbSrc + '" alt="">') : '') +
           '<span>' + esc(c.n) + (c.custom ? ' <span class="cconn-custom-badge">P</span>' : '') + '</span>')
        : ('<span>' + esc(ref) + '</span>');

      // Preparado para a Etapa 3: já reaproveita o modal de detalhes
      // do próprio Compêndio (sem alterá-lo) para abrir a ficha
      // completa da Conexão ao clicar. Personalizadas não existem em
      // CONEXOES_DATA, então não têm esse modal — permanecem só como
      // bloco informativo aqui (a descrição completa fica visível no
      // picker, dentro do filtro "Personalizadas").
      if(c && !c.custom && typeof openConexaoModal === "function" && typeof CONEXOES_DATA !== "undefined"){
        block.addEventListener("click", function(){
          openConexaoModal(CONEXOES_DATA.indexOf(c));
        });
      }

      grid.appendChild(block);
    });
  }

  function renderAll(){
    renderMinhasConexoes();
    renderAgenteConexoes();
  }

  /* ==========================================================
     MODAL "ADICIONAR CONEXÃO"
     Lista as Conexões que já existem em CONEXOES_DATA (mesma
     fonte de dados do Compêndio) para seleção — não cadastra
     nada novo, não duplica a biblioteca.
     ========================================================== */

  function ensurePickerModal(){
    if(document.getElementById("cconn_picker_modal")) return;

    var overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.id = "cconn_picker_modal";
    overlay.innerHTML =
      '<div class="modal-box cconn-picker-box">' +
        '<button type="button" class="cconn-picker-close" id="cconn_picker_close">&times;</button>' +
        '<h3>Adicionar Conexão à Ficha</h3>' +
        '<div class="field cconn-picker-search-row"><label>Pesquisar</label>' +
          '<input type="text" id="cconn_picker_search" placeholder="Nome da Conexão…"></div>' +
        '<div id="cconn_picker_filters" class="cx-filters"></div>' +
        '<div class="cconn-custom-toolbar">' +
          '<button type="button" id="cconn_custom_create_btn" class="cconn-custom-create-btn">+ Criar Personalizada</button>' +
        '</div>' +
        '<div id="cconn_picker_count" class="note cconn-picker-count"></div>' +
        '<div id="cconn_picker_list" class="cconn-picker-list"></div>' +
      '</div>';
    document.body.appendChild(overlay);

    document.getElementById("cconn_picker_close").addEventListener("click", closePickerModal);
    overlay.addEventListener("click", function(e){
      if(e.target.id === "cconn_picker_modal") closePickerModal();
    });

    document.getElementById("cconn_custom_create_btn").addEventListener("click", function(){
      openCustomFormModal(null);
    });

    var searchEl = document.getElementById("cconn_picker_search");
    var handler = (typeof debounce === "function") ? debounce(renderPickerList, 150) : renderPickerList;
    searchEl.addEventListener("input", handler);
  }

  function renderPickerFilters(){
    var wrap = document.getElementById("cconn_picker_filters");
    if(!wrap || wrap.dataset.built) return;
    if(typeof CONEXOES_DIM_ORDER === "undefined" || typeof CONEXOES_DIM_LABELS === "undefined") return;

    var html = '<button type="button" class="cx-filter-btn cx-filter-all active" data-filter="todas">Todas</button>';
    CONEXOES_DIM_ORDER.forEach(function(key){
      var label = key === "tecnica" ? "Técnicas de Aborto Límbico" : CONEXOES_DIM_LABELS[key];
      html += '<button type="button" class="cx-filter-btn cx-' + key + '" data-filter="' + key + '"><span class="dot"></span>' + esc(label) + '</button>';
    });
    // "Personalizadas" não é uma dimensão do Compêndio oficial (não está em
    // CONEXOES_DIM_ORDER) — é só mais um botão de filtro, construído do
    // mesmo jeito que os demais, reaproveitando a mesma lista/mesmo clique.
    html += '<button type="button" class="cx-filter-btn cx-personalizada" data-filter="personalizada"><span class="dot"></span>Personalizadas</button>';
    wrap.innerHTML = html;
    wrap.dataset.built = "1";

    wrap.querySelectorAll(".cx-filter-btn").forEach(function(btn){
      btn.addEventListener("click", function(){
        pickerActiveFilter = btn.dataset.filter;
        wrap.querySelectorAll(".cx-filter-btn").forEach(function(b){ b.classList.remove("active"); });
        btn.classList.add("active");
        renderPickerList();
      });
    });
  }

  function renderPickerList(){
    var list = document.getElementById("cconn_picker_list");
    var countEl = document.getElementById("cconn_picker_count");
    if(!list || typeof CONEXOES_DATA === "undefined") return;

    var searchEl = document.getElementById("cconn_picker_search");
    var q = ((searchEl && searchEl.value) || "").toLowerCase().trim();

    // "Todas" mistura o Compêndio oficial (CONEXOES_DATA, intocado) com as
    // Personalizadas (array separado, nunca gravado dentro de CONEXOES_DATA)
    // só na hora de montar esta lista de seleção — nenhuma das duas fontes
    // é alterada pela outra.
    var items = CONEXOES_DATA.concat(getPersonalizadas());
    if(pickerActiveFilter !== "todas"){
      items = items.filter(function(c){ return c.d === pickerActiveFilter; });
    }
    if(q){
      items = items.filter(function(c){
        return c.n.toLowerCase().indexOf(q) !== -1 ||
               ((CONEXOES_DIM_LABELS && CONEXOES_DIM_LABELS[c.d]) || "").toLowerCase().indexOf(q) !== -1 ||
               (c.dl || "").toLowerCase().indexOf(q) !== -1 ||
               (c.etiqueta || "").toLowerCase().indexOf(q) !== -1;
      });
    }

    if(countEl) countEl.textContent = items.length + " resultado" + (items.length === 1 ? "" : "s");

    if(items.length === 0){
      list.innerHTML = '<div class="cconn-picker-empty">Nenhuma Conexão encontrada para este filtro/pesquisa.</div>';
      return;
    }

    var currentRefs = getConnRefs();
    list.innerHTML = "";
    items.forEach(function(c){
      var ref = c.custom ? (CUSTOM_REF_PREFIX + c.id) : c.n;
      var inSheet = currentRefs.indexOf(ref) !== -1;
      // Exceção obrigatória: Aborto Límbico aparece no Compêndio (dentro
      // de Conexões Superiores) mas nunca pode ser adicionado à ficha
      // como Conexão — ele já possui seu próprio sistema em Agentes.
      var blocked = c.noAdd === true;
      var row = document.createElement("div");
      row.className = "cconn-picker-row cx-" + c.d + (c.custom ? " cconn-custom-row" : "");
      var rowThumbSrc = symSrc(c);
      var rowThumbHtml = rowThumbSrc ? ('<img class="cconn-thumb-sm" src="' + rowThumbSrc + '" alt="">') : '';
      var btnHtml = blocked
        ? '<button type="button" class="cconn-picker-add-btn in-sheet" disabled title="Aborto Límbico possui seu próprio sistema em Agentes e não pode ser adicionado como Conexão.">Indisponível</button>'
        : ('<button type="button" class="cconn-picker-add-btn' + (inSheet ? ' in-sheet' : '') + '">' +
            (inSheet ? '✓ Na Ficha' : 'Adicionar') +
          '</button>');

      var bodyHtml =
        '<div class="cconn-picker-row-body">' +
          '<div class="cconn-picker-row-title">' + esc(c.n) +
            (c.custom ? ' <span class="cconn-custom-badge">Personalizada</span>' : '') +
          '</div>' +
          '<div class="cconn-picker-row-dim">' + esc(dimLabel(c)) + '</div>' +
          (c.custom && c.desc ? '<div class="cconn-custom-desc">' + esc(c.desc) + '</div>' : '') +
          (c.custom && c.obs ? '<div class="cconn-custom-obs"><strong>Observações:</strong> ' + esc(c.obs) + '</div>' : '') +
        '</div>';

      var actionsHtml = c.custom
        ? ('<div class="cconn-picker-row-actions">' + btnHtml +
            '<button type="button" class="cconn-custom-edit-btn" data-edit-custom="' + esc(c.id) + '">Editar</button>' +
            '<button type="button" class="cconn-custom-del-btn" data-del-custom="' + esc(c.id) + '">Excluir</button>' +
          '</div>')
        : btnHtml;

      row.innerHTML = rowThumbHtml + bodyHtml + actionsHtml;

      if(!blocked){
        var btn = row.querySelector(".cconn-picker-add-btn");
        btn.addEventListener("click", function(){
          addConnection(ref);
          renderPickerList(); // atualiza o botão desta linha para "✓ Na Ficha"
        });
      }

      if(c.custom){
        row.querySelector("[data-edit-custom]").addEventListener("click", function(){
          openCustomFormModal(c.id);
        });
        row.querySelector("[data-del-custom]").addEventListener("click", function(){
          if(!confirm('Excluir a personalizada "' + c.n + '"? Ela também será removida de qualquer ficha em que estiver adicionada.')) return;
          deletePersonalizada(c.id).then(function(){
            renderPickerList();
            renderAll(); // reflete a remoção em Minhas Conexões / Agentes, caso estivesse em alguma ficha
          });
        });
      }

      list.appendChild(row);
    });
  }

  function openPickerModal(){
    ensurePickerModal();
    pickerActiveFilter = "todas";
    var wrap = document.getElementById("cconn_picker_filters");
    if(wrap){
      wrap.querySelectorAll(".cx-filter-btn").forEach(function(b){ b.classList.remove("active"); });
      var allBtn = wrap.querySelector('[data-filter="todas"]');
      if(allBtn) allBtn.classList.add("active");
    }
    var searchEl = document.getElementById("cconn_picker_search");
    if(searchEl) searchEl.value = "";
    renderPickerFilters();
    renderPickerList();
    document.getElementById("cconn_picker_modal").style.display = "flex";
  }

  function closePickerModal(){
    var m = document.getElementById("cconn_picker_modal");
    if(m) m.style.display = "none";
  }

  /* ==========================================================
     MODAL "CRIAR/EDITAR PERSONALIZADA"
     Reaproveita as mesmas classes base de modal/campo já usadas
     pelo resto do projeto (.modal-overlay, .modal-box, .field) —
     só adiciona o necessário em character-connections.css. Não é
     um segundo "sistema de modal": é a interface de criação pedida,
     que não tinha equivalente antes.
     ========================================================== */

  function ensureCustomFormModal(){
    if(document.getElementById("cconn_custom_form_modal")) return;

    var overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.id = "cconn_custom_form_modal";
    overlay.innerHTML =
      '<div class="modal-box cconn-custom-form-box">' +
        '<button type="button" class="cconn-picker-close" id="ccf_close">&times;</button>' +
        '<h3 id="ccf_title">Criar Personalizada</h3>' +
        '<div class="field"><label>Nome *</label><input type="text" id="ccf_nome" placeholder="Nome da entrada…"></div>' +
        '<div class="field"><label>Tipo</label>' +
          '<select id="ccf_tipo">' +
            CUSTOM_TIPOS.map(function(t){ return '<option value="' + t + '">' + t + '</option>'; }).join("") +
          '</select>' +
        '</div>' +
        '<div class="field"><label>Etiqueta</label><input type="text" id="ccf_etiqueta" placeholder="ex.: Física, Homebrew, NPC, Campanha…"></div>' +
        '<div class="field"><label>Descrição</label><textarea id="ccf_desc" placeholder="Descrição…"></textarea></div>' +
        '<div class="field"><label>Observações (opcional)</label><textarea id="ccf_obs" placeholder="Observações adicionais…"></textarea></div>' +
        '<div class="cconn-custom-form-actions">' +
          '<button type="button" id="ccf_delete" class="cconn-custom-del-form-btn" style="display:none;">Excluir</button>' +
          '<button type="button" id="ccf_cancel">Cancelar</button>' +
          '<button type="button" id="ccf_save">Salvar</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    document.getElementById("ccf_close").addEventListener("click", closeCustomFormModal);
    document.getElementById("ccf_cancel").addEventListener("click", closeCustomFormModal);
    overlay.addEventListener("click", function(e){
      if(e.target.id === "cconn_custom_form_modal") closeCustomFormModal();
    });

    document.getElementById("ccf_save").addEventListener("click", saveCustomForm);
  }

  var customFormEditId = null;

  function openCustomFormModal(editId){
    ensureCustomFormModal();
    customFormEditId = editId || null;

    var title = document.getElementById("ccf_title");
    var delBtn = document.getElementById("ccf_delete");
    var nome = document.getElementById("ccf_nome");
    var tipo = document.getElementById("ccf_tipo");
    var etiqueta = document.getElementById("ccf_etiqueta");
    var desc = document.getElementById("ccf_desc");
    var obs = document.getElementById("ccf_obs");

    if(editId){
      var p = findPersonalizadaRaw(editId);
      title.textContent = "Editar Personalizada";
      delBtn.style.display = "";
      delBtn.onclick = function(){
        if(!confirm('Excluir a personalizada "' + (p ? p.n : "") + '"? Ela também será removida de qualquer ficha em que estiver adicionada.')) return;
        deletePersonalizada(editId).then(function(){
          closeCustomFormModal();
          renderPickerList();
          renderAll();
        });
      };
      nome.value = p ? p.n : "";
      tipo.value = p ? p.tipo : CUSTOM_TIPOS[0];
      etiqueta.value = p ? (p.etiqueta || "") : "";
      desc.value = p ? (p.desc || "") : "";
      obs.value = p ? (p.obs || "") : "";
    } else {
      title.textContent = "Criar Personalizada";
      delBtn.style.display = "none";
      delBtn.onclick = null;
      nome.value = "";
      tipo.value = CUSTOM_TIPOS[0];
      etiqueta.value = "";
      desc.value = "";
      obs.value = "";
    }

    document.getElementById("cconn_custom_form_modal").style.display = "flex";
    nome.focus();
  }

  function closeCustomFormModal(){
    var m = document.getElementById("cconn_custom_form_modal");
    if(m) m.style.display = "none";
    customFormEditId = null;
  }

  function saveCustomForm(){
    var nome = document.getElementById("ccf_nome").value.trim();
    if(!nome){
      document.getElementById("ccf_nome").focus();
      return; // Nome é obrigatório — não salva sem ele.
    }
    var data = {
      n: nome,
      tipo: document.getElementById("ccf_tipo").value || CUSTOM_TIPOS[0],
      etiqueta: document.getElementById("ccf_etiqueta").value.trim(),
      desc: document.getElementById("ccf_desc").value.trim(),
      obs: document.getElementById("ccf_obs").value.trim()
    };
    upsertPersonalizada(data, customFormEditId).then(function(){
      closeCustomFormModal();
      renderPickerList();
    });
  }

  /* ==========================================================
     INTEGRAÇÃO COM O FLUXO DE FICHAS JÁ EXISTENTE
     Mesmo padrão já usado pela Bandeja de Rolagens: envolve
     openSheet() / createNewSheet() sem reescrevê-las, só para
     trocar de "dono" junto com a troca/criação de ficha.
     ========================================================== */

  function wrapSheetFunctions(){
    if(typeof openSheet === "function"){
      var _origOpenSheet = openSheet;
      openSheet = async function(id){
        // Evita que a referência da ficha anterior "vaze" para a
        // próxima antes do carregamento real (relevante só para
        // fichas antigas, salvas antes de agente_conexoes_ids
        // existir — loadAgent() sobrescreve normalmente quando o
        // campo já foi salvo).
        resetConnRefsSilent();
        await _origOpenSheet(id);
        renderAll();
      };
    }
    if(typeof createNewSheet === "function"){
      var _origCreateNewSheet = createNewSheet;
      createNewSheet = async function(){
        await _origCreateNewSheet();
        resetConnRefsSilent();
        renderAll();
      };
    }
  }

  /* ---------- boot ---------- */
  function initCharacterConnections(){
    ensureHiddenField();
    wrapSheetFunctions();
    ensureParanormalPanel();
    ensureAgentesDisplayPanel();
    renderAll();
    // Personalizadas são conteúdo do projeto (não de uma ficha específica),
    // carregadas uma única vez, em paralelo, sem travar o resto do boot —
    // mesmo padrão de loadInventory()/loadParanormal() no index.html.
    // Como algumas fichas antigas podem referenciar "custom:<id>" antes
    // deste carregamento terminar, renderAll() roda de novo ao concluir,
    // resolvendo essas referências corretamente.
    loadPersonalizadas().then(renderAll);
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", initCharacterConnections);
  } else {
    initCharacterConnections();
  }

})();
