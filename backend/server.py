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
import base64

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

# Helper function to hash passwords
def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

# Models
class UserCreate(BaseModel):
    phone: str
    name: str
    password: str
    
    @validator('phone')
    def validate_phone(cls, v):
        if not v.startswith('+998'):
            raise ValueError('Phone number must start with +998')
        if len(v) != 13:  # +998 + 9 digits
            raise ValueError('Phone number must be exactly 13 characters (+998 + 9 digits)')
        if not v[1:].isdigit():
            raise ValueError('Phone number must contain only digits after +')
        return v

class UserLogin(BaseModel):
    phone: str
    password: str

class UserUpdate(BaseModel):
    name: Optional[str] = None
    avatar: Optional[str] = None  # Base64 encoded image

class PasswordChange(BaseModel):
    old_password: str
    new_password: str

class UserResponse(BaseModel):
    id: str
    phone: str
    name: str
    avatar: Optional[str] = None
    total_distance: float = 0.0
    created_at: datetime

class RunCreate(BaseModel):
    coordinates: List[dict]  # [{lat, lng}]
    distance: float  # in meters
    duration: int  # in seconds

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

class LeaderboardEntry(BaseModel):
    id: str
    name: str
    phone: str
    avatar: Optional[str] = None
    total_distance: float
    rank: int

class AdminAuth(BaseModel):
    password: str

class AdminUserResponse(BaseModel):
    id: str
    phone: str
    name: str
    avatar: Optional[str] = None
    total_distance: float
    rank: int
    created_at: datetime

# Routes
@api_router.get("/")
async def root():
    return {"message": "Yugur API is running"}

@api_router.post("/auth/register", response_model=UserResponse)
async def register(user: UserCreate):
    # Check if phone already exists
    existing_user = await db.users.find_one({"phone": user.phone})
    if existing_user:
        raise HTTPException(status_code=400, detail="Phone number already registered")
    
    # Create user
    user_dict = {
        "id": str(uuid.uuid4()),
        "phone": user.phone,
        "name": user.name,
        "password": hash_password(user.password),
        "avatar": None,
        "total_distance": 0.0,
        "created_at": datetime.utcnow()
    }
    
    await db.users.insert_one(user_dict)
    
    return UserResponse(
        id=user_dict["id"],
        phone=user_dict["phone"],
        name=user_dict["name"],
        avatar=user_dict["avatar"],
        total_distance=user_dict["total_distance"],
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
    
    if update_dict:
        await db.users.update_one({"id": user_id}, {"$set": update_dict})
        
        # Also update avatar in runs
        if update.avatar is not None:
            await db.runs.update_many({"user_id": user_id}, {"$set": {"user_avatar": update.avatar}})
        if update.name is not None:
            await db.runs.update_many({"user_id": user_id}, {"$set": {"user_name": update.name}})
    
    updated_user = await db.users.find_one({"id": user_id})
    
    return UserResponse(
        id=updated_user["id"],
        phone=updated_user["phone"],
        name=updated_user["name"],
        avatar=updated_user.get("avatar"),
        total_distance=updated_user.get("total_distance", 0.0),
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

@api_router.get("/leaderboard", response_model=List[LeaderboardEntry])
async def get_leaderboard():
    users = await db.users.find().sort("total_distance", -1).to_list(1000)
    
    leaderboard = []
    for i, user in enumerate(users):
        leaderboard.append(LeaderboardEntry(
            id=user["id"],
            name=user["name"],
            phone=user["phone"],
            avatar=user.get("avatar"),
            total_distance=user.get("total_distance", 0.0),
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
        result.append(AdminUserResponse(
            id=user["id"],
            phone=user["phone"],
            name=user["name"],
            avatar=user.get("avatar"),
            total_distance=user.get("total_distance", 0.0),
            rank=i + 1,
            created_at=user["created_at"]
        ))
    
    return result

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
