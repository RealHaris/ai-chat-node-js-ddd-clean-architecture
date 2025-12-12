# AI Chat Subscription System (DDD + Clean Architecture)

A robust, production-ready Node.js backend service built with **Domain-Driven Design (DDD)** and **Clean Architecture** principles. This project implements a complete subscription-based AI chat system with quota management, background workers, and comprehensive testing.

**Repository:** [https://github.com/RealHaris/ai-chat-node-js-ddd-clean-architecture](https://github.com/RealHaris/ai-chat-node-js-ddd-clean-architecture)

---

## 🚀 Key Features

*   **Authentication & Authorization**
    *   Secure JWT-based auth (Access + Refresh Tokens).
    *   Role-based access control (Admin vs. Regular User).
    *   Redis-backed token management (Allow/Revoke).
*   **Subscription Management**
    *   Flexible Bundle Tiers (Basic, Pro, Enterprise/Unlimited).
    *   Monthly & Yearly billing cycles.
    *   Auto-renewal and Cancellation workflows.
    *   **Background Workers** (BullMQ) for handling subscription expiry and status updates.
*   **Quota System**
    *   **Free Tier**: Auto-resetting monthly quota (3 messages/month).
    *   **Paid Tiers**: Cumulative quota management.
    *   **Cron Jobs**: Automated monthly reset for free tier users.
*   **Chat Module**
    *   Message persistence and history.
    *   Strict quota enforcement (403 Forbidden when limit reached).
*   **Advanced Architecture**
    *   **DDD**: Rich Domain Models, Aggregates, Value Objects.
    *   **Clean Architecture**: Strict layer separation (Domain -> Application -> Infrastructure).
    *   **CQRS**: Segregated Read and Write repositories for optimized performance.
    *   **Dependency Injection**: Managed via 	syringe.

## 🛠️ Tech Stack

*   **Runtime**: Node.js (>= 18.12.0)
*   **Language**: TypeScript
*   **Framework**: Express.js
*   **Database**: PostgreSQL
*   **ORM**: Drizzle ORM
*   **Caching/Queues**: Redis, BullMQ
*   **Scheduling**: Node-cron
*   **Validation**: Zod
*   **Bundler**: esbuild
*   **Testing**: TSX, Native Fetch (Custom Test Runner)

## 🏗️ Architecture Overview

The project follows a strict modular structure:

`
src/
├── modules/                 # Domain Modules
│   ├── auth/                # Authentication & Token Management
│   ├── user/                # User Profile & Admin Management
│   ├── subscription/        # Bundles, Subscriptions, Quotas
│   └── chat/                # Chat Messages & History
│       ├── domain/          # Entities, Events, Interfaces
│       ├── application/     # Use Cases, DTOs
│       └── infra/           # Controllers, Repositories
├── shared/                  # Shared Kernel
│   ├── infra/               # DB, Redis, Queue, Cron, HTTP
│   └── core/                # Base Classes (Entity, Result, etc.)
└── worker.ts                # Background Worker Entry Point
`

## ⚡ Getting Started

### Prerequisites

*   Node.js (v18+)
*   PostgreSQL
*   Redis (Required for Queues and Token management)

### Installation

1.  **Clone the repository**
    `ash
    git clone https://github.com/RealHaris/ai-chat-node-js-ddd-clean-architecture.git
    cd ai-chat-node-js-ddd-clean-architecture
    `

2.  **Install dependencies**
    `ash
    npm install
    `

3.  **Environment Setup**
    Copy .env.example to .env and configure your database/redis credentials.
    `ash
    cp .env.example .env
    `

4.  **Database Setup**
    `ash
    # Generate migrations
    npm run migration:generate
    
    # Apply migrations
    npm run migration:push
    
    # Seed initial data (Admin user, Bundle tiers)
    npm run db:seed
    `

### Running the Application

*   **Development Server**
    `ash
    npm run dev
    `
*   **Background Worker** (Required for subscription expiry)
    `ash
    npm run worker:dev
    `
*   **Production Build**
    `ash
    npm run build
    npm start
    `

## 🧪 Testing

The project includes a comprehensive custom test runner covering Unit, Integration, and E2E scenarios.

| Command | Description |
| :--- | :--- |
| `npm run test` | Run **ALL** tests (Auth, User, Bundle, Sub, Chat, E2E, Advanced, Postman) |
| `npm run test:e2e` | Run standard End-to-End user journeys |
| `npm run test -- advanced` | Run edge cases (Quota limits, Worker simulation, Cron reset) |
| `npm run test -- postman` | Run happy-path scenarios matching the Postman collection |
| `npm run test:auth` | Run specific module tests (auth, user, chat, etc.) |

## 💻 Development Commands

| Command | Description |
| :--- | :--- |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Fix ESLint errors |
| `npm run format` | Format code with Prettier |
| `npm run type-check` | Run TypeScript type checking |
## 📝 License

This project is private.
