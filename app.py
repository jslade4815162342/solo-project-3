import os
import json
from pathlib import Path

from flask import Flask, request, jsonify, render_template
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import func

app = Flask(__name__)

# Render provides DATABASE_URL for Postgres.
# SQLAlchemy expects postgresql:// (not postgres://)
db_url = os.environ.get("DATABASE_URL", "")
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

app.config["SQLALCHEMY_DATABASE_URI"] = db_url
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)

BASE_DIR = Path(__file__).resolve().parent
SEED_PATH = BASE_DIR / "movies.json"
PLACEHOLDER_IMG = "https://via.placeholder.com/120x180?text=No+Image"


class Movie(db.Model):
    __tablename__ = "movies"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(120), nullable=False)
    director = db.Column(db.String(120), nullable=False)
    year = db.Column(db.Integer, nullable=False)
    rating = db.Column(db.Float, nullable=False)
    image_url = db.Column(db.String(500), nullable=False, default=PLACEHOLDER_IMG)


def validate_movie(payload):
    errors = {}

    title = (payload.get("title") or "").strip()
    director = (payload.get("director") or "").strip()
    image_url = (payload.get("image_url") or "").strip() or PLACEHOLDER_IMG

    if not title:
        errors["title"] = "Title is required."
    elif len(title) > 120:
        errors["title"] = "Title must be 120 characters or less."

    if not director:
        errors["director"] = "Director is required."
    elif len(director) > 120:
        errors["director"] = "Director must be 120 characters or less."

    try:
        year = int(payload.get("year"))
        if year < 1888 or year > 2100:
            errors["year"] = "Year must be between 1888 and 2100."
    except Exception:
        errors["year"] = "Year must be a whole number."

    try:
        rating = float(payload.get("rating"))
        if rating < 0 or rating > 10:
            errors["rating"] = "Rating must be between 0 and 10."
        rating = round(rating, 1)
    except Exception:
        errors["rating"] = "Rating must be a number."

    if errors:
        return None, errors

    return {
        "title": title,
        "director": director,
        "year": year,
        "rating": rating,
        "image_url": image_url,
    }, None


def ensure_schema_and_seed():
    db.create_all()

    # Seed only if table is empty
    if Movie.query.count() > 0:
        return

    if not SEED_PATH.exists():
        return

    try:
        seed = json.loads(SEED_PATH.read_text(encoding="utf-8"))
        if not isinstance(seed, list):
            return
    except Exception:
        return

    for raw in seed:
        try:
            title = (raw.get("title") or "").strip()
            director = (raw.get("director") or "").strip()
            year = int(raw.get("year", 2000))
            rating = float(raw.get("rating", 0))
            image_url = (raw.get("image_url") or raw.get("image") or "").strip() or PLACEHOLDER_IMG

            if not title or not director:
                continue

            db.session.add(Movie(
                title=title,
                director=director,
                year=year,
                rating=rating,
                image_url=image_url
            ))
        except Exception:
            continue

    db.session.commit()


@app.before_request
def _init_once():
    # Safe to call often; only seeds if empty
    ensure_schema_and_seed()


# -----------------------
# UI routes
# -----------------------
@app.get("/")
def home():
    return render_template("index.html")


@app.get("/health")
def health():
    return jsonify({"ok": True})


# -----------------------
# API routes
# -----------------------
@app.get("/api/movies/<int:movie_id>")
def get_movie(movie_id):
    m = Movie.query.get(movie_id)
    if not m:
        return jsonify({"message": "Movie not found."}), 404
    return jsonify({
        "id": m.id,
        "title": m.title,
        "director": m.director,
        "year": m.year,
        "rating": m.rating,
        "image_url": m.image_url,
    })


@app.get("/api/movies")
def list_movies():
    # Paging inputs
    try:
        page = max(1, int(request.args.get("page", 1)))
    except Exception:
        page = 1

    try:
        page_size = int(request.args.get("pageSize", 10))
        page_size = page_size if page_size in (5, 10, 20, 50) else 10
    except Exception:
        page_size = 10

    # Search/filter
    q = (request.args.get("q") or "").strip()

    # Sorting
    sort = (request.args.get("sort") or "title").strip()
    direction = (request.args.get("dir") or "asc").strip().lower()

    sort_map = {
        "title": Movie.title,
        "director": Movie.director,
        "year": Movie.year,
        "rating": Movie.rating,
    }
    sort_col = sort_map.get(sort, Movie.title)
    sort_col = sort_col.desc() if direction == "desc" else sort_col.asc()

    query = Movie.query
    if q:
        like = f"%{q}%"
        query = query.filter(
            (Movie.title.ilike(like)) | (Movie.director.ilike(like))
        )

    total_filtered = query.count()
    total_pages = max(1, (total_filtered + page_size - 1) // page_size)
    if page > total_pages:
        page = total_pages

    movies = (
        query.order_by(sort_col)
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return jsonify({
        "movies": [
            {
                "id": m.id,
                "title": m.title,
                "director": m.director,
                "year": m.year,
                "rating": m.rating,
                "image_url": m.image_url,
            } for m in movies
        ],
        "page": page,
        "pageSize": page_size,
        "totalFiltered": total_filtered,
        "totalPages": total_pages,
    })


@app.post("/api/movies")
def add_movie():
    payload = request.get_json(silent=True) or {}
    movie, errors = validate_movie(payload)
    if errors:
        return jsonify({"errors": errors}), 400

    m = Movie(**movie)
    db.session.add(m)
    db.session.commit()

    return jsonify({
        "id": m.id,
        **movie
    }), 201


@app.put("/api/movies/<int:movie_id>")
def update_movie(movie_id):
    payload = request.get_json(silent=True) or {}
    movie, errors = validate_movie(payload)
    if errors:
        return jsonify({"errors": errors}), 400

    m = Movie.query.get(movie_id)
    if not m:
        return jsonify({"message": "Movie not found."}), 404

    for k, v in movie.items():
        setattr(m, k, v)

    db.session.commit()

    return jsonify({
        "id": m.id,
        **movie
    })


@app.delete("/api/movies/<int:movie_id>")
def delete_movie(movie_id):
    m = Movie.query.get(movie_id)
    if not m:
        return jsonify({"message": "Movie not found."}), 404

    db.session.delete(m)
    db.session.commit()
    return "", 204


@app.get("/api/stats")
def stats():
    """
    Requirements:
    - Total number of records (entire dataset)
    - Current page size
    - At least one domain-specific stat
    """
    try:
        page_size = int(request.args.get("pageSize", 10))
        page_size = page_size if page_size in (5, 10, 20, 50) else 10
    except Exception:
        page_size = 10

    total_all = db.session.query(func.count(Movie.id)).scalar() or 0

    avg_rating = db.session.query(func.avg(Movie.rating)).scalar()
    avg_rating = round(float(avg_rating), 2) if avg_rating is not None else 0.0

    # Domain stat: top director by count
    top = (
        db.session.query(Movie.director, func.count(Movie.id).label("c"))
        .group_by(Movie.director)
        .order_by(func.count(Movie.id).desc())
        .first()
    )

    top_director = top[0] if top else None
    top_director_count = int(top[1]) if top else 0

    return jsonify({
        "totalRecords": int(total_all),
        "currentPageSize": int(page_size),
        "averageRating": avg_rating,
        "topDirector": top_director,
        "topDirectorCount": top_director_count,
    })
