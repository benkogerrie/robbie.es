document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("#problemForm");
  const navLinks = document.getElementById("navLinks");

  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const subject = encodeURIComponent(
        "A problem worth solving — " + (data.get("name") || "website enquiry")
      );
      const body = encodeURIComponent(
        "Name: " + (data.get("name") || "") + "\n" +
        "Email: " + (data.get("email") || "") + "\n\n" +
        "The problem:\n" + (data.get("problem") || "") + "\n\n" +
        "Why it matters:\n" + (data.get("impact") || "") + "\n\n" +
        "Link / context:\n" + (data.get("link") || "")
      );
      window.location.href = `mailto:info@robbie.es?subject=${subject}&body=${body}`;
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
