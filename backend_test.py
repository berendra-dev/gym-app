#!/usr/bin/env python3
"""
Comprehensive test suite for unified attendance API
Tests POST /api/attendance, GET /api/attendance, DELETE /api/attendance, and POST /api/public/checkin
"""

import requests
import json
from datetime import datetime, timedelta
import sys

# Configuration
BASE_URL = "https://gym-saas-platform-3.preview.emergentagent.com"
FIREBASE_API_KEY = "AIzaSyAVS_QA115NS_8jyXxiApZzEjMoOQqmafA"

# Test credentials
SUPER_ADMIN = {"email": "berendrakumarprasad236@gmail.com", "password": "Gymtain@2025"}
GYM_OWNER = {"email": "berendrakumarprasad@gmail.com", "password": "Owner@2025"}
RECEPTIONIST = {"email": "deepak@gmail.com", "password": "Staff@2025"}

# Global variables for test data
tokens = {}
test_gym_id = None
test_member_id = None
test_member_phone = None
expired_member_id = None

def get_firebase_token(email, password):
    """Get Firebase ID token using email/password"""
    url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={FIREBASE_API_KEY}"
    payload = {
        "email": email,
        "password": password,
        "returnSecureToken": True
    }
    try:
        response = requests.post(url, json=payload)
        if response.status_code == 200:
            data = response.json()
            return data.get('idToken')
        else:
            print(f"❌ Failed to get token for {email}: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"❌ Exception getting token for {email}: {str(e)}")
        return None

def setup_tokens():
    """Get tokens for all test users"""
    global tokens
    print("\n=== Setting up authentication tokens ===")
    
    tokens['super_admin'] = get_firebase_token(SUPER_ADMIN['email'], SUPER_ADMIN['password'])
    tokens['gym_owner'] = get_firebase_token(GYM_OWNER['email'], GYM_OWNER['password'])
    tokens['receptionist'] = get_firebase_token(RECEPTIONIST['email'], RECEPTIONIST['password'])
    
    if tokens['super_admin']:
        print("✅ Super admin token obtained")
    if tokens['gym_owner']:
        print("✅ Gym owner token obtained")
    if tokens['receptionist']:
        print("✅ Receptionist token obtained")
    
    if not any(tokens.values()):
        print("❌ CRITICAL: No tokens obtained. Cannot proceed with tests.")
        return False
    return True

def get_test_data():
    """Fetch test gym and member data from Firestore"""
    global test_gym_id, test_member_id, test_member_phone, expired_member_id
    print("\n=== Fetching test data from Firestore ===")
    
    # We need to use the admin SDK or API to get test data
    # For now, let's try to get data via the API if available
    # Otherwise, we'll use hardcoded test data
    
    # Try to get gym data using gym_owner token
    if tokens.get('gym_owner'):
        headers = {'Authorization': f"Bearer {tokens['gym_owner']}"}
        try:
            # Try to get user profile to find gymId
            response = requests.get(f"{BASE_URL}/api/admin/users/me", headers=headers)
            if response.status_code == 200:
                profile = response.json()
                test_gym_id = profile.get('gymId')
                print(f"✅ Found gym ID: {test_gym_id}")
        except Exception as e:
            print(f"⚠️  Could not fetch gym data: {str(e)}")
    
    # If we couldn't get real data, we'll need to create test members or use existing ones
    # For now, let's proceed with the tests and handle missing data gracefully
    print("⚠️  Note: Some tests may require manual setup of test members")
    return True

def test_post_attendance_validation():
    """Test POST /api/attendance validation errors"""
    print("\n=== Testing POST /api/attendance - Validation ===")
    
    # Test 1: Missing required fields
    print("\n1. Testing missing required fields...")
    test_cases = [
        ({}, "empty body"),
        ({"gymId": "test"}, "missing memberId, date, via"),
        ({"gymId": "test", "memberId": "test"}, "missing date, via"),
        ({"gymId": "test", "memberId": "test", "date": "2024-01-01"}, "missing via"),
    ]
    
    for payload, description in test_cases:
        try:
            response = requests.post(f"{BASE_URL}/api/attendance", json=payload)
            if response.status_code == 400:
                data = response.json()
                if data.get('code') == 'INVALID_INPUT':
                    print(f"   ✅ {description}: Got 400 with INVALID_INPUT")
                else:
                    print(f"   ⚠️  {description}: Got 400 but wrong code: {data.get('code')}")
            else:
                print(f"   ❌ {description}: Expected 400, got {response.status_code}")
        except Exception as e:
            print(f"   ❌ {description}: Exception - {str(e)}")
    
    # Test 2: Invalid via value
    print("\n2. Testing invalid via value...")
    payload = {"gymId": "test", "memberId": "test", "date": "2024-01-01", "via": "invalid"}
    try:
        response = requests.post(f"{BASE_URL}/api/attendance", json=payload)
        if response.status_code == 400:
            print(f"   ✅ Invalid via: Got 400")
        else:
            print(f"   ❌ Invalid via: Expected 400, got {response.status_code}")
    except Exception as e:
        print(f"   ❌ Invalid via: Exception - {str(e)}")
    
    # Test 3: Invalid date format
    print("\n3. Testing invalid date format...")
    invalid_dates = ["2024/01/01", "01-01-2024", "2024-1-1", "invalid"]
    for date in invalid_dates:
        payload = {"gymId": "test", "memberId": "test", "date": date, "via": "qr"}
        try:
            response = requests.post(f"{BASE_URL}/api/attendance", json=payload)
            if response.status_code == 400:
                print(f"   ✅ Invalid date '{date}': Got 400")
            else:
                print(f"   ⚠️  Invalid date '{date}': Expected 400, got {response.status_code}")
        except Exception as e:
            print(f"   ❌ Invalid date '{date}': Exception - {str(e)}")

def test_post_attendance_member_not_found():
    """Test POST /api/attendance with non-existent member"""
    print("\n=== Testing POST /api/attendance - Member Not Found ===")
    
    payload = {
        "gymId": "nonexistent-gym",
        "memberId": "nonexistent-member",
        "date": datetime.now().strftime("%Y-%m-%d"),
        "via": "qr"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/attendance", json=payload)
        if response.status_code == 404:
            data = response.json()
            if data.get('code') == 'NOT_FOUND':
                print("✅ Non-existent member: Got 404 with NOT_FOUND code")
            else:
                print(f"⚠️  Non-existent member: Got 404 but wrong code: {data.get('code')}")
        else:
            print(f"❌ Non-existent member: Expected 404, got {response.status_code}")
    except Exception as e:
        print(f"❌ Non-existent member: Exception - {str(e)}")

def test_post_attendance_manual_auth():
    """Test POST /api/attendance manual via auth requirements"""
    print("\n=== Testing POST /api/attendance - Manual Via Auth ===")
    
    # Test 1: Manual via without token
    print("\n1. Testing manual via without auth token...")
    payload = {
        "gymId": "test-gym",
        "memberId": "test-member",
        "date": datetime.now().strftime("%Y-%m-%d"),
        "via": "manual"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/attendance", json=payload)
        if response.status_code == 401:
            print("✅ Manual without token: Got 401 unauthorized")
        else:
            print(f"❌ Manual without token: Expected 401, got {response.status_code}")
    except Exception as e:
        print(f"❌ Manual without token: Exception - {str(e)}")
    
    # Test 2: QR via (should work without token for validation phase)
    print("\n2. Testing QR via without auth token (validation only)...")
    payload["via"] = "qr"
    try:
        response = requests.post(f"{BASE_URL}/api/attendance", json=payload)
        # Should get 404 (member not found) not 401 (unauthorized)
        if response.status_code in [404, 403]:
            print(f"✅ QR without token: Got {response.status_code} (not 401, so auth not required)")
        else:
            print(f"⚠️  QR without token: Got {response.status_code}")
    except Exception as e:
        print(f"❌ QR without token: Exception - {str(e)}")

def test_get_attendance_auth():
    """Test GET /api/attendance auth requirements"""
    print("\n=== Testing GET /api/attendance - Auth Requirements ===")
    
    # Test 1: GET without token
    print("\n1. Testing GET without auth token...")
    try:
        response = requests.get(f"{BASE_URL}/api/attendance?gymId=test-gym")
        if response.status_code == 401:
            print("✅ GET without token: Got 401 unauthorized")
        else:
            print(f"❌ GET without token: Expected 401, got {response.status_code}")
    except Exception as e:
        print(f"❌ GET without token: Exception - {str(e)}")
    
    # Test 2: GET without gymId
    print("\n2. Testing GET without gymId...")
    if tokens.get('gym_owner'):
        headers = {'Authorization': f"Bearer {tokens['gym_owner']}"}
        try:
            response = requests.get(f"{BASE_URL}/api/attendance", headers=headers)
            if response.status_code == 400:
                print("✅ GET without gymId: Got 400")
            else:
                print(f"❌ GET without gymId: Expected 400, got {response.status_code}")
        except Exception as e:
            print(f"❌ GET without gymId: Exception - {str(e)}")

def test_delete_attendance_auth():
    """Test DELETE /api/attendance auth requirements"""
    print("\n=== Testing DELETE /api/attendance - Auth Requirements ===")
    
    # Test 1: DELETE without token
    print("\n1. Testing DELETE without auth token...")
    try:
        response = requests.delete(f"{BASE_URL}/api/attendance?gymId=test&memberId=test&date=2024-01-01")
        if response.status_code == 401:
            print("✅ DELETE without token: Got 401 unauthorized")
        else:
            print(f"❌ DELETE without token: Expected 401, got {response.status_code}")
    except Exception as e:
        print(f"❌ DELETE without token: Exception - {str(e)}")
    
    # Test 2: DELETE without required params
    print("\n2. Testing DELETE without required params...")
    if tokens.get('gym_owner'):
        headers = {'Authorization': f"Bearer {tokens['gym_owner']}"}
        try:
            response = requests.delete(f"{BASE_URL}/api/attendance?gymId=test", headers=headers)
            if response.status_code == 400:
                print("✅ DELETE without memberId/date: Got 400")
            else:
                print(f"❌ DELETE without memberId/date: Expected 400, got {response.status_code}")
        except Exception as e:
            print(f"❌ DELETE without memberId/date: Exception - {str(e)}")

def test_public_checkin_validation():
    """Test POST /api/public/checkin validation"""
    print("\n=== Testing POST /api/public/checkin - Validation ===")
    
    # Test 1: Missing required fields
    print("\n1. Testing missing required fields...")
    test_cases = [
        ({}, "empty body"),
        ({"gymId": "test"}, "missing phone and memberId"),
    ]
    
    for payload, description in test_cases:
        try:
            response = requests.post(f"{BASE_URL}/api/public/checkin", json=payload)
            if response.status_code == 400:
                print(f"   ✅ {description}: Got 400")
            else:
                print(f"   ❌ {description}: Expected 400, got {response.status_code}")
        except Exception as e:
            print(f"   ❌ {description}: Exception - {str(e)}")
    
    # Test 2: Non-existent gym
    print("\n2. Testing non-existent gym...")
    payload = {"gymId": "nonexistent-gym-12345", "phone": "1234567890"}
    try:
        response = requests.post(f"{BASE_URL}/api/public/checkin", json=payload)
        if response.status_code == 404:
            print("✅ Non-existent gym: Got 404")
        else:
            print(f"⚠️  Non-existent gym: Expected 404, got {response.status_code}")
    except Exception as e:
        print(f"❌ Non-existent gym: Exception - {str(e)}")

def test_api_health():
    """Test API health endpoint"""
    print("\n=== Testing API Health ===")
    try:
        response = requests.get(f"{BASE_URL}/api/health")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Health check passed: {json.dumps(data, indent=2)}")
            return True
        else:
            print(f"❌ Health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Health check exception: {str(e)}")
        return False

def run_all_tests():
    """Run all test suites"""
    print("=" * 80)
    print("UNIFIED ATTENDANCE API TEST SUITE")
    print("=" * 80)
    
    # Check API health first
    if not test_api_health():
        print("\n❌ CRITICAL: API health check failed. Aborting tests.")
        return False
    
    # Setup authentication
    if not setup_tokens():
        print("\n❌ CRITICAL: Failed to setup authentication tokens. Aborting tests.")
        return False
    
    # Get test data
    get_test_data()
    
    # Run test suites
    try:
        test_post_attendance_validation()
        test_post_attendance_member_not_found()
        test_post_attendance_manual_auth()
        test_get_attendance_auth()
        test_delete_attendance_auth()
        test_public_checkin_validation()
        
        print("\n" + "=" * 80)
        print("TEST SUITE COMPLETED")
        print("=" * 80)
        print("\n⚠️  NOTE: Full end-to-end tests require:")
        print("   - Active gym with known gymId")
        print("   - Active member with known memberId")
        print("   - Expired member for expiry testing")
        print("   - These can be created via the UI or admin API")
        
        return True
    except Exception as e:
        print(f"\n❌ CRITICAL ERROR during test execution: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
