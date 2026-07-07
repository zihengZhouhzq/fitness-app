/* ============================================
   健身助手 - 主应用逻辑
   ============================================ */

// ==================== 全局状态 ====================
const CDN_BASE = 'https://static.exercisedb.dev/media';

const STATE = {
  exercises: [],
  filtered: [],
  favorites: JSON.parse(localStorage.getItem('fitness_favorites') || '[]'),
  currentPage: 'home',
  filters: {
    bodyPart: null,
    equipment: null
  },
  searchQuery: '',
  currentDetail: null,
  pageSize: 20,
  displayCount: 20
};

// ==================== DOM 引用 ====================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const DOM = {
  exerciseGrid: $('#exerciseGrid'),
  loading: $('#loading'),
  emptyState: $('#emptyState'),
  searchInput: $('#searchInput'),
  filterModal: $('#filterModal'),
  detailModal: $('#detailModal'),
  bodyPartTags: $('#bodyPartTags'),
  equipmentTags: $('#equipmentTags'),
  detailTitle: $('#detailTitle'),
  detailBodyPart: $('#detailBodyPart'),
  detailEquipment: $('#detailEquipment'),
  detailTarget: $('#detailTarget'),
  detailInstructions: $('#detailInstructions'),
  exerciseGif: $('#exerciseGif'),
  gifContainer: $('#gifContainer'),
  btnToggleFavorite: $('#btnToggleFavorite'),
  favoriteText: $('#favoriteText'),
  gifLoading: document.querySelector('.gif-loading')
};

// ==================== 数据加载 ====================
async function loadExercises() {
  try {
    if (window.EXERCISES_DATA) {
      // Load from inline JS (works with file:// protocol)
      STATE.exercises = window.EXERCISES_DATA;
      STATE.filtered = [...STATE.exercises];
      return true;
    }
    // Fallback to fetch
    const resp = await fetch('data/exercises.json');
    if (!resp.ok) throw new Error('Failed to load data');
    STATE.exercises = await resp.json();
    STATE.filtered = [...STATE.exercises];
    return true;
  } catch (e) {
    console.error('Failed to load exercises:', e);
    DOM.exerciseGrid.innerHTML = '<div class="empty-state"><p>数据加载失败，请检查 data/exercises.js 文件是否存在</p></div>';
    DOM.loading.classList.add('hidden');
    return false;
  }
}

// ==================== 工具函数 ====================
function getCategoryLabel(category) {
  const map = {
    'upper arms': '上臂', 'upper legs': '大腿', 'back': '背部',
    'waist': '腰部', 'chest': '胸部', 'shoulders': '肩部',
    'lower legs': '小腿', 'lower arms': '前臂', 'cardio': '有氧',
    'neck': '颈部'
  };
  return map[category] || category;
}

function getEquipmentLabel(equipment) {
  const map = {
    'body weight': '自重', 'dumbbell': '哑铃', 'barbell': '杠铃',
    'cable': '绳索', 'band': '弹力带', 'kettlebell': '壶铃',
    'smith machine': '史密斯机', 'leverage machine': '杠杆机',
    'stability ball': '健身球', 'ez barbell': 'EZ杠铃',
    'weighted': '负重', 'medicine ball': '药球',
    'exercise ball': '运动球', 'bosu ball': '波速球',
    'roller': '泡沫轴', 'hammer': '锤式'
  };
  return map[equipment] || equipment;
}

function getTargetLabel(target) {
  const map = {
    'abs': '腹肌', 'biceps': '肱二头肌', 'triceps': '肱三头肌',
    'delts': '三角肌', 'glutes': '臀肌', 'hamstrings': '腘绳肌',
    'quadriceps': '股四头肌', 'calves': '小腿肌', 'lats': '背阔肌',
    'pectorals': '胸肌', 'traps': '斜方肌', 'forearms': '前臂',
    'serratus anterior': '前锯肌', 'upper back': '上背',
    'lower back': '下背', 'adductors': '内收肌', 'abductors': '外展肌',
    'levator scapulae': '肩胛提肌', 'spine': '脊柱',
    'cardiovascular system': '心血管'
  };
  return map[target] || target;
}

// ==================== 筛选 & 搜索 ====================
function applyFilters() {
  let result = [...STATE.exercises];

  if (STATE.filters.bodyPart) {
    result = result.filter(e => e.category === STATE.filters.bodyPart);
  }
  if (STATE.filters.equipment) {
    result = result.filter(e => e.equipment === STATE.filters.equipment);
  }
  if (STATE.searchQuery) {
    const q = STATE.searchQuery.toLowerCase();
    result = result.filter(e =>
      e.name.toLowerCase().includes(q) ||
      (e.target || '').toLowerCase().includes(q) ||
      (e.equipment || '').toLowerCase().includes(q) ||
      (e.category || '').toLowerCase().includes(q)
    );
  }

  STATE.filtered = result;
  STATE.displayCount = STATE.pageSize;
  renderExercises();
}

// ==================== 渲染 ====================
function renderExercises() {
  const exercises = STATE.filtered.slice(0, STATE.displayCount);
  DOM.loading.classList.add('hidden');

  if (STATE.filtered.length === 0) {
    DOM.exerciseGrid.innerHTML = '';
    DOM.emptyState.classList.remove('hidden');
    return;
  }

  DOM.emptyState.classList.add('hidden');

  if (STATE.displayCount >= STATE.filtered.length) {
    // Remove existing sentinel
    const existing = document.getElementById('loadMoreSentinel');
    if (existing) existing.remove();
  }

  DOM.exerciseGrid.innerHTML = exercises.map((ex, i) => {
    const mediaId = ex.media_id;
    const category = (ex.category || '').replace(/\s+/g, '_').toLowerCase();
    const localSrc = mediaId ? `gifs/${category}/${mediaId}.gif` : '';
    const cdnSrc = mediaId ? `${CDN_BASE}/${mediaId}.gif` : '';

    return `
      <div class="exercise-card" data-index="${i}" data-id="${ex.id}">
        <div class="card-thumb">
          ${mediaId ? `<img src="${localSrc}" alt="${ex.name}" loading="lazy" data-cdn="${cdnSrc}" onerror="var c=this.dataset.cdn;if(c&&this.src!==c){this.src=c}else{this.parentElement.innerHTML='<div class=\\'card-thumb-placeholder\\'><svg width=\\'48\\' height=\\'48\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'#ccc\\' stroke-width=\\'1.5\\'><rect x=\\'3\\' y=\\'3\\' width=\\'18\\' height=\\'18\\' rx=\\'2\\' ry=\\'2\\'/><circle cx=\\'8.5\\' cy=\\'8.5\\' r=\\'1.5\\'/><polyline points=\\'21 15 16 10 5 21\\'/></svg></div>'}">` : `<div class="card-thumb-placeholder"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>`}
        </div>
        <div class="card-body">
          <div class="card-title" title="${ex.name}">${ex.name}</div>
          <div class="card-tags">
            <span class="card-tag">${getCategoryLabel(ex.category)}</span>
            <span class="card-tag">${getEquipmentLabel(ex.equipment)}</span>
          </div>
        </div>
      </div>`;
  }).join('');

  // Add infinite scroll sentinel
  if (STATE.displayCount < STATE.filtered.length) {
    DOM.exerciseGrid.insertAdjacentHTML('beforeend', '<div id="loadMoreSentinel" style="grid-column: 1 / -1; height: 20px;"></div>');
  }

  // Bind card click events
  DOM.exerciseGrid.querySelectorAll('.exercise-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.id;
      const exercise = STATE.filtered.find(e => e.id === id);
      if (exercise) showDetail(exercise);
    });
  });
}

// ==================== 无限滚动 ====================
function setupInfiniteScroll() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && STATE.displayCount < STATE.filtered.length) {
        STATE.displayCount += STATE.pageSize;
        renderExercises();
      }
    });
  }, { threshold: 0.1 });

  // Watch for sentinel mutations
  const mutationObserver = new MutationObserver(() => {
    const sentinel = document.getElementById('loadMoreSentinel');
    if (sentinel) {
      observer.observe(sentinel);
    }
  });

  mutationObserver.observe(DOM.exerciseGrid, { childList: true, subtree: true });
}

// ==================== 详情弹窗 ====================
function showDetail(exercise) {
  STATE.currentDetail = exercise;
  DOM.detailTitle.textContent = exercise.name;
  DOM.detailBodyPart.textContent = getCategoryLabel(exercise.category);
  DOM.detailEquipment.textContent = getEquipmentLabel(exercise.equipment);
  DOM.detailTarget.textContent = getTargetLabel(exercise.target);

  // Instructions (Chinese)
  const instructions = exercise.instruction_steps?.zh || exercise.instructions?.zh;
  if (instructions) {
    const steps = Array.isArray(instructions) ? instructions : [instructions];
    DOM.detailInstructions.innerHTML = steps.map(s => `<li>${s}</li>`).join('');
  } else {
    DOM.detailInstructions.innerHTML = '<li>暂无说明</li>';
  }

  // GIF
  DOM.exerciseGif.classList.add('hidden');
  DOM.gifLoading.style.display = 'block';
  const category = (exercise.category || '').replace(/\s+/g, '_').toLowerCase();
  const mediaId = exercise.media_id;

  if (mediaId) {
    const localPath = `gifs/${category}/${mediaId}.gif`;
    const cdnPath = `${CDN_BASE}/${mediaId}.gif`;
    const fallbackRoot = `gifs/${mediaId}.gif`;
    let attempt = 0;

    DOM.exerciseGif.onload = () => {
      DOM.exerciseGif.classList.remove('hidden');
      DOM.gifLoading.style.display = 'none';
    };
    DOM.exerciseGif.onerror = () => {
      attempt++;
      if (attempt === 1) {
        // Try root fallback
        if (DOM.exerciseGif.src !== fallbackRoot) {
          DOM.exerciseGif.src = fallbackRoot;
        }
      } else if (attempt === 2) {
        // Try CDN
        if (DOM.exerciseGif.src !== cdnPath) {
          DOM.exerciseGif.src = cdnPath;
        }
      } else {
        DOM.gifLoading.textContent = '加载失败';
        DOM.exerciseGif.classList.add('hidden');
      }
    };
    DOM.exerciseGif.src = localPath;
  } else {
    DOM.gifLoading.textContent = '无演示动画';
  }

  // Favorite state
  updateFavoriteButton(exercise.id);

  DOM.detailModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  // Push history state so back button closes modal
  history.pushState({ modal: 'detail', id: exercise.id }, '', `#detail-${exercise.id}`);
}

function closeDetail(silent) {
  DOM.detailModal.classList.add('hidden');
  document.body.style.overflow = '';
  STATE.currentDetail = null;
  // Pop history state if we pushed one (silent = called from popstate, don't pop again)
  if (!silent && history.state?.modal === 'detail') {
    history.back();
  }
}

// ==================== 收藏功能 ====================
function toggleFavorite(exerciseId) {
  const idx = STATE.favorites.indexOf(exerciseId);
  if (idx > -1) {
    STATE.favorites.splice(idx, 1);
  } else {
    STATE.favorites.push(exerciseId);
  }
  localStorage.setItem('fitness_favorites', JSON.stringify(STATE.favorites));
  updateFavoriteButton(exerciseId);

  // Refresh favorites page if visible
  if (STATE.currentPage === 'favorite') showFavorites();
}

function updateFavoriteButton(exerciseId) {
  if (!exerciseId) return;
  const isFav = STATE.favorites.includes(exerciseId);
  DOM.btnToggleFavorite.classList.toggle('active', isFav);
  DOM.favoriteText.textContent = isFav ? '已收藏' : '收藏';
}

function showFavorites() {
  const favExercises = STATE.exercises.filter(e => STATE.favorites.includes(e.id));
  STATE.filtered = favExercises;
  STATE.displayCount = STATE.pageSize;
  renderExercises();
}

// ==================== 随机功能 ====================
function showRandomExercise() {
  if (STATE.exercises.length === 0) return;
  const randomIdx = Math.floor(Math.random() * STATE.exercises.length);
  showDetail(STATE.exercises[randomIdx]);
}

// ==================== 筛选弹窗 ====================
function populateFilterTags() {
  const bodyParts = [...new Set(STATE.exercises.map(e => e.category))].sort();
  const equipments = [...new Set(STATE.exercises.map(e => e.equipment))].sort();

  DOM.bodyPartTags.innerHTML = bodyParts.map(bp => `
    <span class="filter-tag${STATE.filters.bodyPart === bp ? ' selected' : ''}" data-type="bodyPart" data-value="${bp}">
      ${getCategoryLabel(bp)}
    </span>
  `).join('');

  DOM.equipmentTags.innerHTML = equipments.map(eq => `
    <span class="filter-tag${STATE.filters.equipment === eq ? ' selected' : ''}" data-type="equipment" data-value="${eq}">
      ${getEquipmentLabel(eq)}
    </span>
  `).join('');

  // Bind tag clicks
  DOM.filterModal.querySelectorAll('.filter-tag').forEach(tag => {
    tag.addEventListener('click', () => {
      const type = tag.dataset.type;
      const value = tag.dataset.value;

      if (type === 'bodyPart') {
        DOM.filterModal.querySelectorAll('.filter-tag[data-type="bodyPart"]').forEach(t => t.classList.remove('selected'));
        if (STATE.filters.bodyPart === value) {
          STATE.filters.bodyPart = null;
        } else {
          STATE.filters.bodyPart = value;
          tag.classList.add('selected');
        }
      } else if (type === 'equipment') {
        DOM.filterModal.querySelectorAll('.filter-tag[data-type="equipment"]').forEach(t => t.classList.remove('selected'));
        if (STATE.filters.equipment === value) {
          STATE.filters.equipment = null;
        } else {
          STATE.filters.equipment = value;
          tag.classList.add('selected');
        }
      }
    });
  });
}

function openFilter() {
  populateFilterTags();
  DOM.filterModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  history.pushState({ modal: 'filter' }, '', '#filter');
}

function closeFilter() {
  DOM.filterModal.classList.add('hidden');
  document.body.style.overflow = '';
  if (history.state?.modal === 'filter') {
    history.back();
  }
}

function resetFilter() {
  STATE.filters.bodyPart = null;
  STATE.filters.equipment = null;
  populateFilterTags();
}

function applyFilter() {
  closeFilter();
  applyFilters();
}

// ==================== 导航 ====================
function switchPage(page) {
  STATE.currentPage = page;
  STATE.searchQuery = '';
  DOM.searchInput.value = '';
  STATE.filters.bodyPart = null;
  STATE.filters.equipment = null;
  STATE.displayCount = STATE.pageSize;

  $$('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === page);
  });

  switch (page) {
    case 'home':
      STATE.filtered = [...STATE.exercises];
      renderExercises();
      break;
    case 'favorite':
      showFavorites();
      break;
    case 'random':
      showRandomExercise();
      break;
  }
}

// ==================== 事件绑定 ====================
function bindEvents() {
  // Search
  DOM.searchInput.addEventListener('input', (e) => {
    STATE.searchQuery = e.target.value.trim();
    STATE.displayCount = STATE.pageSize;
    applyFilters();
  });

  // Filter
  $('#btnFilter').addEventListener('click', openFilter);
  $('#btnCloseFilter').addEventListener('click', closeFilter);
  $('#btnResetFilter').addEventListener('click', resetFilter);
  $('#btnApplyFilter').addEventListener('click', applyFilter);

  // Close filter modal on backdrop click
  DOM.filterModal.querySelector('.modal-backdrop').addEventListener('click', closeFilter);

  // Detail modal
  $('#btnCloseDetail').addEventListener('click', () => closeDetail(false));
  DOM.detailModal.querySelector('.modal-backdrop').addEventListener('click', () => closeDetail(false));

  // History back button: close modals instead of navigating away
  window.addEventListener('popstate', (e) => {
    if (e.state?.modal === 'detail') {
      closeDetail(true);
    } else if (e.state?.modal === 'filter') {
      closeFilter();
    }
  });

  // Swipe down to close detail modal
  let touchStartY = 0;
  DOM.detailModal.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
  }, { passive: true });
  DOM.detailModal.addEventListener('touchmove', (e) => {
    const deltaY = e.touches[0].clientY - touchStartY;
    const modalContent = DOM.detailModal.querySelector('.modal-content');
    if (deltaY > 0 && modalContent.scrollTop <= 0) {
      modalContent.style.transform = `translateY(${deltaY}px)`;
    }
  }, { passive: true });
  DOM.detailModal.addEventListener('touchend', (e) => {
    const deltaY = e.changedTouches[0].clientY - touchStartY;
    const modalContent = DOM.detailModal.querySelector('.modal-content');
    modalContent.style.transform = '';
    if (deltaY > 80) {
      closeDetail(false);
    }
  });

  // Favorite
  DOM.btnToggleFavorite.addEventListener('click', () => {
    if (STATE.currentDetail) {
      toggleFavorite(STATE.currentDetail.id);
    }
  });

  // Navigation
  $$('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      switchPage(item.dataset.page);
    });
  });

  // Keyboard
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!DOM.detailModal.classList.contains('hidden')) closeDetail();
      else if (!DOM.filterModal.classList.contains('hidden')) closeFilter();
    }
  });
}

// ==================== 初始化 ====================
async function init() {
  const loaded = await loadExercises();
  if (!loaded) return;

  bindEvents();
  setupInfiniteScroll();
  renderExercises();
  DOM.loading.classList.add('hidden');
}

// 启动
init();