from fastapi import FastAPI, APIRouter, HTTPException, Header
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, validator
from typing import List, Optional
import uuid
from datetime import datetime
import hashlib
import httpx

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Admin password
ADMIN_PASSWORD = "admin0011na_14g"

# Expo Push API URL
EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

# Helper function to hash passwords
def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

# Send push notification via Expo
async def send_push_notification(push_token: str, title: str, body: str, data: dict = None):
    """Send push notification using Expo Push API"""
    if not push_token or not push_token.startswith('ExponentPushToken'):
        return False
    
    try:
        message = {
            "to": push_token,
            "sound": "default",
            "title": title,
            "body": body,
            "data": data or {},
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                EXPO_PUSH_URL,
                json=message,
                headers={
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                }
            )
            return response.status_code == 200
    except Exception as e:
        logging.error(f"Push notification error: {e}")
        return False

# Point in polygon algorithm
def point_in_polygon(point: dict, polygon: List[dict]) -> bool:
    """Ray casting algorithm to check if point is inside polygon"""
    x, y = point['lat'], point['lng']
    n = len(polygon)
    inside = False
    
    j = n - 1
    for i in range(n):
        xi, yi = polygon[i]['lat'], polygon[i]['lng']
        xj, yj = polygon[j]['lat'], polygon[j]['lng']
        
        if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi) + xi):
            inside = not inside
        j = i
    
    return inside

# Models
class UserCreate(BaseModel):
    phone: str
    name: str
    password: str
    
    @validator('phone')
    def validate_phone(cls, v):
        if not v.startswith('+998'):
            raise ValueError('Phone number must start with +998')
        if len(v) != 13:
            raise ValueError('Phone number must be exactly 13 characters (+998 + 9 digits)')
        if not v[1:].isdigit():
            raise ValueError('Phone number must contain only digits after +')
        return v

class UserLogin(BaseModel):
    phone: str
    password: str

class UserUpdate(BaseModel):
    name: Optional[str] = None
    avatar: Optional[str] = None
    push_token: Optional[str] = None

class PasswordChange(BaseModel):
    old_password: str
    new_password: str

class UserResponse(BaseModel):
    id: str
    phone: str
    name: str
    avatar: Optional[str] = None
    total_distance: float = 0.0
    color: Optional[str] = None
    push_token: Optional[str] = None
    created_at: datetime

class RunCreate(BaseModel):
    coordinates: List[dict]
    distance: float
    duration: int

class RunResponse(BaseModel):
    id: str
    user_id: str
    user_name: str
    user_phone: str
    user_avatar: Optional[str] = None
    coordinates: List[dict]
    distance: float
    duration: int
    created_at: datetime

class TerritoryCreate(BaseModel):
    polygon: List[dict]  # [{lat, lng}] - closed polygon
    run_id: Optional[str] = None

class TerritoryResponse(BaseModel):
    id: str
    owner_id: str
    owner_name: str
    owner_phone: str
    owner_avatar: Optional[str] = None
    owner_color: str
    polygon: List[dict]
    area: float  # in square meters
    created_at: datetime
    updated_at: datetime

class InvasionCheck(BaseModel):
    lat: float
    lng: float
    user_id: str

class InvasionResponse(BaseModel):
    invaded: bool
    territory_id: Optional[str] = None
    old_owner_id: Optional[str] = None
    old_owner_name: Optional[str] = None
    old_owner_phone: Optional[str] = None
    old_owner_push_token: Optional[str] = None
    new_owner_id: Optional[str] = None
    new_owner_name: Optional[str] = None

class InvasionHistoryResponse(BaseModel):
    id: str
    territory_id: str
    old_owner_id: str
    old_owner_name: str
    new_owner_id: str
    new_owner_name: str
    invasion_point: dict
    timestamp: datetime

class LeaderboardEntry(BaseModel):
    id: str
    name: str
    phone: str
    avatar: Optional[str] = None
    total_distance: float
    territory_count: int = 0
    rank: int

class AdminAuth(BaseModel):
    password: str

class AdminUserResponse(BaseModel):
    id: str
    phone: str
    name: str
    avatar: Optional[str] = None
    total_distance: float
    territory_count: int = 0
    rank: int
    created_at: datetime

# Generate unique color for user
def generate_user_color(user_id: str) -> str:
    colors = [
        '#4a90d9', '#4ade80', '#f59e0b', '#ef4444', '#8b5cf6',
        '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
        '#14b8a6', '#a855f7', '#eab308', '#22c55e', '#3b82f6'
    ]
    # Use hash to get consistent color for same user
    hash_val = int(hashlib.md5(user_id.encode()).hexdigest(), 16)
    return colors[hash_val % len(colors)]

# Calculate polygon area using Shoelace formula
def calculate_polygon_area(polygon: List[dict]) -> float:
    """Calculate area in square meters using Shoelace formula with lat/lng approximation"""
    n = len(polygon)
    if n < 3:
        return 0.0
    
    # Approximate meters per degree at equator
    lat_to_m = 111320
    lng_to_m = 111320
    
    area = 0.0
    j = n - 1
    for i in range(n):
        xi = polygon[i]['lng'] * lng_to_m
        yi = polygon[i]['lat'] * lat_to_m
        xj = polygon[j]['lng'] * lng_to_m
        yj = polygon[j]['lat'] * lat_to_m
        area += (xj + xi) * (yj - yi)
        j = i
    
    return abs(area / 2.0)

# Routes
@api_router.get("/")
async def root():
    return {"message": "Yugur API is running"}

@api_router.post("/auth/register", response_model=UserResponse)
async def register(user: UserCreate):
    existing_user = await db.users.find_one({"phone": user.phone})
    if existing_user:
        raise HTTPException(status_code=400, detail="Phone number already registered")
    
    user_id = str(uuid.uuid4())
    user_dict = {
        "id": user_id,
        "phone": user.phone,
        "name": user.name,
        "password": hash_password(user.password),
        "avatar": None,
        "total_distance": 0.0,
        "color": generate_user_color(user_id),
        "push_token": None,
        "created_at": datetime.utcnow()
    }
    
    await db.users.insert_one(user_dict)
    
    return UserResponse(
        id=user_dict["id"],
        phone=user_dict["phone"],
        name=user_dict["name"],
        avatar=user_dict["avatar"],
        total_distance=user_dict["total_distance"],
        color=user_dict["color"],
        push_token=user_dict["push_token"],
        created_at=user_dict["created_at"]
    )

@api_router.post("/auth/login", response_model=UserResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"phone": credentials.phone})
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid phone number or password")
    
    if user["password"] != hash_password(credentials.password):
        raise HTTPException(status_code=401, detail="Invalid phone number or password")
    
    return UserResponse(
        id=user["id"],
        phone=user["phone"],
        name=user["name"],
        avatar=user.get("avatar"),
        total_distance=user.get("total_distance", 0.0),
        color=user.get("color"),
        push_token=user.get("push_token"),
        created_at=user["created_at"]
    )

@api_router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(user_id: str):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return UserResponse(
        id=user["id"],
        phone=user["phone"],
        name=user["name"],
        avatar=user.get("avatar"),
        total_distance=user.get("total_distance", 0.0),
        color=user.get("color"),
        push_token=user.get("push_token"),
        created_at=user["created_at"]
    )

@api_router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(user_id: str, update: UserUpdate):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    update_dict = {}
    if update.name is not None:
        update_dict["name"] = update.name
    if update.avatar is not None:
        update_dict["avatar"] = update.avatar
    if update.push_token is not None:
        update_dict["push_token"] = update.push_token
    
    if update_dict:
        await db.users.update_one({"id": user_id}, {"$set": update_dict})
        
        # Also update in runs and territories
        if update.avatar is not None:
            await db.runs.update_many({"user_id": user_id}, {"$set": {"user_avatar": update.avatar}})
            await db.territories.update_many({"owner_id": user_id}, {"$set": {"owner_avatar": update.avatar}})
        if update.name is not None:
            await db.runs.update_many({"user_id": user_id}, {"$set": {"user_name": update.name}})
            await db.territories.update_many({"owner_id": user_id}, {"$set": {"owner_name": update.name}})
    
    updated_user = await db.users.find_one({"id": user_id})
    
    return UserResponse(
        id=updated_user["id"],
        phone=updated_user["phone"],
        name=updated_user["name"],
        avatar=updated_user.get("avatar"),
        total_distance=updated_user.get("total_distance", 0.0),
        color=updated_user.get("color"),
        push_token=updated_user.get("push_token"),
        created_at=updated_user["created_at"]
    )

@api_router.post("/users/{user_id}/change-password")
async def change_password(user_id: str, password_data: PasswordChange):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user["password"] != hash_password(password_data.old_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"password": hash_password(password_data.new_password)}}
    )
    
    return {"message": "Password changed successfully"}

@api_router.post("/runs", response_model=RunResponse)
async def create_run(run: RunCreate, user_id: str = Header(..., alias="X-User-Id")):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    run_dict = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "user_name": user["name"],
        "user_phone": user["phone"],
        "user_avatar": user.get("avatar"),
        "coordinates": run.coordinates,
        "distance": run.distance,
        "duration": run.duration,
        "created_at": datetime.utcnow()
    }
    
    await db.runs.insert_one(run_dict)
    
    # Update user's total distance
    new_total = user.get("total_distance", 0.0) + run.distance
    await db.users.update_one({"id": user_id}, {"$set": {"total_distance": new_total}})
    
    return RunResponse(**run_dict)

@api_router.get("/runs", response_model=List[RunResponse])
async def get_all_runs():
    runs = await db.runs.find().sort("created_at", -1).to_list(1000)
    return [RunResponse(**run) for run in runs]

@api_router.get("/runs/user/{user_id}", response_model=List[RunResponse])
async def get_user_runs(user_id: str):
    runs = await db.runs.find({"user_id": user_id}).sort("created_at", -1).to_list(1000)
    return [RunResponse(**run) for run in runs]

# Territory endpoints
@api_router.post("/territories", response_model=TerritoryResponse)
async def create_territory(territory: TerritoryCreate, user_id: str = Header(..., alias="X-User-Id")):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if len(territory.polygon) < 3:
        raise HTTPException(status_code=400, detail="Polygon must have at least 3 points")
    
    # Ensure polygon is closed
    polygon = territory.polygon.copy()
    if polygon[0] != polygon[-1]:
        polygon.append(polygon[0])
    
    territory_dict = {
        "id": str(uuid.uuid4()),
        "owner_id": user_id,
        "owner_name": user["name"],
        "owner_phone": user["phone"],
        "owner_avatar": user.get("avatar"),
        "owner_color": user.get("color", generate_user_color(user_id)),
        "polygon": polygon,
        "area": calculate_polygon_area(polygon),
        "run_id": territory.run_id,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await db.territories.insert_one(territory_dict)
    
    return TerritoryResponse(**territory_dict)

@api_router.get("/territories", response_model=List[TerritoryResponse])
async def get_all_territories():
    territories = await db.territories.find().sort("created_at", -1).to_list(1000)
    return [TerritoryResponse(**t) for t in territories]

@api_router.get("/territories/user/{user_id}", response_model=List[TerritoryResponse])
async def get_user_territories(user_id: str):
    territories = await db.territories.find({"owner_id": user_id}).sort("created_at", -1).to_list(1000)
    return [TerritoryResponse(**t) for t in territories]

@api_router.post("/territories/check-invasion", response_model=InvasionResponse)
async def check_invasion(data: InvasionCheck):
    """Check if a GPS point invades any territory not owned by the user"""
    user = await db.users.find_one({"id": data.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    point = {"lat": data.lat, "lng": data.lng}
    
    # Find all territories not owned by this user
    territories = await db.territories.find({"owner_id": {"$ne": data.user_id}}).to_list(1000)
    
    for territory in territories:
        if point_in_polygon(point, territory["polygon"]):
            # Found invasion!
            old_owner = await db.users.find_one({"id": territory["owner_id"]})
            
            # Record invasion history
            invasion_history = {
                "id": str(uuid.uuid4()),
                "territory_id": territory["id"],
                "old_owner_id": territory["owner_id"],
                "old_owner_name": territory["owner_name"],
                "new_owner_id": data.user_id,
                "new_owner_name": user["name"],
                "invasion_point": point,
                "timestamp": datetime.utcnow()
            }
            await db.invasion_history.insert_one(invasion_history)
            
            # Transfer territory ownership
            await db.territories.update_one(
                {"id": territory["id"]},
                {"$set": {
                    "owner_id": data.user_id,
                    "owner_name": user["name"],
                    "owner_phone": user["phone"],
                    "owner_avatar": user.get("avatar"),
                    "owner_color": user.get("color", generate_user_color(data.user_id)),
                    "updated_at": datetime.utcnow()
                }}
            )
            
            return InvasionResponse(
                invaded=True,
                territory_id=territory["id"],
                old_owner_id=territory["owner_id"],
                old_owner_name=territory["owner_name"],
                old_owner_phone=territory.get("owner_phone"),
                old_owner_push_token=old_owner.get("push_token") if old_owner else None,
                new_owner_id=data.user_id,
                new_owner_name=user["name"]
            )
    
    return InvasionResponse(invaded=False)

@api_router.get("/invasion-history", response_model=List[InvasionHistoryResponse])
async def get_invasion_history():
    history = await db.invasion_history.find().sort("timestamp", -1).to_list(1000)
    return [InvasionHistoryResponse(**h) for h in history]

@api_router.get("/invasion-history/territory/{territory_id}", response_model=List[InvasionHistoryResponse])
async def get_territory_invasion_history(territory_id: str):
    history = await db.invasion_history.find({"territory_id": territory_id}).sort("timestamp", -1).to_list(100)
    return [InvasionHistoryResponse(**h) for h in history]

@api_router.get("/leaderboard", response_model=List[LeaderboardEntry])
async def get_leaderboard():
    users = await db.users.find().sort("total_distance", -1).to_list(1000)
    
    leaderboard = []
    for i, user in enumerate(users):
        # Count territories owned by user
        territory_count = await db.territories.count_documents({"owner_id": user["id"]})
        
        leaderboard.append(LeaderboardEntry(
            id=user["id"],
            name=user["name"],
            phone=user["phone"],
            avatar=user.get("avatar"),
            total_distance=user.get("total_distance", 0.0),
            territory_count=territory_count,
            rank=i + 1
        ))
    
    return leaderboard

@api_router.post("/admin/verify")
async def verify_admin(auth: AdminAuth):
    if auth.password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid admin password")
    return {"success": True, "message": "Admin access granted"}

@api_router.get("/admin/users", response_model=List[AdminUserResponse])
async def get_all_users(admin_password: str = Header(..., alias="X-Admin-Password")):
    if admin_password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid admin password")
    
    users = await db.users.find().sort("total_distance", -1).to_list(1000)
    
    result = []
    for i, user in enumerate(users):
        territory_count = await db.territories.count_documents({"owner_id": user["id"]})
        
        result.append(AdminUserResponse(
            id=user["id"],
            phone=user["phone"],
            name=user["name"],
            avatar=user.get("avatar"),
            total_distance=user.get("total_distance", 0.0),
            territory_count=territory_count,
            rank=i + 1,
            created_at=user["created_at"]
        ))
    
    return result

@api_router.get("/admin/invasion-history", response_model=List[InvasionHistoryResponse])
async def admin_get_invasion_history(admin_password: str = Header(..., alias="X-Admin-Password")):
    if admin_password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid admin password")
    
    history = await db.invasion_history.find().sort("timestamp", -1).to_list(1000)
    return [InvasionHistoryResponse(**h) for h in history]

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
