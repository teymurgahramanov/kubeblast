# JRunner - Job Management System

<div align="center">

![JRunner Logo](web/public/logo192.png)

A modern, full-stack job management system built with Python FastAPI and React.

[![Python](https://img.shields.io/badge/python-3.11-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109.0-green.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18.2.0-blue.svg)](https://reactjs.org/)
[![Material-UI](https://img.shields.io/badge/Material--UI-5.15.0-blue.svg)](https://mui.com/)

</div>

## 🌟 Features

### Backend
- **FastAPI-powered REST API**
  - High-performance async endpoints
  - Automatic API documentation (Swagger/OpenAPI)
  - Built-in data validation
  - JWT authentication
  - Role-based access control

- **Database**
  - PostgreSQL database
  - SQLAlchemy ORM
  - Alembic migrations
  - Efficient data modeling

### Frontend
- **Modern React Application**
  - Material-UI components
  - Responsive design
  - Dark/Light theme support
  - Real-time updates
  - Form validation

- **User Management**
  - User authentication
  - Role-based permissions
  - User profile management
  - File upload support

- **Job Management**
  - Create and manage jobs
  - File attachments
  - Status tracking
  - Search and filtering

## 🚀 Getting Started

### Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL 14+
- Docker (optional)

### Backend Setup

1. Create and activate a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
cd backend
pip install -r requirements.txt
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Run database migrations:
```bash
alembic upgrade head
```

5. Start the backend server:
```bash
uvicorn main:app --reload
```

### Frontend Setup

1. Install dependencies:
```bash
cd web
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Start the development server:
```bash
npm start
```

### Docker Setup

1. Build and run with Docker Compose:
```bash
docker-compose up --build
```

## 📚 API Documentation

Once the backend is running, visit:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## 🔒 Security

- JWT-based authentication
- Password hashing with bcrypt
- Role-based access control
- CORS protection
- Rate limiting
- Input validation

## 🎨 UI/UX Features

- Clean and modern interface
- Responsive design for all devices
- Dark/Light theme support
- Intuitive navigation
- Real-time updates
- Form validation
- Error handling
- Loading states
- Toast notifications

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 Authors

- Your Name - Initial work

## 🙏 Acknowledgments

- FastAPI team for the amazing framework
- React team for the frontend library
- Material-UI team for the beautiful components
- All contributors and users of this project

---

<div align="center">
Made with ❤️ using FastAPI and React
</div>
