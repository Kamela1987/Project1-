const dropZone = document.getElementById("drop-zone");
const fileInput = document.getElementById("file-input");
const restoreFacesInput = document.getElementById("restore-faces");
const statusEl = document.getElementById("status");
const resultEl = document.getElementById("result");
const originalImg = document.getElementById("original-img");
const enhancedImg = document.getElementById("enhanced-img");
const downloadLink = document.getElementById("download-link");

dropZone.addEventListener("click", () => fileInput.click());

dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("dragover");
});

dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));

dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("dragover");
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (file) handleFile(file);
});

function setStatus(message, isError = false) {
  statusEl.hidden = !message;
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}

async function handleFile(file) {
  resultEl.hidden = true;
  setStatus("Uploading and enhancing — this can take up to a minute on first run while models download…");

  originalImg.src = URL.createObjectURL(file);

  const formData = new FormData();
  formData.append("file", file);

  const params = new URLSearchParams({ restore_faces: restoreFacesInput.checked });

  try {
    const res = await fetch(`/api/enhance?${params}`, { method: "POST", body: formData });
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}));
      throw new Error(detail.detail || `Request failed (${res.status})`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    enhancedImg.src = url;
    downloadLink.href = url;
    resultEl.hidden = false;
    setStatus("");
  } catch (err) {
    setStatus(err.message || "Something went wrong.", true);
  }
}
