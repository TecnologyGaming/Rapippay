from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
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
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Could not validate credentials")

async def get_current_admin(current_user: dict = Depends(get_current_user)):
    if not current_user.get("is_admin", False):
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

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
class GiftCardCreate(BaseModel):
    name: str
    description: str
    image_base64: str
    category: str
    price_variants: List[float]
    is_featured: bool = False

class GiftCardResponse(BaseModel):
    id: str
    name: str
    description: str
    image_base64: str
    category: str
    price_variants: List[float]
    is_featured: bool
    is_active: bool
    created_at: datetime

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

class SystemConfigUpdate(BaseModel):
    exchange_rate: Optional[float] = None
    commission_percent: Optional[float] = None
    bank_details: Optional[dict] = None

class BrandingUpdate(BaseModel):
    logo_base64: Optional[str] = None
    favicon_base64: Optional[str] = None

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

# ===== GIFT CARD ROUTES =====

@api_router.get("/gift-cards", response_model=List[GiftCardResponse])
async def get_gift_cards():
    """Get all active gift cards"""
    cards = await db.gift_cards.find({"is_active": True}).to_list(100)
    return [
        GiftCardResponse(
            id=str(card["_id"]),
            name=card["name"],
            description=card["description"],
            image_base64=card["image_base64"],
            category=card["category"],
            price_variants=card["price_variants"],
            is_featured=card["is_featured"],
            is_active=card["is_active"],
            created_at=card["created_at"]
        )
        for card in cards
    ]

@api_router.get("/gift-cards/featured", response_model=List[GiftCardResponse])
async def get_featured_gift_cards():
    """Get 6 featured gift cards"""
    cards = await db.gift_cards.find({"is_active": True, "is_featured": True}).limit(6).to_list(6)
    return [
        GiftCardResponse(
            id=str(card["_id"]),
            name=card["name"],
            description=card["description"],
            image_base64=card["image_base64"],
            category=card["category"],
            price_variants=card["price_variants"],
            is_featured=card["is_featured"],
            is_active=card["is_active"],
            created_at=card["created_at"]
        )
        for card in cards
    ]

@api_router.post("/admin/gift-cards", response_model=GiftCardResponse)
async def create_gift_card(card_data: GiftCardCreate, current_user: dict = Depends(get_current_admin)):
    """Admin: Create a new gift card product"""
    card_dict = {
        "name": card_data.name,
        "description": card_data.description,
        "image_base64": card_data.image_base64,
        "category": card_data.category,
        "price_variants": card_data.price_variants,
        "is_featured": card_data.is_featured,
        "is_active": True,
        "created_at": datetime.utcnow()
    }
    
    result = await db.gift_cards.insert_one(card_dict)
    card_dict["_id"] = result.inserted_id
    
    return GiftCardResponse(
        id=str(card_dict["_id"]),
        name=card_dict["name"],
        description=card_dict["description"],
        image_base64=card_dict["image_base64"],
        category=card_dict["category"],
        price_variants=card_dict["price_variants"],
        is_featured=card_dict["is_featured"],
        is_active=card_dict["is_active"],
        created_at=card_dict["created_at"]
    )

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
        "user_name": current_user["name"],
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
async def get_all_orders(current_user: dict = Depends(get_current_admin)):
    """Admin: Get all orders"""
    orders = await db.orders.find().sort("created_at", -1).to_list(1000)
    
    return [
        OrderResponse(
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
        for order in orders
    ]

@api_router.patch("/admin/orders/{order_id}", response_model=OrderResponse)
async def update_order_status(order_id: str, update_data: OrderStatusUpdate, current_user: dict = Depends(get_current_admin)):
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
async def deliver_gift_card(order_id: str, delivery_data: GiftCardDelivery, current_user: dict = Depends(get_current_admin)):
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
async def create_banner(banner_data: BannerCreate, current_user: dict = Depends(get_current_admin)):
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
async def delete_banner(banner_id: str, current_user: dict = Depends(get_current_admin)):
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
        favicon_base64=config.get("favicon_base64")
    )

@api_router.patch("/admin/config", response_model=SystemConfigResponse)
async def update_system_config(config_data: SystemConfigUpdate, current_user: dict = Depends(get_current_admin)):
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
        favicon_base64=config.get("favicon_base64")
    )

@api_router.patch("/admin/branding", response_model=SystemConfigResponse)
async def update_branding(branding_data: BrandingUpdate, current_user: dict = Depends(get_current_admin)):
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
        favicon_base64=config.get("favicon_base64")
    )

# ===== USER MANAGEMENT ROUTES (ADMIN) =====

@api_router.get("/admin/users")
async def get_all_users(current_user: dict = Depends(get_current_admin)):
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
async def toggle_user_status(user_id: str, current_user: dict = Depends(get_current_admin)):
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
async def reset_user_password(user_id: str, new_password: dict, current_user: dict = Depends(get_current_admin)):
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
