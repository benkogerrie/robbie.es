document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("#problemForm");
  const navLinks = document.getElementById("navLinks");

  if (form) {
    const status = document.getElementById("formStatus");
    const submitBtn = document.getElementById("formSubmit");

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const data = new FormData(form);
      if (!data.get("link")) data.set("link", "");

      status.textContent = "Sending…";
      status.className = "form-note form-status";
      if (submitBtn) submitBtn.disabled = true;

      try {
        const response = await fetch("https://api.web3forms.com/submit", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(Object.fromEntries(data)),
        });
        const result = await response.json();

        if (response.ok && result.success) {
          status.textContent = "Thanks — your message is on its way. I’ll get back to you by email.";
          status.className = "form-note form-status is-success";
          form.reset();
        } else {
          status.textContent = result.message || "Something went wrong. Please email info@robbie.es.";
          status.className = "form-note form-status is-error";
        }
      } catch (error) {
        status.textContent = "Something went wrong. Please email info@robbie.es.";
        status.className = "form-note form-status is-error";
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  if (navLinks) {
    navLinks.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => navLinks.classList.remove("open"));
    });
  }
});

function toggleMenu() {
  document.getElementById("navLinks").classList.toggle("open");
}
