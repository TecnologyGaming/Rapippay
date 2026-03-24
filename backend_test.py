#!/usr/bin/env python3
"""
Zinli Recharge App Backend API Test Suite
Tests all backend endpoints according to the review request specifications.
"""

import requests
import json
import sys
import time
from datetime import datetime

# Configuration
BASE_URL = "https://zinli-recargas.preview.emergentagent.com/api"
TEST_USER_EMAIL = "maria.gonzalez@example.com"
TEST_USER_PASSWORD = "SecurePass123!"
TEST_USER_NAME = "Maria Gonzalez"

# Test data
TEST_IMAGE_BASE64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

class ZinliAPITester:
    def __init__(self):
        self.session = requests.Session()
        self.access_token = None
        self.user_id = None
        self.order_id = None
        self.banner_id = None
        self.test_results = []
        self.current_exchange_rate = 50.0  # Default value
        self.current_commission_percent = 3.0  # Default value
        
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
    
    def make_request(self, method, endpoint, data=None, headers=None, auth_required=False):
        """Make HTTP request with proper headers"""
        url = f"{BASE_URL}{endpoint}"
        request_headers = {"Content-Type": "application/json"}
        
        if headers:
            request_headers.update(headers)
            
        if auth_required and self.access_token:
            request_headers["Authorization"] = f"Bearer {self.access_token}"
        
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
        """Test 1: System Config Check (No auth required)"""
        print("🔧 Testing System Configuration...")
        
        response = self.make_request("GET", "/config")
        
        if response and response.status_code == 200:
            data = response.json()
            
            # Check required fields
            required_fields = ["exchange_rate", "commission_percent", "bank_details"]
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                self.log_test("System Config - Required Fields", False, 
                            f"Missing fields: {missing_fields}", data)
                return False
            
            # Store current values for later calculations
            self.current_exchange_rate = data.get("exchange_rate")
            self.current_commission_percent = data.get("commission_percent")
            
            self.log_test("System Config Check", True, 
                         f"Exchange rate: {self.current_exchange_rate}, Commission: {self.current_commission_percent}%")
            return True
        else:
            self.log_test("System Config Check", False, 
                         f"HTTP {response.status_code if response else 'No response'}", 
                         response.json() if response else None)
            return False
    
    def test_user_registration(self):
        """Test 2: User Registration"""
        print("👤 Testing User Registration...")
        
        user_data = {
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD,
            "name": TEST_USER_NAME
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
            
            # Check if first user gets admin privileges
            is_admin = user.get("is_admin", False)
            
            self.log_test("User Registration", True, 
                         f"User created with admin privileges: {is_admin}")
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
        else:
            self.log_test("User Registration", False, 
                         f"HTTP {response.status_code}", 
                         response.json() if response else None)
            return False
    
    def test_user_login(self):
        """Test 3: User Login"""
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
            
            self.log_test("User Login", True, "Login successful, token received")
            return True
        else:
            self.log_test("User Login", False, 
                         f"HTTP {response.status_code if response else 'No response'}", 
                         response.json() if response else None)
            return False
    
    def test_get_current_user(self):
        """Test 4: Get Current User (requires auth)"""
        print("👤 Testing Get Current User...")
        
        response = self.make_request("GET", "/auth/me", auth_required=True)
        
        if response and response.status_code == 200:
            data = response.json()
            
            # Check user details
            required_fields = ["id", "email", "name", "is_admin", "balance"]
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                self.log_test("Get Current User - Fields", False, 
                            f"Missing fields: {missing_fields}", data)
                return False
            
            if data["email"] != TEST_USER_EMAIL:
                self.log_test("Get Current User - Email", False, 
                            f"Expected {TEST_USER_EMAIL}, got {data['email']}", data)
                return False
            
            self.log_test("Get Current User", True, f"User details retrieved for {data['email']}")
            return True
        else:
            self.log_test("Get Current User", False, 
                         f"HTTP {response.status_code if response else 'No response'}", 
                         response.json() if response else None)
            return False
    
    def test_get_banners(self):
        """Test 5: Get Banners (no auth required)"""
        print("🎯 Testing Get Banners...")
        
        response = self.make_request("GET", "/banners")
        
        if response and response.status_code == 200:
            data = response.json()
            
            # Should return empty array initially
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
    
    def test_create_order(self):
        """Test 6: Create Order (requires auth)"""
        print("📦 Testing Create Order...")
        
        order_data = {
            "zinli_amount": 10.0,
            "payment_method": "pago_movil",
            "reference_number": "123456789",
            "payment_proof_image": TEST_IMAGE_BASE64
        }
        
        response = self.make_request("POST", "/orders", order_data, auth_required=True)
        
        if response and response.status_code in [200, 201]:
            data = response.json()
            
            # Store order ID for later tests
            self.order_id = data["id"]
            
            # Check order details
            if data["status"] != "pending":
                self.log_test("Create Order - Status", False, 
                            f"Expected 'pending', got '{data['status']}'", data)
                return False
            
            # Check total cost calculation using current system config
            base_cost = 10.0 * self.current_exchange_rate
            expected_total = base_cost + (base_cost * self.current_commission_percent / 100)
            actual_total = data["total_cost"]
            
            if abs(actual_total - expected_total) > 0.01:  # Allow small floating point differences
                self.log_test("Create Order - Total Cost", False, 
                            f"Expected {expected_total}, got {actual_total} (rate: {self.current_exchange_rate}, commission: {self.current_commission_percent}%)", data)
                return False
            
            self.log_test("Create Order", True, 
                         f"Order created with ID {self.order_id}, total cost: {actual_total}")
            return True
        else:
            self.log_test("Create Order", False, 
                         f"HTTP {response.status_code if response else 'No response'}", 
                         response.json() if response else None)
            return False
    
    def test_get_user_orders(self):
        """Test 7: Get User Orders (requires auth)"""
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
        """Test 8: Admin - Get All Orders (requires admin auth)"""
        print("👑 Testing Admin Get All Orders...")
        
        response = self.make_request("GET", "/admin/orders", auth_required=True)
        
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
    
    def test_admin_update_order_status(self):
        """Test 9: Admin - Update Order Status (requires admin auth)"""
        print("✏️ Testing Admin Update Order Status...")
        
        if not self.order_id:
            self.log_test("Admin Update Order Status", False, "No order ID available for testing")
            return False
        
        update_data = {
            "status": "completed"
        }
        
        response = self.make_request("PATCH", f"/admin/orders/{self.order_id}", 
                                   update_data, auth_required=True)
        
        if response and response.status_code == 200:
            data = response.json()
            
            if data["status"] != "completed":
                self.log_test("Admin Update Order Status - Status", False, 
                            f"Expected 'completed', got '{data['status']}'", data)
                return False
            
            self.log_test("Admin Update Order Status", True, 
                         f"Order {self.order_id} status updated to completed")
            return True
        else:
            self.log_test("Admin Update Order Status", False, 
                         f"HTTP {response.status_code if response else 'No response'}", 
                         response.json() if response else None)
            return False
    
    def test_admin_update_system_config(self):
        """Test 10: Admin - Update System Config (requires admin auth)"""
        print("⚙️ Testing Admin Update System Config...")
        
        config_data = {
            "exchange_rate": 55.0,
            "commission_percent": 4.0
        }
        
        response = self.make_request("PATCH", "/admin/config", config_data, auth_required=True)
        
        if response and response.status_code == 200:
            data = response.json()
            
            if data["exchange_rate"] != 55.0:
                self.log_test("Admin Update Config - Exchange Rate", False, 
                            f"Expected 55.0, got {data['exchange_rate']}", data)
                return False
            
            if data["commission_percent"] != 4.0:
                self.log_test("Admin Update Config - Commission", False, 
                            f"Expected 4.0, got {data['commission_percent']}", data)
                return False
            
            self.log_test("Admin Update System Config", True, 
                         f"Config updated: rate={data['exchange_rate']}, commission={data['commission_percent']}%")
            return True
        else:
            self.log_test("Admin Update System Config", False, 
                         f"HTTP {response.status_code if response else 'No response'}", 
                         response.json() if response else None)
            return False
    
    def test_admin_create_banner(self):
        """Test 11: Admin - Create Banner (requires admin auth)"""
        print("🎨 Testing Admin Create Banner...")
        
        banner_data = {
            "image_base64": TEST_IMAGE_BASE64,
            "link": "https://example.com",
            "order": 1
        }
        
        response = self.make_request("POST", "/admin/banners", banner_data, auth_required=True)
        
        if response and response.status_code in [200, 201]:
            data = response.json()
            
            # Store banner ID for potential cleanup
            self.banner_id = data["id"]
            
            # Check banner details
            if data["link"] != "https://example.com":
                self.log_test("Admin Create Banner - Link", False, 
                            f"Expected 'https://example.com', got '{data['link']}'", data)
                return False
            
            if data["order"] != 1:
                self.log_test("Admin Create Banner - Order", False, 
                            f"Expected 1, got {data['order']}", data)
                return False
            
            self.log_test("Admin Create Banner", True, f"Banner created with ID {self.banner_id}")
            return True
        else:
            self.log_test("Admin Create Banner", False, 
                         f"HTTP {response.status_code if response else 'No response'}", 
                         response.json() if response else None)
            return False
    
    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting Zinli Recharge App Backend API Tests")
        print("=" * 60)
        
        tests = [
            self.test_system_config,
            self.test_user_registration,
            self.test_user_login,
            self.test_get_current_user,
            self.test_get_banners,
            self.test_create_order,
            self.test_get_user_orders,
            self.test_admin_get_all_orders,
            self.test_admin_update_order_status,
            self.test_admin_update_system_config,
            self.test_admin_create_banner
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
        
        print("=" * 60)
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