# Digital Object Repository

This is a full-stack web application that serves as a "digital object repository." It allows users to upload files (PDFs, text files) and save web page content from URLs. The backend, built with Node.js and Fastify, extracts text content, generates vector embeddings using the OpenAI API, and stores everything in a PostgreSQL database with the `pgvector` extension.

The frontend, a React application built with Vite, provides a user interface for uploading content, viewing all items, searching for similar items based on vector similarity, and exploring detailed views of each item. The application also includes advanced AI-powered features like content summarization, table of contents generation, and key insights extraction.

A key feature is the "Notebooks," which allows users to group related items, add notes, and perform Q&A against the collected content of a notebook.

The entire application is containerized using Docker and managed with Docker Compose for easy setup and development.

## Tech Stack

- **Backend**: Node.js, Fastify
- **Frontend**: React, Vite, React Router
- **Database**: PostgreSQL with `pgvector`
- **AI Services**: OpenAI API (Embeddings, GPT-4o-mini)
- **Containerization**: Docker, Docker Compose

## Features

- **File & URL Ingestion**: Upload PDFs and text files, or scrape and save content from web URLs.
- **Vector Search**: All text content is converted to vector embeddings and stored, enabling semantic search.
- **AI-Powered Insights**:
  - **Summarization**: Generate concise summaries of any item's content.
  - **Table of Contents**: Automatically create a ToC for long documents.
  - **Key Insights**: Extract the most important points from the text.
- **Notebooks**:
  - Group related items into notebooks.
  - Add custom notes to notebooks.
  - Ask questions and get AI-generated answers based on the content of all items in a notebook.
- **API Usage Tracking**: Monitors OpenAI API token usage and associated costs.
- **Download Originals**: Persists original files for download.
- **Containerized**: Fully containerized for consistent development and deployment environments.

## Getting Started

### Prerequisites

- Docker and Docker Compose
- An OpenAI API key

### Installation & Setup

1. **Clone the repository:**

   ```bash
   git clone <repository-url>
   cd digital-object-repo
   ```

2. **Create an environment file:**

   Create a `.env` file in the root of the project by copying the example file:

   ```bash
   cp .env.example .env
   ```

3. **Configure the environment:**

   Open the `.env` file and add your credentials and configuration:
    - `OPENAI_API_KEY`: Your secret key for the OpenAI API.
    - `PORT`: The port for the backend server (e.g., 3001).
    - `DB_USER`, `DB_PASSWORD`, `DB_DATABASE`: Credentials for the PostgreSQL database.
    - `DB_HOST`: Should be `postgres` for Docker networking.
    - `DB_PORT`: The external port for the database (e.g., 5433).

4. **Build and run the application:**

   Use Docker Compose to build the images and start the services.

   ```bash
   docker-compose up --build
   ```

   This will start the following services:
    - `postgres`: The PostgreSQL database instance.
    - `db-init`: A one-off service to initialize the database schema.
    - `app`: The Node.js backend server.
    - `client`: The React frontend development server.

### Usage

- **Frontend**: Access the web application at `http://localhost:5173` (or your configured Vite port).
- **Backend API**: The API is available at `http://localhost:3001` (or your configured backend port).

## Project Structure

```text
.
├── docker-compose.yml  # Defines and configures all services
├── Dockerfile          # Dockerfile for the backend Node.js app
├── package.json        # Backend dependencies and scripts
├── .env.example        # Example environment file
├── src/                # Backend source code
│   ├── server.js       # Main Fastify server entry point
│   ├── init-db.js      # Database schema initialization
│   ├── routes/         # API route definitions
│   ├── services/       # Business logic (OpenAI, scraping)
│   └── db/             # Database connection logic
├── client/             # Frontend React application
│   ├── Dockerfile.dev  # Dockerfile for the client dev server
│   ├── package.json    # Frontend dependencies and scripts
│   └── src/            # Frontend source code
│       ├── App.jsx     # Main React app component
│       ├── pages/      # Page components
│       └── components/ # Reusable UI components
└── uploads/            # Directory for storing uploaded files
```
