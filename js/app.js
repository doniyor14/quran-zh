/**
 * 古兰经 · 中文 — app.js
 *
 * Uses Quran.com API v4 (https://api.quran.com/api/v4)
 * Chinese translation: Ma Jian (马坚) — translation id 109
 */

(() => {
  'use strict';

  /* ---------------------------------------------------------------
     CONSTANTS
  --------------------------------------------------------------- */
  const API_BASE    = 'https://api.quran.com/api/v4';
  const TRANS_ID    = 109;          // Ma Jian Chinese translation
  const LANG        = 'zh';
  const PER_PAGE    = 10;           // verses per pagination page

  /* ---------------------------------------------------------------
     STATE
  --------------------------------------------------------------- */
  const state = {
    surahs:       [],               // full list of 114 chapters
    currentSurah: null,             // { id, name_arabic, ... }
    verses:       [],               // all verses loaded for current surah
    page:         1,                // current UI page
    arabicSize:   24,               // Arabic font size in px
    theme:        'light',
    query:        '',
  };

  /* ---------------------------------------------------------------
     DOM refs
  --------------------------------------------------------------- */
  const $ = id => document.getElementById(id);
  const surahListView    = $('surahListView');
  const verseView        = $('verseView');
  const surahGrid        = $('surahGrid');
  const versesContainer  = $('versesContainer');
  const paginationEl     = $('pagination');
  const surahNameArabic  = $('surahNameArabic');
  const surahNameZhEl    = $('surahNameZh');
  const surahMetaEl      = $('surahMeta');
  const bismillahEl      = $('bismillah');
  const backBtn          = $('backBtn');
  const themeToggle      = $('themeToggle');
  const searchInput      = $('searchInput');
  const searchClear      = $('searchClear');
  const fontSizeSlider   = $('fontSizeSlider');
  const fontSizeVal      = $('fontSizeVal');
  const errorToast       = $('errorToast');

  /* ---------------------------------------------------------------
     THEME
  --------------------------------------------------------------- */
  function applyTheme(t) {
    state.theme = t;
    document.documentElement.setAttribute('data-theme', t);
    themeToggle.textContent = t === 'dark' ? '☀️' : '🌙';
    localStorage.setItem('qz-theme', t);
  }

  themeToggle.addEventListener('click', () => {
    applyTheme(state.theme === 'dark' ? 'light' : 'dark');
  });

  // restore saved theme
  applyTheme(localStorage.getItem('qz-theme') || 'light');

  /* ---------------------------------------------------------------
     FONT SIZE SLIDER
  --------------------------------------------------------------- */
  fontSizeSlider.addEventListener('input', () => {
    state.arabicSize = parseInt(fontSizeSlider.value, 10);
    fontSizeVal.textContent = `${state.arabicSize}px`;
    document.querySelectorAll('.verse-arabic').forEach(el => {
      el.style.fontSize = `${state.arabicSize}px`;
    });
  });

  /* ---------------------------------------------------------------
     SEARCH
  --------------------------------------------------------------- */
  searchInput.addEventListener('input', () => {
    state.query = searchInput.value.trim().toLowerCase();
    searchClear.hidden = !state.query;
    renderSurahCards(getFilteredSurahs());
  });

  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    state.query = '';
    searchClear.hidden = true;
    renderSurahCards(getFilteredSurahs());
  });

  function getFilteredSurahs() {
    if (!state.query) return state.surahs;
    return state.surahs.filter(s =>
      String(s.id).includes(state.query) ||
      (s.name_simple   || '').toLowerCase().includes(state.query) ||
      (s.translated_name?.name || '').toLowerCase().includes(state.query) ||
      (s.name_arabic   || '').includes(state.query)
    );
  }

  /* ---------------------------------------------------------------
     VIEW NAVIGATION
  --------------------------------------------------------------- */
  function showView(viewEl) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    viewEl.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  backBtn.addEventListener('click', () => {
    showView(surahListView);
    // restore search focus
    searchInput.focus();
  });

  /* ---------------------------------------------------------------
     FETCH HELPERS
  --------------------------------------------------------------- */
  async function fetchJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
    return res.json();
  }

  function showError(msg) {
    errorToast.textContent = msg;
    errorToast.hidden = false;
    setTimeout(() => { errorToast.hidden = true; }, 5000);
  }

  /* ---------------------------------------------------------------
     LOAD SURAH LIST
  --------------------------------------------------------------- */
  async function loadSurahList() {
    surahGrid.innerHTML = loadingHTML('正在加载章节列表…');
    try {
      const data = await fetchJSON(`${API_BASE}/chapters?language=${LANG}`);
      state.surahs = data.chapters || [];
      renderSurahCards(state.surahs);
    } catch (err) {
      console.error(err);
      surahGrid.innerHTML = errorHTML('无法加载章节列表，请检查网络后刷新。');
      showError('加载章节列表失败：' + err.message);
    }
  }

  /* ---------------------------------------------------------------
     RENDER SURAH CARDS
  --------------------------------------------------------------- */
  function renderSurahCards(list) {
    if (!list.length) {
      surahGrid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--clr-text-muted);padding:40px 0">未找到匹配的章节。</p>';
      return;
    }
    surahGrid.innerHTML = list.map(s => {
      const zhName   = s.translated_name?.name  || s.name_simple || '';
      const enName   = s.name_simple            || '';
      const verses   = s.verses_count           || '';
      const type     = s.revelation_place === 'makkah' ? '麦加' : '麦地那';
      return `
        <button class="surah-card" role="listitem"
                data-id="${s.id}" aria-label="第${s.id}章 ${zhName}">
          <span class="surah-number">${s.id}</span>
          <span class="surah-card-info">
            <span class="surah-name-zh-card">${zhName}</span>
            <span class="surah-name-en">${enName} · ${type}</span>
            <span class="surah-verses-count">${verses} 节</span>
          </span>
          <span class="surah-name-arabic-card" dir="rtl">${s.name_arabic}</span>
        </button>`;
    }).join('');

    surahGrid.querySelectorAll('.surah-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = parseInt(card.dataset.id, 10);
        openSurah(id);
      });
    });
  }

  /* ---------------------------------------------------------------
     OPEN SURAH → load ALL verses
  --------------------------------------------------------------- */
  async function openSurah(id) {
    const surah = state.surahs.find(s => s.id === id);
    if (!surah) return;
    state.currentSurah = surah;
    state.page = 1;
    state.verses = [];

    // show verse view with loader
    showView(verseView);
    versesContainer.innerHTML = loadingHTML('正在加载经文…');
    paginationEl.hidden = true;

    // populate header
    surahNameArabic.textContent = surah.name_arabic;
    surahNameZhEl.textContent   = surah.translated_name?.name || surah.name_simple;
    surahMetaEl.textContent     =
      `第 ${surah.id} 章 · ${surah.revelation_place === 'makkah' ? '麦加' : '麦地那'} · ${surah.verses_count} 节`;
    // hide bismillah for Al-Fatiha (it IS the bismillah) and At-Tawbah (no bismillah)
    bismillahEl.hidden = (surah.id === 1 || surah.id === 9);

    try {
      await loadAllVerses(id);
      renderVerses();
    } catch (err) {
      console.error(err);
      versesContainer.innerHTML = errorHTML('无法加载经文，请检查网络后重试。');
      showError('加载经文失败：' + err.message);
    }
  }

  /* ---------------------------------------------------------------
     LOAD ALL VERSES (paginated API calls, reassemble)
  --------------------------------------------------------------- */
  async function loadAllVerses(chapterId) {
    const firstPage = await fetchJSON(
      `${API_BASE}/verses/by_chapter/${chapterId}` +
      `?language=${LANG}&translations=${TRANS_ID}&per_page=50&page=1` +
      `&fields=text_uthmani,verse_key`
    );
    const meta        = firstPage.pagination;
    let allVerses     = firstPage.verses || [];
    const totalPages  = meta?.total_pages || 1;

    // fetch remaining pages in parallel
    if (totalPages > 1) {
      const extra = await Promise.all(
        Array.from({ length: totalPages - 1 }, (_, i) =>
          fetchJSON(
            `${API_BASE}/verses/by_chapter/${chapterId}` +
            `?language=${LANG}&translations=${TRANS_ID}&per_page=50&page=${i + 2}` +
            `&fields=text_uthmani,verse_key`
          )
        )
      );
      extra.forEach(p => { allVerses = allVerses.concat(p.verses || []); });
    }

    state.verses = allVerses;
  }

  /* ---------------------------------------------------------------
     RENDER VERSES (current UI page)
  --------------------------------------------------------------- */
  function renderVerses() {
    const { verses, page } = state;
    if (!verses.length) {
      versesContainer.innerHTML = '<p style="text-align:center;color:var(--clr-text-muted)">暂无经文数据。</p>';
      paginationEl.hidden = true;
      return;
    }

    const totalPages = Math.ceil(verses.length / PER_PAGE);
    const start      = (page - 1) * PER_PAGE;
    const pageVerses = verses.slice(start, start + PER_PAGE);

    versesContainer.innerHTML = pageVerses.map(v => {
      const arabic = v.text_uthmani || '';
      const trans  = v.translations?.[0]?.text
                     ? stripHtml(v.translations[0].text)
                     : '（暂无中文译文）';
      const key    = v.verse_key || '';
      const num    = key.split(':')[1] || v.verse_number || '';

      return `
        <article class="verse-item">
          <div class="verse-meta">
            <span class="verse-num-badge">${num}</span>
            <span class="verse-transliteration">${key}</span>
          </div>
          <div class="verse-arabic" dir="rtl"
               style="font-size:${state.arabicSize}px">${arabic}</div>
          <div class="verse-translation">${trans}</div>
        </article>`;
    }).join('');

    // pagination
    if (totalPages <= 1) {
      paginationEl.hidden = true;
    } else {
      paginationEl.hidden = false;
      paginationEl.innerHTML = `
        <button id="prevPage" ${page === 1 ? 'disabled' : ''}>← 上一页</button>
        <span class="page-info">第 ${page} / ${totalPages} 页</span>
        <button id="nextPage" ${page === totalPages ? 'disabled' : ''}>下一页 →</button>`;
      $('prevPage').addEventListener('click', () => {
        state.page--;
        renderVerses();
        window.scrollTo({ top: verseView.offsetTop - 70, behavior: 'smooth' });
      });
      $('nextPage').addEventListener('click', () => {
        state.page++;
        renderVerses();
        window.scrollTo({ top: verseView.offsetTop - 70, behavior: 'smooth' });
      });
    }
  }

  /* ---------------------------------------------------------------
     UTILITIES
  --------------------------------------------------------------- */
  function stripHtml(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  }

  function loadingHTML(msg) {
    return `<div class="loading-state">
              <div class="spinner"></div>
              <p>${msg}</p>
            </div>`;
  }

  function errorHTML(msg) {
    return `<div class="loading-state">
              <p style="color:#c62828">⚠️ ${msg}</p>
            </div>`;
  }

  /* ---------------------------------------------------------------
     BOOT
  --------------------------------------------------------------- */
  loadSurahList();

})();
