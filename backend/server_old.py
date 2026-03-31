from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timedelta
from passlib.context import CryptContext
import jwt
from bson import ObjectId
import base64

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()
SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "zinli-recharge-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# Create the main app
app = FastAPI(title="Zinli Recharge API")
api_router = APIRouter(prefix="/api")

# Helper functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
        
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Could not validate credentials")

async def get_current_admin(current_user: dict = Depends(get_current_user)):
    if not current_user.get("is_admin", False):
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

# Models
class UserRegister(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    is_admin: bool
    balance: float
    created_at: datetime

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

class OrderCreate(BaseModel):
    order_type: str  # "zinli_recharge" or "gift_card"
    zinli_amount: Optional[float] = None
    zinli_email: Optional[str] = None  # Required for zinli_recharge
    gift_card_id: Optional[str] = None  # Required for gift_card
    gift_card_amount: Optional[float] = None  # For gift_card
    payment_method: str
    reference_number: str
    payment_proof_image: str  # base64

class OrderResponse(BaseModel):
    id: str
    user_id: str
    user_email: str
    user_name: str
    zinli_amount: float
    total_cost: float
    payment_method: str
    reference_number: str
    payment_proof_image: str
    status: str
    created_at: datetime
    updated_at: datetime

class OrderStatusUpdate(BaseModel):
    status: str
    admin_note: Optional[str] = None

class BannerCreate(BaseModel):
    image_base64: str
    link: Optional[str] = None
    order: int = 0

class BannerResponse(BaseModel):
    id: str
    image_base64: str
    link: Optional[str]
    order: int
    is_active: bool
    created_at: datetime

class SystemConfigResponse(BaseModel):
    exchange_rate: float
    commission_percent: float
    bank_details: dict

class SystemConfigUpdate(BaseModel):
    exchange_rate: Optional[float] = None
    commission_percent: Optional[float] = None
    bank_details: Optional[dict] = None

# Initialize default system config
async def init_system_config():
    config = await db.system_config.find_one({"key": "app_config"})
    if not config:
        default_config = {
            "key": "app_config",
            "exchange_rate": 50.0,  # 1 USD = 50 VES
            "commission_percent": 3.0,
            "bank_details": {
                "pago_movil": {
                    "bank": "Banco de Venezuela",
                    "phone": "0414-1234567",
                    "id": "V-12345678",
                    "name": "Zinli Recargas C.A."
                },
                "transferencia": {
                    "bank": "Banco Mercantil",
                    "account_type": "Corriente",
                    "account_number": "0105-0123-45-1234567890",
                    "id": "J-12345678-9",
                    "name": "Zinli Recargas C.A."
                },
                "binance_pay": {
                    "email": "zinli.recargas@gmail.com",
                    "user_id": "123456789"
                },
                "paypal": {
                    "email": "payments@zinli-recargas.com"
                }
            },
            "created_at": datetime.utcnow()
        }
        await db.system_config.insert_one(default_config)

# Auth Routes
@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserRegister):
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Check if this is the first user (make them admin)
    user_count = await db.users.count_documents({})
    is_admin = user_count == 0 or user_data.email == "admin@zinli.com"
    
    # Create user
    user_dict = {
        "email": user_data.email,
        "password_hash": get_password_hash(user_data.password),
        "name": user_data.name,
        "is_admin": is_admin,
        "balance": 0.0,
        "created_at": datetime.utcnow()
    }
    
    result = await db.users.insert_one(user_dict)
    user_dict["_id"] = result.inserted_id
    
    # Create token
    access_token = create_access_token(data={"sub": str(result.inserted_id)})
    
    user_response = UserResponse(
        id=str(user_dict["_id"]),
        email=user_dict["email"],
        name=user_dict["name"],
        is_admin=user_dict["is_admin"],
        balance=user_dict["balance"],
        created_at=user_dict["created_at"]
    )
    
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=user_response
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(user_data: UserLogin):
    user = await db.users.find_one({"email": user_data.email})
    if not user or not verify_password(user_data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    
    access_token = create_access_token(data={"sub": str(user["_id"])})
    
    user_response = UserResponse(
        id=str(user["_id"]),
        email=user["email"],
        name=user["name"],
        is_admin=user.get("is_admin", False),
        balance=user.get("balance", 0.0),
        created_at=user["created_at"]
    )
    
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=user_response
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(
        id=str(current_user["_id"]),
        email=current_user["email"],
        name=current_user["name"],
        is_admin=current_user.get("is_admin", False),
        balance=current_user.get("balance", 0.0),
        created_at=current_user["created_at"]
    )

# Order Routes
@api_router.post("/orders", response_model=OrderResponse)
async def create_order(order_data: OrderCreate, current_user: dict = Depends(get_current_user)):
    # Get system config for calculation
    config = await db.system_config.find_one({"key": "app_config"})
    exchange_rate = config["exchange_rate"]
    commission = config["commission_percent"]
    
    # Calculate total cost
    base_cost = order_data.zinli_amount * exchange_rate
    total_cost = base_cost + (base_cost * commission / 100)
    
    order_dict = {
        "user_id": str(current_user["_id"]),
        "user_email": current_user["email"],
        "user_name": current_user["name"],
        "zinli_amount": order_data.zinli_amount,
        "total_cost": round(total_cost, 2),
        "payment_method": order_data.payment_method,
        "reference_number": order_data.reference_number,
        "payment_proof_image": order_data.payment_proof_image,
        "status": "pending",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    result = await db.orders.insert_one(order_dict)
    order_dict["_id"] = result.inserted_id
    
    return OrderResponse(
        id=str(order_dict["_id"]),
        user_id=order_dict["user_id"],
        user_email=order_dict["user_email"],
        user_name=order_dict["user_name"],
        zinli_amount=order_dict["zinli_amount"],
        total_cost=order_dict["total_cost"],
        payment_method=order_dict["payment_method"],
        reference_number=order_dict["reference_number"],
        payment_proof_image=order_dict["payment_proof_image"],
        status=order_dict["status"],
        created_at=order_dict["created_at"],
        updated_at=order_dict["updated_at"]
    )

@api_router.get("/orders", response_model=List[OrderResponse])
async def get_my_orders(current_user: dict = Depends(get_current_user)):
    orders = await db.orders.find({"user_id": str(current_user["_id"])}).sort("created_at", -1).to_list(1000)
    
    return [
        OrderResponse(
            id=str(order["_id"]),
            user_id=order["user_id"],
            user_email=order["user_email"],
            user_name=order["user_name"],
            zinli_amount=order["zinli_amount"],
            total_cost=order["total_cost"],
            payment_method=order["payment_method"],
            reference_number=order["reference_number"],
            payment_proof_image=order["payment_proof_image"],
            status=order["status"],
            created_at=order["created_at"],
            updated_at=order["updated_at"]
        )
        for order in orders
    ]

@api_router.get("/orders/{order_id}", response_model=OrderResponse)
async def get_order(order_id: str, current_user: dict = Depends(get_current_user)):
    try:
        order = await db.orders.find_one({"_id": ObjectId(order_id)})
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        
        # Check if user owns this order or is admin
        if order["user_id"] != str(current_user["_id"]) and not current_user.get("is_admin", False):
            raise HTTPException(status_code=403, detail="Access denied")
        
        return OrderResponse(
            id=str(order["_id"]),
            user_id=order["user_id"],
            user_email=order["user_email"],
            user_name=order["user_name"],
            zinli_amount=order["zinli_amount"],
            total_cost=order["total_cost"],
            payment_method=order["payment_method"],
            reference_number=order["reference_number"],
            payment_proof_image=order["payment_proof_image"],
            status=order["status"],
            created_at=order["created_at"],
            updated_at=order["updated_at"]
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# Admin Order Routes
@api_router.get("/admin/orders", response_model=List[OrderResponse])
async def get_all_orders(current_user: dict = Depends(get_current_admin)):
    orders = await db.orders.find().sort("created_at", -1).to_list(1000)
    
    return [
        OrderResponse(
            id=str(order["_id"]),
            user_id=order["user_id"],
            user_email=order["user_email"],
            user_name=order["user_name"],
            zinli_amount=order["zinli_amount"],
            total_cost=order["total_cost"],
            payment_method=order["payment_method"],
            reference_number=order["reference_number"],
            payment_proof_image=order["payment_proof_image"],
            status=order["status"],
            created_at=order["created_at"],
            updated_at=order["updated_at"]
        )
        for order in orders
    ]

@api_router.patch("/admin/orders/{order_id}", response_model=OrderResponse)
async def update_order_status(order_id: str, update_data: OrderStatusUpdate, current_user: dict = Depends(get_current_admin)):
    try:
        order = await db.orders.find_one({"_id": ObjectId(order_id)})
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        
        update_dict = {
            "status": update_data.status,
            "updated_at": datetime.utcnow()
        }
        
        if update_data.admin_note:
            update_dict["admin_note"] = update_data.admin_note
        
        await db.orders.update_one(
            {"_id": ObjectId(order_id)},
            {"$set": update_dict}
        )
        
        # TODO: Send push notification to user
        
        updated_order = await db.orders.find_one({"_id": ObjectId(order_id)})
        
        return OrderResponse(
            id=str(updated_order["_id"]),
            user_id=updated_order["user_id"],
            user_email=updated_order["user_email"],
            user_name=updated_order["user_name"],
            zinli_amount=updated_order["zinli_amount"],
            total_cost=updated_order["total_cost"],
            payment_method=updated_order["payment_method"],
            reference_number=updated_order["reference_number"],
            payment_proof_image=updated_order["payment_proof_image"],
            status=updated_order["status"],
            created_at=updated_order["created_at"],
            updated_at=updated_order["updated_at"]
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# Banner Routes
@api_router.get("/banners", response_model=List[BannerResponse])
async def get_banners():
    banners = await db.banners.find({"is_active": True}).sort("order", 1).to_list(100)
    
    return [
        BannerResponse(
            id=str(banner["_id"]),
            image_base64=banner["image_base64"],
            link=banner.get("link"),
            order=banner["order"],
            is_active=banner["is_active"],
            created_at=banner["created_at"]
        )
        for banner in banners
    ]

@api_router.post("/admin/banners", response_model=BannerResponse)
async def create_banner(banner_data: BannerCreate, current_user: dict = Depends(get_current_admin)):
    banner_dict = {
        "image_base64": banner_data.image_base64,
        "link": banner_data.link,
        "order": banner_data.order,
        "is_active": True,
        "created_at": datetime.utcnow()
    }
    
    result = await db.banners.insert_one(banner_dict)
    banner_dict["_id"] = result.inserted_id
    
    return BannerResponse(
        id=str(banner_dict["_id"]),
        image_base64=banner_dict["image_base64"],
        link=banner_dict["link"],
        order=banner_dict["order"],
        is_active=banner_dict["is_active"],
        created_at=banner_dict["created_at"]
    )

@api_router.delete("/admin/banners/{banner_id}")
async def delete_banner(banner_id: str, current_user: dict = Depends(get_current_admin)):
    try:
        result = await db.banners.delete_one({"_id": ObjectId(banner_id)})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Banner not found")
        return {"message": "Banner deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# System Config Routes
@api_router.get("/config", response_model=SystemConfigResponse)
async def get_system_config():
    config = await db.system_config.find_one({"key": "app_config"})
    if not config:
        await init_system_config()
        config = await db.system_config.find_one({"key": "app_config"})
    
    return SystemConfigResponse(
        exchange_rate=config["exchange_rate"],
        commission_percent=config["commission_percent"],
        bank_details=config["bank_details"]
    )

@api_router.patch("/admin/config", response_model=SystemConfigResponse)
async def update_system_config(config_data: SystemConfigUpdate, current_user: dict = Depends(get_current_admin)):
    update_dict = {}
    
    if config_data.exchange_rate is not None:
        update_dict["exchange_rate"] = config_data.exchange_rate
    
    if config_data.commission_percent is not None:
        update_dict["commission_percent"] = config_data.commission_percent
    
    if config_data.bank_details is not None:
        update_dict["bank_details"] = config_data.bank_details
    
    if update_dict:
        await db.system_config.update_one(
            {"key": "app_config"},
            {"$set": update_dict}
        )
    
    config = await db.system_config.find_one({"key": "app_config"})
    
    return SystemConfigResponse(
        exchange_rate=config["exchange_rate"],
        commission_percent=config["commission_percent"],
        bank_details=config["bank_details"]
    )

# Include router
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

@app.on_event("startup")
async def startup_db():
    await init_system_config()
    logger.info("Database initialized")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
