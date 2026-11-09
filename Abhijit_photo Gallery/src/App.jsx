import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Search,
  Star,
  Download,
  Trash2,
  Upload,
  FolderUp,
  X,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  RotateCcw,
  ImageOff,
  Aperture,
  Maximize2,
  Minimize2,
} from "lucide-react";

/* ---------------------------------------------------------
   Abhijit's Gallery
   A contact-sheet / darkroom styled photo gallery:
   - folder / multi-file upload + drag & drop
   - four film-process themed looks
   - category rail, search, favorites
   - a filmstrip slideshow, full-screen preview, downloads
   - a soft-delete trash bin with restore
--------------------------------------------------------- */

const THEMES = {
  darkroom: {
    label: "Darkroom",
    swatch: "#B84A3A",
    vars: {
      "--bg": "#100d0b",
      "--surface": "#1a1613",
      "--surface-2": "#221c17",
      "--text": "#f1e7d8",
      "--muted": "#8f8172",
      "--accent": "#b84a3a",
      "--accent-2": "#3e7c74",
      "--border": "#2c241d",
      "--radius": "4px",
    },
  },
  contactsheet: {
    label: "Contact Sheet",
    swatch: "#7c3b2e",
    vars: {
      "--bg": "#ece7dc",
      "--surface": "#fbf9f4",
      "--surface-2": "#e2dccb",
      "--text": "#201b15",
      "--muted": "#736b5a",
      "--accent": "#7c3b2e",
      "--accent-2": "#2f5d50",
      "--border": "#d7cfb9",
      "--radius": "3px",
    },
  },
  cyanotype: {
    label: "Cyanotype",
    swatch: "#f4c95d",
    vars: {
      "--bg": "#0a2540",
      "--surface": "#0f3459",
      "--surface-2": "#134068",
      "--text": "#eaf2fa",
      "--muted": "#8fb4cd",
      "--accent": "#f4c95d",
      "--accent-2": "#6fa8c4",
      "--border": "#1b4e77",
      "--radius": "4px",
    },
  },
  sepia: {
    label: "Sepia",
    swatch: "#c98a3a",
    vars: {
      "--bg": "#1d1610",
      "--surface": "#2a2018",
      "--surface-2": "#33271b",
      "--text": "#ecd9be",
      "--muted": "#a3927a",
      "--accent": "#c98a3a",
      "--accent-2": "#6b7b58",
      "--border": "#3c2f22",
      "--radius": "3px",
    },
  },
};

const DEFAULT_CATEGORIES = ["Nature", "Mountain", "Sea", "Food", "Travel", "Family", "Other"];

const seedPhoto = (seed, name, category, favorite) => ({
  id: `seed-${seed}`,
  url: `https://picsum.photos/seed/${seed}/1000/720`,
  name,
  category,
  favorite,
  deleted: false,
});

const SEED_PHOTOS = [
  seedPhoto("mtn1", "Misty Ridge", "Mountain", true),
  seedPhoto("sea1", "Turquoise Bay", "Sea", false),
  seedPhoto("food1", "Morning Table", "Food", true),
  seedPhoto("nature1", "Fern Hollow", "Nature", false),
  seedPhoto("travel1", "Old Quarter", "Travel", false),
  seedPhoto("family1", "Sunday Picnic", "Family", false),
  seedPhoto("mtn2", "Granite Peak", "Mountain", false),
  seedPhoto("sea2", "Low Tide", "Sea", true),
  seedPhoto("food2", "Market Basket", "Food", false),
  seedPhoto("nature2", "Canopy Light", "Nature", false),
];

const uid = () => `up-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const frameNo = (n) => `N.${String(n).padStart(3, "0")}`;

/* ---------------------------------------------------------
   Small presentational pieces
--------------------------------------------------------- */

function PrintCard({ photo, index, onOpen, onToggleFav, onDelete, onDownload }) {
  const [loaded, setLoaded] = useState(false);
  const tilt = index % 2 === 0 ? "-0.6deg" : "0.7deg";
  return (
    <figure className="ab-print" style={{ "--tilt": tilt }} onClick={() => onOpen(photo.id)}>
      <span className="ab-frame-no">{frameNo(index + 1)}</span>
      <div className="ab-print-media">
        {!loaded && <div className="ab-skeleton" />}
        <img
          src={photo.url}
          alt={photo.name}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          style={{ opacity: loaded ? 1 : 0 }}
        />
        <div className="ab-print-chips" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className={`ab-chip ${photo.favorite ? "is-active" : ""}`}
            onClick={() => onToggleFav(photo.id)}
            aria-label="Toggle favorite"
          >
            <Star size={13} fill={photo.favorite ? "currentColor" : "none"} />
          </button>
          <button type="button" className="ab-chip" onClick={() => onDownload(photo)} aria-label="Download photo">
            <Download size={13} />
          </button>
          <button type="button" className="ab-chip" onClick={() => onDelete(photo.id)} aria-label="Move to trash">
            <Trash2 size={13} />
          </button>
        </div>
      </div>
      <figcaption>
        <span className="ab-print-name">{photo.name}</span>
        <span className="ab-print-cat">{photo.category}</span>
      </figcaption>
    </figure>
  );
}

function EmptyState({ label }) {
  return (
    <div className="ab-empty">
      <ImageOff size={26} strokeWidth={1.3} />
      <p>{label}</p>
    </div>
  );
}

/* ---------------------------------------------------------
   Main component
--------------------------------------------------------- */

export default function App() {
  const [themeKey, setThemeKey] = useState("darkroom");
  const [photos, setPhotos] = useState(SEED_PHOTOS);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [previewId, setPreviewId] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadCategory, setUploadCategory] = useState("Other");
  const [frameIdx, setFrameIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const previewRef = useRef(null);
  const theme = THEMES[themeKey];

  /* ---------- derived data ---------- */

  const livePhotos = useMemo(() => photos.filter((p) => !p.deleted), [photos]);

  const categories = useMemo(() => {
    const found = new Set(livePhotos.map((p) => p.category));
    DEFAULT_CATEGORIES.forEach((c) => found.add(c));
    return Array.from(found);
  }, [livePhotos]);

  const filteredPhotos = useMemo(() => {
    const q = search.trim().toLowerCase();
    return livePhotos.filter((p) => {
      if (activeCategory === "Favorites" && !p.favorite) return false;
      if (activeCategory !== "All" && activeCategory !== "Favorites" && p.category !== activeCategory)
        return false;
      if (q && !p.name.toLowerCase().includes(q) && !p.category.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [livePhotos, activeCategory, search]);

  const trashedPhotos = useMemo(() => photos.filter((p) => p.deleted), [photos]);

  const filmPhotos = livePhotos;
  const previewIndex = previewId ? filteredPhotos.findIndex((p) => p.id === previewId) : -1;
  const previewPhoto = previewIndex >= 0 ? filteredPhotos[previewIndex] : null;

  /* ---------- slideshow ---------- */

  useEffect(() => {
    if (frameIdx >= filmPhotos.length) setFrameIdx(0);
  }, [filmPhotos.length, frameIdx]);

  useEffect(() => {
    if (!playing || filmPhotos.length < 2) return undefined;
    const t = setInterval(() => {
      setFrameIdx((i) => (i + 1) % filmPhotos.length);
    }, 4200);
    return () => clearInterval(t);
  }, [playing, filmPhotos.length]);

  /* ---------- preview keyboard nav ---------- */

  useEffect(() => {
    if (!previewPhoto) return undefined;
    function onKey(e) {
      if (e.key === "Escape") setPreviewId(null);
      if (e.key === "ArrowRight")
        setPreviewId(filteredPhotos[(previewIndex + 1) % filteredPhotos.length]?.id ?? null);
      if (e.key === "ArrowLeft")
        setPreviewId(
          filteredPhotos[(previewIndex - 1 + filteredPhotos.length) % filteredPhotos.length]?.id ?? null
        );
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previewPhoto, previewIndex, filteredPhotos]);

  useEffect(() => {
    function onFsChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  useEffect(() => {
    if (!previewPhoto && document.fullscreenElement) {
      document.exitFullscreen?.();
    }
  }, [previewPhoto]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      previewRef.current?.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.();
    }
  }, []);

  /* ---------- actions ---------- */

  const addFiles = useCallback((fileList, category) => {
    const files = Array.from(fileList || []).filter((f) => f.type.startsWith("image/"));
    if (files.length === 0) return;
    const newPhotos = files.map((f) => ({
      id: uid(),
      url: URL.createObjectURL(f),
      name: f.name.replace(/\.[^/.]+$/, ""),
      category: category || "Other",
      favorite: false,
      deleted: false,
    }));
    setPhotos((prev) => [...newPhotos, ...prev]);
    setShowUpload(false);
    setDragOver(false);
  }, []);

  const toggleFavorite = useCallback((id) => {
    setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, favorite: !p.favorite } : p)));
  }, []);

  const sendToTrash = useCallback(
    (id) => {
      setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, deleted: true } : p)));
      if (previewId === id) setPreviewId(null);
    },
    [previewId]
  );

  const restore = useCallback((id) => {
    setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, deleted: false } : p)));
  }, []);

  const permanentlyDelete = useCallback((id) => {
    setPhotos((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target && target.url.startsWith("blob:")) URL.revokeObjectURL(target.url);
      return prev.filter((p) => p.id !== id);
    });
  }, []);

  const downloadPhoto = useCallback(async (photo) => {
    try {
      const res = await fetch(photo.url);
      const blob = await res.blob();
      const ext = blob.type.split("/")[1] || "jpg";
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `${photo.name.replace(/\s+/g, "_")}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      window.open(photo.url, "_blank");
    }
  }, []);

  const onGridDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const cat = activeCategory !== "All" && activeCategory !== "Favorites" ? activeCategory : "Other";
    addFiles(e.dataTransfer.files, cat);
  };

  /* ---------- render ---------- */

  return (
    <div className="ab-app" style={theme.vars}>
      <style>{CSS}</style>

      <div className="ab-shell">
        {/* ---------------- Sidebar ---------------- */}
        <aside className="ab-rail">
          <div className="ab-brand">
            <Aperture size={22} />
            <div>
              <h1>Abhijit&rsquo;s Gallery</h1>
              <p>{livePhotos.length} frames &middot; {categories.length} rolls</p>
            </div>
          </div>

          <label className="ab-search">
            <Search size={15} />
            <input
              type="text"
              placeholder="Search name or category"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>

          <nav className="ab-catlist">
            {["All", "Favorites", ...categories].map((c) => (
              <button
                key={c}
                type="button"
                className={`ab-catitem ${activeCategory === c ? "is-active" : ""}`}
                onClick={() => setActiveCategory(c)}
              >
                {c === "Favorites" && <Star size={12} />}
                {c}
              </button>
            ))}
          </nav>

          <div className="ab-rail-foot">
            <div className="ab-swatches" role="group" aria-label="Choose a look">
              {Object.entries(THEMES).map(([key, t]) => (
                <button
                  key={key}
                  type="button"
                  className={`ab-swatch ${themeKey === key ? "is-active" : ""}`}
                  style={{ background: t.swatch }}
                  title={t.label}
                  aria-label={`${t.label} look`}
                  onClick={() => setThemeKey(key)}
                />
              ))}
            </div>
            <button type="button" className="ab-btn ab-btn-primary" onClick={() => setShowUpload(true)}>
              <Upload size={15} />
              Add photos
            </button>
            <button type="button" className="ab-btn" onClick={() => setShowTrash(true)}>
              <Trash2 size={15} />
              Trash
              {trashedPhotos.length > 0 && <span className="ab-badge">{trashedPhotos.length}</span>}
            </button>
          </div>
        </aside>

        {/* ---------------- Main ---------------- */}
        <main className="ab-main">
          {/* Filmstrip slideshow */}
          <section className="ab-filmblock">
            <div className="ab-bigframe">
              {filmPhotos.length === 0 ? (
                <EmptyState label="Add photos to load the roll" />
              ) : (
                <>
                  <img
                    key={filmPhotos[frameIdx]?.id}
                    src={filmPhotos[frameIdx]?.url}
                    alt={filmPhotos[frameIdx]?.name}
                    onClick={() => setPreviewId(filmPhotos[frameIdx].id)}
                  />
                  <span className="ab-corner ab-corner-tl" />
                  <span className="ab-corner ab-corner-tr" />
                  <span className="ab-corner ab-corner-bl" />
                  <span className="ab-corner ab-corner-br" />
                  <div className="ab-frame-meta">
                    <span>{frameNo(frameIdx + 1)} / {frameNo(filmPhotos.length)}</span>
                    <span className="ab-frame-title">{filmPhotos[frameIdx]?.name}</span>
                  </div>
                  <div className="ab-frame-controls">
                    <button
                      type="button"
                      className="ab-chip ab-chip-lg"
                      onClick={() => setFrameIdx((i) => (i - 1 + filmPhotos.length) % filmPhotos.length)}
                      aria-label="Previous frame"
                    >
                      <ChevronLeft size={17} />
                    </button>
                    <button
                      type="button"
                      className="ab-chip ab-chip-lg"
                      onClick={() => setPlaying((p) => !p)}
                      aria-label={playing ? "Pause slideshow" : "Play slideshow"}
                    >
                      {playing ? <Pause size={15} /> : <Play size={15} />}
                    </button>
                    <button
                      type="button"
                      className="ab-chip ab-chip-lg"
                      onClick={() => setFrameIdx((i) => (i + 1) % filmPhotos.length)}
                      aria-label="Next frame"
                    >
                      <ChevronRight size={17} />
                    </button>
                  </div>
                </>
              )}
            </div>

            {filmPhotos.length > 0 && (
              <div className="ab-sprockets">
                <div className="ab-strip">
                  {filmPhotos.map((p, i) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`ab-thumb ${i === frameIdx ? "is-active" : ""}`}
                      onClick={() => setFrameIdx(i)}
                      aria-label={`Show frame ${i + 1}: ${p.name}`}
                    >
                      <img src={p.url} alt="" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Masonry contact sheet */}
          <section
            className={`ab-sheet ${dragOver ? "is-drag" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onGridDrop}
          >
            {dragOver && (
              <div className="ab-drop-hint">
                <FolderUp size={22} />
                Drop images to file them under &ldquo;{activeCategory === "All" ? "Other" : activeCategory}&rdquo;
              </div>
            )}

            {filteredPhotos.length === 0 ? (
              <EmptyState label="No frames match. Try another roll or search term." />
            ) : (
              <div className="ab-masonry">
                {filteredPhotos.map((p, i) => (
                  <PrintCard
                    key={p.id}
                    photo={p}
                    index={i}
                    onOpen={setPreviewId}
                    onToggleFav={toggleFavorite}
                    onDelete={sendToTrash}
                    onDownload={downloadPhoto}
                  />
                ))}
              </div>
            )}
          </section>
        </main>
      </div>

      {/* ---------------- Upload modal ---------------- */}
      {showUpload && (
        <div className="ab-modal-backdrop" onClick={() => setShowUpload(false)}>
          <div className="ab-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ab-modal-head">
              <h3>Add photos</h3>
              <button type="button" className="ab-chip" onClick={() => setShowUpload(false)}>
                <X size={16} />
              </button>
            </div>

            <label className="ab-field">
              File these photos under
              <select value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value)}>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>

            <div
              className={`ab-upload-drop ${dragOver ? "is-drag" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                addFiles(e.dataTransfer.files, uploadCategory);
              }}
            >
              <Upload size={20} />
              <p>Drag and drop images here</p>
              <div className="ab-upload-buttons">
                <button type="button" className="ab-btn ab-btn-primary" onClick={() => fileInputRef.current?.click()}>
                  Choose photos
                </button>
                <button type="button" className="ab-btn" onClick={() => folderInputRef.current?.click()}>
                  <FolderUp size={14} />
                  Choose a folder
                </button>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => addFiles(e.target.files, uploadCategory)}
            />
            <input
              ref={folderInputRef}
              type="file"
              accept="image/*"
              multiple
              webkitdirectory=""
              directory=""
              hidden
              onChange={(e) => addFiles(e.target.files, uploadCategory)}
            />
          </div>
        </div>
      )}

      {/* ---------------- Trash modal ---------------- */}
      {showTrash && (
        <div className="ab-modal-backdrop" onClick={() => setShowTrash(false)}>
          <div className="ab-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ab-modal-head">
              <h3>Trash</h3>
              <button type="button" className="ab-chip" onClick={() => setShowTrash(false)}>
                <X size={16} />
              </button>
            </div>
            <p className="ab-modal-sub">Deleted frames wait here until you clear them for good.</p>

            {trashedPhotos.length === 0 ? (
              <EmptyState label="Trash is empty" />
            ) : (
              <ul className="ab-trash-list">
                {trashedPhotos.map((p) => (
                  <li key={p.id} className="ab-trash-item">
                    <img src={p.url} alt={p.name} />
                    <div className="ab-trash-info">
                      <span className="ab-print-name">{p.name}</span>
                      <span className="ab-print-cat">{p.category}</span>
                    </div>
                    <div className="ab-trash-actions">
                      <button type="button" className="ab-btn" onClick={() => restore(p.id)}>
                        <RotateCcw size={13} />
                        Restore
                      </button>
                      <button type="button" className="ab-btn ab-btn-danger" onClick={() => permanentlyDelete(p.id)}>
                        Delete forever
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* ---------------- Fullscreen preview ---------------- */}
      {previewPhoto && (
        <div className="ab-preview-backdrop" ref={previewRef} onClick={() => setPreviewId(null)}>
          <button
            type="button"
            className="ab-chip ab-chip-lg ab-preview-fs"
            onClick={(e) => {
              e.stopPropagation();
              toggleFullscreen();
            }}
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          <button type="button" className="ab-chip ab-chip-lg ab-preview-close" onClick={() => setPreviewId(null)}>
            <X size={18} />
          </button>

          <button
            type="button"
            className="ab-chip ab-chip-lg ab-preview-nav ab-preview-prev"
            onClick={(e) => {
              e.stopPropagation();
              setPreviewId(filteredPhotos[(previewIndex - 1 + filteredPhotos.length) % filteredPhotos.length].id);
            }}
            aria-label="Previous photo"
          >
            <ChevronLeft size={20} />
          </button>

          <figure className="ab-preview" onClick={(e) => e.stopPropagation()}>
            <img src={previewPhoto.url} alt={previewPhoto.name} />
            <figcaption>
              <div>
                <span className="ab-print-name">{previewPhoto.name}</span>
                <span className="ab-print-cat">{previewPhoto.category} &middot; {frameNo(previewIndex + 1)}</span>
              </div>
              <div className="ab-print-chips ab-static-chips">
                <button
                  type="button"
                  className={`ab-chip ${previewPhoto.favorite ? "is-active" : ""}`}
                  onClick={() => toggleFavorite(previewPhoto.id)}
                  aria-label="Toggle favorite"
                >
                  <Star size={15} fill={previewPhoto.favorite ? "currentColor" : "none"} />
                </button>
                <button type="button" className="ab-chip" onClick={() => downloadPhoto(previewPhoto)} aria-label="Download photo">
                  <Download size={15} />
                </button>
                <button type="button" className="ab-chip" onClick={() => sendToTrash(previewPhoto.id)} aria-label="Move to trash">
                  <Trash2 size={15} />
                </button>
              </div>
            </figcaption>
          </figure>

          <button
            type="button"
            className="ab-chip ab-chip-lg ab-preview-nav ab-preview-next"
            onClick={(e) => {
              e.stopPropagation();
              setPreviewId(filteredPhotos[(previewIndex + 1) % filteredPhotos.length].id);
            }}
            aria-label="Next photo"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   Styles
--------------------------------------------------------- */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,500&family=Space+Mono:wght@400;700&display=swap');

.ab-app{
  min-height:100vh;
  background:var(--bg);
  color:var(--text);
  font-family:'Newsreader', Georgia, serif;
  transition:background .3s ease, color .3s ease;
}
.ab-app *{ box-sizing:border-box; }
.ab-app h1, .ab-app h3{ font-family:'Newsreader', serif; margin:0; }

.ab-shell{ display:flex; align-items:flex-start; min-height:100vh; }

/* ---- sidebar ---- */
.ab-rail{
  width:250px; flex-shrink:0; position:sticky; top:0; height:100vh;
  background:var(--surface); border-right:1px solid var(--border);
  padding:24px 18px; display:flex; flex-direction:column; gap:22px;
}
.ab-brand{ display:flex; align-items:flex-start; gap:10px; color:var(--accent); }
.ab-brand h1{ font-size:1.35rem; font-weight:600; color:var(--text); line-height:1.2; }
.ab-brand p{ margin:4px 0 0; font-family:'Space Mono', monospace; font-size:.68rem; color:var(--muted); }

.ab-search{
  display:flex; align-items:center; gap:8px;
  background:var(--bg); border:1px solid var(--border); border-radius:var(--radius);
  padding:8px 10px; color:var(--muted);
}
.ab-search input{
  border:none; outline:none; background:transparent; color:var(--text);
  font-family:'Space Mono', monospace; font-size:.78rem; width:100%;
}

.ab-catlist{ display:flex; flex-direction:column; gap:2px; overflow-y:auto; }
.ab-catitem{
  display:flex; align-items:center; gap:7px; text-align:left;
  background:transparent; border:none; border-left:2px solid transparent; color:var(--muted);
  padding:8px 10px; font-family:'Newsreader', serif; font-size:.95rem; cursor:pointer; border-radius:0 3px 3px 0;
}
.ab-catitem:hover{ background:var(--surface-2); }
.ab-catitem.is-active{ color:var(--text); border-left-color:var(--accent); background:var(--surface-2); font-weight:600; }

.ab-rail-foot{ margin-top:auto; display:flex; flex-direction:column; gap:10px; }
.ab-swatches{ display:flex; gap:6px; }
.ab-swatch{ width:18px; height:18px; border-radius:50%; border:2px solid transparent; cursor:pointer; padding:0; }
.ab-swatch.is-active{ border-color:var(--text); }

.ab-btn{
  display:inline-flex; align-items:center; justify-content:center; gap:7px;
  background:transparent; color:var(--text); border:1px solid var(--border);
  padding:9px 14px; border-radius:var(--radius); font-family:'Space Mono', monospace; font-weight:700;
  font-size:.72rem; cursor:pointer; position:relative;
}
.ab-btn-primary{ background:var(--accent); color:var(--bg); border-color:var(--accent); }
.ab-btn-danger{ color:#d16354; border-color:#d1635455; }
.ab-badge{ background:var(--accent-2); color:var(--bg); font-size:.62rem; border-radius:3px; padding:1px 6px; margin-left:2px; }

/* ---- main ---- */
.ab-main{ flex:1; min-width:0; padding:24px clamp(16px,3vw,40px) 60px; }

/* ---- filmstrip block ---- */
.ab-filmblock{ margin-bottom:34px; }
.ab-bigframe{
  position:relative; height:min(46vh, 420px); border-radius:2px; overflow:hidden;
  background:#000; border:1px solid var(--border);
}
.ab-bigframe img{ width:100%; height:100%; object-fit:cover; cursor:zoom-in; }
.ab-corner{ position:absolute; width:16px; height:16px; border:2px solid rgba(255,255,255,.55); pointer-events:none; }
.ab-corner-tl{ top:10px; left:10px; border-right:none; border-bottom:none; }
.ab-corner-tr{ top:10px; right:10px; border-left:none; border-bottom:none; }
.ab-corner-bl{ bottom:10px; left:10px; border-right:none; border-top:none; }
.ab-corner-br{ bottom:10px; right:10px; border-left:none; border-top:none; }

.ab-frame-meta{
  position:absolute; left:0; right:0; bottom:0; z-index:2;
  display:flex; justify-content:space-between; align-items:baseline; gap:14px;
  padding:12px 18px; background:linear-gradient(to top, rgba(0,0,0,.72), transparent);
  color:#fff;
}
.ab-frame-meta > span:first-child{ font-family:'Space Mono', monospace; font-size:.72rem; color:#e8dcc4; }
.ab-frame-title{ font-size:1.15rem; }

.ab-frame-controls{ position:absolute; top:12px; right:12px; z-index:3; display:flex; gap:7px; }

.ab-sprockets{ background:#0b0908; }
.ab-sprockets::before, .ab-sprockets::after{
  content:""; display:block; height:9px;
  background-image:radial-gradient(circle, var(--bg) 2.4px, transparent 3px);
  background-size:18px 9px; background-repeat:repeat-x;
}
.ab-strip{ display:flex; gap:6px; padding:8px; overflow-x:auto; }
.ab-thumb{
  flex-shrink:0; width:74px; height:52px; border:2px solid transparent; padding:0; cursor:pointer;
  opacity:.55; border-radius:2px; overflow:hidden;
}
.ab-thumb img{ width:100%; height:100%; object-fit:cover; display:block; }
.ab-thumb.is-active{ opacity:1; border-color:var(--accent); }

/* ---- contact sheet masonry ---- */
.ab-sheet{ position:relative; min-height:200px; }
.ab-sheet.is-drag{ outline:2px dashed var(--accent); outline-offset:10px; }
.ab-drop-hint{
  position:absolute; inset:0; z-index:5; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px;
  background:color-mix(in srgb, var(--bg) 82%, transparent); color:var(--accent); font-weight:600; text-align:center; padding:20px;
}
.ab-masonry{ column-count:4; column-gap:20px; }
@media (max-width:1100px){ .ab-masonry{ column-count:3; } }
@media (max-width:760px){ .ab-masonry{ column-count:2; } }
@media (max-width:480px){ .ab-masonry{ column-count:1; } }

.ab-print{
  break-inside:avoid; margin:0 0 20px; background:var(--surface); border:1px solid var(--border);
  padding:8px 8px 12px; box-shadow:0 8px 18px rgba(0,0,0,.28); cursor:pointer;
  transform:rotate(var(--tilt)); transition:transform .25s ease, box-shadow .25s ease; position:relative;
}
.ab-print:hover{ transform:rotate(0deg) translateY(-2px); box-shadow:0 12px 24px rgba(0,0,0,.34); }
.ab-frame-no{
  position:absolute; top:14px; left:14px; z-index:2; font-family:'Space Mono', monospace; font-size:.62rem;
  background:rgba(0,0,0,.55); color:#f1e7d8; padding:2px 6px; border-radius:2px;
}
.ab-print-media{ position:relative; width:100%; overflow:hidden; background:var(--surface-2); }
.ab-print-media img{ width:100%; display:block; transition:opacity .4s ease; }
.ab-skeleton{
  position:absolute; inset:0;
  background:linear-gradient(100deg, var(--surface) 30%, var(--surface-2) 50%, var(--surface) 70%);
  background-size:200% 100%; animation:ab-shimmer 1.3s infinite;
}
@keyframes ab-shimmer{ 0%{background-position:200% 0;} 100%{background-position:-200% 0;} }

.ab-print-chips{
  position:absolute; top:8px; right:8px; display:flex; gap:5px; opacity:0; transition:opacity .2s ease;
}
.ab-print:hover .ab-print-chips{ opacity:1; }
.ab-static-chips{ opacity:1; position:static; }

.ab-print figcaption{ display:flex; flex-direction:column; padding:10px 4px 0; }
.ab-print-name{ font-family:'Newsreader', serif; font-size:1rem; color:var(--text); }
.ab-print-cat{ font-family:'Space Mono', monospace; font-size:.66rem; color:var(--muted); margin-top:2px; }

.ab-chip{
  width:28px; height:28px; border-radius:50%; border:1px solid var(--border); background:rgba(0,0,0,.5);
  color:#fff; display:inline-flex; align-items:center; justify-content:center; cursor:pointer;
}
.ab-print .ab-chip, .ab-trash-actions .ab-chip{ background:var(--surface); color:var(--text); }
.ab-chip.is-active{ color:var(--accent); border-color:var(--accent); }
.ab-chip-lg{ width:34px; height:34px; }

.ab-empty{
  display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px;
  color:var(--muted); padding:60px 20px; text-align:center; font-family:'Space Mono', monospace; font-size:.8rem;
}

/* ---- modals ---- */
.ab-modal-backdrop{
  position:fixed; inset:0; background:rgba(0,0,0,.6); backdrop-filter:blur(2px);
  display:flex; align-items:center; justify-content:center; z-index:50; padding:20px;
}
.ab-modal{
  background:var(--surface); color:var(--text); border:1px solid var(--border);
  width:min(460px, 100%); max-height:82vh; overflow-y:auto; padding:22px;
}
.ab-modal-head{ display:flex; align-items:center; justify-content:space-between; margin-bottom:6px; }
.ab-modal-sub{ color:var(--muted); font-size:.82rem; margin-top:0; font-family:'Space Mono', monospace; }

.ab-field{ display:flex; flex-direction:column; gap:6px; font-family:'Space Mono', monospace; font-size:.72rem; color:var(--muted); margin:16px 0; }
.ab-field select{
  background:var(--bg); color:var(--text); border:1px solid var(--border); border-radius:2px; padding:8px 10px; font-family:'Newsreader', serif; font-size:.95rem;
}

.ab-upload-drop{
  border:1px dashed var(--border); border-radius:2px; padding:26px 16px; text-align:center;
  display:flex; flex-direction:column; align-items:center; gap:10px; color:var(--muted); font-family:'Space Mono', monospace; font-size:.78rem;
}
.ab-upload-drop.is-drag{ border-color:var(--accent); color:var(--accent); }
.ab-upload-buttons{ display:flex; gap:10px; flex-wrap:wrap; justify-content:center; margin-top:6px; }

.ab-trash-list{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:10px; }
.ab-trash-item{ display:flex; align-items:center; gap:12px; background:var(--surface-2); padding:8px; }
.ab-trash-item img{ width:54px; height:54px; object-fit:cover; flex-shrink:0; }
.ab-trash-info{ display:flex; flex-direction:column; flex:1; min-width:0; }
.ab-trash-actions{ display:flex; gap:8px; flex-shrink:0; }

/* ---- fullscreen preview ---- */
.ab-preview-backdrop{
  position:fixed; inset:0; background:rgba(4,3,2,.97); z-index:60;
  display:flex; align-items:center; justify-content:center; gap:6px; padding:0;
}
.ab-preview{ margin:0; width:100%; height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:14px; padding:56px 64px 28px; }
.ab-preview img{ max-width:100%; max-height:calc(100vh - 130px); object-fit:contain; border:1px solid #3a332a; }
.ab-preview figcaption{ display:flex; align-items:center; justify-content:space-between; color:#fff; gap:16px; }
.ab-preview figcaption .ab-print-name{ color:#fff; }
.ab-preview figcaption .ab-print-cat{ color:#c9bfa9; }
.ab-preview-close{ position:absolute; top:20px; right:20px; }
.ab-preview-fs{ position:absolute; top:20px; right:66px; }
.ab-preview-backdrop:fullscreen{ background:#040302; }
.ab-preview-backdrop:fullscreen .ab-preview img{ max-height:calc(100vh - 90px); }

@media (max-width: 860px){
  .ab-shell{ flex-direction:column; }
  .ab-rail{ position:relative; width:100%; height:auto; flex-direction:row; flex-wrap:wrap; align-items:center; }
  .ab-catlist{ flex-direction:row; overflow-x:auto; flex:1; }
  .ab-rail-foot{ margin-top:0; flex-direction:row; }
  .ab-bigframe{ height:38vh; }
  .ab-preview-nav{ display:none; }
}
`;