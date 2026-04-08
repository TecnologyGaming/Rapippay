from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timedelta
from passlib.context import CryptContext
import jwt
from bson import ObjectId
import base64
import httpx
import json
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
import hashlib

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
ADMIN_SECRET = "zinli-admin-2024"  # Simple admin authentication

# Create the main app
app = FastAPI(title="Zinli Recharge & Gift Cards API")
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
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Could not validate credentials")

async def get_current_admin(current_user: dict = Depends(get_current_user)):
    if not current_user.get("is_admin", False):
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

async def verify_admin_secret(x_admin_secret: str = Header(None)):
    """Verify admin secret from header for simple admin authentication"""
    if x_admin_secret != ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Invalid admin credentials")
    return True

# ===== MODELS =====

# User Models
class UserRegister(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    phone_number: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    first_name: str
    last_name: str
    phone_number: str
    is_admin: bool
    balance: float
    created_at: datetime

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

# Gift Card Models
class GiftCardResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = ""
    image_base64: Optional[str] = None
    amounts: List[float]
    is_active: bool = True
    created_at: Optional[datetime] = None

# Order Models
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
    order_type: str
    zinli_amount: Optional[float]
    zinli_email: Optional[str]
    gift_card_id: Optional[str]
    gift_card_name: Optional[str]
    gift_card_amount: Optional[float]
    total_cost: float
    payment_method: str
    reference_number: str
    payment_proof_image: str
    status: str  # "pending", "completed", "rejected"
    delivery_status: Optional[str]  # "pending", "processing", "delivered" (for gift cards)
    gift_card_qr_image: Optional[str]  # base64 QR image uploaded by admin
    gift_card_code: Optional[str]  # alphanumeric code uploaded by admin
    created_at: datetime
    updated_at: datetime

class OrderStatusUpdate(BaseModel):
    status: str
    admin_note: Optional[str] = None

class GiftCardDelivery(BaseModel):
    gift_card_qr_image: str  # base64
    gift_card_code: str

# Banner Models
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

# System Config Models
class SystemConfigResponse(BaseModel):
    exchange_rate: float
    commission_percent: float
    bank_details: dict
    logo_base64: Optional[str] = None
    favicon_base64: Optional[str] = None
    contact_info: Optional[dict] = None
    social_networks: Optional[List[dict]] = None
    payment_methods: Optional[List[dict]] = None
    ubii_config: Optional[dict] = None

class SystemConfigUpdate(BaseModel):
    exchange_rate: Optional[float] = None
    commission_percent: Optional[float] = None
    bank_details: Optional[dict] = None

class BrandingUpdate(BaseModel):
    logo_base64: Optional[str] = None
    favicon_base64: Optional[str] = None

class ContactInfoUpdate(BaseModel):
    phone: Optional[str] = None
    email: Optional[str] = None
    whatsapp: Optional[str] = None

class SocialNetworkItem(BaseModel):
    id: Optional[str] = None
    platform: str  # instagram, facebook, twitter, tiktok, youtube, etc.
    url: str
    is_active: bool = True

class PaymentMethodItem(BaseModel):
    id: Optional[str] = None
    name: str
    logo_base64: Optional[str] = None
    fields: dict  # Dynamic fields like {bank: "", account: "", email: ""}
    is_active: bool = True

# Gift Card Models
class GiftCardCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    image_base64: Optional[str] = None
    amounts: List[float]
    is_active: bool = True

class GiftCardUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    image_base64: Optional[str] = None
    amounts: Optional[List[float]] = None
    is_active: Optional[bool] = None

# Push Notification Models
class PushTokenRegister(BaseModel):
    token: str
    user_id: Optional[str] = None

class PushNotificationSend(BaseModel):
    title: str
    body: str
    target: str = "all"  # "all", "user_id", or list of user_ids
    user_ids: Optional[List[str]] = None
    data: Optional[dict] = None

# Ubii Pago Models
class UbiiConfigUpdate(BaseModel):
    client_id: str
    client_domain: str
    is_active: bool = True

class UbiiPaymentRequest(BaseModel):
    order_id: str
    card_number: str
    expiry_date: str  # MM-YY format
    cvv: str
    cedula: str  # Format: V12345678 or E12345678
    amount: float
    currency: str = "VES"  # VES or USD

# ===== INITIALIZE DEFAULT DATA =====

async def init_system_config():
    config = await db.system_config.find_one({"key": "app_config"})
    if not config:
        default_config = {
            "key": "app_config",
            "exchange_rate": 50.0,
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
            "contact_info": {
                "phone": "+58 412-1234567",
                "email": "contacto@zinli-recargas.com",
                "whatsapp": "+58 412-1234567"
            },
            "social_networks": [
                {"id": "1", "platform": "instagram", "url": "https://instagram.com/zinlirecargas", "is_active": True},
                {"id": "2", "platform": "facebook", "url": "https://facebook.com/zinlirecargas", "is_active": True},
                {"id": "3", "platform": "twitter", "url": "https://twitter.com/zinlirecargas", "is_active": True}
            ],
            "payment_methods": [
                {"id": "pm_1", "name": "Pago Móvil", "logo_base64": None, "fields": {"bank": "Banco de Venezuela", "phone": "0414-1234567", "id": "V-12345678", "name": "Zinli Recargas"}, "is_active": True},
                {"id": "pm_2", "name": "Transferencia Bancaria", "logo_base64": None, "fields": {"bank": "Mercantil", "account_type": "Corriente", "account_number": "0105-0123-45-1234567890", "id": "J-12345678-9", "name": "Zinli Recargas"}, "is_active": True},
                {"id": "pm_3", "name": "Binance Pay", "logo_base64": None, "fields": {"email": "zinli@gmail.com", "user_id": "123456789"}, "is_active": True},
                {"id": "pm_4", "name": "PayPal", "logo_base64": None, "fields": {"email": "payments@zinli.com"}, "is_active": True}
            ],
            "ubii_config": {
                "client_id": "55c3c808-163c-11f1-898a-0050568717e3",
                "client_domain": "",
                "is_active": False
            },
            "created_at": datetime.utcnow()
        }
        await db.system_config.insert_one(default_config)

async def init_gift_cards():
    """Initialize featured gift cards if they don't exist"""
    count = await db.gift_cards.count_documents({})
    if count == 0:
        default_cards = [
            {
                "name": "Amazon",
                "description": "Gift Cards de Amazon para compras en línea",
                "image_base64": "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI0ZGOTkwMCIvPjx0ZXh0IHg9IjUwIiB5PSI1MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkFtYXpvbjwvdGV4dD48L3N2Zz4=",
                "category": "Shopping",
                "price_variants": [10, 25, 50, 100],
                "is_featured": True,
                "is_active": True,
                "created_at": datetime.utcnow()
            },
            {
                "name": "Netflix",
                "description": "Tarjetas de regalo Netflix para suscripciones",
                "image_base64": "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI0UwMEUwQyIvPjx0ZXh0IHg9IjUwIiB5PSI1MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5ldGZsaXg8L3RleHQ+PC9zdmc+",
                "category": "Entertainment",
                "price_variants": [15, 30, 60],
                "is_featured": True,
                "is_active": True,
                "created_at": datetime.utcnow()
            },
            {
                "name": "PlayStation",
                "description": "PlayStation Store Gift Cards para juegos y contenido",
                "image_base64": "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzAwMzA5MSIvPjx0ZXh0IHg9IjUwIiB5PSI1MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjEyIiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPlBsYXlTdGF0aW9uPC90ZXh0Pjwvc3ZnPg==",
                "category": "Gaming",
                "price_variants": [10, 25, 50, 100],
                "is_featured": True,
                "is_active": True,
                "created_at": datetime.utcnow()
            },
            {
                "name": "Razer Gold",
                "description": "Razer Gold para compras en juegos",
                "image_base64": "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzAwRkY4NyIvPjx0ZXh0IHg9IjUwIiB5PSI1MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiBmaWxsPSJibGFjayIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPlJhemVyPC90ZXh0Pjwvc3ZnPg==",
                "category": "Gaming",
                "price_variants": [5, 10, 20, 50],
                "is_featured": True,
                "is_active": True,
                "created_at": datetime.utcnow()
            },
            {
                "name": "Roblox",
                "description": "Robux para Roblox",
                "image_base64": "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI0U0MzAzQSIvPjx0ZXh0IHg9IjUwIiB5PSI1MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPlJvYmxveDwvdGV4dD48L3N2Zz4=",
                "category": "Gaming",
                "price_variants": [10, 25, 50],
                "is_featured": True,
                "is_active": True,
                "created_at": datetime.utcnow()
            },
            {
                "name": "Google Play",
                "description": "Google Play Gift Cards para apps, juegos y más",
                "image_base64": "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzAxODc1RiIvPjx0ZXh0IHg9IjUwIiB5PSI1MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjEyIiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkdvb2dsZSBQbGF5PC90ZXh0Pjwvc3ZnPg==",
                "category": "Apps",
                "price_variants": [10, 25, 50, 100],
                "is_featured": True,
                "is_active": True,
                "created_at": datetime.utcnow()
            }
        ]
        await db.gift_cards.insert_many(default_cards)

# ===== AUTH ROUTES =====

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserRegister):
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_count = await db.users.count_documents({})
    is_admin = user_count == 0 or user_data.email == "admin@zinli.com"
    
    user_dict = {
        "email": user_data.email,
        "password_hash": get_password_hash(user_data.password),
        "first_name": user_data.first_name,
        "last_name": user_data.last_name,
        "phone_number": user_data.phone_number,
        "is_admin": is_admin,
        "balance": 0.0,
        "created_at": datetime.utcnow()
    }
    
    result = await db.users.insert_one(user_dict)
    user_dict["_id"] = result.inserted_id
    
    access_token = create_access_token(data={"sub": str(result.inserted_id)})
    
    user_response = UserResponse(
        id=str(user_dict["_id"]),
        email=user_dict["email"],
        first_name=user_dict["first_name"],
        last_name=user_dict["last_name"],
        phone_number=user_dict["phone_number"],
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
    
    # Handle both old and new user formats
    user_response = UserResponse(
        id=str(user["_id"]),
        email=user["email"],
        first_name=user.get("first_name", user.get("name", "User")),
        last_name=user.get("last_name", ""),
        phone_number=user.get("phone_number", "N/A"),
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
        first_name=current_user.get("first_name", current_user.get("name", "User")),
        last_name=current_user.get("last_name", ""),
        phone_number=current_user.get("phone_number", "N/A"),
        is_admin=current_user.get("is_admin", False),
        balance=current_user.get("balance", 0.0),
        created_at=current_user["created_at"]
    )

class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone_number: Optional[str] = None

@api_router.patch("/users/me", response_model=UserResponse)
async def update_me(user_data: UserUpdate, current_user: dict = Depends(get_current_user)):
    """Update current user's profile data"""
    update_dict = {}
    
    if user_data.first_name is not None:
        update_dict["first_name"] = user_data.first_name
    if user_data.last_name is not None:
        update_dict["last_name"] = user_data.last_name
    if user_data.phone_number is not None:
        update_dict["phone_number"] = user_data.phone_number
    
    # Also update the name field for compatibility
    if user_data.first_name or user_data.last_name:
        first = user_data.first_name if user_data.first_name else current_user.get("first_name", "")
        last = user_data.last_name if user_data.last_name else current_user.get("last_name", "")
        update_dict["name"] = f"{first} {last}".strip()
    
    if update_dict:
        await db.users.update_one(
            {"_id": current_user["_id"]},
            {"$set": update_dict}
        )
    
    # Get updated user
    updated_user = await db.users.find_one({"_id": current_user["_id"]})
    
    return UserResponse(
        id=str(updated_user["_id"]),
        email=updated_user["email"],
        first_name=updated_user.get("first_name", updated_user.get("name", "User")),
        last_name=updated_user.get("last_name", ""),
        phone_number=updated_user.get("phone_number", "N/A"),
        is_admin=updated_user.get("is_admin", False),
        balance=updated_user.get("balance", 0.0),
        created_at=updated_user["created_at"]
    )

# ===== GIFT CARD ROUTES =====

@api_router.get("/gift-cards", response_model=List[GiftCardResponse])
async def get_gift_cards():
    """Get all active gift cards"""
    cards = await db.gift_cards.find({"is_active": True}).to_list(100)
    return [
        GiftCardResponse(
            id=str(card["_id"]),
            name=card["name"],
            description=card.get("description", ""),
            image_base64=card.get("image_base64"),
            amounts=card.get("amounts", card.get("price_variants", [])),
            is_active=card.get("is_active", True),
            created_at=card.get("created_at")
        )
        for card in cards
    ]

@api_router.get("/gift-cards/featured", response_model=List[GiftCardResponse])
async def get_featured_gift_cards():
    """Get 6 featured/active gift cards"""
    cards = await db.gift_cards.find({"is_active": True}).limit(6).to_list(6)
    return [
        GiftCardResponse(
            id=str(card["_id"]),
            name=card["name"],
            description=card.get("description", ""),
            image_base64=card.get("image_base64"),
            amounts=card.get("amounts", card.get("price_variants", [])),
            is_active=card.get("is_active", True),
            created_at=card.get("created_at")
        )
        for card in cards
    ]

# ===== ORDER ROUTES =====

@api_router.post("/orders", response_model=OrderResponse)
async def create_order(order_data: OrderCreate, current_user: dict = Depends(get_current_user)):
    """Create a new order (Zinli recharge or Gift Card purchase)"""
    
    # Validation based on order type
    if order_data.order_type == "zinli_recharge":
        if not order_data.zinli_amount or not order_data.zinli_email:
            raise HTTPException(status_code=400, detail="zinli_amount and zinli_email are required for Zinli recharges")
    elif order_data.order_type == "gift_card":
        if not order_data.gift_card_id or not order_data.gift_card_amount:
            raise HTTPException(status_code=400, detail="gift_card_id and gift_card_amount are required for gift cards")
    else:
        raise HTTPException(status_code=400, detail="Invalid order_type. Must be 'zinli_recharge' or 'gift_card'")
    
    # Get system config for calculation
    config = await db.system_config.find_one({"key": "app_config"})
    exchange_rate = config["exchange_rate"]
    commission = config["commission_percent"]
    
    # Calculate total cost
    amount = order_data.zinli_amount if order_data.order_type == "zinli_recharge" else order_data.gift_card_amount
    base_cost = amount * exchange_rate
    total_cost = base_cost + (base_cost * commission / 100)
    
    # Get gift card name if applicable
    gift_card_name = None
    if order_data.order_type == "gift_card":
        gift_card = await db.gift_cards.find_one({"_id": ObjectId(order_data.gift_card_id)})
        if gift_card:
            gift_card_name = gift_card["name"]
    
    order_dict = {
        "user_id": str(current_user["_id"]),
        "user_email": current_user["email"],
        "user_name": current_user.get("name", f"{current_user.get('first_name', '')} {current_user.get('last_name', '')}".strip()),
        "order_type": order_data.order_type,
        "zinli_amount": order_data.zinli_amount,
        "zinli_email": order_data.zinli_email,
        "gift_card_id": order_data.gift_card_id,
        "gift_card_name": gift_card_name,
        "gift_card_amount": order_data.gift_card_amount,
        "total_cost": round(total_cost, 2),
        "payment_method": order_data.payment_method,
        "reference_number": order_data.reference_number,
        "payment_proof_image": order_data.payment_proof_image,
        "status": "pending",
        "delivery_status": "pending" if order_data.order_type == "gift_card" else None,
        "gift_card_qr_image": None,
        "gift_card_code": None,
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
        order_type=order_dict["order_type"],
        zinli_amount=order_dict["zinli_amount"],
        zinli_email=order_dict["zinli_email"],
        gift_card_id=order_dict["gift_card_id"],
        gift_card_name=order_dict["gift_card_name"],
        gift_card_amount=order_dict["gift_card_amount"],
        total_cost=order_dict["total_cost"],
        payment_method=order_dict["payment_method"],
        reference_number=order_dict["reference_number"],
        payment_proof_image=order_dict["payment_proof_image"],
        status=order_dict["status"],
        delivery_status=order_dict["delivery_status"],
        gift_card_qr_image=order_dict["gift_card_qr_image"],
        gift_card_code=order_dict["gift_card_code"],
        created_at=order_dict["created_at"],
        updated_at=order_dict["updated_at"]
    )

@api_router.get("/orders", response_model=List[OrderResponse])
async def get_my_orders(current_user: dict = Depends(get_current_user)):
    """Get all orders for the current user"""
    orders = await db.orders.find({"user_id": str(current_user["_id"])}).sort("created_at", -1).to_list(1000)
    
    return [
        OrderResponse(
            id=str(order["_id"]),
            user_id=order["user_id"],
            user_email=order["user_email"],
            user_name=order["user_name"],
            order_type=order.get("order_type", "zinli_recharge"),
            zinli_amount=order.get("zinli_amount"),
            zinli_email=order.get("zinli_email"),
            gift_card_id=order.get("gift_card_id"),
            gift_card_name=order.get("gift_card_name"),
            gift_card_amount=order.get("gift_card_amount"),
            total_cost=order["total_cost"],
            payment_method=order["payment_method"],
            reference_number=order["reference_number"],
            payment_proof_image=order["payment_proof_image"],
            status=order["status"],
            delivery_status=order.get("delivery_status"),
            gift_card_qr_image=order.get("gift_card_qr_image"),
            gift_card_code=order.get("gift_card_code"),
            created_at=order["created_at"],
            updated_at=order["updated_at"]
        )
        for order in orders
    ]

@api_router.get("/orders/{order_id}", response_model=OrderResponse)
async def get_order(order_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific order"""
    try:
        order = await db.orders.find_one({"_id": ObjectId(order_id)})
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        
        if order["user_id"] != str(current_user["_id"]) and not current_user.get("is_admin", False):
            raise HTTPException(status_code=403, detail="Access denied")
        
        return OrderResponse(
            id=str(order["_id"]),
            user_id=order["user_id"],
            user_email=order["user_email"],
            user_name=order["user_name"],
            order_type=order["order_type"],
            zinli_amount=order.get("zinli_amount"),
            zinli_email=order.get("zinli_email"),
            gift_card_id=order.get("gift_card_id"),
            gift_card_name=order.get("gift_card_name"),
            gift_card_amount=order.get("gift_card_amount"),
            total_cost=order["total_cost"],
            payment_method=order["payment_method"],
            reference_number=order["reference_number"],
            payment_proof_image=order["payment_proof_image"],
            status=order["status"],
            delivery_status=order.get("delivery_status"),
            gift_card_qr_image=order.get("gift_card_qr_image"),
            gift_card_code=order.get("gift_card_code"),
            created_at=order["created_at"],
            updated_at=order["updated_at"]
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ===== ADMIN ORDER ROUTES =====

@api_router.get("/admin/orders", response_model=List[OrderResponse])
async def get_all_orders(verified: bool = Depends(verify_admin_secret)):
    """Admin: Get all orders"""
    orders = await db.orders.find().sort("created_at", -1).to_list(1000)
    
    return [
        OrderResponse(
            id=str(order["_id"]),
            user_id=order["user_id"],
            user_email=order["user_email"],
            user_name=order["user_name"],
            order_type=order.get("order_type", "zinli"),
            zinli_amount=order.get("zinli_amount"),
            zinli_email=order.get("zinli_email"),
            gift_card_id=order.get("gift_card_id"),
            gift_card_name=order.get("gift_card_name"),
            gift_card_amount=order.get("gift_card_amount"),
            total_cost=order["total_cost"],
            payment_method=order["payment_method"],
            reference_number=order["reference_number"],
            payment_proof_image=order["payment_proof_image"],
            status=order["status"],
            delivery_status=order.get("delivery_status"),
            gift_card_qr_image=order.get("gift_card_qr_image"),
            gift_card_code=order.get("gift_card_code"),
            created_at=order["created_at"],
            updated_at=order.get("updated_at", order["created_at"])
        )
        for order in orders
    ]

@api_router.patch("/admin/orders/{order_id}", response_model=OrderResponse)
async def update_order_status(order_id: str, update_data: OrderStatusUpdate, verified: bool = Depends(verify_admin_secret)):
    """Admin: Approve or reject an order"""
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
        
        # If completing a gift card order, set delivery_status to processing
        if update_data.status == "completed" and order["order_type"] == "gift_card":
            update_dict["delivery_status"] = "processing"
        
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
            order_type=updated_order["order_type"],
            zinli_amount=updated_order.get("zinli_amount"),
            zinli_email=updated_order.get("zinli_email"),
            gift_card_id=updated_order.get("gift_card_id"),
            gift_card_name=updated_order.get("gift_card_name"),
            gift_card_amount=updated_order.get("gift_card_amount"),
            total_cost=updated_order["total_cost"],
            payment_method=updated_order["payment_method"],
            reference_number=updated_order["reference_number"],
            payment_proof_image=updated_order["payment_proof_image"],
            status=updated_order["status"],
            delivery_status=updated_order.get("delivery_status"),
            gift_card_qr_image=updated_order.get("gift_card_qr_image"),
            gift_card_code=updated_order.get("gift_card_code"),
            created_at=updated_order["created_at"],
            updated_at=updated_order["updated_at"]
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.patch("/admin/orders/{order_id}/deliver", response_model=OrderResponse)
async def deliver_gift_card(order_id: str, delivery_data: GiftCardDelivery, verified: bool = Depends(verify_admin_secret)):
    """Admin: Upload QR code and alphanumeric code for gift card delivery"""
    try:
        order = await db.orders.find_one({"_id": ObjectId(order_id)})
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        
        if order["order_type"] != "gift_card":
            raise HTTPException(status_code=400, detail="This endpoint is only for gift card orders")
        
        if order["status"] != "completed":
            raise HTTPException(status_code=400, detail="Order must be approved first")
        
        update_dict = {
            "gift_card_qr_image": delivery_data.gift_card_qr_image,
            "gift_card_code": delivery_data.gift_card_code,
            "delivery_status": "delivered",
            "updated_at": datetime.utcnow()
        }
        
        await db.orders.update_one(
            {"_id": ObjectId(order_id)},
            {"$set": update_dict}
        )
        
        # TODO: Send push notification to user that gift card is ready
        
        updated_order = await db.orders.find_one({"_id": ObjectId(order_id)})
        
        return OrderResponse(
            id=str(updated_order["_id"]),
            user_id=updated_order["user_id"],
            user_email=updated_order["user_email"],
            user_name=updated_order["user_name"],
            order_type=updated_order["order_type"],
            zinli_amount=updated_order.get("zinli_amount"),
            zinli_email=updated_order.get("zinli_email"),
            gift_card_id=updated_order.get("gift_card_id"),
            gift_card_name=updated_order.get("gift_card_name"),
            gift_card_amount=updated_order.get("gift_card_amount"),
            total_cost=updated_order["total_cost"],
            payment_method=updated_order["payment_method"],
            reference_number=updated_order["reference_number"],
            payment_proof_image=updated_order["payment_proof_image"],
            status=updated_order["status"],
            delivery_status=updated_order.get("delivery_status"),
            gift_card_qr_image=updated_order.get("gift_card_qr_image"),
            gift_card_code=updated_order.get("gift_card_code"),
            created_at=updated_order["created_at"],
            updated_at=updated_order["updated_at"]
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ===== BANNER ROUTES =====

@api_router.get("/banners", response_model=List[BannerResponse])
async def get_banners():
    """Get all active banners"""
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
async def create_banner(banner_data: BannerCreate, verified: bool = Depends(verify_admin_secret)):
    """Admin: Create a new banner"""
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
async def delete_banner(banner_id: str, verified: bool = Depends(verify_admin_secret)):
    """Admin: Delete a banner"""
    try:
        result = await db.banners.delete_one({"_id": ObjectId(banner_id)})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Banner not found")
        return {"message": "Banner deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ===== SYSTEM CONFIG ROUTES =====

@api_router.get("/config", response_model=SystemConfigResponse)
async def get_system_config():
    """Get system configuration"""
    config = await db.system_config.find_one({"key": "app_config"})
    if not config:
        await init_system_config()
        config = await db.system_config.find_one({"key": "app_config"})
    
    return SystemConfigResponse(
        exchange_rate=config["exchange_rate"],
        commission_percent=config["commission_percent"],
        bank_details=config["bank_details"],
        logo_base64=config.get("logo_base64"),
        favicon_base64=config.get("favicon_base64"),
        contact_info=config.get("contact_info"),
        social_networks=config.get("social_networks", []),
        payment_methods=config.get("payment_methods", []),
        ubii_config=config.get("ubii_config", {"client_id": "", "client_domain": "", "is_active": False})
    )

@api_router.patch("/admin/config", response_model=SystemConfigResponse)
async def update_system_config(config_data: SystemConfigUpdate, verified: bool = Depends(verify_admin_secret)):
    """Admin: Update system configuration"""
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
        bank_details=config["bank_details"],
        logo_base64=config.get("logo_base64"),
        favicon_base64=config.get("favicon_base64"),
        contact_info=config.get("contact_info"),
        social_networks=config.get("social_networks", []),
        payment_methods=config.get("payment_methods", [])
    )

@api_router.patch("/admin/branding", response_model=SystemConfigResponse)
async def update_branding(branding_data: BrandingUpdate, verified: bool = Depends(verify_admin_secret)):
    """Admin: Update app branding (logo and favicon)"""
    update_dict = {}
    
    if branding_data.logo_base64 is not None:
        update_dict["logo_base64"] = branding_data.logo_base64
    
    if branding_data.favicon_base64 is not None:
        update_dict["favicon_base64"] = branding_data.favicon_base64
    
    if update_dict:
        await db.system_config.update_one(
            {"key": "app_config"},
            {"$set": update_dict}
        )
    
    config = await db.system_config.find_one({"key": "app_config"})
    
    return SystemConfigResponse(
        exchange_rate=config["exchange_rate"],
        commission_percent=config["commission_percent"],
        bank_details=config["bank_details"],
        logo_base64=config.get("logo_base64"),
        favicon_base64=config.get("favicon_base64"),
        contact_info=config.get("contact_info"),
        social_networks=config.get("social_networks", []),
        payment_methods=config.get("payment_methods", [])
    )

@api_router.patch("/admin/contact")
async def update_contact_info(contact_data: ContactInfoUpdate, verified: bool = Depends(verify_admin_secret)):
    """Admin: Update contact information"""
    update_dict = {}
    
    if contact_data.phone is not None:
        update_dict["contact_info.phone"] = contact_data.phone
    if contact_data.email is not None:
        update_dict["contact_info.email"] = contact_data.email
    if contact_data.whatsapp is not None:
        update_dict["contact_info.whatsapp"] = contact_data.whatsapp
    
    if update_dict:
        await db.system_config.update_one(
            {"key": "app_config"},
            {"$set": update_dict}
        )
    
    config = await db.system_config.find_one({"key": "app_config"})
    return {"message": "Contact info updated", "contact_info": config.get("contact_info")}

@api_router.put("/admin/social-networks")
async def update_social_networks(networks: List[SocialNetworkItem], verified: bool = Depends(verify_admin_secret)):
    """Admin: Update social networks list"""
    networks_data = [n.dict() for n in networks]
    
    # Generate IDs for new items
    for i, network in enumerate(networks_data):
        if not network.get("id"):
            networks_data[i]["id"] = str(uuid.uuid4())[:8]
    
    await db.system_config.update_one(
        {"key": "app_config"},
        {"$set": {"social_networks": networks_data}}
    )
    
    return {"message": "Social networks updated", "social_networks": networks_data}

@api_router.put("/admin/payment-methods")
async def update_payment_methods(methods: List[PaymentMethodItem], verified: bool = Depends(verify_admin_secret)):
    """Admin: Update payment methods list"""
    methods_data = [m.dict() for m in methods]
    
    # Generate IDs for new items
    for i, method in enumerate(methods_data):
        if not method.get("id"):
            methods_data[i]["id"] = f"pm_{str(uuid.uuid4())[:8]}"
    
    await db.system_config.update_one(
        {"key": "app_config"},
        {"$set": {"payment_methods": methods_data}}
    )
    
    return {"message": "Payment methods updated", "payment_methods": methods_data}

@api_router.patch("/admin/payment-methods/{method_id}/toggle")
async def toggle_payment_method(method_id: str, verified: bool = Depends(verify_admin_secret)):
    """Admin: Toggle payment method active status"""
    config = await db.system_config.find_one({"key": "app_config"})
    methods = config.get("payment_methods", [])
    
    for i, method in enumerate(methods):
        if method.get("id") == method_id:
            methods[i]["is_active"] = not method.get("is_active", True)
            break
    
    await db.system_config.update_one(
        {"key": "app_config"},
        {"$set": {"payment_methods": methods}}
    )
    
    return {"message": "Payment method toggled", "payment_methods": methods}

# ===== USER MANAGEMENT ROUTES (ADMIN) =====

@api_router.get("/admin/users")
async def get_all_users(verified: bool = Depends(verify_admin_secret)):
    """Admin: Get all users"""
    users = await db.users.find().to_list(1000)
    
    # Get order count for each user
    result = []
    for user in users:
        order_count = await db.orders.count_documents({"user_id": str(user["_id"])})
        result.append({
            "id": str(user["_id"]),
            "email": user["email"],
            "first_name": user.get("first_name", user.get("name", "N/A")),
            "last_name": user.get("last_name", ""),
            "phone_number": user.get("phone_number", "N/A"),
            "is_admin": user.get("is_admin", False),
            "is_active": user.get("is_active", True),
            "balance": user.get("balance", 0.0),
            "order_count": order_count,
            "created_at": user["created_at"]
        })
    
    return result

@api_router.patch("/admin/users/{user_id}/toggle-status")
async def toggle_user_status(user_id: str, verified: bool = Depends(verify_admin_secret)):
    """Admin: Activate or deactivate a user"""
    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        new_status = not user.get("is_active", True)
        await db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"is_active": new_status}}
        )
        
        return {"message": f"User {'activated' if new_status else 'deactivated'} successfully", "is_active": new_status}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.post("/admin/users/{user_id}/reset-password")
async def reset_user_password(user_id: str, new_password: dict, verified: bool = Depends(verify_admin_secret)):
    """Admin: Reset user password"""
    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        hashed_password = get_password_hash(new_password.get("password", "123456"))
        await db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"password_hash": hashed_password}}
        )
        
        return {"message": "Password reset successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ===== GIFT CARDS ADMIN CRUD =====

@api_router.get("/admin/gift-cards")
async def admin_get_gift_cards(verified: bool = Depends(verify_admin_secret)):
    """Admin: Get all gift cards"""
    cards = await db.gift_cards.find().to_list(100)
    return [
        {
            "id": str(card["_id"]),
            "name": card["name"],
            "description": card.get("description", ""),
            "image_base64": card.get("image_base64"),
            "amounts": card.get("amounts", card.get("price_variants", [])),
            "is_active": card.get("is_active", True),
            "created_at": str(card.get("created_at", "")) if card.get("created_at") else None
        }
        for card in cards
    ]

@api_router.post("/admin/gift-cards")
async def admin_create_gift_card(card_data: GiftCardCreate, verified: bool = Depends(verify_admin_secret)):
    """Admin: Create a new gift card"""
    new_card = {
        "name": card_data.name,
        "description": card_data.description,
        "image_base64": card_data.image_base64,
        "amounts": card_data.amounts,
        "is_active": card_data.is_active,
        "created_at": datetime.utcnow()
    }
    
    result = await db.gift_cards.insert_one(new_card)
    
    return {
        "message": "Gift card created successfully", 
        "card": {
            "id": str(result.inserted_id),
            "name": new_card["name"],
            "description": new_card["description"],
            "amounts": new_card["amounts"],
            "is_active": new_card["is_active"]
        }
    }

@api_router.patch("/admin/gift-cards/{card_id}")
async def admin_update_gift_card(card_id: str, card_data: GiftCardUpdate, verified: bool = Depends(verify_admin_secret)):
    """Admin: Update a gift card"""
    try:
        card = await db.gift_cards.find_one({"_id": ObjectId(card_id)})
        if not card:
            raise HTTPException(status_code=404, detail="Gift card not found")
        
        update_dict = {}
        if card_data.name is not None:
            update_dict["name"] = card_data.name
        if card_data.description is not None:
            update_dict["description"] = card_data.description
        if card_data.image_base64 is not None:
            update_dict["image_base64"] = card_data.image_base64
        if card_data.amounts is not None:
            update_dict["amounts"] = card_data.amounts
        if card_data.is_active is not None:
            update_dict["is_active"] = card_data.is_active
        
        if update_dict:
            await db.gift_cards.update_one(
                {"_id": ObjectId(card_id)},
                {"$set": update_dict}
            )
        
        return {"message": "Gift card updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.delete("/admin/gift-cards/{card_id}")
async def admin_delete_gift_card(card_id: str, verified: bool = Depends(verify_admin_secret)):
    """Admin: Delete a gift card"""
    try:
        result = await db.gift_cards.delete_one({"_id": ObjectId(card_id)})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Gift card not found")
        
        return {"message": "Gift card deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.patch("/admin/gift-cards/{card_id}/toggle")
async def admin_toggle_gift_card(card_id: str, verified: bool = Depends(verify_admin_secret)):
    """Admin: Toggle gift card active status"""
    try:
        card = await db.gift_cards.find_one({"_id": ObjectId(card_id)})
        if not card:
            raise HTTPException(status_code=404, detail="Gift card not found")
        
        new_status = not card.get("is_active", True)
        await db.gift_cards.update_one(
            {"_id": ObjectId(card_id)},
            {"$set": {"is_active": new_status}}
        )
        
        return {"message": f"Gift card {'activated' if new_status else 'deactivated'}", "is_active": new_status}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ===== PUSH NOTIFICATIONS =====

@api_router.post("/push/register-token")
async def register_push_token(token_data: PushTokenRegister):
    """Register a push notification token"""
    existing = await db.push_tokens.find_one({"token": token_data.token})
    if existing:
        # Update existing token
        await db.push_tokens.update_one(
            {"token": token_data.token},
            {"$set": {"user_id": token_data.user_id, "updated_at": datetime.utcnow()}}
        )
    else:
        # Insert new token
        await db.push_tokens.insert_one({
            "token": token_data.token,
            "user_id": token_data.user_id,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        })
    
    return {"message": "Push token registered successfully"}

@api_router.get("/admin/push-tokens")
async def admin_get_push_tokens(verified: bool = Depends(verify_admin_secret)):
    """Admin: Get all registered push tokens"""
    tokens = await db.push_tokens.find().to_list(1000)
    return {
        "total": len(tokens),
        "tokens": [
            {
                "id": str(t["_id"]),
                "token": t["token"][:20] + "..." if len(t["token"]) > 20 else t["token"],
                "user_id": t.get("user_id"),
                "created_at": t.get("created_at")
            }
            for t in tokens
        ]
    }

@api_router.post("/admin/push/send")
async def admin_send_push_notification(notification: PushNotificationSend, verified: bool = Depends(verify_admin_secret)):
    """Admin: Send push notification to users"""
    import httpx
    
    # Get tokens based on target
    if notification.target == "all":
        tokens = await db.push_tokens.find().to_list(1000)
    elif notification.user_ids:
        tokens = await db.push_tokens.find({"user_id": {"$in": notification.user_ids}}).to_list(1000)
    else:
        return {"error": "Invalid target specified"}
    
    if not tokens:
        return {"message": "No registered devices found", "sent": 0}
    
    # Prepare Expo push messages
    messages = []
    for token_doc in tokens:
        push_token = token_doc["token"]
        if push_token.startswith("ExponentPushToken"):
            messages.append({
                "to": push_token,
                "title": notification.title,
                "body": notification.body,
                "data": notification.data or {},
                "sound": "default"
            })
    
    if not messages:
        return {"message": "No valid Expo push tokens found", "sent": 0}
    
    # Send to Expo Push API
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://exp.host/--/api/v2/push/send",
                json=messages,
                headers={"Content-Type": "application/json"}
            )
            result = response.json()
            
            # Save notification history
            await db.notifications.insert_one({
                "title": notification.title,
                "body": notification.body,
                "target": notification.target,
                "sent_count": len(messages),
                "created_at": datetime.utcnow()
            })
            
            return {"message": "Notifications sent", "sent": len(messages), "response": result}
    except Exception as e:
        return {"error": str(e), "sent": 0}

@api_router.get("/admin/notifications")
async def admin_get_notification_history(verified: bool = Depends(verify_admin_secret)):
    """Admin: Get notification history"""
    notifications = await db.notifications.find().sort("created_at", -1).to_list(50)
    return [
        {
            "id": str(n["_id"]),
            "title": n["title"],
            "body": n["body"],
            "target": n.get("target", "all"),
            "sent_count": n.get("sent_count", 0),
            "created_at": n.get("created_at")
        }
        for n in notifications
    ]

# ===== UBII PAGO INTEGRATION =====

UBII_API_BASE = "https://botonc.ubiipagos.com"

@api_router.get("/admin/ubii-config")
async def get_ubii_config(verified: bool = Depends(verify_admin_secret)):
    """Admin: Get Ubii Pago configuration"""
    config = await db.system_config.find_one({"key": "app_config"})
    ubii_config = config.get("ubii_config", {})
    
    # Ensure all required fields are present
    result = {
        "client_id": ubii_config.get("client_id", "55c3c808-163c-11f1-898a-0050568717e3"),
        "client_domain": ubii_config.get("client_domain", ""),
        "is_active": ubii_config.get("is_active", False)
    }
    return result

@api_router.patch("/admin/ubii-config")
async def update_ubii_config(ubii_data: UbiiConfigUpdate, verified: bool = Depends(verify_admin_secret)):
    """Admin: Update Ubii Pago configuration"""
    await db.system_config.update_one(
        {"key": "app_config"},
        {"$set": {"ubii_config": {
            "client_id": ubii_data.client_id,
            "client_domain": ubii_data.client_domain,
            "is_active": ubii_data.is_active
        }}}
    )
    return {"message": "Ubii config updated successfully"}

@api_router.patch("/admin/ubii-config/toggle")
async def toggle_ubii_config(verified: bool = Depends(verify_admin_secret)):
    """Admin: Toggle Ubii Pago active status"""
    config = await db.system_config.find_one({"key": "app_config"})
    ubii_config = config.get("ubii_config", {"is_active": False})
    new_status = not ubii_config.get("is_active", False)
    
    await db.system_config.update_one(
        {"key": "app_config"},
        {"$set": {"ubii_config.is_active": new_status}}
    )
    return {"message": f"Ubii {'activated' if new_status else 'deactivated'}", "is_active": new_status}

@api_router.post("/ubii/init")
async def ubii_init_transaction(current_user: dict = Depends(get_current_user)):
    """Initialize Ubii transaction - Get token and encryption keys"""
    config = await db.system_config.find_one({"key": "app_config"})
    ubii_config = config.get("ubii_config", {})
    
    if not ubii_config.get("is_active"):
        raise HTTPException(status_code=400, detail="Ubii Pago is not active")
    
    client_id = ubii_config.get("client_id")
    client_domain = ubii_config.get("client_domain", "")
    
    if not client_id:
        raise HTTPException(status_code=400, detail="Ubii Client ID not configured")
    
    try:
        async with httpx.AsyncClient(timeout=15.0) as http_client:
            # Step 1: Check client and get token
            check_response = await http_client.get(
                f"{UBII_API_BASE}/check_client_id",
                headers={
                    "X-CLIENT-ID": client_id,
                    "X-CLIENT-DOMAIN": client_domain,
                    "Content-Type": "application/json"
                }
            )
            check_data = check_response.json()
            
            if check_data.get("R") != "0":
                raise HTTPException(
                    status_code=400, 
                    detail=check_data.get("MS", "Error validating with Ubii")
                )
            
            token = check_data.get("token")
            
            # Step 2: Get API keys
            keys_response = await http_client.get(
                f"{UBII_API_BASE}/get_keys",
                headers={
                    "X-CLIENT-ID": client_id,
                    "Authorization": token,
                    "Content-Type": "application/json"
                }
            )
            keys_data = keys_response.json()
            
            if keys_data.get("R") != "0":
                raise HTTPException(
                    status_code=400,
                    detail=keys_data.get("MS", "Error getting Ubii keys")
                )
            
            # Store session for this user
            session_id = str(uuid.uuid4())
            await db.ubii_sessions.update_one(
                {"user_id": str(current_user["_id"])},
                {"$set": {
                    "user_id": str(current_user["_id"]),
                    "token": token,
                    "keys": keys_data,
                    "client_id": client_id,
                    "created_at": datetime.utcnow(),
                    "expires_at": datetime.utcnow() + timedelta(minutes=14)
                }},
                upsert=True
            )
            
            return {
                "success": True,
                "session_id": session_id,
                "message": "Ubii session initialized"
            }
    except httpx.TimeoutException as e:
        logger.error(f"Ubii API timeout: {str(e)}")
        raise HTTPException(status_code=503, detail="El servidor de Ubii Pago no responde. Por favor intenta más tarde o usa otro método de pago.")
    except httpx.ConnectError as e:
        logger.error(f"Ubii API connection error: {str(e)}")
        raise HTTPException(status_code=503, detail="No se pudo conectar con Ubii Pago. Verifica tu conexión o intenta más tarde.")
    except httpx.RequestError as e:
        logger.error(f"Ubii API error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error conectando con Ubii Pago: {str(e)}")

@api_router.post("/ubii/pay")
async def ubii_process_payment(payment: UbiiPaymentRequest, current_user: dict = Depends(get_current_user)):
    """Process credit card payment through Ubii Pago"""
    config = await db.system_config.find_one({"key": "app_config"})
    ubii_config = config.get("ubii_config", {})
    
    if not ubii_config.get("is_active"):
        raise HTTPException(status_code=400, detail="Ubii Pago is not active")
    
    # Get stored session
    session = await db.ubii_sessions.find_one({
        "user_id": str(current_user["_id"]),
        "expires_at": {"$gt": datetime.utcnow()}
    })
    
    if not session:
        raise HTTPException(status_code=400, detail="Session expired. Please initialize again.")
    
    # Get the TDC API key from stored keys
    keys = session.get("keys", {})
    tdc_key = None
    for key_item in keys.get("content", []):
        if key_item.get("method") == "TDC":
            tdc_key = key_item.get("api_key")
            break
    
    if not tdc_key:
        raise HTTPException(status_code=400, detail="TDC payment method not available")
    
    # Generate unique order number
    order_number = f"ZNL-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{str(uuid.uuid4())[:8]}"
    
    try:
        async with httpx.AsyncClient(timeout=60.0) as http_client:
            # Build payment payload
            payment_body = {
                "bwa": "Web",
                "manu": "Generic",
                "model": "Browser",
                "OSV": "Web",
                "lat": "0",
                "long": "0",
                "crdn": payment.card_number.replace(" ", "").replace("-", ""),
                "ci": payment.cedula,
                "fexp": payment.expiry_date,
                "cvv": payment.cvv,
                "m": str(payment.amount),
                "cu": payment.currency,
                "order": order_number,
                "ip": "0.0.0.0"
            }
            
            # Make payment request
            pay_response = await http_client.post(
                f"{UBII_API_BASE}/payment_tde",
                json=payment_body,
                headers={
                    "X-CLIENT-ID": session.get("client_id"),
                    "X-API-KEY": tdc_key,
                    "X-CLIENT-CHANNEL": "BTN-API",
                    "Authorization": session.get("token"),
                    "Content-Type": "application/json"
                }
            )
            pay_data = pay_response.json()
            
            # Log transaction
            await db.ubii_transactions.insert_one({
                "user_id": str(current_user["_id"]),
                "order_id": payment.order_id,
                "order_number": order_number,
                "amount": payment.amount,
                "currency": payment.currency,
                "response": pay_data,
                "status": "approved" if pay_data.get("R") == "0" else "rejected",
                "created_at": datetime.utcnow()
            })
            
            if pay_data.get("R") == "0":
                # Update order status if successful
                if payment.order_id:
                    await db.orders.update_one(
                        {"_id": ObjectId(payment.order_id)},
                        {"$set": {
                            "ubii_reference": pay_data.get("ref"),
                            "ubii_trace": pay_data.get("trace"),
                            "reference_number": pay_data.get("ref", order_number),
                            "payment_verified": True,
                            "updated_at": datetime.utcnow()
                        }}
                    )
                
                return {
                    "success": True,
                    "message": "Pago aprobado",
                    "reference": pay_data.get("ref"),
                    "trace": pay_data.get("trace"),
                    "code": pay_data.get("codR"),
                    "description": pay_data.get("codS")
                }
            else:
                return {
                    "success": False,
                    "message": pay_data.get("M", "Pago rechazado"),
                    "code": pay_data.get("codR"),
                    "description": pay_data.get("codS", pay_data.get("MS", "Error en la transacción"))
                }
                
    except httpx.RequestError as e:
        logger.error(f"Ubii payment error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing payment: {str(e)}")

@api_router.get("/ubii/verify/{order_number}")
async def ubii_verify_payment(order_number: str, current_user: dict = Depends(get_current_user)):
    """Verify a payment status with Ubii"""
    config = await db.system_config.find_one({"key": "app_config"})
    ubii_config = config.get("ubii_config", {})
    
    if not ubii_config.get("is_active"):
        raise HTTPException(status_code=400, detail="Ubii Pago is not active")
    
    session = await db.ubii_sessions.find_one({
        "user_id": str(current_user["_id"]),
        "expires_at": {"$gt": datetime.utcnow()}
    })
    
    if not session:
        raise HTTPException(status_code=400, detail="Session expired")
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as http_client:
            verify_response = await http_client.get(
                f"{UBII_API_BASE}/get_check_order",
                params={"Order": order_number},
                headers={
                    "X-CLIENT-ID": session.get("client_id"),
                    "Authorization": session.get("token"),
                    "Content-Type": "application/json"
                }
            )
            return verify_response.json()
    except httpx.RequestError as e:
        raise HTTPException(status_code=500, detail=f"Error verifying payment: {str(e)}")

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
    await init_gift_cards()
    logger.info("Database initialized with system config and gift cards")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
