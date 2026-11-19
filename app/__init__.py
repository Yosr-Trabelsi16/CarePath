from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager
from flask_wtf.csrf import CSRFProtect
from config import Config

db = SQLAlchemy()
login_manager = LoginManager()
csrf = CSRFProtect()


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    db.init_app(app)
    login_manager.init_app(app)
    csrf.init_app(app)

    login_manager.login_view = "main.login"
    login_manager.login_message = "Please sign in to continue."

    from app.models import User, MedicalRequest, Appointment, Document, ActivityLog
    from app.routes import main

    app.register_blueprint(main)

    with app.app_context():
        db.create_all()

    return app