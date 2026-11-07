"""
DriveAI - Hybrid Database Manager (MongoDB + SQLite Auto-Fallback)
Provides:
  1. Primary rich document & GeoJSON hazard logging via MongoDB (if configured & reachable).
  2. Automatic, zero-error fallback to embedded SQLite (for 100% offline local demos).
  3. Real-time status reporting and unified query API for sessions & road hazards.
"""

import os
import sqlite3
import datetime
import traceback
from pathlib import Path
from typing import List, Dict, Any, Optional

# Optional MongoDB driver
try:
    from pymongo import MongoClient, ASCENDING, DESCENDING, GEOSPHERE
    from pymongo.errors import PyMongoError, ServerSelectionTimeoutError, ConnectionFailure
    PYMONGO_AVAILABLE = True
except ImportError:
    PYMONGO_AVAILABLE = False

DB_PATH = Path(__file__).resolve().parent.parent / "sessions.db"

# Internal connection state
_mongo_client: Optional[Any] = None
_mongo_db: Optional[Any] = None
_mongo_active: bool = False
_mongo_error: Optional[str] = None
_active_uri: Optional[str] = None


# ==============================================================================
# SQLite Engine (Always Available, Zero-Dependency)
# ==============================================================================

def get_sqlite_connection():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_sqlite_db():
    """Initializes SQLite schema for DriveAI sessions and road hazards."""
    conn = get_sqlite_connection()
    cursor = conn.cursor()
    
    # 1. Sessions table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            session_id TEXT PRIMARY KEY,
            start_time TEXT NOT NULL,
            end_time TEXT,
            mode TEXT NOT NULL,
            preset TEXT NOT NULL,
            distance_km REAL DEFAULT 0.0,
            max_speed_kmh REAL DEFAULT 0.0,
            avg_speed_kmh REAL DEFAULT 0.0,
            detected_objects_count INTEGER DEFAULT 0,
            warnings_count INTEGER DEFAULT 0,
            avg_latency_ms REAL DEFAULT 0.0,
            status TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # 2. Road hazards table (offline GeoJSON equivalent)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS road_hazards (
            hazard_id TEXT PRIMARY KEY,
            session_id TEXT,
            hazard_type TEXT NOT NULL,
            severity TEXT NOT NULL,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            distance_km REAL DEFAULT 0.0,
            speed_kmh REAL DEFAULT 0.0,
            evasion_action TEXT,
            detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    conn.commit()
    conn.close()
    print(f"✅ [Database] SQLite initialized at: {DB_PATH}")


# ==============================================================================
# MongoDB Engine (Optional with Auto-Fallback)
# ==============================================================================

def init_mongodb():
    """
    Attempts connection to MongoDB if URI is provided in config or environment.
    Falls back gracefully to SQLite if MongoDB is offline, unconfigured, or unreachable.
    """
    global _mongo_client, _mongo_db, _mongo_active, _mongo_error, _active_uri

    if not PYMONGO_AVAILABLE:
        _mongo_active = False
        _mongo_error = "pymongo package not installed"
        print("ℹ️ [Database] pymongo not installed. Operating in SQLite offline mode.")
        return

    # Check Environment Variable first, then config.json
    uri = os.environ.get("MONGODB_URI", "").strip()
    db_name = os.environ.get("MONGODB_DB_NAME", "driveai_telemetry").strip()
    timeout_ms = 2500

    if not uri:
        # Load from config.json
        try:
            from .config import load_config
            cfg = load_config().get("database", {})
            uri = cfg.get("mongodb_uri", "").strip()
            db_name = cfg.get("database_name", "driveai_telemetry").strip()
            timeout_ms = int(cfg.get("connection_timeout_ms", 2500))
            if not cfg.get("enable_mongodb", True):
                _mongo_active = False
                _mongo_error = "MongoDB explicitly disabled in config.json"
                return
        except Exception:
            pass

    if not uri:
        _mongo_active = False
        _mongo_error = "No MONGODB_URI configured. Set MONGODB_URI in config.json or environment."
        print("ℹ️ [Database] No MongoDB URI configured. Using embedded SQLite storage.")
        return

    _active_uri = uri
    masked_uri = uri
    if "@" in uri:
        prefix = uri.split("@")[0]
        schema = prefix.split("://")[0]
        masked_uri = f"{schema}://***:***@" + uri.split("@")[1]

    try:
        print(f"🔄 [Database] Attempting MongoDB connection ({masked_uri})...")
        client = MongoClient(
            uri,
            serverSelectionTimeoutMS=timeout_ms,
            connectTimeoutMS=timeout_ms,
            appname="DriveAI-AutonomousVehicle"
        )
        # Test connection with ping
        client.admin.command("ping")

        _mongo_client = client
        _mongo_db = client[db_name]
        _mongo_active = True
        _mongo_error = None

        # Setup indexes for high-speed queries & 2D spatial search
        try:
            _mongo_db.sessions.create_index([("session_id", ASCENDING)], unique=True)
            _mongo_db.sessions.create_index([("created_at", DESCENDING)])
            _mongo_db.hazards.create_index([("location", GEOSPHERE)])
            _mongo_db.hazards.create_index([("detected_at", DESCENDING)])
        except Exception as idx_err:
            print(f"⚠️ [Database] Index check note: {idx_err}")

        print(f"🍃 [Database] MongoDB Atlas/Cluster connected successfully! (DB: {db_name})")

    except (ServerSelectionTimeoutError, ConnectionFailure, PyMongoError) as err:
        _mongo_active = False
        _mongo_error = f"Connection failed ({err.__class__.__name__}): {err}"
        print(f"⚠️ [Database] MongoDB unreachable: {err.__class__.__name__}. Auto-fallback active: Using SQLite.")
    except Exception as err:
        _mongo_active = False
        _mongo_error = str(err)
        print(f"⚠️ [Database] Unexpected MongoDB error: {err}. Falling back to SQLite.")


def is_mongodb_active() -> bool:
    """Returns True if MongoDB is currently connected and active."""
    return _mongo_active and _mongo_db is not None


# ==============================================================================
# Unified Session Logging (Rich MongoDB + SQLite Sync)
# ==============================================================================

def save_session(session: Dict[str, Any]) -> bool:
    """
    Saves a driving demonstration session.
    - Always records tabular summary in SQLite (so offline dashboard never breaks).
    - If MongoDB is connected, records full rich document (obstacles, Frenet paths, GeoJSON).
    """
    session_id = session.get("session_id")
    start_time = session.get("start_time", datetime.datetime.now().isoformat())
    end_time = session.get("end_time", datetime.datetime.now().isoformat())
    mode = session.get("mode", "MANUAL")
    preset = session.get("preset", "busy_city")
    distance_km = float(session.get("distance_km", 0.0))
    max_speed_kmh = float(session.get("max_speed_kmh", 0.0))
    avg_speed_kmh = float(session.get("avg_speed_kmh", 0.0))
    detected_objects_count = int(session.get("detected_objects_count", 0))
    warnings_count = int(session.get("warnings_count", 0))
    avg_latency_ms = float(session.get("avg_latency_ms", 0.0))
    status = session.get("status", "Completed")

    # 1. SQLite Storage
    sqlite_ok = False
    conn = get_sqlite_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT OR REPLACE INTO sessions (
                session_id, start_time, end_time, mode, preset,
                distance_km, max_speed_kmh, avg_speed_kmh,
                detected_objects_count, warnings_count, avg_latency_ms, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            session_id, start_time, end_time, mode, preset,
            distance_km, max_speed_kmh, avg_speed_kmh,
            detected_objects_count, warnings_count, avg_latency_ms, status
        ))
        conn.commit()
        sqlite_ok = True
    except Exception as e:
        print(f"❌ [Database] SQLite save failed: {e}")
    finally:
        conn.close()

    # 2. MongoDB Rich Document Storage (if active)
    if is_mongodb_active():
        try:
            rich_doc = {
                "session_id": session_id,
                "start_time": start_time,
                "end_time": end_time,
                "mode": mode,
                "preset": preset,
                "metrics": {
                    "distance_km": distance_km,
                    "max_speed_kmh": max_speed_kmh,
                    "avg_speed_kmh": avg_speed_kmh,
                    "detected_objects_count": detected_objects_count,
                    "warnings_count": warnings_count,
                    "avg_latency_ms": avg_latency_ms
                },
                "status": status,
                # Rich nested telemetry
                "detected_obstacles": session.get("detected_obstacles", []),
                "frenet_planner_state": session.get("frenet_planner_state", {}),
                "telemetry_summary": session.get("telemetry_summary", {}),
                "hazard_events": session.get("hazard_events", []),
                "created_at": datetime.datetime.utcnow()
            }
            _mongo_db.sessions.update_one(
                {"session_id": session_id},
                {"$set": rich_doc},
                upsert=True
            )
        except Exception as e:
            print(f"⚠️ [Database] MongoDB rich document save note: {e}")

    return sqlite_ok


def get_all_sessions(limit: int = 50) -> List[Dict[str, Any]]:
    """Returns past demonstration sessions. Prefers MongoDB if connected, else SQLite."""
    if is_mongodb_active():
        try:
            cursor = _mongo_db.sessions.find({}, {"_id": 0}).sort("created_at", DESCENDING).limit(limit)
            mongo_sessions = []
            for doc in cursor:
                # Convert MongoDB datetime to string if needed
                if isinstance(doc.get("created_at"), datetime.datetime):
                    doc["created_at"] = doc["created_at"].isoformat()
                # Normalize flat structure for compatibility
                if "metrics" in doc:
                    doc["distance_km"] = doc["metrics"].get("distance_km", 0.0)
                    doc["max_speed_kmh"] = doc["metrics"].get("max_speed_kmh", 0.0)
                    doc["avg_speed_kmh"] = doc["metrics"].get("avg_speed_kmh", 0.0)
                    doc["detected_objects_count"] = doc["metrics"].get("detected_objects_count", 0)
                    doc["warnings_count"] = doc["metrics"].get("warnings_count", 0)
                    doc["avg_latency_ms"] = doc["metrics"].get("avg_latency_ms", 0.0)
                mongo_sessions.append(doc)
            if mongo_sessions:
                return mongo_sessions
        except Exception as e:
            print(f"⚠️ [Database] MongoDB read error: {e}. Falling back to SQLite.")

    # Fallback to SQLite
    conn = get_sqlite_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT session_id, start_time, end_time, mode, preset,
               distance_km, max_speed_kmh, avg_speed_kmh,
               detected_objects_count, warnings_count, avg_latency_ms, status, created_at
        FROM sessions
        ORDER BY created_at DESC
        LIMIT ?
    """, (limit,))
    rows = cursor.fetchall()
    sessions = [dict(row) for row in rows]
    conn.close()
    return sessions


def get_session_by_id(session_id: str) -> Optional[Dict[str, Any]]:
    """Retrieves single session with full details."""
    if is_mongodb_active():
        try:
            doc = _mongo_db.sessions.find_one({"session_id": session_id}, {"_id": 0})
            if doc:
                if isinstance(doc.get("created_at"), datetime.datetime):
                    doc["created_at"] = doc["created_at"].isoformat()
                return doc
        except Exception:
            pass

    conn = get_sqlite_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM sessions WHERE session_id = ?", (session_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


# ==============================================================================
# Road Hazards & Geospatial API (GeoJSON + SQLite Fallback)
# ==============================================================================

def save_hazard_event(hazard: Dict[str, Any]) -> bool:
    """
    Saves an Indian road hazard (pothole, cattle, barricade, speed bump).
    - If MongoDB is connected: logs with standard GeoJSON Point for 2dsphere proximity queries.
    - If offline: logs in SQLite road_hazards table.
    """
    hazard_id = hazard.get("hazard_id")
    session_id = hazard.get("session_id", "GLOBAL")
    hazard_type = hazard.get("hazard_type", "pothole")
    severity = hazard.get("severity", "HIGH")
    latitude = float(hazard.get("latitude", 12.9716))
    longitude = float(hazard.get("longitude", 77.5946))
    distance_km = float(hazard.get("distance_km", 0.0))
    speed_kmh = float(hazard.get("speed_kmh", 0.0))
    evasion_action = hazard.get("evasion_action", "Lateral Offset")
    detected_at = hazard.get("detected_at", datetime.datetime.utcnow().isoformat())

    # 1. SQLite storage
    conn = get_sqlite_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT OR REPLACE INTO road_hazards (
                hazard_id, session_id, hazard_type, severity,
                latitude, longitude, distance_km, speed_kmh, evasion_action, detected_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            hazard_id, session_id, hazard_type, severity,
            latitude, longitude, distance_km, speed_kmh, evasion_action, detected_at
        ))
        conn.commit()
    except Exception as e:
        print(f"❌ [Database] SQLite hazard save failed: {e}")
    finally:
        conn.close()

    # 2. MongoDB GeoJSON storage
    if is_mongodb_active():
        try:
            mongo_hazard = {
                "hazard_id": hazard_id,
                "session_id": session_id,
                "hazard_type": hazard_type,
                "severity": severity,
                "location": {
                    "type": "Point",
                    "coordinates": [longitude, latitude]  # GeoJSON standard: [lng, lat]
                },
                "distance_km": distance_km,
                "speed_kmh": speed_kmh,
                "evasion_action": evasion_action,
                "detected_at": detected_at,
                "created_at": datetime.datetime.utcnow()
            }
            _mongo_db.hazards.update_one(
                {"hazard_id": hazard_id},
                {"$set": mongo_hazard},
                upsert=True
            )
        except Exception as e:
            print(f"⚠️ [Database] MongoDB hazard save note: {e}")

    return True


def get_road_hazards(
    limit: int = 50,
    near_lat: Optional[float] = None,
    near_lng: Optional[float] = None,
    max_distance_meters: float = 5000.0
) -> List[Dict[str, Any]]:
    """
    Returns road hazards.
    If MongoDB is active and coordinates are provided, executes a 2dsphere $near query.
    Otherwise returns latest detected hazards.
    """
    if is_mongodb_active():
        try:
            query: Dict[str, Any] = {}
            if near_lat is not None and near_lng is not None:
                query["location"] = {
                    "$near": {
                        "$geometry": {
                            "type": "Point",
                            "coordinates": [float(near_lng), float(near_lat)]
                        },
                        "$maxDistance": float(max_distance_meters)
                    }
                }
            cursor = _mongo_db.hazards.find(query, {"_id": 0}).limit(limit)
            hazards = []
            for doc in cursor:
                if isinstance(doc.get("created_at"), datetime.datetime):
                    doc["created_at"] = doc["created_at"].isoformat()
                # Expose flat coordinates for easy UI plotting
                if "location" in doc and "coordinates" in doc["location"]:
                    doc["longitude"] = doc["location"]["coordinates"][0]
                    doc["latitude"] = doc["location"]["coordinates"][1]
                hazards.append(doc)
            return hazards
        except Exception as e:
            print(f"⚠️ [Database] MongoDB hazard query note: {e}")

    # Fallback SQLite query
    conn = get_sqlite_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT hazard_id, session_id, hazard_type, severity,
               latitude, longitude, distance_km, speed_kmh, evasion_action, detected_at
        FROM road_hazards
        ORDER BY detected_at DESC
        LIMIT ?
    """, (limit,))
    rows = cursor.fetchall()
    hazards = [dict(row) for row in rows]
    conn.close()
    return hazards


# ==============================================================================
# Database Status Inspection
# ==============================================================================

def get_database_status() -> Dict[str, Any]:
    """Returns real-time status of both MongoDB and SQLite engines."""
    # Count SQLite sessions & hazards
    sqlite_sessions = 0
    sqlite_hazards = 0
    try:
        conn = get_sqlite_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM sessions")
        sqlite_sessions = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM road_hazards")
        sqlite_hazards = cursor.fetchone()[0]
        conn.close()
    except Exception:
        pass

    mongo_sessions = 0
    mongo_hazards = 0
    if is_mongodb_active():
        try:
            mongo_sessions = _mongo_db.sessions.count_documents({})
            mongo_hazards = _mongo_db.hazards.count_documents({})
        except Exception:
            pass

    return {
        "active_engine": "MongoDB (Atlas/Cluster)" if is_mongodb_active() else "SQLite (Local Auto-Fallback)",
        "mongodb_connected": is_mongodb_active(),
        "mongodb_driver_installed": PYMONGO_AVAILABLE,
        "mongodb_error": _mongo_error,
        "sqlite_available": True,
        "sqlite_path": str(DB_PATH),
        "counts": {
            "sessions": mongo_sessions if is_mongodb_active() else sqlite_sessions,
            "hazards": mongo_hazards if is_mongodb_active() else sqlite_hazards,
            "sqlite_sessions": sqlite_sessions,
            "sqlite_hazards": sqlite_hazards
        }
    }


# Auto-initialize both engines on module import
init_sqlite_db()
init_mongodb()
