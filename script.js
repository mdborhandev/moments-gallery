const PAGE_SIZE = 48;
const SEARCH_PAGE = 60;
const FAVORITES_KEY = 'our-little-moments-favorites';
const DENSITY_KEY = 'our-little-moments-density';
const MONTH_NAMES = new Intl.DateTimeFormat('en', { month: 'long' });
const FULL_DATE = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'long', year: 'numeric' });

function loadFavorites() {
  try {
    const saved = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
    return new Set(Array.isArray(saved) ? saved : []);
  } catch {
    return new Set();
  }
}

const els = {
  headerCount: document.querySelector('#header-count'),
  headerAlbums: document.querySelector('#header-albums'),
  favoriteCount: document.querySelector('#favorite-count'),
  statPhotos: document.querySelector('#stat-photos'),
  statAlbums: document.querySelector('#stat-albums'),
  statSince: document.querySelector('#stat-since'),
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
};

let photos = [];
let albumMap = new Map();
let albumList = [];
let favorites = loadFavorites();
let currentAlbum = null;
let lbList = [];
let lbIndex = 0;
let slideshowTimer = null;
let searchTimer = null;
let searchResults = [];
let searchShown = 0;
let searchActive = false;
let photoObjectUrls = [];
let density = localStorage.getItem(DENSITY_KEY) === 'compact' ? 'compact' : 'roomy';

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
}

function renderLanding() {
  const earliest = photos.filter(photo => photo.date).at(-1);
  els.headerCount.textContent = photos.length.toLocaleString();
  els.headerAlbums.textContent = albumList.length.toLocaleString();
  els.favoriteCount.textContent = favorites.size.toLocaleString();
  els.statPhotos.textContent = photos.length.toLocaleString();
  els.statAlbums.textContent = albumList.length.toLocaleString();
  els.statSince.textContent = earliest ? String(earliest.date.getFullYear()) : '—';
  els.albumGrid.hidden = photos.length === 0;
  els.landingEmpty.hidden = photos.length !== 0;
  if (photos.length) renderAlbums();
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

  card.append(img, hit, meta);
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
    return;
  }
  if (els.dialog.open) els.dialog.close();
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
    return;
  }
  let id = match[1];
  try {
    id = decodeURIComponent(id);
  } catch {
    /* keep the raw value */
  }
  openAlbumById(id);
}

/* ——— Lightbox ——— */

function renderLightbox() {
  const photo = lbList[lbIndex];
  if (!photo) return;
  els.lightboxImage.src = photo.src;
  els.lightboxImage.alt = `A memory from ${prettyDate(photo)}`;
  els.lightboxCaption.textContent = prettyDate(photo);
  els.lightboxIndex.textContent = `${lbIndex + 1} / ${lbList.length}`;
  els.downloadPhoto.href = photo.src;
  els.downloadPhoto.download = photo.name;
  updateFavoriteButton(els.lightboxFavorite, photo.name);
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
      els.searchSection.hidden = true;
      els.albumsSection.hidden = false;
      els.searchGrid.replaceChildren();
      searchResults = [];
      if (photos.length) renderAlbums();
    }
    return;
  }

  const firstOpen = !searchActive;
  searchActive = true;
  els.albumsSection.hidden = true;
  els.searchSection.hidden = false;
  const needle = query.toLowerCase();
  searchResults = photos.filter(photo => {
    const haystack = `${photo.name} ${prettyDate(photo)} ${photo.date ? `${MONTH_NAMES.format(photo.date)} ${photo.date.getFullYear()}` : ''}`.toLowerCase();
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
  route();
  window.scrollTo({ top: 0, behavior: 'auto' });
}

function showLoadError(message) {
  els.albumGrid.replaceChildren();
  els.albumGrid.hidden = true;
  els.landingEmpty.hidden = false;
  els.landingEmptyText.textContent = message;
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
  if (event.target === els.lbStage || event.target.classList.contains('lb-figure')) els.dialog.close();
});
els.dialog.addEventListener('click', event => { if (event.target === els.dialog) els.dialog.close(); });
els.dialog.addEventListener('close', stopSlideshow);

els.lightboxFavorite.addEventListener('click', () => {
  const photo = lbList[lbIndex];
  if (photo) toggleFavorite(photo);
});

els.slideshowToggle.addEventListener('click', () => {
  slideshowTimer ? stopSlideshow() : startSlideshow();
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
    if (currentAlbum) location.hash = '#/';
    window.setTimeout(() => {
      els.searchInput.focus();
      els.searchInput.select();
    }, currentAlbum ? 60 : 0);
    return;
  }
  if (els.dialog.open) {
    if (event.key === 'ArrowRight') { event.preventDefault(); stepPhoto(1); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); stepPhoto(-1); }
    return;
  }
  if (event.key === 'Escape' && currentAlbum) location.hash = '#/';
});

window.addEventListener('hashchange', route);

const sentinelObserver = new IntersectionObserver(entries => {
  if (!entries[0].isIntersecting || !currentAlbum) return;
  if (currentAlbum.shown < currentAlbum.list.length) renderAlbumPage();
}, { root: els.albumScroll, rootMargin: '700px 0px' });
sentinelObserver.observe(els.albumSentinel);

applyDensity();
updateFavoriteBadge();
discoverPhotos();
