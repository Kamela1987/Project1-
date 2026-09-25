document.getElementById("year").textContent = new Date().getFullYear();

const navToggle = document.getElementById("navToggle");
const nav = document.getElementById("nav");
navToggle.addEventListener("click", () => {
  const isOpen = nav.classList.toggle("open");
  navToggle.setAttribute("aria-expanded", String(isOpen));
});
nav.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    nav.classList.remove("open");
    navToggle.setAttribute("aria-expanded", "false");
  });
});

const form = document.getElementById("contactForm");
const status = document.getElementById("formStatus");
const submitBtn = document.getElementById("submitBtn");
const AJAX_ENDPOINT = "https://formsubmit.co/ajax/monzemove@gmail.com";

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  submitBtn.disabled = true;
  status.textContent = "Sending...";

  try {
    const res = await fetch(AJAX_ENDPOINT, {
      method: "POST",
      headers: { Accept: "application/json" },
      body: new FormData(form),
    });
    if (!res.ok) throw new Error("Request failed");
    status.textContent = "Thanks! Your message has been sent — we'll get back to you soon.";
    form.reset();
  } catch (err) {
    status.textContent = "Couldn't send automatically — submitting the regular way instead...";
    form.submit();
    return;
  } finally {
    submitBtn.disabled = false;
  }
});
