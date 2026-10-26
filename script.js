// Rick & Morty Multiverse Explorer — JavaScript Vanilla
"use strict";

const API_URL = "https://rickandmortyapi.com/api/character";

const elements = {
  grid: document.querySelector("#charactersGrid"),
  search: document.querySelector("#searchInput"),
  status: document.querySelector("#statusFilter"),
  count: document.querySelector("#resultsCount"),
  loading: document.querySelector("#loading"),
  message: document.querySelector("#messageBox"),
  messageIcon: document.querySelector("#messageIcon"),
  messageTitle: document.querySelector("#messageTitle"),
  messageText: document.querySelector("#messageText"),
  retry: document.querySelector("#retryButton"),
  loadMore: document.querySelector("#loadMoreButton"),
  modal: document.querySelector("#characterModal"),
  modalBody: document.querySelector("#modalBody"),
  closeModal: document.querySelector("#closeModal")
};

const state = {
  page: 1,
  nextPage: null,
  search: "",
  status: "",
  loading: false,
  requestId: 0,
  debounce: null
};

document.addEventListener("DOMContentLoaded", () => loadCharacters());

async function loadCharacters({ reset = true } = {}) {
  // Um identificador impede respostas antigas de sobrescreverem filtros recentes.
  const requestId = ++state.requestId;

  if (state.loading && !reset) return;
  state.loading = true;
  hideMessage();

  if (reset) {
    state.page = 1;
    state.nextPage = null;
    elements.grid.replaceChildren();
    elements.loading.hidden = false;
  } else {
    elements.loadMore.disabled = true;
    elements.loadMore.textContent = "Carregando...";
  }

  const params = new URLSearchParams({ page: String(state.page) });
  if (state.search) params.set("name", state.search);
  if (state.status) params.set("status", state.status);

  try {
    const response = await fetch(`${API_URL}?${params.toString()}`);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error("NO_RESULTS");
      }
      throw new Error(`Falha HTTP ${response.status}`);
    }

    const data = await response.json();

    // Ignora uma resposta que ficou desatualizada por uma busca mais recente.
    if (requestId !== state.requestId) return;

    state.nextPage = data.info.next;

    data.results.forEach((character) => {
      elements.grid.appendChild(createCharacterCard(character));
    });

    elements.count.textContent = `${elements.grid.children.length} personagem(ns) exibido(s)`;
    elements.loadMore.hidden = !state.nextPage;

  } catch (error) {
    if (requestId !== state.requestId) return;
    console.error("Erro ao consultar a API:", error);

    if (error.message === "NO_RESULTS") {
      showMessage("🔎", "Nenhum personagem encontrado", "Tente outro nome ou altere os filtros.");
    } else {
      showMessage("⚠️", "Não foi possível carregar os dados", "Verifique sua conexão e tente novamente.");
    }
  } finally {
    if (requestId === state.requestId) {
      state.loading = false;
      elements.loading.hidden = true;
      elements.loadMore.disabled = false;
      elements.loadMore.textContent = "Carregar mais personagens ↓";
    }
  }
}

function createCharacterCard(character) {
  // Os cards são montados pelo JavaScript: createElement + append.
  const card = document.createElement("article");
  card.className = "character-card";
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", `Ver detalhes de ${character.name}`);

  const imageWrap = document.createElement("div");
  imageWrap.className = "image-wrap";

  const image = document.createElement("img");
  image.className = "character-image";
  image.src = character.image;
  image.alt = `Imagem de ${character.name}`;
  image.loading = "lazy";

  const badge = document.createElement("div");
  const normalizedStatus = character.status.toLowerCase();
  badge.className = `status-badge status-${normalizedStatus}`;

  const dot = document.createElement("span");
  dot.className = "status-dot";
  const statusText = document.createElement("span");
  statusText.textContent = translateStatus(character.status);
  badge.append(dot, statusText);

  const content = document.createElement("div");
  content.className = "card-content";

  const name = document.createElement("h3");
  name.className = "character-name";
  name.textContent = character.name;

  const species = document.createElement("p");
  species.className = "species";
  species.textContent = character.species;

  const info = document.createElement("div");
  info.className = "card-info";
  info.append(
    createInfoRow("Gênero", translateGender(character.gender)),
    createInfoRow("Local", character.location?.name || "Desconhecido")
  );

  imageWrap.append(image, badge);
  content.append(name, species, info);
  card.append(imageWrap, content);

  card.addEventListener("click", () => openCharacterModal(character));
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openCharacterModal(character);
    }
  });

  return card;
}

function createInfoRow(label, value) {
  const row = document.createElement("div");
  row.className = "info-row";

  const labelEl = document.createElement("span");
  labelEl.className = "info-label";
  labelEl.textContent = label;

  const valueEl = document.createElement("span");
  valueEl.className = "info-value";
  valueEl.textContent = value || "Desconhecido";

  row.append(labelEl, valueEl);
  return row;
}

async function openCharacterModal(character) {
  elements.modal.hidden = false;
  document.body.classList.add("modal-open");
  elements.modalBody.innerHTML = `
    <div class="modal-loading">
      <div class="spinner"></div>
      <p>Consultando episódios...</p>
    </div>`;

  try {
    // Consulta os endpoints de episódios associados ao personagem.
    const responses = await Promise.all(
      character.episode.map((url) => fetch(url))
    );
    const episodes = await Promise.all(responses.map((response) => {
      if (!response.ok) throw new Error("Falha ao carregar episódio");
      return response.json();
    }));
    renderModal(character, episodes);
  } catch (error) {
    console.error("Não foi possível carregar todos os episódios:", error);
    renderModal(character, []);
  }
}

function renderModal(character, episodes) {
  // Elementos de conteúdo textual são criados com textContent para evitar interpretar
  // os dados da API como HTML. A lista de episódios também é criada dinamicamente.
  const wrapper = document.createElement("div");
  wrapper.className = "modal-grid";

  const image = document.createElement("img");
  image.className = "modal-image";
  image.src = character.image;
  image.alt = `Imagem de ${character.name}`;

  const info = document.createElement("div");
  info.className = "modal-info";

  const title = document.createElement("h2");
  title.className = "modal-title";
  title.id = "modalTitle";
  title.textContent = character.name;

  const status = document.createElement("div");
  status.className = `modal-status status-${character.status.toLowerCase()}`;
  const dot = document.createElement("span");
  dot.className = "status-dot";
  const statusLabel = document.createElement("span");
  statusLabel.textContent = translateStatus(character.status);
  status.append(dot, statusLabel);

  const details = document.createElement("div");
  details.className = "details-grid";
  const fields = [
    ["Espécie", character.species],
    ["Gênero", translateGender(character.gender)],
    ["Origem", character.origin?.name],
    ["Localização atual", character.location?.name],
    ["Tipo", character.type || "Não informado"],
    ["Episódios", String(character.episode.length)]
  ];
  fields.forEach(([label, value]) => {
    const box = document.createElement("div");
    box.className = "detail-box";
    const caption = document.createElement("span");
    caption.textContent = label;
    const strong = document.createElement("strong");
    strong.textContent = value || "Desconhecido";
    box.append(caption, strong);
    details.appendChild(box);
  });

  const episodesTitle = document.createElement("h3");
  episodesTitle.className = "episodes-title";
  episodesTitle.textContent = "Episódios";

  const episodeList = document.createElement("div");
  episodeList.className = "episodes-list";

  if (episodes.length) {
    episodes.forEach((episode) => {
      const tag = document.createElement("span");
      tag.className = "episode-tag";
      tag.textContent = `${episode.episode} — ${episode.name}`;
      episodeList.appendChild(tag);
    });
  } else {
    const tag = document.createElement("span");
    tag.className = "episode-tag";
    tag.textContent = "Lista de episódios indisponível no momento.";
    episodeList.appendChild(tag);
  }

  info.append(title, status, details, episodesTitle, episodeList);
  wrapper.append(image, info);
  elements.modalBody.replaceChildren(wrapper);
}

function translateStatus(status) {
  return ({ Alive: "Vivo", Dead: "Morto", unknown: "Desconhecido" })[status] || status;
}

function translateGender(gender) {
  return ({
    Male: "Masculino",
    Female: "Feminino",
    Genderless: "Sem gênero",
    unknown: "Desconhecido"
  })[gender] || gender;
}

elements.search.addEventListener("input", () => {
  clearTimeout(state.debounce);
  state.debounce = setTimeout(() => {
    state.search = elements.search.value.trim();
    loadCharacters({ reset: true });
  }, 400);
});

elements.status.addEventListener("change", () => {
  state.status = elements.status.value;
  loadCharacters({ reset: true });
});

elements.loadMore.addEventListener("click", () => {
  if (!state.nextPage || state.loading) return;
  const next = new URL(state.nextPage);
  state.page = Number(next.searchParams.get("page")) || state.page + 1;
  loadCharacters({ reset: false });
});

elements.retry.addEventListener("click", () => loadCharacters({ reset: true }));
elements.closeModal.addEventListener("click", closeModal);
document.querySelector("[data-close-modal]").addEventListener("click", closeModal);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !elements.modal.hidden) closeModal();
});

function closeModal() {
  elements.modal.hidden = true;
  document.body.classList.remove("modal-open");
}

function showMessage(icon, title, message) {
  elements.messageIcon.textContent = icon;
  elements.messageTitle.textContent = title;
  elements.messageText.textContent = message;
  elements.message.hidden = false;
}

function hideMessage() {
  elements.message.hidden = true;
}
