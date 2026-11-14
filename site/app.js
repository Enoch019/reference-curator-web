(function () {
  "use strict";

  var REPO = "https://github.com/Enoch019/reference-curator-web-web";
  var SOURCES = ["artstation", "pinterest", "behance", "flickr"];
  var TEXT_FIELDS = ["label", "direction", "period", "architecture", "materials", "lighting", "palette"];
  var DEFAULT_ROLES = {
    silhouette: "Wide-angle view emphasizing overall form, silhouette and spatial hierarchy.",
    architecture: "Close-up reference emphasizing authentic structural details and materials.",
    atmosphere: "Environmental reference emphasizing lighting, weather, scale and mood."
  };
  var initial = window.REFERENCE_CURATOR_BOOTSTRAP || {
    active_topic: "gothic_fantasy_castles",
    topics: {
      gothic_fantasy_castles: {
        label: "고딕 성채 · 어두운 중세 판타지",
        direction: "Curate atmospheric medieval Gothic castle reference images with believable stone architecture.",
        fantasy_intensity: 1, vision_strictness: "balanced",
        roles: DEFAULT_ROLES,
        artstation: ["gothic castle environment concept art"],
        pinterest: ["medieval gothic castle photography"],
        behance: ["gothic architecture environment design"],
        flickr: ["medieval stone castle photography"]
      }
    },
    vision: {enabled: true, max_candidates: 7},
    minimum_image_width: 480,
    minimum_image_height: 320
  };

  function clone(obj) { return JSON.parse(JSON.stringify(obj)); }
  function el(id) { return document.getElementById(id); }
  function value(id) { return el(id).value.trim(); }
  function selected(id) { return el(id).checked; }
  function setValue(id, text) { el(id).value = text == null ? "" : String(text); }
  function lines(text) {
    return String(text || "").split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean);
  }
  function safeArray(value) { return Array.isArray(value) ? value.filter(function (s) { return typeof s === "string"; }) : []; }
  function cleanConfig(raw) {
    if (!raw || typeof raw !== "object" || !raw.topics || typeof raw.topics !== "object" || !Object.keys(raw.topics).length) {
      throw new Error("topics가 포함된 유효한 config.json을 선택하세요.");
    }
    return {
      active_topic: typeof raw.active_topic === "string" ? raw.active_topic : Object.keys(raw.topics)[0],
      max_results: 3,
      minimum_image_width: Number.isInteger(raw.minimum_image_width) ? raw.minimum_image_width : 480,
      minimum_image_height: Number.isInteger(raw.minimum_image_height) ? raw.minimum_image_height : 320,
      topics: clone(raw.topics),
      vision: {
        enabled: !!(raw.vision && raw.vision.enabled),
        model: raw.vision && typeof raw.vision.model === "string" ? raw.vision.model : "gpt-4o-mini",
        max_candidates: raw.vision && Number.isInteger(raw.vision.max_candidates) ? raw.vision.max_candidates : 7
      }
    };
  }
  var state = {
    cfg: cleanConfig(initial),
    selectedId: "",
    drafts: {},
    tab: "direction"
  };
  var requestedTopic = new URLSearchParams(window.location.search).get("topic");
  state.selectedId = requestedTopic && Object.prototype.hasOwnProperty.call(state.cfg.topics, requestedTopic)
    ? requestedTopic
    : (Object.prototype.hasOwnProperty.call(state.cfg.topics, state.cfg.active_topic)
      ? state.cfg.active_topic : Object.keys(state.cfg.topics)[0]);

  function starterProfile(topicId) {
    var name = topicId.replace(/_/g, " ");
    return {
      label: name, direction: "Collect detailed visual references for " + name + " with realistic materials and usable forms.",
      fantasy_intensity: 1, period: "", architecture: "", materials: "", lighting: "", palette: "",
      include: [], exclude: [], roles: clone(DEFAULT_ROLES),
      vision_strictness: "balanced",
      artstation: [name + " environment art"], pinterest: [name + " architecture reference"],
      behance: [], flickr: []
    };
  }

  function normalizeProfile(input, id) {
    var base = starterProfile(id);
    var profile = Object.assign(base, clone(input || {}));
    profile.roles = Object.assign(clone(DEFAULT_ROLES), profile.roles || {});
    SOURCES.forEach(function (source) { profile[source] = safeArray(profile[source]); });
    profile.include = safeArray(profile.include);
    profile.exclude = safeArray(profile.exclude);
    return profile;
  }

  function getDraft(id) {
    if (!state.drafts[id]) {
      var profile = normalizeProfile(state.cfg.topics[id], id);
      var enabled = {};
      SOURCES.forEach(function (source) { enabled[source] = profile[source].length > 0; });
      state.drafts[id] = {profile: profile, enabled: enabled, activate: id === state.cfg.active_topic};
    }
    return state.drafts[id];
  }

  function renderTopics() {
    var list = el("topicList");
    list.replaceChildren();
    var ids = Object.keys(state.cfg.topics);
    el("topicCount").textContent = String(ids.length).padStart(2, "0");
    ids.forEach(function (id, index) {
      var draft = getDraft(id);
      var button = document.createElement("button");
      button.type = "button";
      button.className = "topic-item" + (id === state.selectedId ? " active" : "");
      button.setAttribute("aria-current", id === state.selectedId ? "true" : "false");
      var number = document.createElement("span");
      number.className = "topic-index";
      number.textContent = String(index + 1).padStart(2, "0");
      var copy = document.createElement("span");
      copy.className = "topic-text";
      var title = document.createElement("strong");
      title.textContent = draft.profile.label || id;
      var key = document.createElement("small");
      key.textContent = id;
      copy.append(title, key);
      button.append(number, copy);
      if (id === state.cfg.active_topic) {
        var active = document.createElement("span");
        active.className = "topic-active-tag";
        active.textContent = "LIVE";
        button.append(active);
      }
      button.addEventListener("click", function () { changeTopic(id); });
      list.append(button);
    });
  }

  function loadEditor() {
    var draft = getDraft(state.selectedId);
    var p = draft.profile;
    setValue("topicId", state.selectedId);
    TEXT_FIELDS.forEach(function (field) { setValue(field, p[field]); });
    setValue("fantasy", p.fantasy_intensity == null ? 1 : p.fantasy_intensity);
    setValue("include", safeArray(p.include).join("\n"));
    setValue("exclude", safeArray(p.exclude).join("\n"));
    setValue("silhouette", p.roles.silhouette);
    setValue("roleArchitecture", p.roles.architecture);
    setValue("atmosphere", p.roles.atmosphere);
    setValue("strictness", p.vision_strictness || "balanced");
    SOURCES.forEach(function (source) {
      document.querySelector('[data-enabled="' + source + '"]').checked = !!draft.enabled[source];
      document.querySelector('[data-queries="' + source + '"]').value = safeArray(p[source]).join("\n");
    });
    el("visionEnabled").checked = !!state.cfg.vision.enabled;
    setValue("maxCandidates", state.cfg.vision.max_candidates || 7);
    setValue("minWidth", state.cfg.minimum_image_width);
    setValue("minHeight", state.cfg.minimum_image_height);
    el("activate").checked = draft.activate;
    renderFantasy();
    updateSources();
    renderReview();
  }

  function readEditor() {
    var draft = getDraft(state.selectedId);
    var p = draft.profile;
    TEXT_FIELDS.forEach(function (field) { p[field] = value(field); });
    p.fantasy_intensity = Number(el("fantasy").value);
    p.include = lines(el("include").value);
    p.exclude = lines(el("exclude").value);
    p.roles = {silhouette: value("silhouette"), architecture: value("roleArchitecture"), atmosphere: value("atmosphere")};
    p.vision_strictness = el("strictness").value;
    SOURCES.forEach(function (source) {
      p[source] = lines(document.querySelector('[data-queries="' + source + '"]').value);
      draft.enabled[source] = document.querySelector('[data-enabled="' + source + '"]').checked;
    });
    draft.activate = selected("activate");
    state.cfg.vision.enabled = selected("visionEnabled");
    state.cfg.vision.max_candidates = Number(el("maxCandidates").value);
    state.cfg.minimum_image_width = Number(el("minWidth").value);
    state.cfg.minimum_image_height = Number(el("minHeight").value);
    return draft;
  }

  function effectiveProfile(draft) {
    var p = clone(draft.profile);
    SOURCES.forEach(function (source) { if (!draft.enabled[source]) p[source] = []; });
    return p;
  }

  function buildSubmission(validate) {
    var draft = readEditor();
    var id = value("topicId");
    var profile = effectiveProfile(draft);
    if (validate) {
      if (!/^[a-z][a-z0-9_]{2,63}$/.test(id)) throw new Error("Topic ID는 3~64자의 영문 소문자·숫자·밑줄이어야 합니다.");
      if (!profile.label || profile.label.length > 90) throw new Error("토픽 이름을 1~90자로 입력하세요.");
      if (profile.direction.length < 8 || profile.direction.length > 2000) throw new Error("Visual Direction을 8~2000자로 입력하세요.");
      ["silhouette", "architecture", "atmosphere"].forEach(function (role) {
        if (profile.roles[role].length < 8 || profile.roles[role].length > 2000) {
          throw new Error(role + " 역할 설명을 8~2000자로 입력하세요.");
        }
      });
      ["include", "exclude"].forEach(function (field) {
        if (profile[field].length > 12 || profile[field].some(function (s) { return s.length > 140; }))
          throw new Error(field + "는 12개 이하, 항목당 140자 이하로 입력하세요.");
      });
      var enabledCount = 0;
      SOURCES.forEach(function (source) {
        if (profile[source].length) enabledCount++;
        if (profile[source].length > 8 || profile[source].some(function (s) { return s.length < 3 || s.length > 140; }))
          throw new Error(source + " 검색어는 최대 8개, 각 3~140자로 입력하세요.");
      });
      if (!enabledCount) throw new Error("검색 소스를 최소 1개 활성화하고 검색어를 입력하세요.");
      ["period", "architecture", "materials", "lighting", "palette"].forEach(function (field) {
        if (profile[field].length > 2000) throw new Error(field + "는 최대 2000자입니다.");
      });
      if (!Number.isInteger(state.cfg.vision.max_candidates) || state.cfg.vision.max_candidates < 3 || state.cfg.vision.max_candidates > 7)
        throw new Error("Vision 후보 수는 3~7 사이입니다.");
      if (!Number.isInteger(state.cfg.minimum_image_width) || state.cfg.minimum_image_width < 64 || state.cfg.minimum_image_width > 4096 ||
          !Number.isInteger(state.cfg.minimum_image_height) || state.cfg.minimum_image_height < 64 || state.cfg.minimum_image_height > 4096)
        throw new Error("최소 이미지 크기는 64~4096px입니다.");
    }
    return {
      version: 1, topic_id: id, profile: profile, activate: draft.activate,
      options: {
        vision_enabled: state.cfg.vision.enabled,
        max_candidates: state.cfg.vision.max_candidates,
        min_width: state.cfg.minimum_image_width,
        min_height: state.cfg.minimum_image_height
      }
    };
  }

  function updateSources() {
    SOURCES.forEach(function (source) {
      var checkbox = document.querySelector('[data-enabled="' + source + '"]');
      var input = document.querySelector('[data-queries="' + source + '"]');
      var card = document.querySelector('.source-card[data-source="' + source + '"]');
      var enabled = checkbox.checked;
      card.classList.toggle("off", !enabled);
      input.disabled = !enabled;
      el("count-" + source).textContent = (enabled ? lines(input.value).length : 0) + " QUERIES" + (!enabled ? " · DISABLED" : "");
    });
  }
  function renderFantasy() {
    var labels = ["0 / HISTORICAL", "1 / SUBTLE", "2 / MODERATE", "3 / HIGH FANTASY"];
    el("fantasyValue").textContent = labels[Number(el("fantasy").value)] || labels[1];
  }
  function renderReview() {
    var draft = getDraft(state.selectedId);
    var p = effectiveProfile(draft);
    var activeSources = SOURCES.filter(function (source) { return p[source].length; });
    var queryCount = activeSources.reduce(function (sum, source) { return sum + p[source].length; }, 0);
    el("reviewName").textContent = p.label || "—";
    el("reviewId").textContent = value("topicId") || state.selectedId;
    el("reviewSources").textContent = activeSources.length + " / 4";
    el("reviewQueries").textContent = queryCount + " SEARCH QUERIES";
    el("reviewVision").textContent = state.cfg.vision.enabled ? "ENABLED" : "DISABLED";
    el("reviewStrictness").textContent = String(p.vision_strictness || "balanced").toUpperCase() + " · " + state.cfg.vision.max_candidates + " CANDIDATES";
    el("reviewResolution").textContent = state.cfg.minimum_image_width + " × " + state.cfg.minimum_image_height;
    el("reviewActive").textContent = draft.activate ? "ACTIVATE ON SAVE" : "KEEP CURRENT ACTIVE TOPIC";
    var summary = "**topic : " + (p.label || state.selectedId) + "**\n\n";
    summary += "1. [Source] Selected silhouette reference\n";
    summary += "2. [Source] Selected architecture reference\n";
    summary += "3. [Source] Selected atmosphere reference";
    el("discordPreview").textContent = summary;
  }

  function setTab(name) {
    state.tab = name;
    document.querySelectorAll("[data-tab]").forEach(function (btn) {
      btn.setAttribute("aria-selected", btn.getAttribute("data-tab") === name ? "true" : "false");
    });
    ["direction", "sources", "vision", "review"].forEach(function (tab) {
      var visible = tab === name;
      el("panel-" + tab).hidden = !visible;
      el("panel-" + tab).classList.toggle("active", visible);
    });
    if (name === "review") renderReview();
  }

  function changeTopic(id) {
    if (id === state.selectedId) return;
    readEditor();
    state.selectedId = id;
    var url = new URL(window.location.href);
    url.searchParams.set("topic", id);
    window.history.replaceState(null, "", url);
    renderTopics();
    loadEditor();
  }

  function newTopic(copyExisting) {
    readEditor();
    var current = getDraft(state.selectedId);
    var suggested = copyExisting ? state.selectedId + "_copy" : "new_reference_topic";
    var id = window.prompt(copyExisting ? "복제할 토픽의 새 ID를 입력하세요." : "새 토픽 ID를 입력하세요.", suggested);
    if (id == null) return;
    id = id.trim();
    if (!/^[a-z][a-z0-9_]{2,63}$/.test(id)) return notify("토픽 ID는 3~64자의 소문자·숫자·밑줄만 사용할 수 있습니다.", true);
    if (Object.prototype.hasOwnProperty.call(state.cfg.topics, id)) return notify("이미 사용 중인 토픽 ID입니다.", true);
    var profile = copyExisting ? clone(current.profile) : starterProfile(id);
    if (copyExisting) profile.label = (profile.label + " Copy").slice(0, 90);
    state.cfg.topics[id] = clone(profile);
    var enabled = {};
    SOURCES.forEach(function (source) { enabled[source] = copyExisting ? current.enabled[source] : profile[source].length > 0; });
    state.drafts[id] = {profile: profile, enabled: enabled, activate: true};
    state.selectedId = id;
    renderTopics();
    loadEditor();
    setTab("direction");
    notify("새 토픽을 만들었습니다. GitHub에 저장하기 전까지는 이 편집기에서만 존재합니다.");
  }

  function notify(message, error) {
    var toast = el("toast");
    toast.textContent = message;
    toast.classList.toggle("error", !!error);
    toast.classList.add("show");
    clearTimeout(notify.timer);
    notify.timer = setTimeout(function () { toast.classList.remove("show"); }, 5800);
  }

  function showModal(raw, reason) {
    el("payloadOutput").value = raw;
    el("modalHint").textContent = reason || "GitHub에서 Issue를 확인하고 제출하세요. 자동 입력이 되지 않았다면 아래 JSON을 복사해 붙여넣으세요.";
    el("openIssue").href = REPO + "/issues/new?template=reference-dashboard.yml";
    el("modal").hidden = false;
    el("copyPayload").focus();
  }
  function save() {
    try {
      var payload = buildSubmission(true);
      var raw = JSON.stringify(payload);
      var params = new URLSearchParams();
      params.set("template", "reference-dashboard.yml");
      params.set("title", "[Curator Web] " + payload.topic_id);
      params.set("payload", raw);
      var url = REPO + "/issues/new?" + params.toString();
      // GitHub documents a 414 for oversized issue URLs. Fall back to copy/paste.
      if (url.length > 7500) {
        showModal(JSON.stringify(payload, null, 2), "설정이 길어 자동 입력 URL을 사용할 수 없습니다. JSON을 복사한 뒤 GitHub Issue 양식에 붙여넣고 제출하세요.");
        return;
      }
      var newTab = window.open(url, "_blank");
      if (newTab) { try { newTab.opener = null; } catch (_error) {} }
      if (!newTab) {
        showModal(JSON.stringify(payload, null, 2), "새 탭이 차단되었거나 자동 입력에 실패했을 수 있습니다. JSON을 복사하고 Issue 양식을 열어 제출하세요.");
      } else {
        notify("GitHub 저장 요청 양식을 새 탭에서 열었습니다. Submit new issue를 눌러 저장을 완료하세요.");
      }
    } catch (err) {
      notify(err.message || "입력값을 확인하세요.", true);
    }
  }

  function exportConfig() {
    try {
      var payload = buildSubmission(true);
      var exported = clone(state.cfg);
      Object.keys(state.drafts).forEach(function (key) {
        var draft = state.drafts[key];
        exported.topics[key] = effectiveProfile(draft);
      });
      exported.topics[payload.topic_id] = payload.profile;
      if (payload.activate) exported.active_topic = payload.topic_id;
      var blob = new Blob([JSON.stringify(exported, null, 2) + "\n"], {type: "application/json"});
      var url = URL.createObjectURL(blob);
      var link = document.createElement("a");
      link.href = url;
      link.download = "reference-curator-config.json";
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
      notify("config.json을 내려받았습니다. 이 작업은 GitHub에 자동 저장되지 않습니다.");
    } catch (err) {
      notify(err.message || "내보내기에 실패했습니다.", true);
    }
  }

  function importConfig(event) {
    var file = event.target.files && event.target.files[0];
    if (!file) return;
    file.text().then(function (raw) {
      var next = cleanConfig(JSON.parse(raw));
      state.cfg = next;
      state.drafts = {};
      state.selectedId = Object.prototype.hasOwnProperty.call(next.topics, next.active_topic) ? next.active_topic : Object.keys(next.topics)[0];
      renderTopics();
      loadEditor();
      setTab("direction");
      notify("config.json을 불러왔습니다. GitHub에 적용하려면 저장 요청을 제출하세요.");
    }).catch(function (err) {
      notify("파일을 불러올 수 없습니다: " + (err.message || "JSON 오류"), true);
    }).finally(function () { el("configFile").value = ""; });
  }

  document.querySelectorAll("[data-tab]").forEach(function (btn) {
    btn.addEventListener("click", function () { readEditor(); setTab(btn.getAttribute("data-tab")); });
  });
  el("editor").addEventListener("input", function () {
    readEditor();
    renderFantasy();
    updateSources();
    renderReview();
  });
  el("editor").addEventListener("change", function () {
    readEditor();
    updateSources();
    renderReview();
  });
  el("newTopic").addEventListener("click", function () { newTopic(false); });
  el("duplicateTopic").addEventListener("click", function () { newTopic(true); });
  el("importBtn").addEventListener("click", function () { el("configFile").click(); });
  el("configFile").addEventListener("change", importConfig);
  el("exportBtn").addEventListener("click", exportConfig);
  el("saveTop").addEventListener("click", save);
  el("saveBottom").addEventListener("click", save);
  el("closeModal").addEventListener("click", function () { el("modal").hidden = true; });
  el("modal").addEventListener("click", function (ev) { if (ev.target === el("modal")) el("modal").hidden = true; });
  document.addEventListener("keydown", function (ev) { if (ev.key === "Escape") el("modal").hidden = true; });
  el("copyPayload").addEventListener("click", function () {
    var text = el("payloadOutput").value;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { notify("JSON을 복사했습니다."); }).catch(function () {
        el("payloadOutput").focus(); el("payloadOutput").select(); notify("자동 복사가 불가능합니다. Ctrl+C를 눌러 복사하세요.");
      });
    } else {
      el("payloadOutput").focus(); el("payloadOutput").select(); notify("Ctrl+C를 눌러 JSON을 복사하세요.");
    }
  });
  el("editor").addEventListener("submit", function (ev) { ev.preventDefault(); });

  renderTopics();
  loadEditor();
  setTab("direction");
})();
