# Workshop Registration

## Goal

Allow faculty members to register for available
faculty-development workshops.

## Workshop

A workshop has:

- title
- date
- instructor
- capacity
- registered participants

## Functional Requirements

FR-01
Users can view available workshops.

FR-02
Users can register for a workshop.

FR-03
The system must not allow registrations beyond capacity.

FR-04
The same email address cannot register twice
for the same workshop.

FR-05
A registered participant can cancel registration.

FR-06
The application displays the number of remaining seats.

FR-07

Registration requires an institutional
.edu email address.

## Acceptance Criteria

Scenario: Successful registration

Given:
A workshop capacity is 20
and 15 participants have registered

When:
a new faculty member registers

Then:
the registration succeeds

And:
remaining seats becomes 4

Scenario: Workshop is full

Given:
capacity is 20
and 20 participants are already registered

When:
another participant attempts to register

Then:
registration must be rejected

And:
the application displays
"Workshop is full"

Scenario: Duplicate registration

Given:
john@college.edu is already registered

When:
john@college.edu attempts to register again

Then:
registration must be rejected.

scenario : only accept .edu domain in the email

Given:
a user enters john@gmail.com

When:
registration is submitted

Then:
registration must be rejected.