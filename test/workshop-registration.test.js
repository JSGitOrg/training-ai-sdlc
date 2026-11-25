const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { after, test } = require("node:test");
const { createServer, initializeDataFile } = require("../server");
const { displayResult, submitRegistration } = require("../public/app");

const activeApps = new Set();

after(async () => {
  await Promise.all([...activeApps].map((app) => app.stop()));
});

function makeWorkshop(registeredCount, capacity = 20) {
  return {
    id: "teaching-workshop",
    title: "Teaching Workshop",
    date: "2027-03-15",
    instructor: "Dr. Taylor Morgan",
    capacity,
    registrations: Array.from({ length: registeredCount }, (_, index) => ({
      id: `existing-${index}`,
      email: `faculty${index}@college.edu`,
      registeredAt: "2026-01-01T00:00:00.000Z"
    }))
  };
}

async function startApp(t, workshops) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "workshop-registration-"));
  const dataFile = path.join(directory, "workshops.json");
  fs.writeFileSync(dataFile, JSON.stringify(workshops));

  const server = createServer({ dataFile });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const app = {
    dataFile,
    origin: `http://127.0.0.1:${address.port}`,
    async stop() {
      if (server.listening) {
        await new Promise((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        });
      }
      fs.rmSync(directory, { recursive: true, force: true });
      activeApps.delete(app);
    }
  };
  activeApps.add(app);
  t.after(() => app.stop());
  return app;
}

test("successful registration leaves four seats when capacity is 20 and 15 are registered", async (t) => {
  const app = await startApp(t, [makeWorkshop(15)]);
  const result = await submitRegistration(
    "teaching-workshop",
    "new.faculty@college.edu",
    (url, options) => fetch(new URL(url, app.origin), options)
  );

  assert.equal(result.ok, true);
  assert.ok(result.registrationId);
  const workshops = await fetch(new URL("/workshops", app.origin)).then((response) =>
    response.json()
  );
  assert.equal(workshops[0].remainingSeats, 4);
});

test('full workshop registration is rejected and the UI displays "Workshop is full"', async (t) => {
  const app = await startApp(t, [makeWorkshop(20)]);
  const result = await submitRegistration(
    "teaching-workshop",
    "new.faculty@college.edu",
    (url, options) => fetch(new URL(url, app.origin), options)
  );
  const status = { textContent: "", dataset: {} };
  displayResult(status, result);

  assert.equal(result.ok, false);
  assert.equal(status.textContent, "Workshop is full");
  const workshops = await fetch(new URL("/workshops", app.origin)).then((response) =>
    response.json()
  );
  assert.equal(workshops[0].remainingSeats, 0);
});

test("the same email cannot register twice for one workshop", async (t) => {
  const workshop = makeWorkshop(1);
  workshop.registrations[0].email = "john@college.edu";
  const app = await startApp(t, [workshop]);

  const response = await fetch(
    new URL("/workshops/teaching-workshop/registrations", app.origin),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "john@college.edu" })
    }
  );

  assert.equal(response.status, 409);
  assert.match((await response.json()).error, /already registered/i);
});

test("workshop listing displays workshop details and remaining seats", async (t) => {
  const app = await startApp(t, [makeWorkshop(15)]);
  const response = await fetch(new URL("/workshops", app.origin));
  const workshops = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(
    {
      id: workshops[0].id,
      title: workshops[0].title,
      date: workshops[0].date,
      instructor: workshops[0].instructor,
      capacity: workshops[0].capacity,
      registeredCount: workshops[0].registeredCount,
      remainingSeats: workshops[0].remainingSeats
    },
    {
      id: "teaching-workshop",
      title: "Teaching Workshop",
      date: "2027-03-15",
      instructor: "Dr. Taylor Morgan",
      capacity: 20,
      registeredCount: 15,
      remainingSeats: 5
    }
  );
});

test("cancelling a registration restores one seat", async (t) => {
  const workshop = makeWorkshop(1);
  const app = await startApp(t, [workshop]);
  const registrationId = workshop.registrations[0].id;

  const response = await fetch(
    new URL(`/workshops/teaching-workshop/registrations/${registrationId}`, app.origin),
    { method: "DELETE" }
  );
  const result = await response.json();
  const workshops = await fetch(new URL("/workshops", app.origin)).then((item) =>
    item.json()
  );

  assert.equal(response.status, 200);
  assert.equal(result.remainingSeats, 20);
  assert.equal(workshops[0].registeredCount, 0);
});

test("concurrent registrations cannot exceed capacity", async (t) => {
  const app = await startApp(t, [makeWorkshop(19)]);
  const registrationUrl = new URL(
    "/workshops/teaching-workshop/registrations",
    app.origin
  );
  const register = (email) =>
    fetch(registrationUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });

  const responses = await Promise.all([
    register("one@college.edu"),
    register("two@college.edu")
  ]);
  const workshops = await fetch(new URL("/workshops", app.origin)).then((response) =>
    response.json()
  );

  assert.equal(responses.filter((response) => response.status === 201).length, 1);
  assert.equal(responses.filter((response) => response.status === 409).length, 1);
  assert.equal(workshops[0].registeredCount, 20);
});

test("invalid email addresses are rejected", async (t) => {
  const app = await startApp(t, [makeWorkshop(0)]);
  const response = await fetch(
    new URL("/workshops/teaching-workshop/registrations", app.origin),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "not-an-email" })
    }
  );

  assert.equal(response.status, 400);
});

test("non-.edu email addresses are rejected without consuming a seat", async (t) => {
  const app = await startApp(t, [makeWorkshop(0)]);
  const response = await fetch(
    new URL("/workshops/teaching-workshop/registrations", app.origin),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "john@gmail.com" })
    }
  );
  const error = await response.json();
  const workshops = await fetch(new URL("/workshops", app.origin)).then((item) =>
    item.json()
  );

  assert.equal(response.status, 400);
  assert.match(error.error, /\.edu/i);
  assert.equal(workshops[0].registeredCount, 0);
  assert.equal(workshops[0].remainingSeats, 20);
});

test("deployment data initialization seeds once and preserves existing registrations", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "workshop-seed-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const seedFile = path.join(__dirname, "..", "data", "workshops.seed.json");
  const dataFile = path.join(directory, "persistent", "workshops.json");

  initializeDataFile(dataFile, seedFile);
  const seededWorkshops = JSON.parse(fs.readFileSync(dataFile, "utf8"));
  assert.equal(seededWorkshops.length, 4);
  assert.ok(seededWorkshops.every((workshop) => workshop.registrations.length === 0));

  seededWorkshops[0].registrations.push({
    id: "persistent-registration",
    email: "faculty@college.edu",
    registeredAt: "2026-01-01T00:00:00.000Z"
  });
  fs.writeFileSync(dataFile, JSON.stringify(seededWorkshops));
  initializeDataFile(dataFile, seedFile);

  const persistedWorkshops = JSON.parse(fs.readFileSync(dataFile, "utf8"));
  assert.equal(persistedWorkshops[0].registrations.length, 1);
  assert.equal(persistedWorkshops[0].registrations[0].id, "persistent-registration");
});
