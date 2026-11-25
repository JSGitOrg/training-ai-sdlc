(function (root, factory) {
  const app = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = app;
  }
  if (typeof document !== "undefined") {
    app.initialize(document, root.fetch.bind(root), root.localStorage);
  }
})(globalThis, function () {
  const registrationStorageKey = (workshopId) => `workshop-registration:${workshopId}`;

  async function submitRegistration(workshopId, email, fetchImpl) {
    const response = await fetchImpl(`/workshops/${encodeURIComponent(workshopId)}/registrations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    const body = await response.json();
    return {
      ok: response.ok,
      message: response.ok ? "Registration successful" : body.error,
      registrationId: body.registrationId
    };
  }

  async function submitCancellation(workshopId, registrationId, fetchImpl) {
    const response = await fetchImpl(
      `/workshops/${encodeURIComponent(workshopId)}/registrations/${encodeURIComponent(registrationId)}`,
      { method: "DELETE" }
    );
    const body = await response.json();
    return {
      ok: response.ok,
      message: response.ok ? "Registration cancelled" : body.error
    };
  }

  function displayResult(element, result) {
    element.textContent = result.message;
    element.dataset.state = result.ok ? "success" : "error";
  }

  function createWorkshopCard(documentRef, workshop, fetchImpl, storage, refresh) {
    const card = documentRef.createElement("article");
    card.className = "workshop-card";

    const title = documentRef.createElement("h2");
    title.textContent = workshop.title;
    card.appendChild(title);

    const details = documentRef.createElement("dl");
    for (const [label, value] of [
      ["Date", workshop.date],
      ["Instructor", workshop.instructor],
      ["Capacity", workshop.capacity]
    ]) {
      const term = documentRef.createElement("dt");
      term.textContent = label;
      const description = documentRef.createElement("dd");
      description.textContent = String(value);
      details.append(term, description);
    }
    card.appendChild(details);

    const seats = documentRef.createElement("p");
    seats.className = "remaining-seats";
    seats.textContent = `${workshop.remainingSeats} ${
      workshop.remainingSeats === 1 ? "seat" : "seats"
    } remaining`;
    card.appendChild(seats);

    const status = documentRef.createElement("p");
    status.className = "status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    card.appendChild(status);

    const form = documentRef.createElement("form");
    form.className = "registration-form";
    const email = documentRef.createElement("input");
    email.type = "email";
    email.name = "email";
    email.autocomplete = "email";
    email.required = true;
    email.placeholder = "you@college.edu";
    email.setAttribute("aria-label", `Email for ${workshop.title}`);
    const registerButton = documentRef.createElement("button");
    registerButton.type = "submit";
    registerButton.textContent = "Register";
    form.append(email, registerButton);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        const result = await submitRegistration(workshop.id, email.value, fetchImpl);
        displayResult(status, result);
        if (result.ok) {
          storage.setItem(registrationStorageKey(workshop.id), result.registrationId);
          await refresh(result.message);
        }
      } catch (error) {
        displayResult(status, { ok: false, message: error.message });
      }
    });
    card.appendChild(form);

    const registrationId = storage.getItem(registrationStorageKey(workshop.id));
    if (registrationId) {
      const cancelButton = documentRef.createElement("button");
      cancelButton.type = "button";
      cancelButton.className = "cancel-registration";
      cancelButton.textContent = "Cancel my registration";
      cancelButton.addEventListener("click", async () => {
        try {
          const result = await submitCancellation(workshop.id, registrationId, fetchImpl);
          displayResult(status, result);
          if (result.ok) {
            storage.removeItem(registrationStorageKey(workshop.id));
            await refresh(result.message);
          }
        } catch (error) {
          displayResult(status, { ok: false, message: error.message });
        }
      });
      card.appendChild(cancelButton);
    }

    return card;
  }

  async function loadWorkshops(fetchImpl) {
    const response = await fetchImpl("/workshops");
    const body = await response.json();
    if (!response.ok) {
      throw new Error(body.error);
    }
    return body;
  }

  function initialize(documentRef, fetchImpl, storage) {
    const container = documentRef.getElementById("workshops");
    const loadStatus = documentRef.getElementById("load-status");

    async function refresh(message = "") {
      try {
        const workshops = await loadWorkshops(fetchImpl);
        container.replaceChildren(
          ...workshops.map((workshop) =>
            createWorkshopCard(documentRef, workshop, fetchImpl, storage, refresh)
          )
        );
        loadStatus.textContent = message;
      } catch (error) {
        loadStatus.textContent = error.message;
      }
    }

    refresh();
  }

  return {
    displayResult,
    initialize,
    submitCancellation,
    submitRegistration
  };
});
