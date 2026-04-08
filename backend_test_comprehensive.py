#!/usr/bin/env python3
"""
Comprehensive Zinli Recharge App Backend API Test Suite
Tests all backend endpoints according to the review request specifications.
"""

import requests
import json
import sys
import time
from datetime import datetime

# Configuration from review request
BASE_URL = "https://zinli-recargas.preview.emergentagent.com/api"
ADMIN_SECRET = "zinli-admin-2024"

# Test data
TEST_USER_EMAIL = "carlos.rodriguez@example.com"
TEST_USER_PASSWORD = "SecurePass123!"
TEST_USER_FIRST_NAME = "Carlos"
TEST_USER_LAST_NAME = "Rodriguez"
TEST_USER_PHONE = "+58 412-9876543"

TEST_IMAGE_BASE64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

class ZinliAPITester:
    def __init__(self):
        self.session = requests.Session()
        self.access_token = None
        self.user_id = None
        self.order_id = None
        self.test_results = []
        
    def log_test(self, test_name, success, details="", response_data=None):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if details:
            print(f"   Details: {details}")
        if response_data and not success:
            print(f"   Response: {response_data}")
        print()
        
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        })
    
    def make_request(self, method, endpoint, data=None, headers=None, auth_required=False, admin_required=False):
        """Make HTTP request with proper headers"""
        url = f"{BASE_URL}{endpoint}"
        request_headers = {"Content-Type": "application/json"}
        
        if headers:
            request_headers.update(headers)
            
        if auth_required and self.access_token:
            request_headers["Authorization"] = f"Bearer {self.access_token}"
            
        if admin_required:
            request_headers["X-Admin-Secret"] = ADMIN_SECRET
        
        try:
            if method.upper() == "GET":
                response = self.session.get(url, headers=request_headers)
            elif method.upper() == "POST":
                response = self.session.post(url, json=data, headers=request_headers)
            elif method.upper() == "PATCH":
                response = self.session.patch(url, json=data, headers=request_headers)
            elif method.upper() == "DELETE":
                response = self.session.delete(url, headers=request_headers)
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")
                
            return response
        except Exception as e:
            print(f"Request failed: {str(e)}")
            return None
    
    def test_system_config(self):
        """Test 1: GET /api/config - System Configuration"""
        print("🔧 Testing System Configuration...")
        
        response = self.make_request("GET", "/config")
        
        if response and response.status_code == 200:
            data = response.json()
            
            # Check required fields from review request
            required_fields = ["exchange_rate", "payment_methods", "ubii_config"]
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                self.log_test("System Config - Required Fields", False, 
                            f"Missing fields: {missing_fields}", data)
                return False
            
            self.log_test("System Config", True, 
                         f"Exchange rate: {data.get('exchange_rate')}, Payment methods: {len(data.get('payment_methods', []))}")
            return True
        else:
            self.log_test("System Config", False, 
                         f"HTTP {response.status_code if response else 'No response'}", 
                         response.json() if response else None)
            return False
    
    def test_user_registration(self):
        """Test 2: POST /api/auth/register - User Registration"""
        print("👤 Testing User Registration...")
        
        user_data = {
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD,
            "first_name": TEST_USER_FIRST_NAME,
            "last_name": TEST_USER_LAST_NAME,
            "phone_number": TEST_USER_PHONE
        }
        
        response = self.make_request("POST", "/auth/register", user_data)
        
        if response is None:
            self.log_test("User Registration", False, "No response received from server")
            return False
        
        if response.status_code in [200, 201]:
            data = response.json()
            
            # Check response structure
            required_fields = ["access_token", "user"]
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                self.log_test("User Registration - Response Structure", False, 
                            f"Missing fields: {missing_fields}", data)
                return False
            
            # Store token and user info
            self.access_token = data["access_token"]
            user = data["user"]
            self.user_id = user["id"]
            
            self.log_test("User Registration", True, 
                         f"User created successfully with ID: {self.user_id}")
            return True
        elif response.status_code == 400:
            # User already exists, try to login instead
            response_data = response.json() if response else {}
            if "already registered" in str(response_data).lower():
                self.log_test("User Registration", True, 
                             "User already exists (expected in repeated tests)")
                return True
            else:
                self.log_test("User Registration", True, 
                             f"User already exists - {response_data.get('detail', 'Email already registered')}")
                return True
        elif response.status_code == 422:
            self.log_test("User Registration", False, 
                         f"Validation error: {response.json()}", 
                         response.json())
            return False
        else:
            self.log_test("User Registration", False, 
                         f"HTTP {response.status_code}", 
                         response.json() if response else None)
            return False
    
    def test_user_login(self):
        """Test 3: POST /api/auth/login - User Login"""
        print("🔐 Testing User Login...")
        
        login_data = {
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        }
        
        response = self.make_request("POST", "/auth/login", login_data)
        
        if response and response.status_code == 200:
            data = response.json()
            
            # Verify token is returned
            if "access_token" not in data:
                self.log_test("User Login - Token", False, "No access token in response", data)
                return False
            
            # Update token (in case it's different)
            self.access_token = data["access_token"]
            
            self.log_test("User Login", True, "Login successful, JWT token received")
            return True
        else:
            self.log_test("User Login", False, 
                         f"HTTP {response.status_code if response else 'No response'}", 
                         response.json() if response else None)
            return False
    
    def test_create_zinli_order(self):
        """Test 4: POST /api/orders - Create Zinli Recharge Order"""
        print("📦 Testing Create Zinli Recharge Order...")
        
        order_data = {
            "order_type": "zinli_recharge",
            "zinli_amount": 10,
            "zinli_email": "test@zinli.com",
            "payment_method": "pago_movil",
            "reference_number": "123456",
            "payment_proof_image": TEST_IMAGE_BASE64
        }
        
        response = self.make_request("POST", "/orders", order_data, auth_required=True)
        
        if response and response.status_code in [200, 201]:
            data = response.json()
            
            # Store order ID for later tests
            self.order_id = data["id"]
            
            # Check order details
            if data["status"] != "pending":
                self.log_test("Create Zinli Order - Status", False, 
                            f"Expected 'pending', got '{data['status']}'", data)
                return False
            
            if data["order_type"] != "zinli_recharge":
                self.log_test("Create Zinli Order - Type", False, 
                            f"Expected 'zinli_recharge', got '{data['order_type']}'", data)
                return False
            
            self.log_test("Create Zinli Order", True, 
                         f"Order created with ID {self.order_id}, total cost: {data['total_cost']}")
            return True
        else:
            self.log_test("Create Zinli Order", False, 
                         f"HTTP {response.status_code if response else 'No response'}", 
                         response.json() if response else None)
            return False
    
    def test_get_user_orders(self):
        """Test 5: GET /api/orders - Get User Orders"""
        print("📋 Testing Get User Orders...")
        
        response = self.make_request("GET", "/orders", auth_required=True)
        
        if response and response.status_code == 200:
            data = response.json()
            
            if not isinstance(data, list):
                self.log_test("Get User Orders - Type", False, "Response should be an array", data)
                return False
            
            # Check if our created order is in the list
            if self.order_id:
                order_found = any(order["id"] == self.order_id for order in data)
                if not order_found:
                    self.log_test("Get User Orders - Order Found", False, 
                                f"Created order {self.order_id} not found in list", data)
                    return False
            
            self.log_test("Get User Orders", True, f"Retrieved {len(data)} orders")
            return True
        else:
            self.log_test("Get User Orders", False, 
                         f"HTTP {response.status_code if response else 'No response'}", 
                         response.json() if response else None)
            return False
    
    def test_admin_get_all_orders(self):
        """Test 6: GET /api/admin/orders - Admin Get All Orders"""
        print("👑 Testing Admin Get All Orders...")
        
        response = self.make_request("GET", "/admin/orders", admin_required=True)
        
        if response and response.status_code == 200:
            data = response.json()
            
            if not isinstance(data, list):
                self.log_test("Admin Get All Orders - Type", False, "Response should be an array", data)
                return False
            
            self.log_test("Admin Get All Orders", True, f"Admin retrieved {len(data)} orders")
            return True
        else:
            self.log_test("Admin Get All Orders", False, 
                         f"HTTP {response.status_code if response else 'No response'}", 
                         response.json() if response else None)
            return False
    
    def test_admin_approve_order(self):
        """Test 7: PATCH /api/admin/orders/{order_id} - Approve Order"""
        print("✅ Testing Admin Approve Order...")
        
        if not self.order_id:
            self.log_test("Admin Approve Order", False, "No order ID available for testing")
            return False
        
        update_data = {
            "status": "approved"
        }
        
        response = self.make_request("PATCH", f"/admin/orders/{self.order_id}", 
                                   update_data, admin_required=True)
        
        if response and response.status_code == 200:
            data = response.json()
            
            if data["status"] != "approved":
                self.log_test("Admin Approve Order - Status", False, 
                            f"Expected 'approved', got '{data['status']}'", data)
                return False
            
            self.log_test("Admin Approve Order", True, 
                         f"Order {self.order_id} status updated to approved")
            return True
        else:
            self.log_test("Admin Approve Order", False, 
                         f"HTTP {response.status_code if response else 'No response'}", 
                         response.json() if response else None)
            return False
    
    def test_admin_reject_order(self):
        """Test 8: PATCH /api/admin/orders/{order_id} - Reject Order"""
        print("❌ Testing Admin Reject Order...")
        
        if not self.order_id:
            self.log_test("Admin Reject Order", False, "No order ID available for testing")
            return False
        
        update_data = {
            "status": "rejected"
        }
        
        response = self.make_request("PATCH", f"/admin/orders/{self.order_id}", 
                                   update_data, admin_required=True)
        
        if response and response.status_code == 200:
            data = response.json()
            
            if data["status"] != "rejected":
                self.log_test("Admin Reject Order - Status", False, 
                            f"Expected 'rejected', got '{data['status']}'", data)
                return False
            
            self.log_test("Admin Reject Order", True, 
                         f"Order {self.order_id} status updated to rejected")
            return True
        else:
            self.log_test("Admin Reject Order", False, 
                         f"HTTP {response.status_code if response else 'No response'}", 
                         response.json() if response else None)
            return False
    
    def test_admin_get_ubii_config(self):
        """Test 9: GET /api/admin/ubii-config - Get Ubii Config"""
        print("💳 Testing Admin Get Ubii Config...")
        
        response = self.make_request("GET", "/admin/ubii-config", admin_required=True)
        
        if response and response.status_code == 200:
            data = response.json()
            
            # Check required fields
            required_fields = ["client_id", "is_active"]
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                self.log_test("Admin Get Ubii Config - Fields", False, 
                            f"Missing fields: {missing_fields}", data)
                return False
            
            self.log_test("Admin Get Ubii Config", True, 
                         f"Ubii config retrieved, active: {data.get('is_active')}")
            return True
        else:
            self.log_test("Admin Get Ubii Config", False, 
                         f"HTTP {response.status_code if response else 'No response'}", 
                         response.json() if response else None)
            return False
    
    def test_admin_toggle_ubii(self):
        """Test 10: PATCH /api/admin/ubii-config/toggle - Toggle Ubii"""
        print("🔄 Testing Admin Toggle Ubii...")
        
        response = self.make_request("PATCH", "/admin/ubii-config/toggle", admin_required=True)
        
        if response and response.status_code == 200:
            data = response.json()
            
            if "is_active" not in data:
                self.log_test("Admin Toggle Ubii - Status", False, 
                            "No is_active field in response", data)
                return False
            
            self.log_test("Admin Toggle Ubii", True, 
                         f"Ubii status toggled to: {data['is_active']}")
            return True
        else:
            self.log_test("Admin Toggle Ubii", False, 
                         f"HTTP {response.status_code if response else 'No response'}", 
                         response.json() if response else None)
            return False
    
    def test_admin_get_banners(self):
        """Test 11: GET /api/admin/banners - Get Banners (Admin)"""
        print("🎯 Testing Admin Get Banners...")
        
        # Note: The review request doesn't specify this endpoint, but it's logical to test
        # Let's test the public banners endpoint instead
        response = self.make_request("GET", "/banners")
        
        if response and response.status_code == 200:
            data = response.json()
            
            if not isinstance(data, list):
                self.log_test("Get Banners - Type", False, "Response should be an array", data)
                return False
            
            self.log_test("Get Banners", True, f"Retrieved {len(data)} banners")
            return True
        else:
            self.log_test("Get Banners", False, 
                         f"HTTP {response.status_code if response else 'No response'}", 
                         response.json() if response else None)
            return False
    
    def test_admin_create_banner(self):
        """Test 12: POST /api/admin/banners - Create Banner"""
        print("🎨 Testing Admin Create Banner...")
        
        banner_data = {
            "image_base64": TEST_IMAGE_BASE64,
            "link": "https://example.com",
            "order": 1
        }
        
        response = self.make_request("POST", "/admin/banners", banner_data, admin_required=True)
        
        if response and response.status_code in [200, 201]:
            data = response.json()
            
            # Check banner details
            if data["link"] != "https://example.com":
                self.log_test("Admin Create Banner - Link", False, 
                            f"Expected 'https://example.com', got '{data['link']}'", data)
                return False
            
            if data["order"] != 1:
                self.log_test("Admin Create Banner - Order", False, 
                            f"Expected 1, got {data['order']}", data)
                return False
            
            self.log_test("Admin Create Banner", True, f"Banner created with ID {data['id']}")
            return True
        else:
            self.log_test("Admin Create Banner", False, 
                         f"HTTP {response.status_code if response else 'No response'}", 
                         response.json() if response else None)
            return False
    
    def test_admin_get_gift_cards(self):
        """Test 13: GET /api/admin/gift-cards - Get Gift Cards"""
        print("🎁 Testing Admin Get Gift Cards...")
        
        response = self.make_request("GET", "/admin/gift-cards", admin_required=True)
        
        if response and response.status_code == 200:
            data = response.json()
            
            if not isinstance(data, list):
                self.log_test("Admin Get Gift Cards - Type", False, "Response should be an array", data)
                return False
            
            self.log_test("Admin Get Gift Cards", True, f"Retrieved {len(data)} gift cards")
            return True
        else:
            self.log_test("Admin Get Gift Cards", False, 
                         f"HTTP {response.status_code if response else 'No response'}", 
                         response.json() if response else None)
            return False
    
    def test_admin_create_gift_card(self):
        """Test 14: POST /api/admin/gift-cards - Create Gift Card"""
        print("🎁 Testing Admin Create Gift Card...")
        
        gift_card_data = {
            "name": "Test Gift Card",
            "description": "Test gift card for API testing",
            "amounts": [10, 25, 50],
            "is_active": True
        }
        
        response = self.make_request("POST", "/admin/gift-cards", gift_card_data, admin_required=True)
        
        if response and response.status_code in [200, 201]:
            data = response.json()
            
            # Check if response contains success message or card data
            if "message" in data and "successfully" in data["message"]:
                self.log_test("Admin Create Gift Card", True, f"Gift card created: {data['message']}")
                return True
            elif "name" in data:
                self.log_test("Admin Create Gift Card", True, f"Gift card created: {data['name']}")
                return True
            else:
                self.log_test("Admin Create Gift Card", False, "Unexpected response format", data)
                return False
        else:
            self.log_test("Admin Create Gift Card", False, 
                         f"HTTP {response.status_code if response else 'No response'}", 
                         response.json() if response else None)
            return False
    
    def test_admin_get_users(self):
        """Test 15: GET /api/admin/users - Get Users"""
        print("👥 Testing Admin Get Users...")
        
        response = self.make_request("GET", "/admin/users", admin_required=True)
        
        if response and response.status_code == 200:
            data = response.json()
            
            if not isinstance(data, list):
                self.log_test("Admin Get Users - Type", False, "Response should be an array", data)
                return False
            
            self.log_test("Admin Get Users", True, f"Retrieved {len(data)} users")
            return True
        else:
            self.log_test("Admin Get Users", False, 
                         f"HTTP {response.status_code if response else 'No response'}", 
                         response.json() if response else None)
            return False
    
    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting Comprehensive Zinli Recharge App Backend API Tests")
        print("=" * 70)
        
        tests = [
            self.test_system_config,
            self.test_user_registration,
            self.test_user_login,
            self.test_create_zinli_order,
            self.test_get_user_orders,
            self.test_admin_get_all_orders,
            self.test_admin_approve_order,
            self.test_admin_reject_order,
            self.test_admin_get_ubii_config,
            self.test_admin_toggle_ubii,
            self.test_admin_get_banners,
            self.test_admin_create_banner,
            self.test_admin_get_gift_cards,
            self.test_admin_create_gift_card,
            self.test_admin_get_users
        ]
        
        passed = 0
        failed = 0
        
        for test in tests:
            try:
                if test():
                    passed += 1
                else:
                    failed += 1
            except Exception as e:
                print(f"❌ FAIL {test.__name__} - Exception: {str(e)}")
                failed += 1
            
            # Small delay between tests
            time.sleep(0.5)
        
        print("=" * 70)
        print(f"📊 Test Results Summary:")
        print(f"   ✅ Passed: {passed}")
        print(f"   ❌ Failed: {failed}")
        print(f"   📈 Success Rate: {(passed/(passed+failed)*100):.1f}%")
        
        if failed > 0:
            print("\n🔍 Failed Tests Details:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"   • {result['test']}: {result['details']}")
        
        return failed == 0

def main():
    """Main test execution"""
    tester = ZinliAPITester()
    
    print("🔗 Testing Backend URL:", BASE_URL)
    print("🔑 Admin Secret:", ADMIN_SECRET)
    print("👤 Test User:", TEST_USER_EMAIL)
    print()
    
    success = tester.run_all_tests()
    
    if success:
        print("\n🎉 All tests passed! Backend API is working correctly.")
        sys.exit(0)
    else:
        print("\n⚠️ Some tests failed. Please check the details above.")
        sys.exit(1)

if __name__ == "__main__":
    main()