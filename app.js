const STORAGE_KEY = "todo-pages-app-v2";
const AI_STORAGE_KEY = "todo-pages-ai-v1";
const DEFAULT_NOESIA_BASE_URL = "https://noesia.onrender.com";
const THEMES = ["sepia", "navy", "green"];
const CORNERS = ["soft", "wide", "tiny"];
const STAMP_LABELS = {
  urgent: "急ぎ",
  today: "今日",
  buy: "買う",
};
const AI_ACTION_PROMPTS = {
  impression: "今開いているTODOページ全体を見て、あなたらしい言い方で短く感想をください。褒めるだけではなく、印象に残る点があれば一言で触れてください。",
  concern: "今開いているTODOページを見て、あなたが最初に気になる点を1つか2つだけ挙げてください。人格らしい目線や言い方をはっきり出してください。",
  delay: "今開いているTODOページの中で、後回しになりそうなことをあなたの視点で指摘してください。理由も短く添えてください。",
  owner: "今開いているTODOページの持ち主に向けて、あなたらしい言葉でひとこと話しかけてください。励ましでもツッコミでも構いません。",
  missing: "今開いているTODOページを見て、抜けていそうな予定や見落としをあなたの視点で短く指摘してください。"
};

const defaultState = {
  currentPageId: "page-1",
  sortMode: "manual",
  pages: [
    {
      id: "page-1",
      title: "やること",
      tabLabel: "買い物",
      theme: "sepia",
      corner: "soft",
      items: [
        {
          id: createId(),
          text: "最初の予定を追加",
          memo: "",
          dueDate: "",
          stamp: "today",
          pinned: false,
          completed: false,
        },
      ],
    },
  ],
};

let state = loadState();
let touchStartX = null;
let touchCurrentX = null;
let pressTimer = null;
let draggingItemId = null;
let draggingPointerId = null;
let suppressClick = false;
let pressStartPoint = null;
let expandedMemoId = null;
let stampedItemId = null;
let deletingItemIds = new Set();
let aiState = loadAiState();

const appShell = document.querySelector(".app-shell");
const pagePanel = document.getElementById("page-panel");
const pageTabInput = document.getElementById("page-tab-input");
const themeSelect = document.getElementById("theme-select");
const todoForm = document.getElementById("todo-form");
const todoInput = document.getElementById("todo-input");
const todoList = document.getElementById("todo-list");
const emptyState = document.getElementById("empty-state");
const pageTabs = document.getElementById("page-tabs");
const pageIndicator = document.getElementById("page-indicator");
const addPageButton = document.getElementById("add-page");
const deletePageButton = document.getElementById("delete-page");
const sortToggle = document.getElementById("sort-toggle");
const deleteCompletedButton = document.getElementById("delete-completed");
const checkAllButton = document.getElementById("check-all");
const swipeSurface = document.getElementById("swipe-surface");
const prevPageButton = document.getElementById("prev-page");
const nextPageButton = document.getElementById("next-page");
const todoItemTemplate = document.getElementById("todo-item-template");
const aiToggle = document.getElementById("ai-toggle");
const aiPanel = document.getElementById("ai-panel");
const aiClose = document.getElementById("ai-close");
const aiSettingsToggle = document.getElementById("ai-settings-toggle");
const aiSettingsPanel = document.getElementById("ai-settings-panel");
const aiSettingsClose = document.getElementById("ai-settings-close");
const aiActiveProfileName = document.getElementById("ai-active-profile-name");
const aiProfileForm = document.getElementById("ai-profile-form");
const aiProfileNameInput = document.getElementById("ai-profile-name");
const aiProfileKeyInput = document.getElementById("ai-profile-key");
const aiProfileList = document.getElementById("ai-profile-list");
const aiActionImpressionButton = document.getElementById("ai-action-impression");
const aiActionConcernButton = document.getElementById("ai-action-concern");
const aiActionDelayButton = document.getElementById("ai-action-delay");
const aiActionOwnerButton = document.getElementById("ai-action-owner");
const aiActionMissingButton = document.getElementById("ai-action-missing");
const aiMessages = document.getElementById("ai-messages");

initialize();

function initialize() {
  bindEvents();
  render();
}

function bindEvents() {
  todoForm.addEventListener("submit", handleAddTodo);
  pageTabInput.addEventListener("input", handleTabRename);
  themeSelect.addEventListener("change", handleThemeChange);
  addPageButton.addEventListener("click", handleAddPage);
  deletePageButton.addEventListener("click", () => deletePage(state.currentPageId));
  sortToggle.addEventListener("click", toggleSortMode);
  deleteCompletedButton.addEventListener("click", deleteCompletedItems);
  checkAllButton.addEventListener("click", toggleAllItemsCompleted);
  prevPageButton.addEventListener("click", () => movePageView(-1));
  nextPageButton.addEventListener("click", () => movePageView(1));
  aiToggle.addEventListener("click", openAiPanel);
  aiClose.addEventListener("click", closeAiPanel);
  aiSettingsToggle.addEventListener("click", openAiSettingsPanel);
  aiSettingsClose.addEventListener("click", closeAiSettingsPanel);
  aiProfileForm.addEventListener("submit", handleAiProfileSubmit);
  aiActionImpressionButton.addEventListener("click", () => runAiAction("ひとこと感想", AI_ACTION_PROMPTS.impression));
  aiActionConcernButton.addEventListener("click", () => runAiAction("気になる点", AI_ACTION_PROMPTS.concern));
  aiActionDelayButton.addEventListener("click", () => runAiAction("後回し警報", AI_ACTION_PROMPTS.delay));
  aiActionOwnerButton.addEventListener("click", () => runAiAction("持ち主にひとこと", AI_ACTION_PROMPTS.owner));
  aiActionMissingButton.addEventListener("click", () => runAiAction("抜けチェック", AI_ACTION_PROMPTS.missing));
  swipeSurface.addEventListener("touchstart", handleTouchStart, { passive: true });
  swipeSurface.addEventListener("touchmove", handleTouchMove, { passive: true });
  swipeSurface.addEventListener("touchend", handleTouchEnd, { passive: true });
  swipeSurface.addEventListener("pointermove", handleDragPointerMove);
  swipeSurface.addEventListener("pointerup", finishLongPressDrag);
  swipeSurface.addEventListener("pointercancel", finishLongPressDrag);
}

function handleAddTodo(event) {
  event.preventDefault();
  const value = todoInput.value.trim();
  if (!value) {
    return;
  }

  getCurrentPage().items.push({
    id: createId(),
    text: value,
    memo: "",
    dueDate: "",
    stamp: "",
    pinned: false,
    completed: false,
  });

  todoInput.value = "";
  persist();
  render();
}

function handleTabRename(event) {
  const currentPage = getCurrentPage();
  currentPage.tabLabel = event.target.value.trim() || "メモ";
  persist();
  renderTabs();
}

function handleThemeChange(event) {
  const currentPage = getCurrentPage();
  currentPage.theme = event.target.value;
  persist();
  renderHeader();
  renderTabs();
}

function handleAddPage() {
  const nextIndex = state.pages.length + 1;
  const page = {
    id: createId("page"),
    title: `ページ ${nextIndex}`,
    tabLabel: defaultTabLabel(nextIndex),
    theme: THEMES[(nextIndex - 1) % THEMES.length],
    corner: CORNERS[(nextIndex - 1) % CORNERS.length],
    items: [],
  };

  state.pages.push(page);
  state.currentPageId = page.id;
  expandedMemoId = null;
  persist();
  pagePanel.classList.remove("stack-pop");
  void pagePanel.offsetWidth;
  pagePanel.classList.add("stack-pop");
  window.clearTimeout(handleAddPage.popTimer);
  handleAddPage.popTimer = window.setTimeout(() => {
    pagePanel.classList.remove("stack-pop");
  }, 340);
  render();
  pageTabInput.focus();
  pageTabInput.select();
}

function toggleSortMode() {
  state.sortMode = state.sortMode === "manual" ? "alphabetical" : "manual";
  persist();
  render();
}

async function deleteCompletedItems() {
  const currentPage = getCurrentPage();
  const ids = currentPage.items.filter((item) => item.completed).map((item) => item.id);
  if (!ids.length) {
    return;
  }

  deletingItemIds = new Set(ids);
  render();
  await wait(260);

  currentPage.items = currentPage.items.filter((item) => !deletingItemIds.has(item.id));
  deletingItemIds = new Set();
  if (!currentPage.items.some((item) => item.id === expandedMemoId)) {
    expandedMemoId = null;
  }
  persist();
  render();
}

function toggleAllItemsCompleted() {
  const currentPage = getCurrentPage();
  if (!currentPage.items.length) {
    return;
  }

  const shouldComplete = currentPage.items.some((item) => !item.completed);
  currentPage.items = currentPage.items.map((item) => ({
    ...item,
    completed: shouldComplete,
  }));
  stampedItemId = shouldComplete ? currentPage.items[currentPage.items.length - 1]?.id ?? null : null;
  window.clearTimeout(toggleAllItemsCompleted.stampTimer);
  toggleAllItemsCompleted.stampTimer = window.setTimeout(() => {
    stampedItemId = null;
    render();
  }, 420);

  persist();
  render();
}

function movePageView(direction) {
  const currentIndex = state.pages.findIndex((page) => page.id === state.currentPageId);
  const nextIndex = currentIndex + direction;
  if (nextIndex < 0 || nextIndex >= state.pages.length) {
    return;
  }

  state.currentPageId = state.pages[nextIndex].id;
  expandedMemoId = null;
  persist();
  render(direction > 0 ? "left" : "right");
}

function handleTouchStart(event) {
  touchStartX = event.changedTouches[0].clientX;
  touchCurrentX = touchStartX;
}

function handleTouchMove(event) {
  touchCurrentX = event.changedTouches[0].clientX;
}

function handleTouchEnd(event) {
  if (suppressClick) {
    touchStartX = null;
    touchCurrentX = null;
    return;
  }

  if (touchStartX === null) {
    return;
  }

  const touchEndX = touchCurrentX ?? event.changedTouches[0].clientX;
  const delta = touchEndX - touchStartX;
  touchStartX = null;
  touchCurrentX = null;

  if (Math.abs(delta) < 48) {
    return;
  }

  movePageView(delta < 0 ? 1 : -1);
}

function render(swipeDirection) {
  renderHeader();
  renderTabs();
  renderTodos(swipeDirection);
  renderAiPanel();
}

function renderHeader() {
  const currentPage = getCurrentPage();
  appShell.dataset.theme = currentPage.theme;
  pagePanel.dataset.corner = currentPage.corner;
  pageTabInput.value = currentPage.tabLabel;
  themeSelect.value = currentPage.theme;
  updatePageIndicator();
  sortToggle.textContent = state.sortMode === "manual" ? "並び替え" : "手動順";
  deleteCompletedButton.disabled = !currentPage.items.some((item) => item.completed);
  checkAllButton.disabled = currentPage.items.length === 0;
  deletePageButton.disabled = state.pages.length === 1;
  checkAllButton.textContent = currentPage.items.every((item) => item.completed) && currentPage.items.length > 0
    ? "全部はずす"
    : "全部チェック";

  pagePanel.style.setProperty("--stack-count", String(Math.min(state.pages.length, 6)));
}

function renderTabs() {
  const currentPage = getCurrentPage();
  pageTabs.innerHTML = "";

  state.pages.forEach((page) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "page-tab";
    button.dataset.theme = page.theme;
    button.classList.toggle("active", page.id === currentPage.id);
    button.textContent = page.tabLabel || page.title;
    button.addEventListener("click", () => {
      if (page.id === state.currentPageId) {
        return;
      }
      const currentIndex = state.pages.findIndex((entry) => entry.id === state.currentPageId);
      const nextIndex = state.pages.findIndex((entry) => entry.id === page.id);
      state.currentPageId = page.id;
      expandedMemoId = null;
      persist();
      render(nextIndex > currentIndex ? "left" : "right");
    });
    pageTabs.appendChild(button);
  });
}

function updatePageIndicator() {
  const currentIndex = state.pages.findIndex((page) => page.id === state.currentPageId);
  pageIndicator.textContent = `${currentIndex + 1} / ${state.pages.length}`;
}

function renderAiPanel() {
  aiPanel.classList.toggle("hidden", !aiState.open);
  aiSettingsPanel.classList.toggle("hidden", !aiState.settingsOpen);
  aiActiveProfileName.textContent = getActiveAiProfile()?.name ?? "未設定";
  aiMessages.innerHTML = "";
  renderAiProfileList();

  if (!aiState.messages.length) {
    appendAiMessageElement("system", "まず API設定 で名前と `pk_` APIキーを追加してください。そのあと上の固定ボタンを押すと、今見ているページを Noesia が人格らしく見てコメントします。");
    return;
  }

  aiState.messages.forEach((message) => appendAiMessageElement(message.role, message.content));
  aiMessages.scrollTop = aiMessages.scrollHeight;
}

function renderTodos(swipeDirection) {
  const currentPage = getCurrentPage();
  const items = getOrderedItems(currentPage);

  todoList.innerHTML = "";
  for (const item of items) {
    const fragment = todoItemTemplate.content.cloneNode(true);
    const element = fragment.querySelector(".todo-item");
    const checkbox = fragment.querySelector(".todo-check");
    const text = fragment.querySelector(".todo-text");
    const textButton = fragment.querySelector(".todo-text-button");
    const stamp = fragment.querySelector(".item-stamp");
    const memoPanel = fragment.querySelector(".memo-panel");
    const titleInput = fragment.querySelector(".title-input");
    const memoInput = fragment.querySelector(".memo-input");
    const dueInput = fragment.querySelector(".due-input");
    const stampSelect = fragment.querySelector(".stamp-select");
    const pinInput = fragment.querySelector(".pin-input");

    element.dataset.id = item.id;
    element.classList.toggle("completed", item.completed);
    element.classList.toggle("sortable", state.sortMode === "manual");
    element.classList.toggle("dragging", draggingItemId === item.id);
    element.classList.toggle("stamp-pop", stampedItemId === item.id);
    element.classList.toggle("pinned", item.pinned);
    element.classList.toggle("tearing", deletingItemIds.has(item.id));
    checkbox.checked = item.completed;
    text.textContent = item.text;

    if (item.stamp) {
      stamp.textContent = STAMP_LABELS[item.stamp];
      stamp.dataset.stamp = item.stamp;
    } else {
      stamp.textContent = "";
      stamp.dataset.stamp = "";
    }

    memoPanel.classList.toggle("hidden", expandedMemoId !== item.id);
    titleInput.value = item.text;
    memoInput.value = item.memo;
    dueInput.value = item.dueDate;
    stampSelect.value = item.stamp;
    pinInput.checked = item.pinned;

    checkbox.addEventListener("change", (event) => {
      if (suppressClick) {
        checkbox.checked = item.completed;
        return;
      }
      setTodoCompleted(item.id, event.target.checked);
    });
    textButton.addEventListener("click", () => {
      if (suppressClick) {
        return;
      }
      toggleMemoEditor(item.id);
    });
    titleInput.addEventListener("input", (event) => {
      text.textContent = event.target.value || "無題";
      updateTodoField(item.id, "text", event.target.value, false);
    });
    memoInput.addEventListener("input", (event) => updateTodoField(item.id, "memo", event.target.value, false));
    dueInput.addEventListener("change", (event) => updateTodoField(item.id, "dueDate", event.target.value, true));
    stampSelect.addEventListener("change", (event) => updateTodoField(item.id, "stamp", event.target.value, true));
    pinInput.addEventListener("change", (event) => updateTodoField(item.id, "pinned", event.target.checked, true));
    if (state.sortMode === "manual") {
      element.addEventListener("pointerdown", handleItemPointerDown);
    }

    todoList.appendChild(fragment);
  }

  emptyState.classList.toggle("hidden", items.length > 0);

  pagePanel.classList.remove("swipe-left", "swipe-right");
  if (swipeDirection) {
    void pagePanel.offsetWidth;
    pagePanel.classList.add(swipeDirection === "left" ? "swipe-left" : "swipe-right");
  }
}

function getOrderedItems(page) {
  const items = [...page.items];
  if (state.sortMode === "alphabetical") {
    items.sort((a, b) => {
      if (a.pinned !== b.pinned) {
        return Number(b.pinned) - Number(a.pinned);
      }
      if (a.completed !== b.completed) {
        return Number(a.completed) - Number(b.completed);
      }
      return a.text.localeCompare(b.text, "ja");
    });
    return items;
  }

  const pinned = items.filter((item) => item.pinned);
  const normal = items.filter((item) => !item.pinned);
  return [...pinned, ...normal];
}

function setTodoCompleted(itemId, completed) {
  const item = findItemById(itemId);
  if (!item) {
    return;
  }

  item.completed = completed;
  stampedItemId = completed ? itemId : null;
  window.clearTimeout(setTodoCompleted.stampTimer);
  setTodoCompleted.stampTimer = window.setTimeout(() => {
    stampedItemId = null;
    render();
  }, 420);
  persist();
  render();
}

function toggleMemoEditor(itemId) {
  expandedMemoId = expandedMemoId === itemId ? null : itemId;
  render();
  if (expandedMemoId === itemId) {
    window.requestAnimationFrame(() => {
      document.querySelector(`.todo-item[data-id="${itemId}"] .memo-input`)?.focus();
    });
  }
}

function updateTodoField(itemId, key, value, shouldRender) {
  const item = findItemById(itemId);
  if (!item) {
    return;
  }

  item[key] = value;
  persist();
  if (shouldRender) {
    render();
  }
}

async function deletePage(pageId) {
  if (state.pages.length === 1) {
    return;
  }

  const targetPage = state.pages.find((page) => page.id === pageId);
  if (targetPage?.items.length) {
    const accepted = window.confirm(`「${targetPage.title}」を削除しますか？`);
    if (!accepted) {
      return;
    }
  }

  pagePanel.classList.add("page-tear");
  await wait(300);
  pagePanel.classList.remove("page-tear");

  state.pages = state.pages.filter((page) => page.id !== pageId);
  if (!state.pages.some((page) => page.id === state.currentPageId)) {
    state.currentPageId = state.pages[0].id;
  }
  expandedMemoId = null;
  persist();
  render();
}

function findItemById(itemId) {
  return getCurrentPage().items.find((item) => item.id === itemId);
}

function getCurrentPage() {
  return state.pages.find((page) => page.id === state.currentPageId) ?? state.pages[0];
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function persistAiState() {
  localStorage.setItem(AI_STORAGE_KEY, JSON.stringify({
    activeProfileId: aiState.activeProfileId,
    profiles: aiState.profiles,
    messages: aiState.messages,
  }));
}

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return cloneDefaultState();
    }

    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed.pages) || parsed.pages.length === 0) {
      return cloneDefaultState();
    }

    return {
      currentPageId: parsed.currentPageId ?? parsed.pages[0].id,
      sortMode: parsed.sortMode === "alphabetical" ? "alphabetical" : "manual",
      pages: parsed.pages.map((page, index) => ({
        id: page.id || createId("page"),
        title: validText(page.title, "無題ページ"),
        tabLabel: validText(page.tabLabel, defaultTabLabel(index + 1)),
        theme: THEMES.includes(page.theme) ? page.theme : THEMES[index % THEMES.length],
        corner: CORNERS.includes(page.corner) ? page.corner : CORNERS[index % CORNERS.length],
        items: Array.isArray(page.items)
          ? page.items.map((item) => ({
              id: item.id || createId(),
              text: typeof item.text === "string" ? item.text : "",
              memo: typeof item.memo === "string" ? item.memo : "",
              dueDate: typeof item.dueDate === "string" ? item.dueDate : "",
              stamp: item.stamp in STAMP_LABELS ? item.stamp : "",
              pinned: Boolean(item.pinned),
              completed: Boolean(item.completed),
            }))
          : [],
      })),
    };
  } catch {
    return cloneDefaultState();
  }
}

function loadAiState() {
  try {
    const saved = localStorage.getItem(AI_STORAGE_KEY);
    if (!saved) {
      return {
        open: false,
        settingsOpen: false,
        activeProfileId: null,
        profiles: [],
        messages: [],
      };
    }

    const parsed = JSON.parse(saved);
    return {
      open: false,
      settingsOpen: false,
      activeProfileId: typeof parsed.activeProfileId === "string" ? parsed.activeProfileId : null,
      profiles: Array.isArray(parsed.profiles)
        ? parsed.profiles
            .filter((profile) => profile?.id && profile?.name && profile?.apiKey)
            .map((profile) => ({ id: profile.id, name: profile.name, apiKey: profile.apiKey }))
        : [],
      messages: Array.isArray(parsed.messages) ? parsed.messages.filter((message) => message?.role && message?.content) : [],
    };
  } catch {
    return {
      open: false,
      settingsOpen: false,
      activeProfileId: null,
      profiles: [],
      messages: [],
    };
  }
}

function cloneDefaultState() {
  return JSON.parse(JSON.stringify(defaultState));
}

function createId(prefix = "item") {
  if (window.crypto?.randomUUID) {
    return `${prefix}-${window.crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function validText(value, fallback) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function defaultTabLabel(index) {
  return ["買い物", "仕事", "病院", "家", "予定"][((index ?? 1) - 1) % 5];
}

function handleItemPointerDown(event) {
  if (event.pointerType === "mouse" && event.button !== 0) {
    return;
  }

  if (event.target.closest(".check-control") || event.target.closest(".title-input") || event.target.closest(".memo-input") || event.target.closest(".meta-field") || event.target.closest(".pin-field")) {
    return;
  }

  const itemElement = event.currentTarget;
  const itemId = itemElement.dataset.id;
  clearPressTimer();
  pressStartPoint = { x: event.clientX, y: event.clientY };

  pressTimer = window.setTimeout(() => {
    draggingItemId = itemId;
    draggingPointerId = event.pointerId;
    suppressClick = true;
    itemElement.setPointerCapture?.(event.pointerId);
    render();
  }, 320);
}

function handleDragPointerMove(event) {
  if (pressTimer !== null && draggingItemId === null && pressStartPoint) {
    const deltaX = Math.abs(event.clientX - pressStartPoint.x);
    const deltaY = Math.abs(event.clientY - pressStartPoint.y);
    if (deltaX > 10 || deltaY > 10) {
      clearPressTimer();
    }
  }

  if (draggingItemId === null || draggingPointerId !== event.pointerId) {
    return;
  }

  const target = document.elementFromPoint(event.clientX, event.clientY)?.closest(".todo-item");
  if (!target) {
    return;
  }

  const targetId = target.dataset.id;
  if (!targetId || targetId === draggingItemId) {
    return;
  }

  moveTodoBefore(draggingItemId, targetId);
}

function finishLongPressDrag(event) {
  clearPressTimer();

  if (draggingItemId !== null && (!event || draggingPointerId === event.pointerId)) {
    draggingItemId = null;
    draggingPointerId = null;
    window.setTimeout(() => {
      suppressClick = false;
    }, 0);
    render();
  }
}

function clearPressTimer() {
  if (pressTimer !== null) {
    window.clearTimeout(pressTimer);
    pressTimer = null;
  }
  pressStartPoint = null;
}

function moveTodoBefore(sourceId, targetId) {
  const currentPage = getCurrentPage();
  const sourceIndex = currentPage.items.findIndex((item) => item.id === sourceId);
  const targetIndex = currentPage.items.findIndex((item) => item.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
    return;
  }

  const [item] = currentPage.items.splice(sourceIndex, 1);
  const nextIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
  currentPage.items.splice(nextIndex, 0, item);
  persist();
  render();
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function openAiPanel() {
  aiState.open = true;
  renderAiPanel();
}

function closeAiPanel() {
  aiState.open = false;
  aiState.settingsOpen = false;
  renderAiPanel();
}

function openAiSettingsPanel() {
  aiState.settingsOpen = true;
  aiState.open = true;
  renderAiPanel();
}

function closeAiSettingsPanel() {
  aiState.settingsOpen = false;
  renderAiPanel();
}

function handleAiProfileSubmit(event) {
  event.preventDefault();
  const name = aiProfileNameInput.value.trim();
  const apiKey = aiProfileKeyInput.value.trim();
  if (!name || !apiKey) {
    pushAiMessage("system", "API設定には名前と APIキーの両方が必要です。");
    return;
  }

  if (!apiKey.startsWith("pk_")) {
    pushAiMessage("system", "このTODOアプリはブラウザで動くので、Noesia の `pk_` キーを入れてください。");
    return;
  }

  const profile = {
    id: createId("ai"),
    name,
    apiKey,
  };

  aiState.profiles.push(profile);
  aiState.activeProfileId = profile.id;
  aiProfileNameInput.value = "";
  aiProfileKeyInput.value = "";
  persistAiState();
  renderAiPanel();
}

function runAiAction(label, prompt) {
  sendAiMessage(`【${label}】\n${prompt}`);
}

async function sendAiMessage(message) {
  const activeProfile = getActiveAiProfile();
  if (!activeProfile) {
    pushAiMessage("system", "API設定で APIキーを追加して選んでください。");
    return;
  }

  pushAiMessage("user", message);
  pushAiMessage("system", "AIが考えています…");

  try {
    const context = aiState.messages
      .filter((entry) => entry.role === "user" || entry.role === "assistant")
      .slice(-10)
      .map((entry) => ({ role: entry.role, content: entry.content }));

    const response = await fetch(`${DEFAULT_NOESIA_BASE_URL}/v1/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": activeProfile.apiKey,
      },
      body: JSON.stringify({
        message: `${buildCurrentPageSummary()}\n\n依頼: ${message}`,
        context,
        lang: "ja",
        max_tokens: 600,
      }),
    });

    const data = await response.json();
    removeLastSystemThinking();

    if (!response.ok) {
      pushAiMessage("system", formatNoesiaError(response.status, data));
      return;
    }

    pushAiMessage("assistant", data.reply ?? "返答がありませんでした。");
  } catch (error) {
    removeLastSystemThinking();
    pushAiMessage("system", "API接続エラー");
  }
}

function formatNoesiaError(status, data) {
  const detail = data?.detail;
  const error = detail?.error;
  const code = error?.code ?? "";
  const requestId = error?.request_id ?? data?.request_id ?? "";

  let message = "API接続エラー";
  if (code === "insufficient_balance" || status === 402) {
    message = "token切れ";
  } else if (code === "origin_not_allowed" || status === 403) {
    message = "このURLはNoesiaで許可されていません";
  } else if (code === "rate_limit_exceeded" || status === 429) {
    message = "アクセスが多すぎます。少し待ってください";
  } else if (code === "invalid_api_key" || status === 401) {
    message = "APIキーエラー";
  } else if (code === "persona_not_found" || status === 404) {
    message = "人格データが見つかりません";
  } else if (error?.message) {
    message = `APIエラー: ${error.message}`;
  }

  return requestId ? `${message}\nrequest_id: ${requestId}` : message;
}

function buildCurrentPageSummary() {
  const page = getCurrentPage();
  const lines = [
    `現在のページ名: ${page.title}`,
    `付箋名: ${page.tabLabel}`,
    `テーマ: ${page.theme}`,
    "TODO一覧:",
  ];

  if (!page.items.length) {
    lines.push("- 予定なし");
  } else {
    page.items.forEach((item, index) => {
      lines.push(`- ${index + 1}. ${item.text || "無題"} / 完了:${item.completed ? "はい" : "いいえ"} / ピン:${item.pinned ? "はい" : "いいえ"} / スタンプ:${item.stamp || "なし"} / 期限:${item.dueDate || "なし"} / メモ:${item.memo || "なし"}`);
    });
  }

  return lines.join("\n");
}

function pushAiMessage(role, content) {
  aiState.messages.push({ role, content });
  persistAiState();
  aiState.open = true;
  renderAiPanel();
}

function removeLastSystemThinking() {
  const last = aiState.messages.at(-1);
  if (last?.role === "system" && last.content === "AIが考えています…") {
    aiState.messages.pop();
    persistAiState();
  }
}

function appendAiMessageElement(role, content) {
  const node = document.createElement("div");
  node.className = `ai-message ${role}`;
  node.textContent = content;
  aiMessages.appendChild(node);
}

function renderAiProfileList() {
  aiProfileList.innerHTML = "";

  if (!aiState.profiles.length) {
    const empty = document.createElement("div");
    empty.className = "ai-message system";
    empty.textContent = "まだ API は登録されていません。";
    aiProfileList.appendChild(empty);
    return;
  }

  aiState.profiles.forEach((profile) => {
    const card = document.createElement("div");
    card.className = "ai-profile-card";
    card.classList.toggle("active", profile.id === aiState.activeProfileId);

    const row = document.createElement("div");
    row.className = "ai-profile-row";

    const name = document.createElement("div");
    name.className = "ai-profile-name";
    name.textContent = profile.name;

    const mask = document.createElement("div");
    mask.className = "ai-profile-key-mask";
    mask.textContent = `${profile.apiKey.slice(0, 6)}••••••`;

    row.appendChild(name);
    row.appendChild(mask);

    const actions = document.createElement("div");
    actions.className = "ai-profile-actions";

    const useButton = document.createElement("button");
    useButton.type = "button";
    useButton.className = "ai-mini-button";
    useButton.textContent = profile.id === aiState.activeProfileId ? "使用中" : "使う";
    useButton.disabled = profile.id === aiState.activeProfileId;
    useButton.addEventListener("click", () => {
      aiState.activeProfileId = profile.id;
      persistAiState();
      renderAiPanel();
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "ai-mini-button";
    deleteButton.textContent = "削除";
    deleteButton.addEventListener("click", () => {
      aiState.profiles = aiState.profiles.filter((entry) => entry.id !== profile.id);
      if (aiState.activeProfileId === profile.id) {
        aiState.activeProfileId = aiState.profiles[0]?.id ?? null;
      }
      persistAiState();
      renderAiPanel();
    });

    actions.appendChild(useButton);
    actions.appendChild(deleteButton);
    card.appendChild(row);
    card.appendChild(actions);
    aiProfileList.appendChild(card);
  });
}

function getActiveAiProfile() {
  return aiState.profiles.find((profile) => profile.id === aiState.activeProfileId) ?? null;
}
