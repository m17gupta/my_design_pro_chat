# Project Analysis & Resume Blueprint: Luna AI / MyDesign Pro Chat

---

## 1. Project Summary

**Luna AI / MyDesign Pro Chat (`my_design_pro_chat`)** is an enterprise-grade, conversational AI architectural and exterior design intake platform. The application guides property owners and enterprise clients through dynamic, multi-step design questionnaires, handles architectural asset uploads (photos, surveys, CAD/SketchUp files), orchestrates automated AI design rendering generation, and facilitates multi-round design revisions. Additionally, it provides vendor and administrative dashboards for tracking subscription lifecycles and API consumption.

- **Problem Solved:** Replaces manual, fragmented architectural design intake with an automated, interactive AI questionnaire workflow, real-time image generation pipeline, and vendor subscription monitoring.
- **Target Users:** Property owners, enterprise design clients, external design vendors, and Dzinly platform administrators.
- **Product Type:** B2B / Enterprise SaaS widget (embeddable via iframe bridge) and standalone web platform.

---

## 2. Verified Tech Stack

| Layer | Technologies Verified in Codebase |
|---|---|
| **Frontend Framework & Core** | **Next.js 16.3** (App Router), **React 19.2**, **TypeScript 5** |
| **State Management** | **Redux Toolkit 2.12**, **React-Redux 9.3** (with custom debounced persistence middleware) |
| **Styling & Animation** | **Tailwind CSS v4**, **Framer Motion 13.0**, **Bootstrap Icons**, **React Hot Toast** |
| **Backend & Runtime** | **Next.js Route Handlers** (Node.js runtime), **FastAPI** (external AI generation & vendor microservices) |
| **AI / LLM Integrations** | **OpenAI SDK** (`gpt-4o-mini`), **Anthropic SDK** (`claude-3-5-sonnet`) with streaming `ReadableStream`, **Dzinly Luna AI** Design Generation API |
| **Cloud & Storage** | **AWS S3** (`@aws-sdk/client-s3`, `@aws-sdk/lib-storage` multipart streaming), **Supabase** (`@supabase/supabase-js` service-role server client) |
| **Inter-App Communication** | Bidirectional **`window.postMessage`** Host Bridge (`hostBridge.ts`) |
| **Deployment & Ops** | **PM2** (`ecosystem.config.js`), Node.js production daemon on port `5178`, Vercel compatible |
| **Testing & Quality** | **Vitest 4.1**, **ESLint 9** |

---

## 3. Key Contributions

- **Dynamic Conversational Intake Engine:** Engineered an interactive chat-driven architectural intake workflow with multi-step branching, real-time typewriter text streaming, live answer inline editing, and progress tracking.
- **AI Design Generation & Task Polling Pipeline:** Built secure server-side API proxy routes (`/api/design-brief`, `/api/design-status/[taskId]`) that assemble complex design briefs, interface with FastAPI microservices, and poll asynchronous image generation tasks without exposing secret keys to the client.
- **Secure S3 Streaming Upload Handler:** Implemented a server-side multipart streaming upload route (`/api/upload`) using AWS SDK v3 to stream large design files, CAD drawings, and elevation photos directly to AWS S3 under isolated project prefixes (`luna-ai/<projectId>/`).
- **Multi-Provider LLM Streaming:** Developed a unified streaming chat API supporting both OpenAI and Anthropic SDKs, streaming token deltas in real-time to the UI via web `ReadableStream` pipelines.
- **Debounced Redux Persistence Architecture:** Built a centralized Redux Toolkit store integrated with custom debounced middleware to automatically synchronize chat progress and design iteration history to Supabase database tables.
- **Bidirectional Host Communication Bridge:** Implemented an iframe communication layer using `window.postMessage` to allow embedding host applications to listen to design submission events, ratings, and designer engagement triggers.
- **Vendor Subscription & Admin Dashboard:** Designed responsive monitoring interfaces (`/admin/subscriptions`, `/dashboard/subscription`) featuring KPI status metrics, expiry countdown progress bars, and renewal management.
- **Iterative Design Revision Flow:** Implemented multi-version design revision workflows allowing clients to inspect generated visuals, submit targeted architectural modifications, and compare revision histories.

---

## 4. Technical Complexity & Production Status

- **Complex State & Data Flow:** Multi-slice Redux Toolkit architecture managing chat briefs, questionnaire sequences, design generation tasks, and persistent storage synchronization.
- **Security & Microservice Proxying:** Decoupled architecture where private credentials (AWS S3, Supabase Service Role, OpenAI/Anthropic, FastAPI keys) reside strictly server-side behind Next.js route handlers.
- **Production Status:** **Production-Ready / Deployed.** Verified by production PM2 process configurations (`ecosystem.config.js` running on production host `luna.dzinlynxt.com` on port 5178 with 1GB memory limit and log rotation), unit test suites (`vitest`), and environment isolation.

---

## 5. Resume-Ready Versions

### Option 1: Frontend / Full-Stack Engineering Focused
> **Luna AI Design Platform** | *Next.js 16, React 19, TypeScript, Redux Toolkit, Tailwind CSS, AWS S3, OpenAI/Anthropic*
> - Engineered an AI-driven architectural design intake and revision web application with real-time LLM streaming, dynamic branched questionnaire flows, and S3 multipart file streaming.
> - Built debounced Redux persistence middleware syncing state to Supabase and an iframe `postMessage` bridge for embedding across host platforms.

### Option 2: Technical Complexity & Architecture Focused
> **Luna AI Design Platform** | *Next.js 16, TypeScript, Redux Toolkit, FastAPI, AWS SDK v3, Supabase, Vitest, PM2*
> - Architected a secure Next.js full-stack platform proxying async AI design generation tasks to FastAPI microservices, handling client-to-S3 media streaming and multi-provider LLM pipelines.
> - Implemented debounced database synchronization, vendor subscription monitoring dashboards, and production PM2 deployment infrastructure.

### Option 3: Balanced & Concise (Selected Projects Style)
> **Luna AI Design Platform** | *Next.js 16, React 19, TypeScript, Redux Toolkit, AWS S3, Supabase, OpenAI, Anthropic*
> - Developed an AI-powered architectural design platform featuring dynamic conversational intake questionnaires, streaming LLM chat, AWS S3 media uploads, and async design generation workflows.
> - Integrated debounced state persistence with Supabase, multi-version design revision tracking, and an embeddable iframe communication bridge.

---

## 6. Recommended Version

**Recommended: Option 3 (Balanced & Concise)**

**Why:**
1. **Clear Impact & Modern Stack:** Immediately highlights modern production technologies (**Next.js 16**, **React 19**, **TypeScript**, **Redux Toolkit**, **AWS S3**, **OpenAI/Anthropic**).
2. **Demonstrates Full-Stack Breadth:** Accurately captures your work across dynamic UI interactions, streaming media/AI pipelines, async backend communication, and data persistence.
3. **Concise Format:** Matches the clean, 2-bullet format standard for top software engineering resumes.
