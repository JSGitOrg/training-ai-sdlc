const fs = require("node:fs");
const path = require("node:path");
const { URL } = require("node:url");
const { createWorkshopService, AppError } = require("./src/workshop-service");

const publicDirectory = path.join(__dirname, "public");
const staticFiles = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/app.js", ["app.js", "text/javascript; charset=utf-8"]],
  ["/styles.css", ["styles.css", "text/css; charset=utf-8"]]
]);

function sendJson(response, statusCode, value) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(value));
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new AppError(400, "Invalid JSON body"));
      }
    });
    request.on("error", reject);
  });
}

function serveStatic(response, pathname) {
  const file = staticFiles.get(pathname);
  if (!file) {
    sendJson(response, 404, { error: "Not found" });
    return;
  }

  const [filename, contentType] = file;
  const contents = fs.readFileSync(path.join(publicDirectory, filename));
  response.writeHead(200, { "Content-Type": contentType });
  response.end(contents);
}

function initializeDataFile(dataFile, seedFile) {
  if (fs.existsSync(dataFile)) {
    return;
  }

  fs.mkdirSync(path.dirname(dataFile), { recursive: true });
  try {
    fs.copyFileSync(seedFile, dataFile, fs.constants.COPYFILE_EXCL);
  } catch (error) {
    if (error.code !== "EEXIST") {
      throw error;
    }
  }
}

function createServer(options = {}) {
  const dataFile = options.dataFile || path.join(__dirname, "data", "workshops.json");
  const service = createWorkshopService(dataFile);

  return require("node:http").createServer(async (request, response) => {
    const url = new URL(request.url, "http://localhost");
    const pathname = decodeURIComponent(url.pathname);

    try {
      if (request.method === "GET" && staticFiles.has(pathname)) {
        serveStatic(response, pathname);
        return;
      }

      if (request.method === "GET" && pathname === "/workshops") {
        sendJson(response, 200, service.listWorkshops());
        return;
      }

      const workshopMatch = pathname.match(/^\/workshops\/([^/]+)$/);
      if (request.method === "GET" && workshopMatch) {
        sendJson(response, 200, service.getWorkshop(workshopMatch[1]));
        return;
      }

      const registrationMatch = pathname.match(/^\/workshops\/([^/]+)\/registrations$/);
      if (request.method === "POST" && registrationMatch) {
        const body = await readJsonBody(request);
        sendJson(response, 201, service.register(registrationMatch[1], body.email));
        return;
      }

      const cancellationMatch = pathname.match(
        /^\/workshops\/([^/]+)\/registrations\/([^/]+)$/
      );
      if (request.method === "DELETE" && cancellationMatch) {
        sendJson(
          response,
          200,
          service.cancelRegistration(cancellationMatch[1], cancellationMatch[2])
        );
        return;
      }

      sendJson(response, 404, { error: "Not found" });
    } catch (error) {
      if (error instanceof AppError) {
        sendJson(response, error.statusCode, { error: error.message });
        return;
      }

      console.error(error);
      sendJson(response, 500, { error: "Internal server error" });
    }
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  const dataFile = process.env.DATA_FILE || path.join(__dirname, "data", "workshops.json");
  const seedFile = path.join(__dirname, "data", "workshops.seed.json");
  initializeDataFile(dataFile, seedFile);
  createServer({ dataFile }).listen(port, () => {
    console.log(`Workshop registration app listening on http://localhost:${port}`);
  });
}

module.exports = { createServer, initializeDataFile };
