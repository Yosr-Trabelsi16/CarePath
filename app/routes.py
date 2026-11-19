from datetime import datetime
from functools import wraps

from flask import (
    Blueprint, render_template, request, redirect, url_for, flash, abort
)
from flask_login import (
    login_user, logout_user, login_required, current_user
)
from werkzeug.security import generate_password_hash, check_password_hash

from app import db
from app.models import User, MedicalRequest, Appointment, ActivityLog

main = Blueprint("main", __name__)


# ---------- helpers ----------

def role_required(role):
    def decorator(f):
        @wraps(f)
        @login_required
        def wrapper(*args, **kwargs):
            if current_user.role != role:
                abort(403)
            return f(*args, **kwargs)
        return wrapper
    return decorator


def log(action, entity_type, entity_id):
    db.session.add(ActivityLog(
        actor_id=current_user.id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
    ))


def can_view(req):
    if current_user.role == "patient":
        return req.patient_id == current_user.id
    if current_user.role == "provider":
        return req.provider_id == current_user.id or req.status == "Pending"
    return False


# ---------- public ----------

@main.route("/")
def home():
    return render_template("index.html")


@main.route("/login", methods=["GET", "POST"])
def login():
    if current_user.is_authenticated:
        return redirect(url_for("main.dashboard"))

    if request.method == "POST":
        email = request.form.get("email", "").lower().strip()
        password = request.form.get("password", "")

        user = User.query.filter_by(email=email).first()

        if user and check_password_hash(user.password_hash, password):
            login_user(user, remember=bool(request.form.get("remember")))
            return redirect(url_for("main.dashboard"))

        flash("Invalid email or password.")

    return render_template("login.html")


@main.route("/register", methods=["GET", "POST"])
def register():
    if current_user.is_authenticated:
        return redirect(url_for("main.dashboard"))

    if request.method == "POST":
        full_name = request.form.get("full_name", "").strip()
        email = request.form.get("email", "").lower().strip()
        role = request.form.get("account_type", "")
        password = request.form.get("password", "")
        confirm = request.form.get("confirm_password", "")

        if not full_name:
            flash("Please enter your full name.")
        elif role not in ("patient", "provider"):
            flash("Please select a valid account type.")
        elif len(password) < 8:
            flash("Password must be at least 8 characters.")
        elif password != confirm:
            flash("Passwords do not match.")
        elif User.query.filter_by(email=email).first():
            flash("This email is already registered.")
        else:
            user = User(
                full_name=full_name,
                email=email,
                role=role,
                password_hash=generate_password_hash(password),
            )
            db.session.add(user)
            db.session.commit()
            flash("Account created. You can now sign in.")
            return redirect(url_for("main.login"))

    return render_template("register.html")


@main.route("/logout")
@login_required
def logout():
    logout_user()
    return redirect(url_for("main.home"))


# ---------- app ----------

@main.route("/dashboard")
@login_required
def dashboard():
    # upcoming appointments (for the current user, whatever the role)
    appts = Appointment.query.filter(
        Appointment.status == "Scheduled",
        Appointment.scheduled_at >= datetime.now(),
    )
    if current_user.role == "patient":
        appts = appts.filter(Appointment.patient_id == current_user.id)
    else:
        appts = appts.filter(Appointment.provider_id == current_user.id)
    upcoming = appts.order_by(Appointment.scheduled_at.asc()).limit(6).all()

    if current_user.role == "patient":
        mine = (MedicalRequest.query
                .filter_by(patient_id=current_user.id)
                .order_by(MedicalRequest.created_at.desc())
                .all())
        return render_template(
            "dashboard.html", mine=mine, open_requests=[], upcoming=upcoming
        )

    open_requests = (MedicalRequest.query
                     .filter_by(status="Pending", provider_id=None)
                     .order_by(MedicalRequest.created_at.desc())
                     .all())
    mine = (MedicalRequest.query
            .filter_by(provider_id=current_user.id)
            .order_by(MedicalRequest.created_at.desc())
            .all())
    return render_template(
        "dashboard.html", mine=mine, open_requests=open_requests, upcoming=upcoming
    )


@main.route("/requests/new", methods=["GET", "POST"])
@role_required("patient")
def new_request():
    form_title = ""
    form_description = ""

    if request.method == "POST":
        form_title = request.form.get("title", "").strip()
        form_description = request.form.get("description", "").strip()

        if not form_title:
            flash("Please enter a title.")
        elif len(form_title) > 150:
            flash("Title must be 150 characters or fewer.")
        elif not form_description:
            flash("Please describe your request.")
        else:
            req = MedicalRequest(
                patient_id=current_user.id,
                title=form_title,
                description=form_description,
            )
            db.session.add(req)
            db.session.flush()
            log("Request created", "MedicalRequest", req.id)
            db.session.commit()
            flash("Your request has been sent.")
            return redirect(url_for("main.request_detail", request_id=req.id))

    return render_template(
        "new_request.html",
        form_title=form_title,
        form_description=form_description,
    )


@main.route("/requests/<int:request_id>")
@login_required
def request_detail(request_id):
    req = db.get_or_404(MedicalRequest, request_id)
    if not can_view(req):
        abort(403)

    logs = (ActivityLog.query
            .filter_by(entity_type="MedicalRequest", entity_id=req.id)
            .order_by(ActivityLog.created_at.asc())
            .all())
    appointment = (Appointment.query
                   .filter_by(request_id=req.id, status="Scheduled")
                   .first())

    return render_template(
        "request_detail.html",
        req=req,
        logs=logs,
        appointment=appointment,
        now_min=datetime.now().strftime("%Y-%m-%dT%H:%M"),
    )


@main.route("/requests/<int:request_id>/accept", methods=["POST"])
@role_required("provider")
def accept_request(request_id):
    req = db.get_or_404(MedicalRequest, request_id)

    if req.status != "Pending" or req.provider_id is not None:
        flash("This request is no longer available.")
        return redirect(url_for("main.dashboard"))

    req.provider_id = current_user.id
    req.status = "Accepted"
    log("Request accepted", "MedicalRequest", req.id)
    db.session.commit()
    flash("Request accepted.")
    return redirect(url_for("main.request_detail", request_id=req.id))


@main.route("/requests/<int:request_id>/appointment", methods=["POST"])
@role_required("provider")
def schedule_appointment(request_id):
    req = db.get_or_404(MedicalRequest, request_id)

    if req.provider_id != current_user.id or req.status != "Accepted":
        abort(403)

    raw = request.form.get("scheduled_at", "")
    try:
        when = datetime.strptime(raw, "%Y-%m-%dT%H:%M")
    except ValueError:
        flash("Please choose a valid date and time.")
        return redirect(url_for("main.request_detail", request_id=req.id))

    if when <= datetime.now():
        flash("The appointment must be in the future.")
        return redirect(url_for("main.request_detail", request_id=req.id))

    appt = (Appointment.query
            .filter_by(request_id=req.id, status="Scheduled")
            .first())

    if appt:
        appt.scheduled_at = when
        action = "Appointment rescheduled"
    else:
        appt = Appointment(
            patient_id=req.patient_id,
            provider_id=current_user.id,
            request_id=req.id,
            scheduled_at=when,
        )
        db.session.add(appt)
        action = "Appointment scheduled"

    log(action, "MedicalRequest", req.id)
    db.session.commit()
    flash("Appointment saved.")
    return redirect(url_for("main.request_detail", request_id=req.id))


@main.route("/requests/<int:request_id>/complete", methods=["POST"])
@role_required("provider")
def complete_request(request_id):
    req = db.get_or_404(MedicalRequest, request_id)

    if req.provider_id != current_user.id or req.status != "Accepted":
        abort(403)

    req.status = "Completed"
    log("Request completed", "MedicalRequest", req.id)
    db.session.commit()
    flash("Request marked as completed.")
    return redirect(url_for("main.request_detail", request_id=req.id))