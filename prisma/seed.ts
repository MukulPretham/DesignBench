import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const problems = [
  {
    slug: "parking-lot",
    title: "Parking Lot",
    difficulty: "Medium",
    tags: ["OOP", "Design Patterns"],
    statementMd: `# Parking Lot

## Overview
Design a parking lot system that manages parking spots for different vehicle types and handles ticketing and payments.

## Functional Requirements
- Support multiple floors, each with spots for motorcycle, car, and bus/truck.
- Park a vehicle in the nearest suitable spot; issue a ticket with entry time.
- Unpark by ticket; compute fee from hourly rates per vehicle type.
- Track free vs occupied spots per floor in real time.

## Non-Functional Requirements
- Extensible to new vehicle types and pricing strategies without rewriting core logic.
- Thread-safe parking operations.

## Constraints
- One vehicle per spot. A vehicle can use a larger spot only if no suitable spot exists (state your assumption).
- In-memory design; no real payment gateway needed (mock it).`,
    deliverables:
      "explanation.txt (approach, class diagram in words, patterns used) + code with Vehicle, Spot, Floor, ParkingLot, Ticket, PricingStrategy classes.",
  },
  {
    slug: "splitwise",
    title: "Splitwise (Expense Sharing)",
    difficulty: "Medium",
    tags: ["OOP", "Graph"],
    statementMd: `# Splitwise

## Overview
Design an expense-sharing app where users in a group split bills and settle debts with minimum transactions.

## Functional Requirements
- Add users and groups; record expenses (equal, exact, percentage splits).
- Show per-user balances and group-wise owed amounts.
- Simplify debts (settle with minimum transactions).

## Non-Functional Requirements
- Correct money handling (no floating point errors — use integer paise/cents).
- Extensible split strategies.

## Constraints
- Single currency. In-memory; persistence optional.`,
    deliverables:
      "explanation.txt (data model, split strategies, debt-simplification algorithm) + code with User, Group, Expense, Split, BalanceSheet classes.",
  },
  {
    slug: "elevator",
    title: "Elevator System",
    difficulty: "Hard",
    tags: ["Concurrency", "Scheduling"],
    statementMd: `# Elevator System

## Overview
Design controllers for elevators serving a building with multiple lifts and floors.

## Functional Requirements
- Handle internal (floor buttons) and external (up/down) requests.
- Dispatch the best elevator per request (SCAN/LOOK or your stated strategy).
- Support door open/close, overload handling, and direction states.

## Non-Functional Requirements
- Thread-safe request handling; fair scheduling (no starvation).
- Extensible dispatch algorithm.

## Constraints
- Simulate time; no real hardware. State capacity and speed assumptions.`,
    deliverables:
      "explanation.txt (dispatch algorithm, state machine, concurrency model) + code with Elevator, Request, Dispatcher, Building classes.",
  },
  {
    slug: "bookmyshow",
    title: "BookMyShow (Movie Tickets)",
    difficulty: "Hard",
    tags: ["Concurrency", "OOP"],
    statementMd: `# BookMyShow

## Overview
Design a movie ticket booking system with seat selection and concurrent booking safety.

## Functional Requirements
- Browse movies, theatres, shows; view seat map.
- Hold seats temporarily, confirm booking with mock payment, release on timeout.
- Prevent double-booking of the same seat.

## Non-Functional Requirements
- Correctness under concurrency (two users, one seat — exactly one wins).
- Extensible to coupons/offers.

## Constraints
- In-memory with locks/transactions you explain; no real payment gateway.`,
    deliverables:
      "explanation.txt (seat-hold flow, concurrency control, data model) + code with Movie, Theatre, Show, Seat, Booking, Payment classes.",
  },
  {
    slug: "lru-cache",
    title: "LRU Cache",
    difficulty: "Easy",
    tags: ["Data Structures", "OOP"],
    statementMd: `# LRU Cache

## Overview
Design a thread-safe LRU cache with O(1) get and put.

## Functional Requirements
- get(key), put(key, value) with capacity-based eviction of least recently used.
- Optional TTL per entry.

## Non-Functional Requirements
- O(1) operations; thread-safe; clean separation of eviction policy.

## Constraints
- In-memory; language standard library only for the core structure.`,
    deliverables:
      "explanation.txt (why HashMap + doubly-linked list, policy abstraction) + code with Cache, EvictionPolicy, Node classes.",
  },
];

async function main() {
  for (const p of problems) {
    await db.problem.upsert({
      where: { slug: p.slug },
      update: {
        title: p.title,
        difficulty: p.difficulty,
        tags: p.tags,
        statementMd: p.statementMd,
        deliverables: p.deliverables,
      },
      create: p,
    });
  }
  console.log(`Seeded ${problems.length} problems`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
