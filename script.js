const PAGE_SIZE = 48;
const SEARCH_PAGE = 60;
const FAVORITES_KEY = 'our-little-moments-favorites';
const DENSITY_KEY = 'our-little-moments-density';
const NOTES_KEY = 'our-little-moments-notes';
const MONTH_NAMES = new Intl.DateTimeFormat('en', { month: 'long' });
const MONTH_SHORT = new Intl.DateTimeFormat('en', { month: 'short' });
const FULL_DATE = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'long', year: 'numeric' });

function loadFavorites() {
  try {
    const saved = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
    return new Set(Array.isArray(saved) ? saved : []);
  } catch {
    return new Set();
  }
}

function loadNotes() {
  try {
    const saved = JSON.parse(localStorage.getItem(NOTES_KEY) || '{}');
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return {};
    const notes = {};
    Object.entries(saved).forEach(([name, text]) => {
      if (typeof text === 'string' && text.trim()) notes[name] = text.trim();
    });
    return notes;
  } catch {
    return {};
  }
}

const els = {
  navHome: document.querySelector('#nav-home'),
  navFavorites: document.querySelector('#nav-favorites'),
  navAlbumCount: document.querySelector('#nav-album-count'),
  timeline: document.querySelector('#timeline'),
  timelineSection: document.querySelector('.timeline-section'),
  recentSection: document.querySelector('#recent-section'),
  recentStrip: document.querySelector('#recent-strip'),
  favoriteCount: document.querySelector('#favorite-count'),
  albumsSection: document.querySelector('#albums-section'),
  albumGrid: document.querySelector('#album-grid'),
  landingEmpty: document.querySelector('#landing-empty'),
  landingEmptyText: document.querySelector('#landing-empty-text'),
  landingEmptyButton: document.querySelector('#landing-empty-button'),
  searchInput: document.querySelector('#search-input'),
  searchSection: document.querySelector('#search-section'),
  searchNote: document.querySelector('#search-note'),
  searchGrid: document.querySelector('#search-grid'),
  searchEmpty: document.querySelector('#search-empty'),
  searchMore: document.querySelector('#search-more'),
  albumView: document.querySelector('#album-view'),
  albumBack: document.querySelector('#album-back'),
  albumKicker: document.querySelector('#album-kicker'),
  albumTitle: document.querySelector('#album-title'),
  albumCount: document.querySelector('#album-count'),
  albumPhotos: document.querySelector('#album-photos'),
  albumEmpty: document.querySelector('#album-empty'),
  albumEmptyText: document.querySelector('#album-empty-text'),
  albumSentinel: document.querySelector('#album-sentinel'),
  albumScroll: document.querySelector('#album-scroll'),
  albumSlideshow: document.querySelector('#album-slideshow'),
  dialog: document.querySelector('#lightbox'),
  lightboxImage: document.querySelector('#lightbox-image'),
  lightboxCaption: document.querySelector('#lightbox-caption'),
  lightboxIndex: document.querySelector('#lightbox-index'),
  lightboxFavorite: document.querySelector('#lightbox-favorite'),
  downloadPhoto: document.querySelector('#download-photo'),
  slideshowToggle: document.querySelector('#slideshow-toggle'),
  chooseFolder: document.querySelector('#choose-folder'),
  folderInput: document.querySelector('#folder-input'),
  lbStage: document.querySelector('.lb-stage'),
  lbClose: document.querySelector('.lb-close'),
  lbPrev: document.querySelector('.lb-prev'),
  lbNext: document.querySelector('.lb-next'),
  noteEdit: document.querySelector('#note-edit'),
  noteRemove: document.querySelector('#note-remove'),
  noteText: document.querySelector('#note-text'),
  noteForm: document.querySelector('#note-form'),
  noteInput: document.querySelector('#note-input'),
  noteCancel: document.querySelector('#note-cancel'),
};

let photos = [];
let albumMap = new Map();
let albumList = [];
let favorites = loadFavorites();
let notes = loadNotes();
let currentAlbum = null;
let lbList = [];
let lbIndex = 0;
let noteEditing = false;
let slideshowTimer = null;
let searchTimer = null;
let searchResults = [];
let searchShown = 0;
let searchActive = false;
let photoObjectUrls = [];
let density = localStorage.getItem(DENSITY_KEY) === 'compact' ? 'compact' : 'roomy';
let albumsRevealed = false;

/* ——— Motion ——— */

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const revealObserver = 'IntersectionObserver' in window
  ? new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.05 })
  : null;

function watchReveal(element, delay = 0) {
  if (!element) return;
  if (reduceMotion.matches || !revealObserver) {
    element.classList.add('is-visible');
    return;
  }
  element.style.setProperty('--reveal-delay', `${delay}ms`);
  element.classList.add('will-reveal');
  revealObserver.observe(element);
}

function pop(element) {
  if (!element || reduceMotion.matches || typeof element.animate !== 'function') return;
  element.animate(
    [{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }, { transform: 'scale(1)' }],
    { duration: 340, easing: 'cubic-bezier(.2, .7, .2, 1)' }
  );
}

/* ——— Dates & data ——— */

function parseDate(name) {
  const match = name.match(/(20\d{2})[-_]?([01]\d)[-_]?([0-3]\d)/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1990 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

function prettyDate(photo) {
  return photo.date ? FULL_DATE.format(photo.date) : 'A lovely day';
}

function favoritePhotos() {
  return photos.filter(photo => favorites.has(photo.name));
}

function buildAlbums() {
  albumMap = new Map();
  photos.forEach(photo => {
    let id = 'undated';
    let title = 'Odds & ends';
    let kicker = 'Undated moments';
    if (photo.date) {
      const year = photo.date.getFullYear();
      id = `${year}-${String(photo.date.getMonth() + 1).padStart(2, '0')}`;
      title = `${MONTH_NAMES.format(photo.date)} ${year}`;
      kicker = 'Photo album';
    }
    if (!albumMap.has(id)) albumMap.set(id, { id, title, kicker, photos: [] });
    albumMap.get(id).photos.push(photo);
  });
  albumList = [...albumMap.values()].sort((a, b) => {
    if (a.id === 'undated') return 1;
    if (b.id === 'undated') return -1;
    return b.id.localeCompare(a.id);
  });
}

function getAlbumData(id) {
  if (id === 'favorites') {
    return {
      id,
      title: 'Favorites',
      kicker: 'Handpicked collection',
      photos: favoritePhotos(),
      empty: 'Nothing saved yet. Tap the ♡ on any moment you love and it will appear here.',
    };
  }
  const album = albumMap.get(id);
  if (!album) return null;
  return { id, title: album.title, kicker: album.kicker, photos: album.photos, empty: 'No moments here yet.' };
}

/* ——— Notes ——— */

function noteFor(name) {
  return notes[name] || '';
}

function persistNotes() {
  try {
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  } catch {
    /* storage full or unavailable — keep the in-memory note */
  }
}

function refreshNoteBadges() {
  document.querySelectorAll('.photo-card').forEach(card => {
    const badge = card.querySelector('.photo-note-badge');
    if (badge) badge.hidden = !noteFor(card.dataset.name);
  });
}

function syncNoteUI() {
  const photo = lbList[lbIndex];
  const hasPhoto = Boolean(photo);
  const note = hasPhoto ? noteFor(photo.name) : '';
  const editing = hasPhoto && noteEditing;

  els.noteText.hidden = editing || !note;
  els.noteText.textContent = note;
  els.noteForm.hidden = !editing;
  els.noteRemove.hidden = editing || !note;
  els.noteEdit.hidden = editing;
  els.noteEdit.textContent = note ? 'Edit note' : 'Add a note';
}

function startNoteEdit() {
  const photo = lbList[lbIndex];
  if (!photo) return;
  noteEditing = true;
  els.noteInput.value = noteFor(photo.name);
  syncNoteUI();
  els.noteInput.focus();
  els.noteInput.setSelectionRange(els.noteInput.value.length, els.noteInput.value.length);
}

function stopNoteEdit() {
  if (!noteEditing) return;
  noteEditing = false;
  syncNoteUI();
}

function saveNote() {
  const photo = lbList[lbIndex];
  if (!photo) return;
  const text = els.noteInput.value.trim();
  if (text) notes[photo.name] = text;
  else delete notes[photo.name];
  persistNotes();
  noteEditing = false;
  refreshNoteBadges();
  syncNoteUI();
  if (text && !reduceMotion.matches && typeof els.noteText.animate === 'function') {
    els.noteText.animate(
      [{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }],
      { duration: 280, easing: 'cubic-bezier(.2, .7, .2, 1)' }
    );
  }
  if (searchActive) runSearch();
}

function removeNote() {
  const photo = lbList[lbIndex];
  if (!photo) return;
  delete notes[photo.name];
  persistNotes();
  noteEditing = false;
  refreshNoteBadges();
  syncNoteUI();
  if (searchActive) runSearch();
}

/* ——— Timeline ——— */

function makeTimelineMonth(album, index = 0) {
  const link = document.createElement('a');
  link.className = 'timeline-month';
  link.href = `#album/${encodeURIComponent(album.id)}`;
  link.dataset.album = album.id;
  link.style.setProperty('--i', index);

  const dot = document.createElement('span');
  dot.className = 'timeline-dot';
  dot.setAttribute('aria-hidden', 'true');

  const name = document.createElement('span');
  name.className = 'timeline-month-name';
  name.textContent = album.id === 'undated'
    ? 'Odds & ends'
    : MONTH_SHORT.format(album.photos[0].date);

  const count = document.createElement('span');
  count.className = 'timeline-month-count';
  count.textContent = album.photos.length.toLocaleString();

  link.append(dot, name, count);
  return link;
}

function renderTimeline() {
  const fragment = document.createDocumentFragment();
  const groups = new Map();
  albumList.forEach(album => {
    if (album.id === 'undated') return;
    const year = album.id.slice(0, 4);
    if (!groups.has(year)) groups.set(year, []);
    groups.get(year).push(album);
  });

  let monthIndex = 0;
  groups.forEach((albums, year) => {
    const total = albums.reduce((sum, album) => sum + album.photos.length, 0);
    const group = document.createElement('div');
    group.className = 'timeline-year';

    const label = document.createElement('p');
    label.className = 'timeline-year-label';
    const yearText = document.createElement('span');
    yearText.textContent = year;
    const countText = document.createElement('span');
    countText.textContent = total.toLocaleString();
    label.append(yearText, countText);

    const months = document.createElement('div');
    months.className = 'timeline-months';
    albums.forEach(album => months.append(makeTimelineMonth(album, monthIndex++)));

    group.append(label, months);
    fragment.append(group);
  });

  const undated = albumMap.get('undated');
  if (undated) {
    const group = document.createElement('div');
    group.className = 'timeline-year timeline-year--undated';

    const label = document.createElement('p');
    label.className = 'timeline-year-label';
    const labelText = document.createElement('span');
    labelText.textContent = 'Unsorted';
    const countText = document.createElement('span');
    countText.textContent = undated.photos.length.toLocaleString();
    label.append(labelText, countText);

    const months = document.createElement('div');
    months.className = 'timeline-months';
    months.append(makeTimelineMonth(undated, 0));

    group.append(label, months);
    fragment.append(group);
  }

  els.timeline.replaceChildren(fragment);
  [...els.timeline.children].forEach((group, index) => watchReveal(group, index * 90));
  syncTimeline();
}

function syncTimeline() {
  const match = location.hash.match(/^#album\/([^/]+)$/);
  let id = null;
  if (match) {
    try {
      id = decodeURIComponent(match[1]);
    } catch {
      id = match[1];
    }
  }
  els.navHome.classList.toggle('is-active', !id);
  els.navFavorites.classList.toggle('is-active', id === 'favorites');
  els.timeline.querySelectorAll('.timeline-month').forEach(link => {
    link.classList.toggle('is-active', link.dataset.album === id);
  });
}

function renderRecent() {
  const dated = photos.filter(photo => photo.date);
  const recent = (dated.length ? dated : photos).slice(0, 14);
  const fragment = document.createDocumentFragment();

  recent.forEach((photo, index) => {
    const thumb = document.createElement('button');
    thumb.type = 'button';
    thumb.className = 'recent-thumb';
    thumb.style.setProperty('--i', index);
    thumb.setAttribute('aria-label', `Open photo from ${prettyDate(photo)}`);

    const img = document.createElement('img');
    img.src = photo.src;
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.addEventListener('error', () => thumb.remove(), { once: true });

    thumb.append(img);
    thumb.addEventListener('click', () => openLightbox(recent, index));
    fragment.append(thumb);
  });

  els.recentStrip.replaceChildren(fragment);
  els.recentSection.hidden = recent.length === 0;
}

/* ——— Album index ——— */

function coverPicks(list) {
  if (!list.length) return [];
  if (list.length <= 3) return list.slice();
  return [list[0], list[Math.floor(list.length / 2)], list[list.length - 1]];
}

function makeAlbumCard({ id, title, list, count, favorite }) {
  const card = document.createElement('a');
  card.className = 'album-card' + (favorite ? ' is-favorites' : '');
  card.href = `#album/${encodeURIComponent(id)}`;

  const cover = document.createElement('div');
  cover.className = 'album-cover';
  const picks = coverPicks(list);
  if (picks.length) {
    cover.classList.add(picks.length === 1 ? 'solo' : picks.length === 2 ? 'duo' : 'mosaic');
    picks.forEach(photo => {
      const img = document.createElement('img');
      img.src = photo.src;
      img.alt = '';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.fetchPriority = 'low';
      img.addEventListener('error', () => img.remove(), { once: true });
      cover.append(img);
    });
    const veil = document.createElement('span');
    veil.className = 'cover-veil';
    cover.append(veil);
    if (favorite) {
      const ribbon = document.createElement('span');
      ribbon.className = 'album-ribbon';
      ribbon.textContent = 'Handpicked';
      cover.append(ribbon);
    }
  } else {
    cover.classList.add('empty');
    cover.textContent = '♡';
  }

  const caption = document.createElement('div');
  caption.className = 'album-caption';
  const text = document.createElement('div');
  const heading = document.createElement('h3');
  heading.textContent = title;
  const meta = document.createElement('p');
  meta.textContent = `${count.toLocaleString()} ${count === 1 ? 'moment' : 'moments'}`;
  text.append(heading, meta);
  const go = document.createElement('span');
  go.className = 'album-go';
  go.setAttribute('aria-hidden', 'true');
  go.textContent = '↗';
  caption.append(text, go);

  card.append(cover, caption);
  return card;
}

function renderAlbums() {
  const fragment = document.createDocumentFragment();
  const favList = favoritePhotos();
  fragment.append(makeAlbumCard({
    id: 'favorites',
    title: 'Favorites',
    list: favList,
    count: favList.length,
    favorite: true,
  }));
  albumList.forEach(album => fragment.append(makeAlbumCard({
    id: album.id,
    title: album.title,
    list: album.photos,
    count: album.photos.length,
    favorite: false,
  })));
  els.albumGrid.replaceChildren(fragment);
  [...els.albumGrid.children].forEach((card, index) => {
    if (albumsRevealed) card.classList.add('is-visible');
    else watchReveal(card, Math.min(index, 6) * 45);
  });
  albumsRevealed = true;
}

function renderLanding() {
  els.navAlbumCount.textContent = albumList.length.toLocaleString();
  els.favoriteCount.textContent = favorites.size.toLocaleString();
  els.albumGrid.hidden = photos.length === 0;
  els.landingEmpty.hidden = photos.length !== 0;
  if (photos.length) renderAlbums();
  renderTimeline();
  renderRecent();
}

/* ——— Photo cards ——— */

function makePhotoCard(photo, list, index) {
  const card = document.createElement('figure');
  card.className = 'photo-card';
  card.dataset.name = photo.name;

  const img = document.createElement('img');
  img.loading = 'lazy';
  img.decoding = 'async';
  img.src = photo.src;
  img.alt = `A memory from ${prettyDate(photo)}`;
  img.addEventListener('error', () => card.remove(), { once: true });

  const hit = document.createElement('button');
  hit.type = 'button';
  hit.className = 'photo-hit';
  hit.setAttribute('aria-label', `Open photo from ${prettyDate(photo)}`);
  hit.addEventListener('click', () => openLightbox(list, index));

  const meta = document.createElement('div');
  meta.className = 'photo-meta';
  const date = document.createElement('span');
  date.className = 'photo-date';
  date.textContent = prettyDate(photo);
  const favorite = document.createElement('button');
  favorite.type = 'button';
  favorite.className = 'favorite-button';
  favorite.dataset.favName = photo.name;
  favorite.addEventListener('click', event => {
    event.stopPropagation();
    toggleFavorite(photo);
  });
  updateFavoriteButton(favorite, photo.name);
  meta.append(date, favorite);

  const badge = document.createElement('span');
  badge.className = 'photo-note-badge';
  badge.setAttribute('aria-hidden', 'true');
  badge.title = 'Has a note';
  badge.textContent = '✎';
  badge.hidden = !noteFor(photo.name);

  card.append(img, hit, meta, badge);
  return card;
}

function applyDensity() {
  const compact = density === 'compact';
  [els.albumPhotos, els.searchGrid].forEach(grid => grid.classList.toggle('is-compact', compact));
  document.querySelectorAll('.density-button').forEach(button => {
    button.classList.toggle('is-active', button.dataset.density === density);
  });
}

/* ——— Favorites ——— */

function saveFavorites() {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favorites]));
}

function updateFavoriteButton(button, name) {
  if (!button) return;
  const saved = favorites.has(name);
  button.classList.toggle('is-favorite', saved);
  button.textContent = saved ? '♥' : '♡';
  button.setAttribute('aria-label', saved ? 'Remove from favorites' : 'Save as favorite');
}

function updateFavoriteBadge() {
  els.favoriteCount.textContent = favorites.size.toLocaleString();
  pop(els.favoriteCount);
}

function toggleFavorite(photo) {
  if (favorites.has(photo.name)) favorites.delete(photo.name);
  else favorites.add(photo.name);
  saveFavorites();
  updateFavoriteBadge();
  document.querySelectorAll('.favorite-button').forEach(button => {
    if (button.dataset.favName === photo.name) updateFavoriteButton(button, photo.name);
  });
  updateFavoriteButton(els.lightboxFavorite, photo.name);
  if (currentAlbum && currentAlbum.id === 'favorites' && !favorites.has(photo.name)) {
    if (els.dialog.open) els.dialog.close();
    const scrollTop = els.albumScroll.scrollTop;
    openAlbumById('favorites');
    els.albumScroll.scrollTop = scrollTop;
  }
}

/* ——— Album view ——— */

function renderAlbumPage() {
  if (!currentAlbum) return;
  const list = currentAlbum.list;
  const end = Math.min(currentAlbum.shown + PAGE_SIZE, list.length);
  const fragment = document.createDocumentFragment();
  for (let index = currentAlbum.shown; index < end; index++) {
    const card = makePhotoCard(list[index], list, index);
    card.style.animationDelay = `${Math.min(index % 10, 9) * 26}ms`;
    fragment.append(card);
  }
  els.albumPhotos.append(fragment);
  currentAlbum.shown = end;
}

function openAlbumById(id) {
  if (!photos.length) return;
  const data = getAlbumData(id);
  if (!data) {
    history.replaceState(null, '', '#/');
    closeAlbum();
    syncTimeline();
    return;
  }
  if (els.dialog.open) els.dialog.close();
  noteEditing = false;
  currentAlbum = { id, list: data.photos, shown: 0 };
  els.albumView.hidden = false;
  document.body.classList.add('album-open');
  els.albumKicker.textContent = data.kicker;
  els.albumTitle.textContent = data.title;
  els.albumCount.textContent = `${data.photos.length.toLocaleString()} ${data.photos.length === 1 ? 'moment' : 'moments'}`;
  els.albumPhotos.replaceChildren();
  els.albumPhotos.hidden = data.photos.length === 0;
  els.albumEmpty.hidden = data.photos.length !== 0;
  els.albumEmptyText.textContent = data.empty;
  els.albumScroll.scrollTop = 0;
  document.title = `${data.title} — Our Little Moments`;
  renderAlbumPage();
  els.albumBack.focus({ preventScroll: true });
}

function closeAlbum() {
  if (!currentAlbum) return;
  if (els.dialog.open) els.dialog.close();
  stopSlideshow();
  currentAlbum = null;
  els.albumView.hidden = true;
  document.body.classList.remove('album-open');
  document.title = 'Our Little Moments — a photo archive';
  if (photos.length) renderAlbums();
}

function route() {
  const match = location.hash.match(/^#album\/([^/]+)$/);
  if (!match) {
    closeAlbum();
    syncTimeline();
    return;
  }
  let id = match[1];
  try {
    id = decodeURIComponent(id);
  } catch {
    /* keep the raw value */
  }
  openAlbumById(id);
  syncTimeline();
}

/* ——— Lightbox ——— */

function renderLightbox() {
  const photo = lbList[lbIndex];
  if (!photo) return;
  noteEditing = false;
  els.lightboxImage.src = photo.src;
  els.lightboxImage.alt = `A memory from ${prettyDate(photo)}`;
  els.lightboxCaption.textContent = prettyDate(photo);
  els.lightboxIndex.textContent = `${lbIndex + 1} / ${lbList.length}`;
  els.downloadPhoto.href = photo.src;
  els.downloadPhoto.download = photo.name;
  updateFavoriteButton(els.lightboxFavorite, photo.name);
  syncNoteUI();
  if (!reduceMotion.matches && typeof els.lightboxImage.animate === 'function') {
    els.lightboxImage.animate(
      [{ opacity: 0.25, transform: 'scale(.985)' }, { opacity: 1, transform: 'none' }],
      { duration: 300, easing: 'cubic-bezier(.2, .7, .2, 1)' }
    );
  }
}

function openLightbox(list, index, autoplay = false) {
  if (!list.length) return;
  lbList = list;
  lbIndex = Math.max(0, Math.min(index, list.length - 1));
  renderLightbox();
  if (!els.dialog.open) els.dialog.showModal();
  if (autoplay) startSlideshow();
  else stopSlideshow();
}

function stepPhoto(amount) {
  if (!lbList.length) return;
  lbIndex = (lbIndex + amount + lbList.length) % lbList.length;
  renderLightbox();
}

function updateSlideshowLabels(running) {
  els.slideshowToggle.textContent = running ? 'Ⅱ Pause' : '▶ Slideshow';
  els.albumSlideshow.innerHTML = running
    ? '<span aria-hidden="true">Ⅱ</span> Pause'
    : '<span aria-hidden="true">▶</span> Slideshow';
}

function startSlideshow() {
  if (lbList.length < 2) return;
  clearInterval(slideshowTimer);
  slideshowTimer = setInterval(() => stepPhoto(1), 4000);
  updateSlideshowLabels(true);
}

function stopSlideshow() {
  clearInterval(slideshowTimer);
  slideshowTimer = null;
  updateSlideshowLabels(false);
}

/* ——— Search ——— */

function setSearchMode(active) {
  els.timelineSection.hidden = active;
  els.timelineSection.hidden = active;
  els.recentSection.hidden = active || photos.length === 0;
  els.albumsSection.hidden = active;
  els.searchSection.hidden = !active;
}

function renderSearchPage() {
  const end = Math.min(searchShown + SEARCH_PAGE, searchResults.length);
  const fragment = document.createDocumentFragment();
  for (let index = searchShown; index < end; index++) {
    const card = makePhotoCard(searchResults[index], searchResults, index);
    card.style.animationDelay = `${Math.min(index % 10, 9) * 26}ms`;
    fragment.append(card);
  }
  els.searchGrid.append(fragment);
  searchShown = end;
  els.searchMore.hidden = searchShown >= searchResults.length;
}

function runSearch() {
  const query = els.searchInput.value.trim();
  const active = query.length > 0;
  if (!active) {
    if (searchActive) {
      searchActive = false;
      els.searchGrid.replaceChildren();
      searchResults = [];
      setSearchMode(false);
      if (photos.length) renderAlbums();
    }
    return;
  }

  const firstOpen = !searchActive;
  searchActive = true;
  setSearchMode(true);
  const needle = query.toLowerCase();
  searchResults = photos.filter(photo => {
    const note = noteFor(photo.name);
    const haystack = `${photo.name} ${prettyDate(photo)} ${photo.date ? `${MONTH_NAMES.format(photo.date)} ${photo.date.getFullYear()}` : ''} ${note}`.toLowerCase();
    return haystack.includes(needle);
  });
  searchShown = 0;
  els.searchGrid.replaceChildren();
  els.searchEmpty.hidden = searchResults.length !== 0;
  els.searchNote.textContent = searchResults.length
    ? `${searchResults.length.toLocaleString()} ${searchResults.length === 1 ? 'moment' : 'moments'} for “${query}”`
    : `Nothing for “${query}”`;
  renderSearchPage();
  if (firstOpen) els.searchSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function leaveAlbumForSearch() {
  if (!currentAlbum) return;
  history.replaceState(null, '', '#/');
  closeAlbum();
  syncTimeline();
}

function focusSearch() {
  if (els.dialog.open) els.dialog.close();
  leaveAlbumForSearch();
  els.searchInput.focus();
  els.searchInput.select();
}

/* ——— Photo loading ——— */

function showPhotos(items, objectUrls = []) {
  photoObjectUrls.forEach(url => URL.revokeObjectURL(url));
  photoObjectUrls = objectUrls;
  photos = items.map(item => ({ ...item, date: parseDate(item.name) }));
  photos.sort((a, b) => {
    if (a.date && b.date) return b.date - a.date || a.name.localeCompare(b.name);
    if (a.date) return -1;
    if (b.date) return 1;
    return a.name.localeCompare(b.name);
  });
  buildAlbums();
  els.albumGrid.hidden = false;
  els.landingEmpty.hidden = true;
  renderLanding();
  applyDensity();
  runSearch();
  if (!searchActive) setSearchMode(false);
  route();
  window.scrollTo({ top: 0, behavior: 'auto' });
}

function showLoadError(message) {
  els.albumGrid.replaceChildren();
  els.albumGrid.hidden = true;
  els.landingEmpty.hidden = false;
  els.landingEmptyText.textContent = message;
  els.timeline.replaceChildren();
  els.navAlbumCount.textContent = '—';
  els.timelineSection.hidden = true;
  els.albumsSection.hidden = false;
  els.searchSection.hidden = true;
  els.recentSection.hidden = true;
  searchActive = false;
  searchResults = [];
  els.searchGrid.replaceChildren();
}

async function discoverPhotos() {
  if (location.protocol === 'file:') {
    showLoadError('This page needs a small local server to scan pic/ automatically.');
    return;
  }
  try {
    const response = await fetch('pic/', { cache: 'no-store' });
    if (!response.ok) throw new Error('Folder listing unavailable');
    const listing = new DOMParser().parseFromString(await response.text(), 'text/html');
    const names = [...listing.querySelectorAll('a[href]')]
      .map(link => new URL(link.href, response.url).pathname.split('/').filter(Boolean).pop())
      .filter(name => name && /\.(jpe?g|png|webp|gif)$/i.test(name))
      .map(name => decodeURIComponent(name));
    if (!names.length) throw new Error('No photos discovered');
    showPhotos(names.map(name => ({ name, src: `pic/${encodeURIComponent(name)}` })));
  } catch {
    showLoadError('Could not scan pic/ automatically. Load a local folder instead.');
  }
}

/* ——— Events ——— */

document.querySelectorAll('.density-button').forEach(button => button.addEventListener('click', () => {
  density = button.dataset.density === 'compact' ? 'compact' : 'roomy';
  localStorage.setItem(DENSITY_KEY, density);
  applyDensity();
}));

els.searchInput.addEventListener('input', () => {
  leaveAlbumForSearch();
  clearTimeout(searchTimer);
  searchTimer = setTimeout(runSearch, 120);
});

els.searchMore.addEventListener('click', renderSearchPage);

els.albumBack.addEventListener('click', () => { location.hash = '#/'; });
els.albumSlideshow.addEventListener('click', () => {
  if (els.dialog.open) {
    slideshowTimer ? stopSlideshow() : startSlideshow();
    return;
  }
  if (currentAlbum && currentAlbum.list.length) openLightbox(currentAlbum.list, 0, true);
});

els.lbClose.addEventListener('click', () => els.dialog.close());
els.lbPrev.addEventListener('click', () => stepPhoto(-1));
els.lbNext.addEventListener('click', () => stepPhoto(1));
els.lbStage.addEventListener('click', event => {
  if (event.target === els.lbStage || event.target.classList.contains('lb-frame')) els.dialog.close();
});
els.dialog.addEventListener('click', event => { if (event.target === els.dialog) els.dialog.close(); });
els.dialog.addEventListener('close', () => {
  noteEditing = false;
  stopSlideshow();
});
els.dialog.addEventListener('cancel', () => { noteEditing = false; });

els.lightboxFavorite.addEventListener('click', () => {
  const photo = lbList[lbIndex];
  if (photo) toggleFavorite(photo);
});

els.slideshowToggle.addEventListener('click', () => {
  slideshowTimer ? stopSlideshow() : startSlideshow();
});

els.noteEdit.addEventListener('click', startNoteEdit);
els.noteCancel.addEventListener('click', stopNoteEdit);
els.noteRemove.addEventListener('click', removeNote);
els.noteForm.addEventListener('submit', event => {
  event.preventDefault();
  saveNote();
});

document.querySelectorAll('[data-go-home]').forEach(button => button.addEventListener('click', () => {
  location.hash = '#/';
}));

els.chooseFolder.addEventListener('click', () => {
  els.folderInput.value = '';
  els.folderInput.click();
});
els.landingEmptyButton.addEventListener('click', () => {
  els.folderInput.value = '';
  els.folderInput.click();
});

document.querySelector('.footer-top').addEventListener('click', event => {
  if (currentAlbum) return;
  event.preventDefault();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

els.folderInput.addEventListener('change', () => {
  const items = [...els.folderInput.files]
    .filter(file => file.type.startsWith('image/') || /\.(jpe?g|png|webp|gif)$/i.test(file.name))
    .map(file => ({ name: file.name, src: URL.createObjectURL(file) }));
  if (!items.length) {
    showLoadError('No image files were found in that folder.');
    return;
  }
  const objectUrls = items.map(item => item.src);
  if (location.hash) {
    history.replaceState(null, '', '#/');
    closeAlbum();
  }
  showPhotos(items, objectUrls);
});

document.addEventListener('keydown', event => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    focusSearch();
    return;
  }
  if (els.dialog.open) {
    const typing = event.target instanceof Element && event.target.closest('textarea, input');
    if (!typing && event.key === 'ArrowRight') { event.preventDefault(); stepPhoto(1); }
    if (!typing && event.key === 'ArrowLeft') { event.preventDefault(); stepPhoto(-1); }
    return;
  }
  if (event.key === 'Escape') {
    if (currentAlbum) location.hash = '#/';
  }
});

window.addEventListener('hashchange', route);

const sentinelObserver = new IntersectionObserver(entries => {
  if (!entries[0].isIntersecting || !currentAlbum) return;
  if (currentAlbum.shown < currentAlbum.list.length) renderAlbumPage();
}, { root: els.albumScroll, rootMargin: '700px 0px' });
sentinelObserver.observe(els.albumSentinel);

applyDensity();
updateFavoriteBadge();
document.querySelectorAll('.section-bar, .timeline, .site-footer').forEach((element, index) => {
  watchReveal(element, Math.min(index, 8) * 50);
});
discoverPhotos();
