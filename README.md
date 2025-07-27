# Welcome to EduRetrieve !!
Course Module Sharing Application with AI Assistance 🚀

## Project Overview
EduRetrieve is a full-stack web application designed to facilitate the sharing and discovery of course modules. It empowers users to upload educational content, manage their saved modules, and interact with an AI assistant to enhance their learning experience. Whether you're looking to share your knowledge or find new study materials, EduRetrieve provides a streamlined platform.

## ✨ Features
- **User Authentication**: Secure sign-up and login for user accounts powered by Firebase Authentication.
- **Module Management**: Upload, view, and manage course modules.
- **Module Saving**: Save modules to your personal collection for easy access.
- **AI Chat Integration**: Interact with a Google Gemini-powered AI assistant for queries, explanations, or content generation related to your studies.
- **Dashboard Overview**: A centralized dashboard to view available modules and manage your activities.
- **Responsive Design**: A clean, modern UI that adapts to various screen sizes.

## 🛠️ Tech Stack

EduRetrieve is built as a **monorepo**, separating the client and server applications.

### Client (Frontend)
- **React.js**: A JavaScript library for building user interfaces.
- **React Router**: For declarative routing within the application.
- **Firebase SDK**:
  - Authentication: User login, registration, and session management.
  - Firestore: NoSQL cloud database for storing module metadata and user data.
  - Storage: Cloud storage for uploaded module files.
- **react-icons**: For beautiful and easily customizable SVG icons.
- **CSS**: For styling and design.

### Server (Backend)
- **Node.js**: JavaScript runtime for the server.
- **Express.js**: A fast, unopinionated, minimalist web framework for Node.js.
- **Firebase Admin SDK**: For privileged interactions with Firebase services.
- **@google/generative-ai**: SDK for integrating with Google's Gemini AI models.
- **@google-cloud/storage**: For managing file uploads to Google Cloud Storage.
- **multer**: Middleware for handling multipart/form-data.
- **cors**: Node.js middleware for enabling Cross-Origin Resource Sharing.
- **dotenv**: For loading environment variables from a .env file.

### Monorepo Tooling
- **concurrently**: Allows running multiple npm scripts concurrently (e.g., client and server together).

## ⚙️ Prerequisites
Before you begin, ensure you have the following installed on your system:
- **Node.js** (v18.x or higher recommended)
- **npm** (Comes with Node.js)
- **Git**: For cloning the repository

## ▶️ Run the Application
From the root directory, run:
```bash
npm start
```
This will:
- Start the React dev server (`http://localhost:3000`)
- Start the Node.js server (`http://localhost:5000` or your chosen port)

---

## 📂 Project Structure
```bash
EduRetrieve/
├── client/               # React frontend
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── layouts/
│   │   ├── hooks/
│   │   ├── Styles/
│   │   ├── App.js
│   │   ├── firebaseConfig.js
│   │   └── index.js
│   ├── .env
│   ├── .gitignore
│   ├── package.json
│   └── ...
│
├── server/               # Node.js backend
│   ├── src/
│   │   ├── model/
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── middleware/
│   │   ├── utils/
│   │   ├── config/
│   │   └── index.js
│   ├── EduRetrieve-ServiceAccount.json  # should be the exact same name!
│   ├── .env
│   ├── package.json
│   └── ...
│
├── node_modules/
├── .gitignore
├── package.json
└── README.md
```
---

## 🤝 Contributing
Contributions are welcome! Please open an issue or submit a pull request with improvements or suggestions.