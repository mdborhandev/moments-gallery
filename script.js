const grid = document.querySelector('#photo-grid');
const searchInput = document.querySelector('#search-input');
const yearFilter = document.querySelector('#year-filter');
const sortFilter = document.querySelector('#sort-filter');
const resultCount = document.querySelector('#result-count');
const emptyState = document.querySelector('#empty-state');
const loadMoreButton = document.querySelector('#load-more');
const dialog = document.querySelector('#lightbox');
const PAGE_SIZE = 60;
const favoritesKey = 'our-little-moments-favorites';
let photos = [];
let filteredPhotos = [];
let shown = 0;
let activeFilter = 'all';
let favorites = new Set(JSON.parse(localStorage.getItem(favoritesKey) || '[]'));
let activePhotoIndex = -1;
let slideshowTimer = null;
let photoObjectUrls = [];

const savedDensity = localStorage.getItem('our-little-moments-density') || 'roomy';
grid.classList.toggle('is-compact', savedDensity === 'compact');
document.querySelectorAll('.density-button').forEach(button => {
  button.classList.toggle('is-active', button.dataset.density === savedDensity);
});

function yearFromName(name) {
  const match = name.match(/(?:IMG[-_])?(20\d{2})/i);
  return match ? match[1] : '';
}

function prettyDate(name) {
  const match = name.match(/(20\d{2})[-_]?([01]\d)[-_]?([0-3]\d)/);
  if (!match) return 'A lovely day';
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(date);
}

function dateKey(name) {
  const match = name.match(/(20\d{2})[-_]?([01]\d)[-_]?([0-3]\d)/);
  return match ? Number(`${match[1]}${match[2]}${match[3]}`) : 0;
}

function saveFavorites() {
  localStorage.setItem(favoritesKey, JSON.stringify([...favorites]));
}

function updateFavoriteButton(button, filename) {
  const saved = favorites.has(filename);
  button.classList.toggle('is-favorite', saved);
  button.textContent = saved ? '♥' : '♡';
  button.setAttribute('aria-label', saved ? 'Remove from favorites' : 'Save as favorite');
}

function makeCard(photo, index) {
  const card = document.createElement('figure');
  card.className = 'photo-card';
  card.style.animationDelay = `${Math.min(index % PAGE_SIZE, 12) * 18}ms`;
  card.dataset.filename = photo.name;
  card.innerHTML = `<img loading="lazy" decoding="async" src="${photo.src}" alt="A memory from ${prettyDate(photo.name)}"><span class="photo-date">${prettyDate(photo.name)}</span><button class="favorite-button" type="button" aria-label="Save as favorite">♡</button>`;
  card.addEventListener('click', event => {
    if (event.target.closest('.favorite-button')) {
      event.stopPropagation();
      favorites.has(photo.name) ? favorites.delete(photo.name) : favorites.add(photo.name);
      saveFavorites();
      updateFavoriteButton(card.querySelector('.favorite-button'), photo.name);
      if (activeFilter === 'favorites') applyFilters();
      return;
    }
    openPhoto(photo);
  });
  updateFavoriteButton(card.querySelector('.favorite-button'), photo.name);
  card.querySelector('img').addEventListener('error', () => card.remove(), { once: true });
  return card;
}

function renderMore() {
  const end = Math.min(shown + PAGE_SIZE, filteredPhotos.length);
  const fragment = document.createDocumentFragment();
  for (let index = shown; index < end; index++) fragment.append(makeCard(filteredPhotos[index], index));
  grid.append(fragment);
  shown = end;
  loadMoreButton.hidden = shown >= filteredPhotos.length;
  resultCount.textContent = `${filteredPhotos.length.toLocaleString()} ${filteredPhotos.length === 1 ? 'moment' : 'moments'}${filteredPhotos.length !== photos.length ? ' found' : ' to wander through'}`;
}

function applyFilters() {
  const query = searchInput.value.trim().toLowerCase();
  const year = yearFilter.value;
  filteredPhotos = photos.filter(photo => {
    if (activeFilter === 'favorites' && !favorites.has(photo.name)) return false;
    if (year !== 'all' && yearFromName(photo.name) !== year) return false;
    return !query || photo.name.toLowerCase().includes(query) || prettyDate(photo.name).toLowerCase().includes(query);
  });
  if (sortFilter.value === 'name') filteredPhotos.sort((a, b) => a.name.localeCompare(b.name));
  else if (sortFilter.value === 'oldest') filteredPhotos.sort((a, b) => dateKey(a.name) - dateKey(b.name));
  else if (sortFilter.value === 'newest') filteredPhotos.sort((a, b) => dateKey(b.name) - dateKey(a.name));
  shown = 0;
  grid.replaceChildren();
  emptyState.hidden = filteredPhotos.length !== 0;
  loadMoreButton.hidden = filteredPhotos.length === 0;
  if (filteredPhotos.length) renderMore();
  else resultCount.textContent = 'No moments found';
}

function openPhoto(photo) {
  activePhotoIndex = filteredPhotos.findIndex(item => item.name === photo.name);
  updateLightbox();
  dialog.showModal();
}

function updateLightbox() {
  const photo = filteredPhotos[activePhotoIndex];
  if (!photo) return;
  const image = document.querySelector('#lightbox-image');
  image.src = photo.src;
  image.alt = `A memory from ${prettyDate(photo.name)}`;
  document.querySelector('#lightbox-caption').textContent = prettyDate(photo.name);
  document.querySelector('#lightbox-index').textContent = `${activePhotoIndex + 1} / ${filteredPhotos.length}`;
  const download = document.querySelector('#download-photo');
  download.href = photo.src;
  download.download = photo.name;
  updateFavoriteButton(document.querySelector('.lightbox-favorite'), photo.name);
}

function stepPhoto(amount) {
  activePhotoIndex = (activePhotoIndex + amount + filteredPhotos.length) % filteredPhotos.length;
  updateLightbox();
}

document.querySelectorAll('.filter-button').forEach(button => button.addEventListener('click', () => {
  document.querySelector('.filter-button.is-active').classList.remove('is-active');
  button.classList.add('is-active');
  activeFilter = button.dataset.filter;
  applyFilters();
}));
searchInput.addEventListener('input', applyFilters);
yearFilter.addEventListener('change', applyFilters);
sortFilter.addEventListener('change', () => {
  if (sortFilter.value === 'random') {
    for (let index = photos.length - 1; index > 0; index--) {
      const other = Math.floor(Math.random() * (index + 1));
      [photos[index], photos[other]] = [photos[other], photos[index]];
    }
  }
  applyFilters();
});
loadMoreButton.addEventListener('click', renderMore);
document.querySelectorAll('.density-button').forEach(button => button.addEventListener('click', () => {
  const density = button.dataset.density;
  grid.classList.toggle('is-compact', density === 'compact');
  document.querySelectorAll('.density-button').forEach(item => item.classList.toggle('is-active', item === button));
  localStorage.setItem('our-little-moments-density', density);
}));
document.querySelector('#clear-filters').addEventListener('click', () => {
  searchInput.value = '';
  yearFilter.value = 'all';
  document.querySelector('[data-filter="all"]').click();
});
const folderInput = document.querySelector('#folder-input');
document.querySelector('#choose-folder').addEventListener('click', () => {
  folderInput.value = '';
  folderInput.click();
});
function showPhotos(items, objectUrls = []) {
  photoObjectUrls.forEach(url => URL.revokeObjectURL(url));
  photoObjectUrls = objectUrls;
  photos = items;
  for (let index = photos.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [photos[index], photos[other]] = [photos[other], photos[index]];
  }
  const years = [...new Set(photos.map(photo => yearFromName(photo.name)).filter(Boolean))].sort().reverse();
  yearFilter.replaceChildren(new Option('Every year', 'all'), ...years.map(year => new Option(year, year)));
  document.querySelector('#all-count').textContent = photos.length.toLocaleString();
  document.querySelector('#gallery-title').scrollIntoView({ behavior: 'smooth', block: 'start' });
  applyFilters();
  if (!photos.length) resultCount.textContent = 'No image files found in that folder.';
}
folderInput.addEventListener('change', () => {
  const items = [...folderInput.files]
    .filter(file => file.type.startsWith('image/') || /\.(jpe?g|png|webp|gif)$/i.test(file.name))
    .map(file => {
      const src = URL.createObjectURL(file);
      return { name: file.name, src };
    });
  const objectUrls = items.map(photo => photo.src).filter(src => src.startsWith('blob:'));
  showPhotos(items, objectUrls);
  document.querySelector('#gallery-title').scrollIntoView({ behavior: 'smooth', block: 'start' });
});
document.querySelector('.lightbox-close').addEventListener('click', () => dialog.close());
document.querySelector('.lightbox-prev').addEventListener('click', () => stepPhoto(-1));
document.querySelector('.lightbox-next').addEventListener('click', () => stepPhoto(1));
document.querySelector('.lightbox-favorite').addEventListener('click', event => {
  const photo = filteredPhotos[activePhotoIndex];
  favorites.has(photo.name) ? favorites.delete(photo.name) : favorites.add(photo.name);
  saveFavorites();
  updateFavoriteButton(event.currentTarget, photo.name);
  const cardButton = grid.querySelector(`[data-filename="${CSS.escape(photo.name)}"] .favorite-button`);
  if (cardButton) updateFavoriteButton(cardButton, photo.name);
  if (activeFilter === 'favorites' && !favorites.has(photo.name)) {
    dialog.close();
    applyFilters();
  }
});
dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
const slideshowButton = document.querySelector('#slideshow-toggle');
function stopSlideshow() {
  clearInterval(slideshowTimer);
  slideshowTimer = null;
  slideshowButton.textContent = '▶ Slideshow';
}
slideshowButton.addEventListener('click', () => {
  if (slideshowTimer) return stopSlideshow();
  if (filteredPhotos.length < 2) return;
  slideshowButton.textContent = 'Ⅱ Pause';
  slideshowTimer = setInterval(() => stepPhoto(1), 3500);
});
dialog.addEventListener('close', stopSlideshow);
document.addEventListener('keydown', event => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); searchInput.focus(); }
  if (!dialog.open) return;
  if (event.key === 'ArrowRight') stepPhoto(1);
  if (event.key === 'ArrowLeft') stepPhoto(-1);
});

async function discoverPhotos() {
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
    resultCount.textContent = 'Could not scan pic/ automatically. Choose the photo folder to load it.';
  }
}

discoverPhotos();

