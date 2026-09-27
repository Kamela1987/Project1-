const MAX_BATCH_FILES = 50;

const dropZone = document.getElementById("drop-zone");
const fileInput = document.getElementById("file-input");
const restoreFacesInput = document.getElementById("restore-faces");
const statusEl = document.getElementById("status");
const queueEl = document.getElementById("queue");
const batchActionsEl = document.getElementById("batch-actions");
const downloadAllBtn = document.getElementById("download-all-btn");

let queue = []; // { id, file, status, resultBlob, errorMsg }
let processing = false;

dropZone.addEventListener("click", () => fileInput.click());

dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("dragover");
});

dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));

dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("dragover");
  handleFiles(e.dataTransfer.files);
});

fileInput.addEventListener("change", () => {
  handleFiles(fileInput.files);
  fileInput.value = "";
});

downloadAllBtn.addEventListener("click", downloadAllAsZip);

function setStatus(message, isError = false) {
  statusEl.hidden = !message;
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}

function handleFiles(fileList) {
  const allFiles = Array.from(fileList);
  const imageFiles = allFiles.filter((f) => /^image\/(png|jpeg|webp)$/.test(f.type));
  const skippedNonImage = allFiles.length - imageFiles.length;

  const accepted = imageFiles.slice(0, MAX_BATCH_FILES);
  const skippedOverLimit = imageFiles.length - accepted.length;

  if (accepted.length === 0) {
    setStatus("No supported images (JPEG/PNG/WebP) found in that selection.", true);
    return;
  }

  const notes = [];
  if (skippedNonImage > 0) notes.push(`${skippedNonImage} non-image file(s) skipped`);
  if (skippedOverLimit > 0) notes.push(`${skippedOverLimit} file(s) skipped (limit is ${MAX_BATCH_FILES} per batch)`);
  setStatus(notes.length ? notes.join("; ") : "");

  queue = accepted.map((file, i) => ({
    id: `${Date.now()}-${i}`,
    file,
    status: "pending",
    resultBlob: null,
    errorMsg: null,
  }));

  batchActionsEl.hidden = true;
  renderQueue();
  processQueue();
}

function renderQueue() {
  queueEl.innerHTML = "";
  for (const item of queue) {
    const card = document.createElement("div");
    card.className = "queue-item";
    card.dataset.id = item.id;

    const thumb = document.createElement("img");
    thumb.className = "queue-thumb";
    thumb.src = URL.createObjectURL(item.file);
    thumb.alt = item.file.name;
    card.appendChild(thumb);

    const info = document.createElement("div");
    info.className = "queue-info";

    const name = document.createElement("div");
    name.className = "queue-name";
    name.textContent = item.file.name;
    info.appendChild(name);

    const state = document.createElement("div");
    state.className = `queue-state queue-state-${item.status}`;
    state.textContent = statusLabel(item);
    info.appendChild(state);

    if (item.status === "done" && item.resultBlob) {
      const link = document.createElement("a");
      link.className = "queue-download";
      link.href = URL.createObjectURL(item.resultBlob);
      link.download = enhancedFileName(item.file.name);
      link.textContent = "Download";
      info.appendChild(link);
    }

    card.appendChild(info);
    queueEl.appendChild(card);
  }
}

function statusLabel(item) {
  switch (item.status) {
    case "pending": return "Waiting…";
    case "processing": return "Enhancing…";
    case "done": return "Done";
    case "error": return `Failed: ${item.errorMsg || "unknown error"}`;
    default: return "";
  }
}

function updateItem(id, patch) {
  const item = queue.find((q) => q.id === id);
  if (!item) return;
  Object.assign(item, patch);
  const card = queueEl.querySelector(`[data-id="${id}"]`);
  if (!card) return renderQueue();
  const state = card.querySelector(".queue-state");
  state.className = `queue-state queue-state-${item.status}`;
  state.textContent = statusLabel(item);
  if (item.status === "done" && item.resultBlob && !card.querySelector(".queue-download")) {
    const link = document.createElement("a");
    link.className = "queue-download";
    link.href = URL.createObjectURL(item.resultBlob);
    link.download = enhancedFileName(item.file.name);
    link.textContent = "Download";
    card.querySelector(".queue-info").appendChild(link);
  }
}

async function processQueue() {
  if (processing) return;
  processing = true;

  const total = queue.length;
  for (let i = 0; i < queue.length; i++) {
    const item = queue[i];
    setStatus(`Enhancing ${i + 1} of ${total}: ${item.file.name}…`);
    updateItem(item.id, { status: "processing" });

    try {
      const blob = await enhanceOne(item.file);
      updateItem(item.id, { status: "done", resultBlob: blob });
    } catch (err) {
      updateItem(item.id, { status: "error", errorMsg: err.message || "request failed" });
    }
  }

  const doneCount = queue.filter((q) => q.status === "done").length;
  const errorCount = queue.filter((q) => q.status === "error").length;
  setStatus(
    errorCount > 0
      ? `Finished: ${doneCount} succeeded, ${errorCount} failed.`
      : `Finished: ${doneCount} of ${total} enhanced.`,
    errorCount > 0 && doneCount === 0
  );

  batchActionsEl.hidden = doneCount === 0;
  processing = false;
}

async function enhanceOne(file) {
  const formData = new FormData();
  formData.append("file", file);
  const params = new URLSearchParams({ restore_faces: restoreFacesInput.checked });

  const res = await fetch(`/api/enhance?${params}`, { method: "POST", body: formData });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.detail || `Request failed (${res.status})`);
  }
  return res.blob();
}

function enhancedFileName(originalName) {
  const dot = originalName.lastIndexOf(".");
  const stem = dot > 0 ? originalName.slice(0, dot) : originalName;
  return `${stem}_enhanced.jpg`;
}

async function downloadAllAsZip() {
  const doneItems = queue.filter((q) => q.status === "done" && q.resultBlob);
  if (doneItems.length === 0) return;

  downloadAllBtn.disabled = true;
  downloadAllBtn.textContent = "Zipping…";

  try {
    const zip = new JSZip();
    for (const item of doneItems) {
      zip.file(enhancedFileName(item.file.name), item.resultBlob);
    }
    const zipBlob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "enhanced-photos.zip";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    downloadAllBtn.disabled = false;
    downloadAllBtn.textContent = "Download all as ZIP";
  }
}
