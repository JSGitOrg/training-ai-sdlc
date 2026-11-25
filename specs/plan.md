# Workshop Registration Implementation Plan

Based on [workshop-registration.md](./workshop-registration.md). This document is a plan only; it does not implement the application.

## 1. Application components

- **Workshop listing UI** to show available workshops and remaining seats.
- **Registration UI** to collect a participant's email and submit a registration.
- **Cancellation UI/action** for a registered participant to cancel.
- **API/service layer** to enforce registration, capacity, duplicate, and cancellation rules.
- **Persistence layer** for workshops and registrations, with capacity checks and registration writes made safe under concurrent requests.

## 2. Data model

- **Workshop:** `id`, `title`, `date`, `instructor`, `capacity`.
- **Registration:** `id`, `workshopId`, `email`, `registeredAt`.
- Derive the registered count from registrations and remaining seats as `capacity - registered count`.
- Enforce uniqueness for `(workshopId, normalized email)` and prevent the registered count from exceeding capacity.

## 3. Business rules

- List workshops considered available; the specification does not define "available."
- A registration succeeds only if the workshop has a seat and the email is not already registered.
- Registration requires an email address whose domain ends in `.edu` (FR-07).
- Reject a registration when the workshop is full; the UI must display **"Workshop is full"**.
- A participant may cancel a registration; the registered count and remaining seats must update.
- Successful registration for a capacity-20 workshop with 15 existing registrations leaves 4 seats.
- Capacity enforcement must remain correct when simultaneous registrations compete for the last seat.

## 4. Proposed API endpoints

- `GET /workshops` — list workshops and remaining-seat counts.
- `GET /workshops/{workshopId}` — retrieve workshop details and availability.
- `POST /workshops/{workshopId}/registrations` — register using participant email.
- `DELETE /workshops/{workshopId}/registrations/{registrationId}` — cancel a registration.

Exact response shapes and error/status-code conventions should be confirmed before implementation.

## 5. UI components

- Workshop list with title, date, instructor, and remaining seats.
- Registration form with email input and submit action.
- Clear success, validation, duplicate-registration, and full-workshop messages.
- Cancellation action for an existing registration, with confirmation if desired.

## 6. Validation rules

- Require a valid workshop identifier and an existing workshop.
- Require a syntactically valid email with a domain ending in `.edu`; trim and case-normalize it before duplicate checks.
- Require capacity to be a non-negative integer; confirm whether zero-capacity workshops are valid.
- Reject duplicate registrations and registrations at capacity.
- For cancellation, verify the registration belongs to the specified workshop and define how unauthorized cancellation is prevented.

## 7. Tests mapped to acceptance criteria and functional requirements

- **Successful registration:** Given capacity 20 and 15 registrations, submit a new email; assert success and remaining seats of 4.
- **Workshop full:** Given capacity 20 and 20 registrations, submit another email; assert rejection and the UI displays exactly **"Workshop is full"**.
- **Duplicate registration:** Register `john@college.edu`, then submit it again for the same workshop; assert the second attempt is rejected.
- **FR-07 / non-.edu email:** Submit `john@gmail.com`; assert registration is rejected and no seat is consumed. Retain a positive `.edu` registration test.
- **FR-01 / FR-06:** Verify the workshop listing includes available workshops and accurate remaining-seat counts, including after a registration and cancellation.
- **FR-05:** Cancel a registration; assert it is removed and the remaining-seat count increases.
- **Capacity edge/concurrency:** Attempt concurrent registrations for the final seat; assert no more than one succeeds and capacity is never exceeded.
- **Validation/error handling:** Cover malformed email, unknown workshop, and invalid or unauthorized cancellation once those behaviors are defined.

## Ambiguities to resolve before implementation

1. What qualifies as an **available workshop**—future date, at least one seat, or both? Should full workshops still appear?
2. Which participant details are required beyond email (for example, name), and is authentication required?
3. Should email comparisons be case-insensitive, and should whitespace be trimmed?
4. How should cancellations be authorized, and is there a cancellation deadline?
5. What are the required API response shapes, status codes, and duplicate-registration message?
6. Should workshops be managed through this application, or are they supplied by another system?
7. What timezone/date format applies to workshop dates, and are past workshops retained in listings?
8. Should zero-capacity workshops be allowed?
