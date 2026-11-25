const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

class AppError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

function readWorkshops(dataFile) {
  const workshops = JSON.parse(fs.readFileSync(dataFile, "utf8"));
  if (!Array.isArray(workshops)) {
    throw new Error("Workshop data must be a JSON array");
  }
  return workshops;
}

function writeWorkshops(dataFile, workshops) {
  fs.mkdirSync(path.dirname(dataFile), { recursive: true });
  const temporaryFile = `${dataFile}.${process.pid}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(temporaryFile, JSON.stringify(workshops, null, 2));
  fs.renameSync(temporaryFile, dataFile);
}

function findWorkshop(workshops, workshopId) {
  const workshop = workshops.find((item) => item.id === workshopId);
  if (!workshop) {
    throw new AppError(404, "Workshop not found");
  }
  return workshop;
}

function toWorkshopSummary(workshop) {
  const registeredCount = workshop.registrations.length;
  return {
    id: workshop.id,
    title: workshop.title,
    date: workshop.date,
    instructor: workshop.instructor,
    capacity: workshop.capacity,
    registeredCount,
    remainingSeats: workshop.capacity - registeredCount
  };
}

function normalizeEmail(email) {
  if (typeof email !== "string") {
    throw new AppError(400, "A valid email address is required");
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new AppError(400, "A valid email address is required");
  }
  const domain = normalizedEmail.slice(normalizedEmail.lastIndexOf("@") + 1);
  if (!domain.endsWith(".edu")) {
    throw new AppError(400, "An email address ending in .edu is required");
  }
  return normalizedEmail;
}

function createWorkshopService(dataFile) {
  return {
    listWorkshops() {
      return readWorkshops(dataFile).map(toWorkshopSummary);
    },

    getWorkshop(workshopId) {
      return toWorkshopSummary(findWorkshop(readWorkshops(dataFile), workshopId));
    },

    register(workshopId, email) {
      const normalizedEmail = normalizeEmail(email);
      const workshops = readWorkshops(dataFile);
      const workshop = findWorkshop(workshops, workshopId);

      if (workshop.registrations.some((registration) => registration.email === normalizedEmail)) {
        throw new AppError(409, "Already registered for this workshop");
      }
      if (workshop.registrations.length >= workshop.capacity) {
        throw new AppError(409, "Workshop is full");
      }

      const registration = {
        id: crypto.randomUUID(),
        email: normalizedEmail,
        registeredAt: new Date().toISOString()
      };
      workshop.registrations.push(registration);
      writeWorkshops(dataFile, workshops);

      return {
        registrationId: registration.id,
        remainingSeats: workshop.capacity - workshop.registrations.length
      };
    },

    cancelRegistration(workshopId, registrationId) {
      const workshops = readWorkshops(dataFile);
      const workshop = findWorkshop(workshops, workshopId);
      const registrationIndex = workshop.registrations.findIndex(
        (registration) => registration.id === registrationId
      );
      if (registrationIndex === -1) {
        throw new AppError(404, "Registration not found");
      }

      workshop.registrations.splice(registrationIndex, 1);
      writeWorkshops(dataFile, workshops);
      return {
        remainingSeats: workshop.capacity - workshop.registrations.length
      };
    }
  };
}

module.exports = { AppError, createWorkshopService };
