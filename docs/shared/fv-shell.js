/* ============================================================================
   fv-shell.js · FairValpha 子站共享外壳 (/lab/ /rightside/ /targets/ /strategies/)
   源文件: stock-core/dashboard/fv-shell.js
   产物镜像: stock-screener/docs/shared/fv-shell.js
   规格: stock-core/design/mobile_nav_spec.md §6
   ----------------------------------------------------------------------------
   职责 (只做这四件事, 不碰子站正文):
     1. 48px sticky 页头: ← 回来源市场 · 面包屑 · A|US 分段(双市页) · 主题 · 语言
     2. 主题/语言与两市工作台同源共享: 读写同一批 localStorage 键
        (fv_shell_from → us_theme_v2|ashare_theme_v2 / us_lang_v1|ashare_lang_v1)
     3. 被 iframe 内嵌 (window.self!==window.top) 时整条外壳隐藏 —— 父页已有页头
     4. 给子站提供极小 API: fvShell.lang / .market / .onLang / .onMarket / .applyI18n

   页面用法 (在引入本文件之前声明):
     <script>window.FV_SHELL_CFG={page:'lab', from:'a', markets:true};</script>
     <script src="/shared/fv-shell.js?v=1"></script>
   page: 面包屑用哪个站名 (lab|rightside|targets|strategies)
   from: 无历史来源时的默认市场 ('a'|'us')
   markets: true = 渲染 A|US 分段 (双市页, 如 /lab/)
   ========================================================================== */
(function () {
  "use strict";

  var CFG = window.FV_SHELL_CFG || {};
  var EMBED = false;
  try { EMBED = (window.self !== window.top); } catch (e) { EMBED = true; }

  /* ---------------------------------------------------------------- i18n */
  var T = {
    zh: {
      brand: "FairValpha",
      back_desk: "返回工作台", back_a: "返回 A股工作台", back_us: "返回美股工作台",
      site_lab: "量化工作台", site_rightside: "右侧工作台",
      site_targets: "分析师目标", site_strategies: "策略库",
      mkt_a: "A股", mkt_us: "美股",
      theme_dark: "🌙 黑夜", theme_light: "☀️ 白天", theme_auto: "🖥️ 跟随系统",
      theme_btn_title: "点击切换：白天 / 黑夜 / 跟随系统",
      lang_btn: "EN", lang_btn_title: "切换到 English",
      market_title: "切换市场"
    },
    en: {
      brand: "FairValpha",
      back_desk: "Back to desk", back_a: "Back to A-share desk", back_us: "Back to US desk",
      site_lab: "Quant Lab", site_rightside: "Right-side Desk",
      site_targets: "Analyst Targets", site_strategies: "Strategies",
      mkt_a: "CN", mkt_us: "US",
      theme_dark: "🌙 Dark", theme_light: "☀️ Light", theme_auto: "🖥️ System",
      theme_btn_title: "Click to cycle: Light / Dark / System",
      lang_btn: "中文", lang_btn_title: "Switch to Chinese",
      market_title: "Switch market"
    }
  };

  /* ------------------------------------------------------------ 来源市场 */
  function readFrom() {
    var v = null;
    try { v = localStorage.getItem("fv_shell_from"); } catch (e) {}
    if (v === "a" || v === "us") return v;
    var ref = "";
    try { ref = document.referrer || ""; } catch (e) {}
    if (/\/us\//.test(ref)) return "us";
    if (/\/a\//.test(ref)) return "a";
    return (CFG.from === "us") ? "us" : (CFG.from === "a" ? "a" : "a");
  }
  var FROM = readFrom();
  var THEME_KEY = (FROM === "us") ? "us_theme_v2" : "ashare_theme_v2";
  var LANG_KEY  = (FROM === "us") ? "us_lang_v1"  : "ashare_lang_v1";

  function ls(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  /* ------------------------------------------------------------ 主题状态 */
  var mqLight = window.matchMedia ? window.matchMedia("(prefers-color-scheme: light)") : null;
  var themeMode = ls(THEME_KEY, "dark");
  if (["light", "dark", "auto"].indexOf(themeMode) < 0) themeMode = "dark";
  function effLight() { return themeMode === "light" || (themeMode === "auto" && mqLight && mqLight.matches); }

  var LANG = ls(LANG_KEY, "zh"); if (LANG !== "en") LANG = "zh";
  var MARKET = (CFG.markets ? (ls("fv_shell_market", FROM) === "us" ? "us" : "a") : FROM);

  function t(k) { return (T[LANG] && T[LANG][k]) || T.zh[k] || k; }

  /* -------------------------------------------------------- 应用主题/语言 */
  function metaTheme(color) {
    var m = document.querySelector('meta[name="theme-color"]');
    if (!m) { m = document.createElement("meta"); m.setAttribute("name", "theme-color");
      (document.head || document.documentElement).appendChild(m); }
    m.setAttribute("content", color);
  }
  function applyTheme() {
    if (EMBED) return;                       // 内嵌时主题由父工作台注入, 外壳不抢方向盘
    var light = effLight();
    var root = document.documentElement;
    root.setAttribute("data-theme", light ? "light" : "dark");
    if (document.body) document.body.classList.toggle("light", light);
    metaTheme(light ? "#eef2f8" : "#0b1220");
    lsSet(THEME_KEY, themeMode);
  }
  function applyLang() {
    if (EMBED) return;
    document.documentElement.setAttribute("lang", LANG === "en" ? "en" : "zh-CN");
    lsSet(LANG_KEY, LANG);
  }
  /* 主题真相 = html[data-theme] (自己写的, 或父工作台注入的) —— 一律经它通知子站重绘 */
  function watchTheme() {
    var last = null;
    var tick = function () {
      var v = document.documentElement.getAttribute("data-theme") === "light";
      // 内嵌时不挂 body.light: 令牌一律走 :root (父页注入 + .fv-embed 映射), 否则
      // body 上的浅色块会盖住注入值, iframe 里就跟父工作台不是同一张皮。
      if (document.body && !EMBED) document.body.classList.toggle("light", v);
      if (v !== last) { last = v; api.isLightNow = v; fire(themeCbs, v); }
    };
    tick();
    new MutationObserver(tick).observe(document.documentElement,
      { attributes: true, attributeFilter: ["data-theme"] });
  }

  /* 内嵌时等父工作台把 #fvOverride 注进来 (旧名令牌), 到了才挂 .fv-embed 做名字映射 */
  function watchEmbedSkin() {
    if (!EMBED) return;
    var root = document.documentElement, tries = 0;
    var chk = function () {
      var has = getComputedStyle(root).getPropertyValue("--surface").trim() !== "";
      root.classList.toggle("fv-embed", has);
      if (!has && ++tries < 60) setTimeout(chk, 150);
    };
    chk();
    new MutationObserver(chk).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  }

  /* ------------------------------------------------------------ 事件回调 */
  var langCbs = [], themeCbs = [], mktCbs = [];
  function fire(list, a) { for (var i = 0; i < list.length; i++) { try { list[i](a); } catch (e) {} } }

  /* ------------------------------------------------------- i18n 静态套用 */
  function applyI18n(dict, root) {
    var d = (dict && (dict[LANG] || dict.zh)) || {};
    var fb = (dict && dict.zh) || {};
    var scope = root || document;
    var get = function (k) { return d[k] != null ? d[k] : fb[k]; };
    scope.querySelectorAll("[data-i18n]").forEach(function (el) {
      var v = get(el.getAttribute("data-i18n")); if (v != null) el.textContent = v;
    });
    scope.querySelectorAll("[data-i18n-html]").forEach(function (el) {
      var v = get(el.getAttribute("data-i18n-html")); if (v != null) el.innerHTML = v;
    });
    scope.querySelectorAll("[data-i18n-title]").forEach(function (el) {
      var v = get(el.getAttribute("data-i18n-title")); if (v != null) el.setAttribute("title", v);
    });
    scope.querySelectorAll("[data-i18n-ph]").forEach(function (el) {
      var v = get(el.getAttribute("data-i18n-ph")); if (v != null) el.setAttribute("placeholder", v);
    });
  }

  /* ---------------------------------------------------------------- 页头 */
  var ICONS = '<svg width="0" height="0" style="position:absolute" aria-hidden="true">' +
    '<symbol id="fvi-back" viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></symbol>' +
    '<symbol id="fvi-moon" viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></symbol>' +
    '<symbol id="fvi-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/>' +
      '<path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></symbol>' +
    '<symbol id="fvi-auto" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></symbol>' +
    "</svg>";

  var shell = null;
  function build() {
    if (EMBED) return;                       // 被工作台 iframe 内嵌: 父页已有页头
    if (document.getElementById("fvShell")) return;
    var wrap = document.createElement("div");
    wrap.innerHTML = ICONS;
    var h = document.createElement("header");
    h.id = "fvShell";
    h.innerHTML =
      '<a class="fv-ib" id="fvBack" href="#"><svg class="fv-ico"><use href="#fvi-back"/></svg></a>' +
      '<div class="fv-crumb"><small id="fvBrand"></small> <span id="fvCrumb"></span></div>' +
      (CFG.markets ? '<div class="fv-seg" id="fvMkts"><button type="button" data-m="a"></button>' +
                     '<button type="button" data-m="us"></button></div>' : "") +
      '<button class="fv-ib" type="button" id="fvTheme"><svg class="fv-ico"><use href="#fvi-moon"/></svg></button>' +
      '<button class="fv-ib fv-txt" type="button" id="fvLang"></button>';
    var body = document.body;
    body.insertBefore(h, body.firstChild);
    body.insertBefore(wrap.firstChild, h);
    shell = h;

    h.querySelector("#fvBack").addEventListener("click", function (e) {
      e.preventDefault();
      lsSet("fv_shell_from", FROM);
      location.href = "/" + FROM + "/";
    });
    h.querySelector("#fvTheme").addEventListener("click", function () {
      themeMode = themeMode === "dark" ? "light" : (themeMode === "light" ? "auto" : "dark");
      applyTheme(); paint();
    });
    h.querySelector("#fvLang").addEventListener("click", function () {
      LANG = (LANG === "zh") ? "en" : "zh";
      applyLang(); paint(); api.lang = LANG; fire(langCbs, LANG);
    });
    var seg = h.querySelector("#fvMkts");
    if (seg) seg.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-m]"); if (!b) return;
      MARKET = b.dataset.m; lsSet("fv_shell_market", MARKET);
      api.market = MARKET; paint(); fire(mktCbs, MARKET);
    });
    document.documentElement.classList.add("fv-shell-on");
  }

  function paint() {
    if (!shell) return;
    var pageKey = "site_" + (CFG.page || "lab");
    shell.querySelector("#fvBrand").textContent = t("brand") + " ›";
    shell.querySelector("#fvCrumb").textContent = t(pageKey);
    var back = shell.querySelector("#fvBack");
    back.setAttribute("title", t(FROM === "us" ? "back_us" : "back_a"));
    back.setAttribute("aria-label", t(FROM === "us" ? "back_us" : "back_a"));
    back.setAttribute("href", "/" + FROM + "/");
    var th = shell.querySelector("#fvTheme");
    var icon = themeMode === "light" ? "fvi-sun" : (themeMode === "auto" ? "fvi-auto" : "fvi-moon");
    th.querySelector("use").setAttribute("href", "#" + icon);
    var label = themeMode === "light" ? t("theme_light") : (themeMode === "dark" ? t("theme_dark") : t("theme_auto"));
    th.setAttribute("title", label + " · " + t("theme_btn_title"));
    th.setAttribute("aria-label", label);
    var lg = shell.querySelector("#fvLang");
    lg.textContent = t("lang_btn");
    lg.setAttribute("title", t("lang_btn_title"));
    lg.setAttribute("aria-label", t("lang_btn_title"));
    var seg = shell.querySelector("#fvMkts");
    if (seg) {
      seg.setAttribute("title", t("market_title"));
      seg.querySelectorAll("button[data-m]").forEach(function (b) {
        b.textContent = t("mkt_" + b.dataset.m);
        b.classList.toggle("on", b.dataset.m === MARKET);
      });
    }
  }

  /* ------------------------------------------------------------------ API */
  var api = {
    lang: LANG,
    market: MARKET,
    from: FROM,
    embedded: EMBED,
    isLight: effLight,
    t: t,
    applyI18n: applyI18n,
    onLang:  function (fn) { langCbs.push(fn); return fn; },
    onTheme: function (fn) { themeCbs.push(fn); return fn; },
    onMarket:function (fn) { mktCbs.push(fn); return fn; }
  };
  window.fvShell = api;

  /* --------------------------------------------------------------- 启动 */
  applyLang();
  applyTheme();                                       // body 可能还不存在, boot 里再补一次
  if (mqLight) {
    var onMq = function () { if (themeMode === "auto") { applyTheme(); paint(); } };
    if (mqLight.addEventListener) mqLight.addEventListener("change", onMq);
    else if (mqLight.addListener) mqLight.addListener(onMq);
  }
  function boot() { applyTheme(); build(); paint(); watchTheme(); watchEmbedSkin(); }
  if (document.body) boot();
  else document.addEventListener("DOMContentLoaded", boot, { once: true });
})();
