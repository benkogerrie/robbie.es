const projectData = {
      kvk: {
        title: "KvK Signal",
        text: "A focused monitoring tool that follows selected Dutch companies and sends a Telegram message when a relevant filing or company event appears. It started with one simple frustration: the information exists, but the useful alert does not.",
        status: "Early prototype / pilot"
      },
      chatbot: {
        title: "AI Product Advice Chatbot",
        text: "A conversational product adviser that combines store data with a natural dialogue. Instead of immediately showing product cards, it first understands the customer's situation and only then recommends suitable options.",
        status: "Working prototype"
      },
      dashboard: {
        title: "Commercial Opportunities Dashboard",
        text: "A signal-first commercial dashboard that collects company news, scores relevance and suggests timely outreach. The aim is not more data, but a clearer reason to act.",
        status: "Product concept and implementation"
      },
      scanner: {
        title: "Website Opportunity Scanner",
        text: "An automated workflow that reviews business websites, identifies commercial and design weaknesses and generates a modern first concept. Built to turn a large list of companies into a focused pipeline of real opportunities.",
        status: "Working workflow"
      }
    };

    function openProject(key) {
      const p = projectData[key];
      document.getElementById("modalContent").innerHTML =
        `<div class="section-kicker">${p.status}</div><h3>${p.title}</h3><p>${p.text}</p><p><strong>Interested in this project or a similar problem?</strong></p><a class="btn btn-primary" href="mailto:info@robbie.es?subject=${encodeURIComponent(p.title)}">Send me a message →</a>`;
      document.getElementById("projectModal").classList.add("open");
      document.body.style.overflow = "hidden";
    }
    function closeProject() {
      document.getElementById("projectModal").classList.remove("open");
      document.body.style.overflow = "";
    }
    document.addEventListener("keydown", e => { if (e.key === "Escape") closeProject(); });
